import React, { useState, useEffect } from 'react';
import { Glossary, GlossaryTerm, RubySetting } from '../types';
import { BookMarked, ShieldCheck, Sparkles, Plus, Trash2, Edit3, Save, Check } from 'lucide-react';

interface GlossaryViewProps {
  glossary: Glossary;
  onSave: (glossary: Glossary) => void;
  onNext: () => void;
}

export const GlossaryView: React.FC<GlossaryViewProps> = ({ glossary, onSave, onNext }) => {
  const [glossaryState, setGlossaryState] = useState<Glossary>(glossary);
  const [savedNotice, setSavedNotice] = useState(false);

  // 親コンポーネントからの glossary 変更 (一括抽出スキャン等の更新) をリアルタイム同期＆欠落補正
  useEffect(() => {
    const repaired: Glossary = {
      terms: (glossary.terms || []).map((t: any) => ({
        ...t,
        reading: t.reading || t.ruby || '',
        description: t.description || t.meaning || t.content || '',
        ignoreInProofreading: t.ignoreInProofreading !== false,
        updatedEpisode: t.updatedEpisode || (t.id && String(t.id).includes('init') ? '【初期プロット策定時】' : undefined),
      })),
      rubies: (glossary.rubies || []).map((r: any) => ({
        ...r,
        notation: r.notation || (r.kanji && r.ruby ? `${r.kanji}《${r.ruby}》` : r.kanji || r.ruby || ''),
        updatedEpisode: r.updatedEpisode || (r.id && String(r.id).includes('init') ? '【初期プロット策定時】' : undefined),
      })),
    };
    setGlossaryState(repaired);
  }, [glossary]);

  // 用語モーダル
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);

  // ルビモーダル
  const [editingRuby, setEditingRuby] = useState<RubySetting | null>(null);
  const [isRubyModalOpen, setIsRubyModalOpen] = useState(false);

  const handleSave = () => {
    onSave(glossaryState);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  // 用語操作
  const handleOpenTermModal = (term?: GlossaryTerm) => {
    if (term) {
      setEditingTerm({ ...term });
    } else {
      setEditingTerm({
        id: `term-${Date.now()}`,
        term: '',
        reading: '',
        description: '',
        ignoreInProofreading: true,
      });
    }
    setIsTermModalOpen(true);
  };

  const handleSaveTerm = () => {
    if (!editingTerm || !editingTerm.term.trim()) return;
    const exists = glossaryState.terms.some((t) => t.id === editingTerm.id);
    const newTerms = exists
      ? glossaryState.terms.map((t) => (t.id === editingTerm.id ? editingTerm : t))
      : [...glossaryState.terms, editingTerm];
    const updated = { ...glossaryState, terms: newTerms };
    setGlossaryState(updated);
    onSave(updated);
    setIsTermModalOpen(false);
  };

  const handleDeleteTerm = (id: string) => {
    const updated = {
      ...glossaryState,
      terms: glossaryState.terms.filter((t) => t.id !== id),
    };
    setGlossaryState(updated);
    onSave(updated);
  };

  // ルビ操作
  const handleOpenRubyModal = (ruby?: RubySetting) => {
    if (ruby) {
      setEditingRuby({ ...ruby });
    } else {
      setEditingRuby({
        id: `ruby-${Date.now()}`,
        kanji: '',
        ruby: '',
        notation: '',
      });
    }
    setIsRubyModalOpen(true);
  };

  const handleSaveRuby = () => {
    if (!editingRuby || !editingRuby.kanji.trim() || !editingRuby.ruby.trim()) return;
    const notation = `${editingRuby.kanji}《${editingRuby.ruby}》`;
    const rubyObj = { ...editingRuby, notation };
    const exists = glossaryState.rubies.some((r) => r.id === rubyObj.id);
    const newRubies = exists
      ? glossaryState.rubies.map((r) => (r.id === rubyObj.id ? rubyObj : r))
      : [...glossaryState.rubies, rubyObj];
    const updated = { ...glossaryState, rubies: newRubies };
    setGlossaryState(updated);
    onSave(updated);
    setIsRubyModalOpen(false);
  };

  const handleDeleteRuby = (id: string) => {
    const updated = {
      ...glossaryState,
      rubies: glossaryState.rubies.filter((r) => r.id !== id),
    };
    setGlossaryState(updated);
    onSave(updated);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <BookMarked className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-slate-100">特殊用語辞典 ＆ ルビ管理</h2>
          </div>
          <p className="text-slate-400 text-sm">
            校閲時に誤字扱いされないように特殊用語・造語を登録します。あえて崩した表現や固有ルビ表記も管理できます。
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
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>保存</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. 特殊用語（校閲除外語句） */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>特殊用語・校閲除外キーワード</span>
            </h3>
            <button
              onClick={() => handleOpenTermModal()}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>用語追加</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {glossaryState.terms.map((term) => (
              <div
                key={term.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-start space-x-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-bold text-sm text-slate-100">{term.term}</span>
                    {term.reading && <span className="text-xs text-slate-400">({term.reading})</span>}
                    {term.updatedEpisode && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                        {term.updatedEpisode}
                      </span>
                    )}
                    {term.ignoreInProofreading && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                        校閲除外
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{term.description || (term as any).meaning || (term as any).content || '説明なし'}</p>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleOpenTermModal(term)}
                    className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTerm(term.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. 特殊ルビ登録 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>特殊ルビ (振り仮名) 登録</span>
            </h3>
            <button
              onClick={() => handleOpenRubyModal()}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ルビ追加</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {glossaryState.rubies.map((ruby) => (
              <div
                key={ruby.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex justify-between items-center"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-purple-300 font-bold">
                      {ruby.notation || (ruby.kanji && ruby.ruby ? `${ruby.kanji}《${ruby.ruby}》` : ruby.kanji || ruby.ruby)}
                    </span>
                    {ruby.updatedEpisode && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                        {ruby.updatedEpisode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    漢字: <span className="text-slate-200">{ruby.kanji}</span> / ルビ: <span className="text-slate-200">{ruby.ruby}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenRubyModal(ruby)}
                    className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRuby(ruby.id)}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 用語編集モーダル */}
      {isTermModalOpen && editingTerm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">特殊用語の追加・編集</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">用語・固有名詞</label>
                <input
                  type="text"
                  value={editingTerm.term}
                  onChange={(e) => setEditingTerm({ ...editingTerm, term: e.target.value })}
                  placeholder="例: 魔導パスタ"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">読み</label>
                <input
                  type="text"
                  value={editingTerm.reading}
                  onChange={(e) => setEditingTerm({ ...editingTerm, reading: e.target.value })}
                  placeholder="例: まどうぱすた"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">説明</label>
                <textarea
                  rows={3}
                  value={editingTerm.description}
                  onChange={(e) => setEditingTerm({ ...editingTerm, description: e.target.value })}
                  placeholder="用語の意味やコンテキスト..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="ignoreProofreading"
                  checked={editingTerm.ignoreInProofreading}
                  onChange={(e) => setEditingTerm({ ...editingTerm, ignoreInProofreading: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="ignoreProofreading" className="text-xs text-slate-300 font-medium cursor-pointer">
                  編集者AIの校閲時に誤字脱字としてフラグを立てない（除外ルールに登録）
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsTermModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveTerm}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ルビ編集モーダル */}
      {isRubyModalOpen && editingRuby && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">特殊ルビの追加・編集</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">漢字表記</label>
                <input
                  type="text"
                  value={editingRuby.kanji}
                  onChange={(e) => setEditingRuby({ ...editingRuby, kanji: e.target.value })}
                  placeholder="例: 魔導書"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">ルビ（振り仮名）</label>
                <input
                  type="text"
                  value={editingRuby.ruby}
                  onChange={(e) => setEditingRuby({ ...editingRuby, ruby: e.target.value })}
                  placeholder="例: ルモワール"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">生成プレビュー記法:</span>
                <span className="font-mono text-sm text-purple-300 font-bold">
                  {editingRuby.kanji || '漢字'}《{editingRuby.ruby || 'ルビ'}》
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsRubyModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveRuby}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* フッター進むボタン */}
      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={() => {
            handleSave();
            onNext();
          }}
          className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/30"
        >
          <span>作品一覧に戻る</span>
        </button>
      </div>
    </div>
  );
};
