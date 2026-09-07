import React, { useState, useEffect, useRef } from 'react';
import { NovelData, Chapter, Scene } from '../types';
import { FileText, Download, Eye, Edit3, Layers, Copy, Check } from 'lucide-react';
import { exportNovelAsSplitTxtZip, exportNovelAsSplitMdZip } from '../utils/exportUtils';

interface ManuscriptViewProps {
  novelData: NovelData | null;
  onUpdateNovelData: (data: NovelData) => void;
}

export const ManuscriptView: React.FC<ManuscriptViewProps> = ({ novelData, onUpdateNovelData }) => {
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

  if (!novelData || novelData.chapters.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <FileText className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-lg font-bold text-slate-300">原稿がまだ生成されていません</h3>
        <p className="text-xs text-slate-500">
          「長編生成パイプライン」タブから全話のプロット生成と自動執筆を実行してください。
        </p>
      </div>
    );
  }

  const currentChapter: Chapter = novelData.chapters[selectedChapterIndex] || novelData.chapters[0];
  const currentScene: Scene = currentChapter.scenes[selectedSceneIndex] || currentChapter.scenes[0];

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

  // 本文編集時の変更反映
  const handleSceneContentChange = (newContent: string) => {
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
    if (currentScene.content) {
      navigator.clipboard.writeText(currentScene.content);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 上部ヘッダー ＆ エクスポートコントロール */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <span>{novelData.title || '無題'}</span>
            <span className="text-xs text-indigo-400 font-normal">({novelData.subtitle})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            全 {novelData.chapters.length} 話 / 総文字数: <strong className="text-emerald-400 font-mono">{novelData.totalWordCount.toLocaleString()}</strong> 文字
          </p>
        </div>

        {/* アクションボタン */}
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
      </div>

      {/* メインビュー 2カラム */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 左 1カラム: 12話の章ツリー */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 h-[640px] flex flex-col">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>目次 (全 {novelData.chapters.length} 話)</span>
          </h3>

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
        <div className="md:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col h-[640px]">
          {/* シーンヘッダー */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100">{currentChapter.title}</h3>
              <p className="text-xs text-slate-400">
                {currentScene.title} — {currentScene.wordCount.toLocaleString()} 文字
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
                {renderRubyText(currentScene?.content || 'このシーンの本文はまだ執筆されていません。')}
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
    </div>
  );
};
