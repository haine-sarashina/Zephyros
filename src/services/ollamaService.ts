// Ollama API 通信サービス (Tauri Rust プロキシ、CORS回避 & 行バッファ処理付き)

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface OllamaModelInfo {
  name: string;
  size: number;
  digest?: string;
  modified_at?: string;
}

export class OllamaService {
  /**
   * Tauri 環境かどうかの判定
   */
  private static isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  /**
   * Ollama サーバーの稼働状態確認 (/api/version または /api/tags 死活判定)
   */
  static async isServerConnected(baseUrl: string = 'http://localhost:11434'): Promise<boolean> {
    try {
      const models = await this.getModels(baseUrl);
      if (models.length > 0) return true;
    } catch {}

    // フェッチフォールバック
    const cleanUrl = baseUrl ? baseUrl.trim().replace(/\/+$/, '') : 'http://localhost:11434';
    const endpoints = [
      `${cleanUrl}/api/version`,
      cleanUrl.includes('localhost') ? `${cleanUrl.replace('localhost', '127.0.0.1')}/api/version` : `${cleanUrl.replace('127.0.0.1', 'localhost')}/api/version`
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (res.ok) return true;
      } catch {}
    }

    return false;
  }

  /**
   * 利用可能モデルの取得 (Rust プロキシ優先)
   */
  static async getModels(baseUrl: string = 'http://localhost:11434'): Promise<OllamaModelInfo[]> {
    if (this.isTauriAvailable()) {
      try {
        const rawJson = await invoke<string>('ollama_get_models', { url: baseUrl });
        const parsed = JSON.parse(rawJson);
        return parsed.models || [];
      } catch (e) {
        console.warn('Tauri invoke ollama_get_models failed, falling back to browser fetch:', e);
      }
    }

    // ブラウザモード / フォールバック
    const cleanUrl = baseUrl ? baseUrl.trim().replace(/\/+$/, '') : 'http://localhost:11434';
    const endpoints = [
      `${cleanUrl}/api/tags`,
      cleanUrl.includes('localhost') ? `${cleanUrl.replace('localhost', '127.0.0.1')}/api/tags` : `${cleanUrl.replace('127.0.0.1', 'localhost')}/api/tags`
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep);
        if (res.ok) {
          const data = await res.json();
          return data.models || [];
        }
      } catch {}
    }
    return [];
  }

  /**
   * 単発テキスト生成 (/api/chat) (Rust プロキシ優先)
   */
  static async chat(
    baseUrl: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7,
    signal?: AbortSignal,
    formatJson: boolean = false,
    aiOptions?: { thinkMode?: 'nothink' | 'think' | 'none'; keepAlive?: string }
  ): Promise<string> {
    const thinkMode = aiOptions?.thinkMode ?? 'nothink';
    const keepAlive = aiOptions?.keepAlive ?? '-1';

    let finalSystem = systemPrompt || '';
    if (thinkMode === 'nothink' && !finalSystem.startsWith('/nothink')) {
      finalSystem = `/nothink\n${finalSystem}`;
    } else if (thinkMode === 'think' && !finalSystem.startsWith('/think')) {
      finalSystem = `/think\n${finalSystem}`;
    }

    const bodyObj = {
      model,
      messages: [
        { role: 'system', content: finalSystem },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      keep_alive: keepAlive,
      ...(formatJson ? { format: 'json' } : {}),
      options: {
        temperature,
        num_ctx: 32768,
        num_predict: 16384,
      }
    };

    if (this.isTauriAvailable()) {
      try {
        const rawRes = await invoke<string>('ollama_chat_raw', {
          url: baseUrl,
          body: JSON.stringify(bodyObj)
        });
        const parsed = JSON.parse(rawRes);
        return parsed.message?.content || '';
      } catch (e) {
        console.warn('Tauri invoke ollama_chat_raw failed, falling back to fetch:', e);
      }
    }

    // ブラウザフェッチフォールバック
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama Chat Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }

  /**
   * ストリーミングテキスト生成 (/api/chat) (Rust プロキシ優先)
   */
  static async chatStream(
    baseUrl: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    onChunk: (chunk: string) => void,
    temperature: number = 0.7,
    signal?: AbortSignal,
    formatJson: boolean = false,
    aiOptions?: { thinkMode?: 'nothink' | 'think' | 'none'; keepAlive?: string }
  ): Promise<string> {
    const thinkMode = aiOptions?.thinkMode ?? 'nothink';
    const keepAlive = aiOptions?.keepAlive ?? '-1';

    let finalSystem = systemPrompt || '';
    if (thinkMode === 'nothink' && !finalSystem.startsWith('/nothink')) {
      finalSystem = `/nothink\n${finalSystem}`;
    } else if (thinkMode === 'think' && !finalSystem.startsWith('/think')) {
      finalSystem = `/think\n${finalSystem}`;
    }

    const bodyObj = {
      model,
      messages: [
        { role: 'system', content: finalSystem },
        { role: 'user', content: userPrompt }
      ],
      stream: true,
      keep_alive: keepAlive,
      ...(formatJson ? { format: 'json' } : {}),
      options: {
        temperature,
        num_ctx: 32768,
        num_predict: 16384,
      }
    };

    if (this.isTauriAvailable()) {
      const channelId = `ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let unlisten: (() => void) | null = null;
      try {
        unlisten = await listen<string>(`ollama-chunk-${channelId}`, (event) => {
          if (event.payload) {
            onChunk(event.payload);
          }
        });

        const fullText = await invoke<string>('ollama_chat_stream_raw', {
          channelId,
          url: baseUrl,
          body: JSON.stringify(bodyObj)
        });

        return fullText;
      } catch (e) {
        console.warn('Tauri invoke ollama_chat_stream_raw failed, falling back to fetch:', e);
      } finally {
        if (unlisten) unlisten();
      }
    }

    // ブラウザフェッチフォールバック
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const response = await fetch(`${cleanUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
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
      } catch {}
    }

    return fullContent;
  }
}
