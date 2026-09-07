import React, { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { ActiveTab } from '../types';
import { ArrowLeft, Settings, Bot, Sparkles, BookOpen, BookMarked, Cpu, FileText } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeProjectTitle: string;
  totalWordCount: number;
  ollamaConnected: boolean;
  onCheckOllama: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeProjectTitle,
  totalWordCount,
  ollamaConnected,
  onCheckOllama,
}) => {
  const [version, setVersion] = useState<string>('0.1.0');

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const getTabTitle = (tab: ActiveTab): { label: string; icon: React.ReactNode } => {
    switch (tab) {
      case 'projects':
        return { label: '作品一覧', icon: null };
      case 'prompt':
        return { label: 'お題・詳細設定', icon: <Sparkles className="w-4 h-4 text-amber-400" /> };
      case 'bible':
        return { label: '設定資料集 (Setting Bible)', icon: <BookOpen className="w-4 h-4 text-indigo-400" /> };
      case 'glossary':
        return { label: '特殊用語辞典 ＆ ルビ管理', icon: <BookMarked className="w-4 h-4 text-purple-400" /> };
      case 'generate':
        return { label: '長編自動生成パイプライン', icon: <Cpu className="w-4 h-4 text-emerald-400" /> };
      case 'manuscript':
        return { label: '完成原稿・閲覧編集', icon: <FileText className="w-4 h-4 text-blue-400" /> };
      case 'ai-settings':
        return { label: 'AI・LLM 接続環境設定', icon: <Settings className="w-4 h-4 text-slate-400" /> };
      default:
        return { label: 'Zephyros', icon: null };
    }
  };

  const currentTabInfo = getTabTitle(activeTab);

  return (
    <header className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-lg select-none">
      {/* 左側: ロゴ / 作品タイトル */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setActiveTab('projects')}
          className="flex items-center space-x-2 group focus:outline-none"
        >
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2 rounded-xl text-white shadow-md group-hover:scale-105 transition-transform">
            <Bot className="w-6 h-6" />
          </div>
          <div className="text-left">
            <div className="flex items-baseline space-x-2">
              <h1 className="font-extrabold text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
                Zephyros
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 font-semibold">
                v{version}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[200px]" title={activeProjectTitle}>
              {activeProjectTitle || '小説自動生成システム'}
            </p>
          </div>
        </button>

        {/* 作品一覧に戻るボタン (作品一覧以外のタブで表示) */}
        {activeTab !== 'projects' && (
          <button
            onClick={() => setActiveTab('projects')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 text-xs font-semibold shadow transition-all transform hover:-translate-x-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>作品一覧に戻る</span>
          </button>
        )}
      </div>

      {/* 中央: 現在の画面名表示 */}
      <div className="hidden md:flex items-center space-x-2 bg-slate-900 px-4 py-1.5 rounded-xl border border-slate-800 text-xs font-bold text-slate-200">
        {currentTabInfo.icon}
        <span>{currentTabInfo.label}</span>
      </div>

      {/* 右側: 文字数 ＆ AI設定 ＆ Ollama接続ボタン */}
      <div className="flex items-center space-x-4">
        {activeTab !== 'projects' && (
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-500 block">作品の総文字数</span>
            <span className="text-xs font-bold font-mono text-emerald-400">
              {totalWordCount.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">字</span>
            </span>
          </div>
        )}

        {/* AI設定ボタン */}
        <button
          onClick={() => setActiveTab('ai-settings')}
          className={`p-2 rounded-xl border transition-colors ${
            activeTab === 'ai-settings'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="AI・LLM環境設定 (Ollama)"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Ollama 接続ステータスボタン */}
        <button
          onClick={onCheckOllama}
          title="クリックでOllama接続を再テスト"
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            ollamaConnected
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/60'
              : 'bg-rose-950/60 border-rose-800 text-rose-300 hover:bg-rose-900/60'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              ollamaConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline">{ollamaConnected ? 'Ollama 接続中' : 'Ollama 切断'}</span>
        </button>
      </div>
    </header>
  );
};
