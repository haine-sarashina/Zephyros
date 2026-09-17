import React, { useState } from 'react';
import { Terminal, FileCode, Sparkles, Copy, Check, X } from 'lucide-react';

export interface OllamaLogEntry {
  id: string;
  timestamp: string;
  model: string;
  role: 'writer' | 'editor' | 'extractor' | 'gacha';
  systemPrompt: string;
  userPrompt: string;
  rawResponse: string;
  parsedResponse?: any;
}

interface OllamaLogViewerProps {
  logs: OllamaLogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

export const OllamaLogViewer: React.FC<OllamaLogViewerProps> = ({ logs, isOpen, onClose }) => {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(logs[logs.length - 1]?.id || null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentLog = logs.find((l) => l.id === selectedLogId) || logs[logs.length - 1];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Ollama 通信ログ ＆ Markdown可視化ビューア
              </h2>
              <p className="text-xs text-slate-400">
                AIへの入力プロンプトと生のJSON/テキスト応答のリアルタイム検証
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Log List */}
          <div className="w-64 border-r border-slate-800 bg-slate-950/50 overflow-y-auto p-2 space-y-1">
            <div className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">
              通信履歴 ({logs.length}件)
            </div>
            {logs.length === 0 ? (
              <div className="p-4 text-xs text-slate-500 text-center">通信ログがありません</div>
            ) : (
              logs.map((log) => {
                const isSelected = log.id === (currentLog?.id);
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={`w-full text-left p-3 rounded-lg text-xs transition flex flex-col gap-1 border ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                          log.role === 'editor'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : log.role === 'writer'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {log.role}
                      </span>
                    </div>
                    <div className="font-medium truncate text-slate-200">{log.model}</div>
                  </button>
                );
              })
            )}
          </div>

          {/* Main Detail View */}
          {currentLog ? (
            <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
              {/* Log Metadata Header */}
              <div className="flex items-center justify-between bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
                <div className="flex items-center space-x-4 text-xs">
                  <div>
                    <span className="text-slate-400">モデル:</span>{' '}
                    <span className="font-mono font-bold text-indigo-300">{currentLog.model}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">役割:</span>{' '}
                    <span className="font-semibold text-slate-200 uppercase">{currentLog.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">時刻:</span>{' '}
                    <span className="font-mono text-slate-300">{currentLog.timestamp}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(currentLog.rawResponse, 'raw')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded border border-slate-600 transition"
                >
                  {copiedId === 'raw' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>生の応答をコピー</span>
                </button>
              </div>

              {/* Prompts Section */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <FileCode className="w-4 h-4 text-slate-400" />
                    送信システムプロンプト (System Prompt)
                  </label>
                  <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800 whitespace-pre-wrap max-h-40">
                    {currentLog.systemPrompt}
                  </pre>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5">
                    <FileCode className="w-4 h-4 text-slate-400" />
                    ユーザープロンプト (User Prompt)
                  </label>
                  <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto border border-slate-800 whitespace-pre-wrap max-h-48">
                    {currentLog.userPrompt}
                  </pre>
                </div>
              </div>

              {/* Response Section */}
              <div>
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Ollama 生応答 (Raw JSON / Text Response)
                </label>
                <pre className="bg-slate-950 p-4 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800 whitespace-pre-wrap max-h-96">
                  {currentLog.rawResponse}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              ログが選択されていません
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
