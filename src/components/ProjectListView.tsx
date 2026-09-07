import React, { useState, useEffect, useRef } from 'react';
import { Project, NovelData, Chapter, Scene, ActiveTab } from '../types';
import { Plus, BookOpen, Trash2, Edit3, Eye, Download, Sparkles, Cpu, Layers, Copy, Check, Clock, BookMarked } from 'lucide-react';
import { exportNovelAsSplitTxtZip, exportNovelAsSplitMdZip } from '../utils/exportUtils';

interface ProjectListViewProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onUpdateNovelData: (data: NovelData) => void;
  onNavigateToTab: (tab: ActiveTab) => void;
}

export const ProjectListView: React.FC<ProjectListViewProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateNewProject,
  onDeleteProject,
  onUpdateNovelData,
  onNavigateToTab,
}) => {
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const novelData = activeProject?.novelData;

  // 原稿閲覧用の内部状態
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'read' | 'edit'>('read');
  const [rubyPreview, setRubyPreview] = useState<boolean>(true);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // シーン切替時にスクロール位置・カーソル位置を最上部にリセット
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.scrollTop = 0;
    }
    if (editorRef.current) {
      editorRef.current.scrollTop = 0;
      editorRef.current.setSelectionRange(0, 0);
    }
  }, [selectedChapterIndex, selectedSceneIndex, viewMode]);

  const currentChapter: Chapter | undefined = novelData?.chapters?.[selectedChapterIndex];
  const currentScene: Scene | undefined = currentChapter?.scenes?.[selectedSceneIndex];

  // ルビ記法《ルビ》および ｜漢字《ルビ》のHTML置換関数
  const renderRubyText = (text?: string) => {
    if (!text) return '';
    if (!rubyPreview) return text;

    // 1) ｜任意文字《ルビ》
    // 2) 漢字/カタカナ/英数字《ルビ》
    const rubyRegex = /(?:[｜|]([^\s《》\n]+)|([\u4E00-\u9FFF\u3005\u3007\u30A0-\u30FFa-zA-Z0-9]+))《([^》]+)》/g;
    const parts = text.split(/(?:[｜|][^\s《》\n]+|[\u4E00-\u9FFF\u3005\u3007\u30A0-\u30FFa-zA-Z0-9]+)《[^》]+》/g);
    const matches = Array.from(text.matchAll(rubyRegex));

    const result: (string | React.ReactNode)[] = [];
    parts.forEach((part, i) => {
      if (part) {
        result.push(part);
      }
      if (i < matches.length) {
        const m = matches[i];
        const baseText = m[1] || m[2];
        const rubyText = m[3];
        result.push(
          <ruby key={`ruby-${i}`} className="px-0.5">
            {baseText}
            <rt className="text-[0.65em] text-purple-300 select-none">{rubyText}</rt>
          </ruby>
        );
      }
    });

    return result;
  };

  // TXTエクスポート（シーン分割フォルダ出力）
  const handleExportTxt = async () => {
    if (!novelData) return;
    await exportNovelAsSplitTxtZip(novelData);
  };

  // Markdownエクスポート（シーン分割フォルダ出力）
  const handleExportMd = async () => {
    if (!novelData) return;
    await exportNovelAsSplitMdZip(novelData);
  };

  const handleSceneContentChange = (newContent: string) => {
    if (!novelData) return;
    const updatedNovel: NovelData = JSON.parse(JSON.stringify(novelData));
    const ch = updatedNovel.chapters[selectedChapterIndex];
    if (ch && ch.scenes[selectedSceneIndex]) {
      ch.scenes[selectedSceneIndex].content = newContent;
      ch.scenes[selectedSceneIndex].wordCount = newContent.length;
      ch.wordCount = ch.scenes.reduce((sum, sc) => sum + sc.wordCount, 0);
      updatedNovel.totalWordCount = updatedNovel.chapters.reduce((sum, c) => sum + c.wordCount, 0);
      onUpdateNovelData(updatedNovel);
    }
  };

  const handleCopyScene = () => {
    if (currentScene?.content) {
      navigator.clipboard.writeText(currentScene.content);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* 画面最上部: タイトル ＆ 「+ 新規作品を作成」ボタン */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">作品一覧 (小説プロジェクト)</h2>
          </div>
          <p className="text-slate-400 text-xs">
            保存されている作品の一覧です。カードの各ボタンからお題設定・設定資料・自動執筆画面へ移動できます。
          </p>
        </div>

        <button
          onClick={onCreateNewProject}
          className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          <span>新規作品を作成</span>
        </button>
      </div>

      {/* 作品カードグリッド */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">保存された作品 ({projects.length} 件)</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const isSelected = proj.id === activeProjectId;
            const completedChCount =
              proj.novelData?.chapters.filter(
                (c) => c.status === 'completed' || (c.scenes.length > 0 && c.scenes.every((sc) => sc.wordCount > 0))
              ).length || 0;
            const totalWords = proj.novelData?.totalWordCount || 0;

            return (
              <div
                key={proj.id}
                onClick={() => onSelectProject(proj.id)}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 cursor-pointer transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-indigo-500 shadow-xl shadow-indigo-950/60 ring-1 ring-indigo-500'
                    : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-base text-slate-100 line-clamp-1">
                      {proj.novelData?.title || proj.title || '無題作品'}
                    </h4>

                    {projects.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`作品「${proj.title}」を削除しますか？`)) {
                            onDeleteProject(proj.id);
                          }
                        }}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="作品削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans min-h-[32px]">
                    {proj.promptSettings?.storyConcept || 'お題未設定'}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {proj.promptSettings?.themes.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-indigo-300">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800/80 pt-3 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      進捗: <strong className="text-indigo-300">{completedChCount}</strong> / 12 話
                    </span>
                    <span className="text-slate-400">
                      <strong className="text-emerald-400">{totalWords.toLocaleString()}</strong> 文字
                    </span>
                  </div>

                  {/* 各画面ダイレクト移動ボタン */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(proj.id);
                        onNavigateToTab('prompt');
                      }}
                      className="flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-800/80 text-amber-200 text-xs font-medium transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>お題・設定</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(proj.id);
                        onNavigateToTab('bible');
                      }}
                      className="flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/80 text-indigo-200 text-xs font-medium transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>設定資料集</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(proj.id);
                        onNavigateToTab('glossary');
                      }}
                      className="flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900 border border-purple-800/80 text-purple-200 text-xs font-medium transition-colors"
                    >
                      <BookMarked className="w-3.5 h-3.5" />
                      <span>特殊用語</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(proj.id);
                        onNavigateToTab('generate');
                      }}
                      className="flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-200 text-xs font-bold transition-colors"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>自動執筆</span>
                    </button>
                  </div>

                  <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>更新日: {proj.lastUpdatedDate}</span>
                    </span>
                    {isSelected && (
                      <span className="text-indigo-400 font-bold">選択中</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 下部: 選択中の作品の原稿閲覧・推敲エリア */}
      {activeProject && (
        <div className="border-t border-slate-800 pt-6 space-y-6">
          {/* 原稿ヘッダー ＆ エクスポート */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase">
                  原稿プレビュー・編集
                </span>
                <h3 className="text-lg font-bold text-slate-100">
                  {novelData?.title || activeProject.title}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                全 {novelData?.chapters.length || 0} 話 / 総文字数: <strong className="text-emerald-400 font-mono">{(novelData?.totalWordCount || 0).toLocaleString()}</strong> 文字
              </p>
            </div>

            {/* アクションボタン */}
            {novelData && novelData.chapters.length > 0 && (
              <div className="flex items-center space-x-3">
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setViewMode('read')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      viewMode === 'read' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>プレビュー</span>
                  </button>
                  <button
                    onClick={() => setViewMode('edit')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      viewMode === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>編集</span>
                  </button>
                </div>

                <button
                  onClick={() => setRubyPreview(!rubyPreview)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                    rubyPreview
                      ? 'bg-purple-950 border-purple-800 text-purple-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  ルビ変換: {rubyPreview ? 'ON' : 'OFF'}
                </button>

                <button
                  onClick={handleExportTxt}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>.txt 出力</span>
                </button>

                <button
                  onClick={handleExportMd}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
                >
                  <Download className="w-4 h-4" />
                  <span>.md 出力</span>
                </button>
              </div>
            )}
          </div>

          {/* 原稿閲覧 2カラム */}
          {novelData && novelData.chapters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* 左 1カラム: 12話の章ツリー */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 h-[580px] flex flex-col">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>目次 (全 {novelData.chapters.length} 話)</span>
                </h4>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {novelData.chapters.map((ch, cIdx) => {
                    const isChSelected = cIdx === selectedChapterIndex;
                    return (
                      <div key={ch.id} className="space-y-1">
                        <button
                          onClick={() => {
                            setSelectedChapterIndex(cIdx);
                            setSelectedSceneIndex(0);
                          }}
                          className={`w-full text-left p-2.5 rounded-xl text-xs transition-all border ${
                            isChSelected
                              ? 'bg-indigo-950/80 border-indigo-600 text-indigo-200 font-bold'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="truncate">{ch.title}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {ch.wordCount.toLocaleString()} 文字 / {ch.scenes.length} シーン
                          </div>
                        </button>

                        {/* シーンリスト */}
                        {isChSelected && (
                          <div className="pl-3 space-y-1 border-l-2 border-indigo-700/60 ml-2">
                            {ch.scenes.map((sc, sIdx) => {
                              const isScSelected = sIdx === selectedSceneIndex;
                              return (
                                <button
                                  key={sc.id}
                                  onClick={() => setSelectedSceneIndex(sIdx)}
                                  className={`w-full text-left p-1.5 rounded-lg text-[11px] truncate transition-colors ${
                                    isScSelected
                                      ? 'bg-indigo-600 text-white font-medium'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                                  }`}
                                >
                                  {sc.title} ({sc.wordCount.toLocaleString()}字)
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右 3カラム: 原稿本文ビューワー / エディタ */}
              <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[580px]">
                {/* シーンヘッダー */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <h4 className="text-base font-bold text-slate-100">{currentChapter?.title}</h4>
                    <p className="text-xs text-slate-400">
                      {currentScene?.title} — {currentScene?.wordCount.toLocaleString() || 0} 文字
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {copiedNotice && (
                      <span className="text-xs text-emerald-400 flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>コピーしました</span>
                      </span>
                    )}
                    <button
                      onClick={handleCopyScene}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                      title="本文をクリップボードにコピー"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 本文エリア */}
                <div className="flex-1 overflow-hidden">
                  {viewMode === 'read' ? (
                    <div
                      ref={previewRef}
                      className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-100 text-sm leading-relaxed font-sans whitespace-pre-wrap overflow-y-auto select-text selection:bg-indigo-900"
                    >
                      {renderRubyText(currentScene?.content || 'このシーンの本文はまだ執筆されていません。カードの「自動執筆」ボタンから長編生成を開始してください。')}
                    </div>
                  ) : (
                    <textarea
                      ref={editorRef}
                      value={currentScene?.content || ''}
                      onChange={(e) => handleSceneContentChange(e.target.value)}
                      className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-100 leading-relaxed font-sans focus:outline-none focus:border-indigo-500 resize-none"
                      placeholder="本文を入力・推敲できます..."
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-slate-300">この作品の本文原稿は未生成です</h4>
              <p className="text-xs text-slate-500">
                カードの「自動執筆」ボタンを押してプロット作成と本文自動執筆を開始してください。
              </p>
              <button
                onClick={() => onNavigateToTab('prompt')}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow"
              >
                お題・設定を変更する
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
