import React, { useState, useEffect } from 'react';
import { AISettings } from '../types';
import { OllamaService, OllamaModelInfo } from '../services/ollamaService';
import { Settings, RefreshCw, CheckCircle2, XCircle, Bot, ShieldCheck, Save, Check } from 'lucide-react';

interface AISettingsViewProps {
  settings: AISettings;
  onSave: (settings: AISettings) => void;
  onCheckStatus: () => void;
}

export const AISettingsView: React.FC<AISettingsViewProps> = ({ settings, onSave, onCheckStatus }) => {
  const [formState, setFormState] = useState<AISettings>(settings);
  const [availableModels, setAvailableModels] = useState<OllamaModelInfo[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [savedNotice, setSavedNotice] = useState(false);

  const fetchModels = async (url: string) => {
    setIsFetchingModels(true);
    setConnectionStatus('idle');
    try {
      const models = await OllamaService.getModels(url);
      setAvailableModels(models);
      if (models.length > 0) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
      }
    } catch (e) {
      console.error(e);
      setConnectionStatus('error');
    } finally {
      setIsFetchingModels(false);
      onCheckStatus();
    }
  };

  useEffect(() => {
    fetchModels(formState.ollamaUrl);
  }, []);

  const handleSave = () => {
    onSave(formState);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Settings className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">AI・LLM 接続環境設定 (Ollama)</h2>
          </div>
          <p className="text-slate-400 text-sm">
            ローカルの Ollama エンドポイントと、執筆者 (Qwen 等) および編集者 (Gemma 等) の使用モデルを割り当てます。
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedNotice && (
            <span className="text-xs text-emerald-400 flex items-center space-x-1">
              <Check className="w-4 h-4" />
              <span>保存済み</span>
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>設定を保存</span>
          </button>
        </div>
      </div>

      {/* 1. Ollama URL 接続設定 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Ollama API サーバー設定</h3>

        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-400 mb-1">エンドポイント URL</label>
            <input
              type="text"
              value={formState.ollamaUrl}
              onChange={(e) => setFormState({ ...formState, ollamaUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={() => fetchModels(formState.ollamaUrl)}
            disabled={isFetchingModels}
            className="mt-5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetchingModels ? 'animate-spin' : ''}`} />
            <span>モデル再取得</span>
          </button>
        </div>

        {/* 接続テスト状態 */}
        <div className="pt-2">
          {connectionStatus === 'success' && (
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-medium bg-emerald-950/50 border border-emerald-800 p-3 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Ollama サーバーに接続成功（検出モデル数: {availableModels.length} 件）</span>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-medium bg-rose-950/50 border border-rose-800 p-3 rounded-xl">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Ollama サーバーに接続できませんでした。Ollama が実行中であるか確認してください。</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. 執筆者 (Writer) & 編集者 (Editor) の役割分担モデル割り当て */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 執筆者 (Writer) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-950 rounded-xl border border-indigo-700 text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">執筆者エージェント (Writer AI)</h3>
              <p className="text-[11px] text-slate-400">タイトル・章題・長編本文の自動執筆を担当</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">使用モデル名 (手入力または選択)</label>
              {availableModels.length > 0 ? (
                <select
                  value={formState.writerModel}
                  onChange={(e) => setFormState({ ...formState, writerModel: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                >
                  <option value={formState.writerModel}>{formState.writerModel} (現在の指定)</option>
                  {availableModels.map((m) => (
                    <option key={`writer-${m.name}`} value={m.name}>
                      {m.name} ({(m.size / 1024 / 1024 / 1024).toFixed(1)} GB)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formState.writerModel}
                  onChange={(e) => setFormState({ ...formState, writerModel: e.target.value })}
                  placeholder="例: qwen3.8:27b または qwen2.5:32b"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-100"
                />
              )}
              <p className="text-[11px] text-slate-500 mt-1">推奨モデル: Qwen 3.8:27B / Qwen 2.5 32B 等</p>
            </div>
          </div>
        </div>

        {/* 編集者 (Editor) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-purple-950 rounded-xl border border-purple-700 text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">編集者エージェント (Editor AI)</h3>
              <p className="text-[11px] text-slate-400">誤字脱字、学年/クラス/設定の矛盾チェックを担当</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">使用モデル名 (手入力または選択)</label>
              {availableModels.length > 0 ? (
                <select
                  value={formState.editorModel}
                  onChange={(e) => setFormState({ ...formState, editorModel: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                >
                  <option value={formState.editorModel}>{formState.editorModel} (現在の指定)</option>
                  {availableModels.map((m) => (
                    <option key={`editor-${m.name}`} value={m.name}>
                      {m.name} ({(m.size / 1024 / 1024 / 1024).toFixed(1)} GB)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formState.editorModel}
                  onChange={(e) => setFormState({ ...formState, editorModel: e.target.value })}
                  placeholder="例: gemma4:31b または gemma2:27b"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-100"
                />
              )}
              <p className="text-[11px] text-slate-500 mt-1">推奨モデル: Gemma 4:31B / Gemma 2 27B 等</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
