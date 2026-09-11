import React, { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { AISettings, SystemPrompts } from '../types';
import { OllamaService, OllamaModelInfo } from '../services/ollamaService';
import { DEFAULT_SYSTEM_PROMPTS } from '../services/novelEngine';
import { Settings, RefreshCw, CheckCircle2, XCircle, Bot, ShieldCheck, Save, Check, Sparkles, ArrowUpCircle, Download, FileText, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [openPromptKey, setOpenPromptKey] = useState<string | null>('writeSceneContent');

  // アップデート関連ステート
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'up-to-date' | 'available' | 'error';
    version?: string;
    message?: string;
    updateObj?: any;
  }>({ type: 'idle' });
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    getVersion().then((ver) => setCurrentVersion(ver)).catch(() => {});
  }, []);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus({ type: 'idle' });
    try {
      const update = await check();
      if (update) {
        setUpdateStatus({
          type: 'available',
          version: update.version,
          updateObj: update,
        });
      } else {
        setUpdateStatus({
          type: 'up-to-date',
        });
      }
    } catch (e: any) {
      console.error('Update check error:', e);
      setUpdateStatus({
        type: 'error',
        message: e?.message || 'アップデート情報の取得に失敗しました。',
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!updateStatus.updateObj) return;
    setIsUpdating(true);
    try {
      await updateStatus.updateObj.downloadAndInstall();
      await relaunch();
    } catch (e: any) {
      console.error('Apply update error:', e);
      alert('アップデートのインストール中にエラーが発生しました: ' + (e?.message || e));
      setIsUpdating(false);
    }
  };

  const fetchModels = async (url: string) => {
    setIsFetchingModels(true);
    setConnectionStatus('idle');
    try {
      const models = await OllamaService.getModels(url);
      setAvailableModels(models);
      const isConnected = models.length > 0 || (await OllamaService.isServerConnected(url));
      setConnectionStatus(isConnected ? 'success' : 'error');
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

  const handleResetPrompts = () => {
    if (confirm('システムプロンプトをすべて初期デフォルト状態に戻しますか？')) {
      setFormState({
        ...formState,
        systemPrompts: { ...DEFAULT_SYSTEM_PROMPTS },
      });
    }
  };

  const getPromptValue = (key: keyof SystemPrompts): string => {
    return formState.systemPrompts?.[key] ?? DEFAULT_SYSTEM_PROMPTS[key] ?? '';
  };

  const updatePromptValue = (key: keyof SystemPrompts, val: string) => {
    setFormState({
      ...formState,
      systemPrompts: {
        ...DEFAULT_SYSTEM_PROMPTS,
        ...formState.systemPrompts,
        [key]: val,
      },
    });
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

      {/* 1. アプリケーションバージョン ＆ 手動アップデート確認 (最上部配置) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <ArrowUpCircle className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Zephyros アプリケーション更新</h3>
              <p className="text-[11px] text-slate-400">
                現在のバージョン: <span className="font-mono font-semibold text-slate-200">{currentVersion ? `v${currentVersion}` : '確認中...'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate || isUpdating}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} />
            <span>最新バージョンの確認</span>
          </button>
        </div>

        {/* アップデート確認結果 */}
        <div>
          {updateStatus.type === 'up-to-date' && (
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-medium bg-emerald-950/50 border border-emerald-800 p-3 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>お使いの Zephyros (v{currentVersion}) は最新バージョンです。</span>
            </div>
          )}

          {updateStatus.type === 'available' && (
            <div className="flex items-center justify-between text-indigo-300 text-xs font-medium bg-indigo-950/50 border border-indigo-800 p-4 rounded-xl">
              <div className="flex items-center space-x-2">
                <ArrowUpCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-100">
                    新しいバージョン (v{updateStatus.version}) が利用可能です！
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    アップデートをダウンロード・インストールしてアプリケーションを再起動します。
                  </p>
                </div>
              </div>

              <button
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 transition-colors shrink-0 cursor-pointer"
              >
                <Download className={`w-4 h-4 ${isUpdating ? 'animate-bounce' : ''}`} />
                <span>{isUpdating ? '更新適用中...' : 'アップデートして再起動'}</span>
              </button>
            </div>
          )}

          {updateStatus.type === 'error' && (
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-medium bg-amber-950/50 border border-amber-800 p-3 rounded-xl">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>
                アップデート確認スキップ (開発モードまたはオフラインの可能性があります): {updateStatus.message}
              </span>
            </div>
          )}
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

      {/* 3. 思考プロンプト制御 ＆ ローカルAI常駐設定 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-100">思考制御コマンド (`/nothink`) 付与＆常駐設定</h3>
            <p className="text-[11px] text-slate-400">
              各ローカルAI起動時にプロンプト冒頭へ思考抑制コマンド `/nothink` を自動挿入する項目を個別に選択します。
            </p>
          </div>
        </div>

        {/* AI呼び出し項目別チェックボックス一覧 */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            `/nothink` コマンド自動付与対象（チェックを入れると余計な思考出力を抑制）
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* お題ガチャ AI */}
            <label className="flex items-start space-x-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={formState.thinkCommandTargets?.gacha ?? true}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    thinkCommandTargets: {
                      ...formState.thinkCommandTargets,
                      gacha: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200">お題ガチャ AI</span>
                <p className="text-[11px] text-slate-500">お題キーワードからコンセプト・あらすじを自動生成</p>
              </div>
            </label>

            {/* プロット作成 AI */}
            <label className="flex items-start space-x-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={formState.thinkCommandTargets?.outline ?? true}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    thinkCommandTargets: {
                      ...formState.thinkCommandTargets,
                      outline: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200">プロット作成 AI (執筆者AI)</span>
                <p className="text-[11px] text-slate-500">全話のタイトル・章構成・登場人物・世界観を策定</p>
              </div>
            </label>

            {/* プロット校閲 AI */}
            <label className="flex items-start space-x-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={formState.thinkCommandTargets?.outlineProofread ?? true}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    thinkCommandTargets: {
                      ...formState.thinkCommandTargets,
                      outlineProofread: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200">プロット校閲 AI (編集者AI)</span>
                <p className="text-[11px] text-slate-500">プロット案・初期設定・読みの整合性を検証・校閲</p>
              </div>
            </label>

            {/* 本文執筆 AI */}
            <label className="flex items-start space-x-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={formState.thinkCommandTargets?.write ?? true}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    thinkCommandTargets: {
                      ...formState.thinkCommandTargets,
                      write: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200">本文執筆 AI (執筆者AI)</span>
                <p className="text-[11px] text-slate-500">各シーンの長編小説本文をリアルタイムストリーミング執筆</p>
              </div>
            </label>

            {/* 本文校閲 AI */}
            <label className="flex items-start space-x-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors sm:col-span-2">
              <input
                type="checkbox"
                checked={formState.thinkCommandTargets?.proofread ?? true}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    thinkCommandTargets: {
                      ...formState.thinkCommandTargets,
                      proofread: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200">本文校閲 AI (編集者AI)</span>
                <p className="text-[11px] text-slate-500">原稿の設定矛盾・誤字脱字・表記崩れを校閲＆設定自動更新</p>
              </div>
            </label>
          </div>
        </div>

        {/* ローカルAI常駐設定 (keep_alive) */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            ローカルAI常駐VRAM保持設定 (`keep_alive`)
          </label>
          <select
            value={formState.keepAlive || '-1'}
            onChange={(e) => setFormState({ ...formState, keepAlive: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
          >
            <option value="-1">常駐 (VRAMに保持し続ける / 初回以降のロード時間ゼロ・推奨)</option>
            <option value="5m">5分間保持 (5m)</option>
            <option value="10m">10分間保持 (10m)</option>
            <option value="30m">30分間保持 (30m)</option>
            <option value="60m">60分間保持 (60m)</option>
            <option value="0">即座にアンロード (0 / VRAM即時解放)</option>
          </select>
          <p className="text-[11px] text-slate-500">
            OllamaがGPUメモリ(VRAM)上にモデルを保持する時間を指定します。常駐に設定すると毎回のモデルロード待ちを排除できます。
          </p>
        </div>
      </div>

      {/* 4. システムプロンプトの編集 (System Prompt Customization) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">システムプロンプトの編集 (System Prompt Customization)</h3>
              <p className="text-[11px] text-slate-400">
                Ollamaを呼び出す際の各種システムプロンプト（執筆ルールや出力フォーマット指示）を自由に確認・編集・微調整できます。
              </p>
            </div>
          </div>

          <button
            onClick={handleResetPrompts}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="デフォルトのシステムプロンプトに戻す"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>デフォルトに戻す</span>
          </button>
        </div>

        <div className="space-y-3">
          {[
            {
              key: 'generateOutlineStep1' as keyof SystemPrompts,
              title: '1. プロット全体＆初期設定構成 (Step 1)',
              desc: '作品タイトル・全体あらすじ・初期キャラクター・世界観・特殊用語の策定指示',
            },
            {
              key: 'generateOutlineStep2' as keyof SystemPrompts,
              title: '2. 各話プロット・シーン構成 (Step 2)',
              desc: '第N話ごとの章タイトル・あらすじ・詳細シーン展開の策定指示 (※ {{chNum}} は話数に置換されます)',
            },
            {
              key: 'writeSceneContent' as keyof SystemPrompts,
              title: '3. 本文リアルタイム執筆 (Writer AI)',
              desc: 'シーンごとの長編小説本文の執筆ルール・文体・ルビ・対話記法指示',
            },
            {
              key: 'proofreadScene' as keyof SystemPrompts,
              title: '4. 本文校閲 (Editor AI)',
              desc: '誤字脱字、アルファベット混入、設定矛盾、無限ループ異常の検証チェック指示',
            },
            {
              key: 'rewriteSceneWithFeedback' as keyof SystemPrompts,
              title: '5. 原稿リライト (Writer AI)',
              desc: '校閲指摘を受けた初稿原稿の矛盾修正・再執筆ルール指示',
            },
            {
              key: 'extractSettingDelta' as keyof SystemPrompts,
              title: '6. 設定資料自動抽出 (Setting Extractor)',
              desc: '校閲完了後の原稿本文から新規人物・地名・品物・用語を抽出する指示',
            },
          ].map((item) => {
            const isOpen = openPromptKey === item.key;
            return (
              <div key={item.key} className="border border-slate-800 rounded-xl bg-slate-950/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenPromptKey(isOpen ? null : item.key)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/40 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  {formState.systemPrompts?.[item.key] && formState.systemPrompts[item.key] !== DEFAULT_SYSTEM_PROMPTS[item.key] && (
                    <span className="text-[10px] bg-indigo-950 border border-indigo-700 text-indigo-300 px-2 py-0.5 rounded-md font-mono shrink-0">
                      カスタム適用中
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="p-4 border-t border-slate-800/80 bg-slate-950 space-y-2">
                    <textarea
                      rows={10}
                      value={getPromptValue(item.key)}
                      onChange={(e) => updatePromptValue(item.key, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-y"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => updatePromptValue(item.key, DEFAULT_SYSTEM_PROMPTS[item.key] || '')}
                        className="text-[11px] text-slate-400 hover:text-indigo-400 transition-colors"
                      >
                        このプロンプトをデフォルトに戻す
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
