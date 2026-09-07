// Ollama API 通信サービス (堅牢なストリームバッファリング、IPv4/IPv6フォールバック & オプション設定)

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export class OllamaService {
  /**
   * エンドポイントURLの正規化ヘルパー (末尾スラスラ除去 & http:// 補填)
   */
  static cleanUrl(baseUrl: string = 'http://localhost:11434'): string {
    if (!baseUrl || !baseUrl.trim()) return 'http://localhost:11434';
    let url = baseUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(url)) {
      url = `http://${url}`;
    }
    return url;
  }

  /**
   * localhost / 127.0.0.1 の互換フォールバックURLリストの生成
   */
  static getFallbackUrls(baseUrl: string): string[] {
    const primary = this.cleanUrl(baseUrl);
    const urls = [primary];
    if (primary.includes('localhost')) {
      urls.push(primary.replace('localhost', '127.0.0.1'));
    } else if (primary.includes('127.0.0.1')) {
      urls.push(primary.replace('127.0.0.1', 'localhost'));
    }
    return urls;
  }

  /**
   * Ollama サーバーとの接続状態確認 (/api/version または /api/tags の死活監視)
   */
  static async isServerConnected(baseUrl: string = 'http://localhost:11434'): Promise<boolean> {
    const urls = this.getFallbackUrls(baseUrl);
    for (const url of urls) {
      try {
        const response = await fetch(`${url}/api/version`);
        if (response.ok) return true;
      } catch {}
      try {
        const response = await fetch(`${url}/api/tags`);
        if (response.ok) return true;
      } catch {}
    }
    return false;
  }

  /**
   * Ollama サーバーの利用可能モデル一覧の取得
   */
  static async getModels(baseUrl: string = 'http://localhost:11434'): Promise<OllamaModelInfo[]> {
    const urls = this.getFallbackUrls(baseUrl);
    for (const url of urls) {
      try {
        const response = await fetch(`${url}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          return data.models || [];
        }
      } catch (error) {
        console.warn(`Failed to fetch Ollama models from ${url}:`, error);
      }
    }
    return [];
  }

  /**
   * 単発テキスト生成 (/api/chat)
   */
  static async chat(
    baseUrl: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7,
    signal?: AbortSignal,
    formatJson: boolean = false
  ): Promise<string> {
    const urls = this.getFallbackUrls(baseUrl);
    let lastError: any = null;

    for (const url of urls) {
      try {
        const response = await fetch(`${url}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            stream: false,
            ...(formatJson ? { format: 'json' } : {}),
            options: {
              temperature,
              num_ctx: 16384,
              num_predict: 8192,
            }
          }),
          signal
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Ollama Chat Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        return data.message?.content || '';
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Ollama サーバーへの接続に失敗しました。');
  }

  /**
   * ストリーミングテキスト生成 (/api/chat) - 行バッファ処理付き
   */
  static async chatStream(
    baseUrl: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7,
    signal?: AbortSignal,
    formatJson: boolean = false
  ): Promise<string> {
    const urls = this.getFallbackUrls(baseUrl);
    let response: Response | null = null;
    let lastError: any = null;

    for (const url of urls) {
      try {
        const res = await fetch(`${url}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            stream: true,
            ...(formatJson ? { format: 'json' } : {}),
            options: {
              temperature,
              num_ctx: 16384,
              num_predict: 8192,
            }
          }),
          signal
        });

        if (res.ok) {
          response = res;
          break;
        } else {
          const errText = await res.text();
          throw new Error(`Ollama Stream Error (${res.status}): ${errText}`);
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!response) {
      throw lastError || new Error('Ollama サーバーへの接続に失敗しました。');
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullContent = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.message?.content) {
            const text = parsed.message.content;
            fullContent += text;
            onChunk(text);
          }
        } catch {
          // 不完全行は無視
        }
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        if (parsed.message?.content) {
          const text = parsed.message.content;
          fullContent += text;
          onChunk(text);
        }
      } catch {
        // 無視
      }
    }

    return fullContent;
  }
}
