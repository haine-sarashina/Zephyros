// Ollama API 通信サービス (堅牢なストリームバッファリング & オプション設定)

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export class OllamaService {
  /**
   * Ollama サーバーの稼働状態確認と利用可能モデルの取得
   */
  static async getModels(baseUrl: string = 'http://localhost:11434'): Promise<OllamaModelInfo[]> {
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
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
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
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
      console.error('Ollama chat error:', error);
      throw error;
    }
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
    const response = await fetch(`${baseUrl}/api/chat`, {
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama Stream Error (${response.status}): ${errText}`);
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
      // 最後の要素は不完全な行の可能性があるためバッファに保持
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
          // パース失敗した不完全行は無視
        }
      }
    }

    // 残存バッファの最後の処理
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
