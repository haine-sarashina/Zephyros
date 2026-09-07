import React, { useState, useEffect } from 'react';
import { SettingBible, CharacterSetting, WorldSetting, LocationSetting, Glossary } from '../types';
import { NovelEngine } from '../services/novelEngine';
import { BookOpen, Users, Globe, MapPin, Plus, Trash2, Edit3, Image as ImageIcon, Save, Check } from 'lucide-react';

interface SettingBibleViewProps {
  bible: SettingBible;
  glossary?: Glossary;
  editorLogs?: string[];
  onSave: (bible: SettingBible) => void;
  onSaveGlossary?: (glossary: Glossary) => void;
  onSaveBibleAndGlossary?: (bible: SettingBible, glossary: Glossary) => void;
  onNext?: () => void;
}

export const SettingBibleView: React.FC<SettingBibleViewProps> = ({
  bible,
  glossary,
  onSave,
  onSaveGlossary,
  onSaveBibleAndGlossary,
  onNext,
}) => {
  const [bibleState, setBibleState] = useState<SettingBible>(bible);
  const [activeSubTab, setActiveSubTab] = useState<'characters' | 'world' | 'geography'>('characters');
  const [savedNotice, setSavedNotice] = useState(false);

  // 親コンポーネントからの bible プロップス変更をローカル状態へ同期
  useEffect(() => {
    setBibleState(bible);
  }, [bible]);

  // キャラクター編集・モーダル状態
  const [editingCharacter, setEditingCharacter] = useState<CharacterSetting | null>(null);
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);

  // 世界観編集・モーダル状態
  const [editingWorld, setEditingWorld] = useState<WorldSetting | null>(null);
  const [isWorldModalOpen, setIsWorldModalOpen] = useState(false);

  // 地理編集・モーダル状態
  const [editingGeo, setEditingGeo] = useState<LocationSetting | null>(null);
  const [isGeoModalOpen, setIsGeoModalOpen] = useState(false);

  // でたらめな文章断片・ゴミ設定を手動で一括削除・掃除
  const handleCleanJunk = () => {
    const dummyGlossary: Glossary = glossary || { terms: [], rubies: [] };
    const { cleanedBible, cleanedGlossary, removedCount } = NovelEngine.cleanJunkSettings(bibleState, dummyGlossary);

    setBibleState(cleanedBible);
    if (onSaveBibleAndGlossary) {
      onSaveBibleAndGlossary(cleanedBible, cleanedGlossary);
    } else {
      onSave(cleanedBible);
      if (onSaveGlossary && glossary) onSaveGlossary(cleanedGlossary);
    }
    alert(`🧹 ゴミ設定の掃除と、登場人物の一人称・二人称・挿絵タグの自動整形を完了しました！ (${removedCount > 0 ? `${removedCount}件のゴミ削除・` : ''}整形完了)`);
  };

  const handleSave = () => {
    onSave(bibleState);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  // キャラクター操作
  const handleOpenCharModal = (char?: CharacterSetting) => {
    if (char) {
      setEditingCharacter({ ...char });
    } else {
      setEditingCharacter({
        id: `char-${Date.now()}`,
        name: '',
        ruby: '',
        role: '',
        firstPerson: '私',
        secondPerson: 'あなた',
        appearance: '',
        personality: '',
        background: '',
        illustrationPrompt: '',
      });
    }
    setIsCharModalOpen(true);
  };

  const handleSaveChar = () => {
    if (!editingCharacter || !editingCharacter.name.trim()) return;
    const { cleanName, extractedRole } = NovelEngine.sanitizeCharacterName(editingCharacter.name);
    const sanitizedChar: CharacterSetting = {
      ...editingCharacter,
      name: cleanName,
      role: editingCharacter.role || extractedRole || '主要登場人物',
      firstPerson: NovelEngine.sanitizePronoun(editingCharacter.firstPerson, '私', false),
      secondPerson: NovelEngine.sanitizePronoun(editingCharacter.secondPerson, 'あなた', true),
      illustrationPrompt: NovelEngine.buildIllustrationPrompt({
        name: cleanName,
        appearance: editingCharacter.appearance,
        role: editingCharacter.role || extractedRole,
        illustrationPrompt: editingCharacter.illustrationPrompt,
      }),
    };

    const exists = bibleState.characters.some((c) => c.id === sanitizedChar.id);
    const newChars = exists
      ? bibleState.characters.map((c) => (c.id === sanitizedChar.id ? sanitizedChar : c))
      : [...bibleState.characters, sanitizedChar];
    const updated = { ...bibleState, characters: newChars };
    setBibleState(updated);
    onSave(updated);
    setIsCharModalOpen(false);
  };

  const handleDeleteChar = (id: string) => {
    const updated = {
      ...bibleState,
      characters: bibleState.characters.filter((c) => c.id !== id),
    };
    setBibleState(updated);
    onSave(updated);
  };

  // 世界観操作
  const handleOpenWorldModal = (world?: WorldSetting) => {
    if (world) {
      setEditingWorld({ ...world });
    } else {
      setEditingWorld({
        id: `wb-${Date.now()}`,
        category: 'system',
        title: '',
        content: '',
      });
    }
    setIsWorldModalOpen(true);
  };

  const handleSaveWorld = () => {
    if (!editingWorld || !editingWorld.title.trim()) return;
    const exists = bibleState.worldBuilding.some((w) => w.id === editingWorld.id);
    const newWorld = exists
      ? bibleState.worldBuilding.map((w) => (w.id === editingWorld.id ? editingWorld : w))
      : [...bibleState.worldBuilding, editingWorld];
    const updated = { ...bibleState, worldBuilding: newWorld };
    setBibleState(updated);
    onSave(updated);
    setIsWorldModalOpen(false);
  };

  const handleDeleteWorld = (id: string) => {
    const updated = {
      ...bibleState,
      worldBuilding: bibleState.worldBuilding.filter((w) => w.id !== id),
    };
    setBibleState(updated);
    onSave(updated);
  };

  // 地理操作
  const handleOpenGeoModal = (geo?: LocationSetting) => {
    if (geo) {
      setEditingGeo({ ...geo });
    } else {
      setEditingGeo({
        id: `geo-${Date.now()}`,
        name: '',
        description: '',
      });
    }
    setIsGeoModalOpen(true);
  };

  const handleSaveGeo = () => {
    if (!editingGeo || !editingGeo.name.trim()) return;
    const exists = bibleState.geography.some((g) => g.id === editingGeo.id);
    const newGeo = exists
      ? bibleState.geography.map((g) => (g.id === editingGeo.id ? editingGeo : g))
      : [...bibleState.geography, editingGeo];
    const updated = { ...bibleState, geography: newGeo };
    setBibleState(updated);
    onSave(updated);
    setIsGeoModalOpen(false);
  };

  const handleDeleteGeo = (id: string) => {
    const updated = {
      ...bibleState,
      geography: bibleState.geography.filter((g) => g.id !== id),
    };
    setBibleState(updated);
    onSave(updated);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">設定資料集 (Setting Bible)</h2>
          </div>
          <p className="text-slate-400 text-sm">
            登場人物、世界観、周辺地図を登録します。編集者AIが原稿の学年・クラス・口調・外見等の矛盾を検出する基準となります。
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleCleanJunk}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 font-semibold text-xs transition-colors"
            title="会話フレーズや文章断片などのゴミ設定を一括削除・整理"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>🧹 ゴミ設定を一括掃除</span>
          </button>
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

      {/* サブタブナビゲーション */}
      <div className="flex border-b border-slate-800 space-x-4">
        <button
          onClick={() => setActiveSubTab('characters')}
          className={`flex items-center space-x-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === 'characters'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>登場人物 ({bibleState.characters.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('world')}
          className={`flex items-center space-x-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === 'world'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>背景・世界観・品物/道具 ({bibleState.worldBuilding.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('geography')}
          className={`flex items-center space-x-2 pb-3 px-2 text-sm font-semibold border-b-2 transition-all ${
            activeSubTab === 'geography'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>周辺地図・地理 ({bibleState.geography.length})</span>
        </button>
      </div>

      {/* 1. 登場人物タブ */}
      {activeSubTab === 'characters' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-slate-400">登録済みキャラクター一覧</h3>
            <button
              onClick={() => handleOpenCharModal()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>キャラクターを追加</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bibleState.characters.map((char) => (
              <div
                key={char.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-3 transition-all relative group shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-base font-bold text-slate-100">{char.name}</h4>
                      {char.ruby && <span className="text-xs text-indigo-400 font-normal">({char.ruby})</span>}
                      {char.updatedEpisode && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {char.updatedEpisode}
                        </span>
                      )}
                    </div>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-indigo-300 border border-slate-700">
                      {char.role || '役割未設定'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenCharModal(char)}
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteChar(char.id)}
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-xs space-y-1.5 text-slate-300 border-t border-slate-800/80 pt-3">
                  <div className="flex space-x-4 text-slate-400 font-mono">
                    <span>一人称: <strong className="text-slate-200">{char.firstPerson}</strong></span>
                    <span>二人称: <strong className="text-slate-200">{char.secondPerson}</strong></span>
                  </div>
                  <p><strong className="text-slate-400">外見:</strong> {char.appearance || '未設定'}</p>
                  <p><strong className="text-slate-400">性格・口調:</strong> {char.personality || '未設定'}</p>
                  <p className="whitespace-pre-wrap"><strong className="text-slate-400">背景・変化履歴:</strong> {char.background || '未設定'}</p>
                </div>

                {char.illustrationPrompt && (
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-amber-300 font-mono flex items-center space-x-2">
                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">挿絵タグ: {char.illustrationPrompt}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. 背景・世界観・品物/道具タブ */}
      {activeSubTab === 'world' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-slate-400">世界観・品物・道具・アイテム設定一覧</h3>
            <button
              onClick={() => handleOpenWorldModal()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>設定項目を追加</span>
            </button>
          </div>

          <div className="space-y-3">
            {bibleState.worldBuilding.map((item) => {
              const categoryLabel =
                item.category === 'culture'
                  ? '品物・道具・文化'
                  : item.category === 'magic'
                  ? '魔法・能力'
                  : item.category === 'dungeon'
                  ? 'ダンジョン'
                  : item.category === 'system'
                  ? '社会・システム'
                  : '品物・設定';

              return (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {categoryLabel}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">{item.title}</h4>
                      {item.updatedEpisode && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {item.updatedEpisode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pt-1 whitespace-pre-wrap">{item.content}</p>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-4">
                    <button
                      onClick={() => handleOpenWorldModal(item)}
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteWorld(item.id)}
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 周辺地図・地理タブ */}
      {activeSubTab === 'geography' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-slate-400">地理・マップ設定一覧</h3>
            <button
              onClick={() => handleOpenGeoModal()}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>場所を追加</span>
            </button>
          </div>

          <div className="space-y-3">
            {bibleState.geography.map((geo) => (
              <div key={geo.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-1.5">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span>{geo.name}</span>
                    </h4>
                    {geo.updatedEpisode && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {geo.updatedEpisode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pt-1 whitespace-pre-wrap">{geo.description}</p>
                </div>

                <div className="flex items-center space-x-1 shrink-0 ml-4">
                  <button
                    onClick={() => handleOpenGeoModal(geo)}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteGeo(geo.id)}
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* キャラクター編集モーダル */}
      {isCharModalOpen && editingCharacter && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-100">登場人物の設定</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">キャラクター名</label>
                <input
                  type="text"
                  value={editingCharacter.name}
                  onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                  placeholder="例: アルド"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">読み (ルビ)</label>
                <input
                  type="text"
                  value={editingCharacter.ruby}
                  onChange={(e) => setEditingCharacter({ ...editingCharacter, ruby: e.target.value })}
                  placeholder="例: あるど"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">役割 / 立場</label>
                <input
                  type="text"
                  value={editingCharacter.role}
                  onChange={(e) => setEditingCharacter({ ...editingCharacter, role: e.target.value })}
                  placeholder="例: 主人公 / シェフ"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div className="flex space-x-2">
                <div className="w-1/2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">一人称</label>
                  <input
                    type="text"
                    value={editingCharacter.firstPerson}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, firstPerson: e.target.value })}
                    placeholder="俺, 私, 僕"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">二人称</label>
                  <input
                    type="text"
                    value={editingCharacter.secondPerson}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, secondPerson: e.target.value })}
                    placeholder="お前, あなた, 君"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">外見・服装（矛盾防止用）</label>
              <textarea
                rows={2}
                value={editingCharacter.appearance}
                onChange={(e) => setEditingCharacter({ ...editingCharacter, appearance: e.target.value })}
                placeholder="髪型、目の色、服装、傷の位置など..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">性格・口調</label>
              <textarea
                rows={2}
                value={editingCharacter.personality}
                onChange={(e) => setEditingCharacter({ ...editingCharacter, personality: e.target.value })}
                placeholder="性格、口調の特徴、決めゼリフなど..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">経歴・背景設定</label>
              <textarea
                rows={2}
                value={editingCharacter.background}
                onChange={(e) => setEditingCharacter({ ...editingCharacter, background: e.target.value })}
                placeholder="過去、目的、人間関係など..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-400 mb-1">挿絵用生成プロンプト（プロンプトタグ）</label>
              <input
                type="text"
                value={editingCharacter.illustrationPrompt}
                onChange={(e) => setEditingCharacter({ ...editingCharacter, illustrationPrompt: e.target.value })}
                placeholder="handsome male chef, black tied hair, white chef coat"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-amber-200"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsCharModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveChar}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 世界観モーダル */}
      {isWorldModalOpen && editingWorld && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">世界観・背景設定の編集</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">カテゴリー</label>
                <select
                  value={editingWorld.category}
                  onChange={(e) => setEditingWorld({ ...editingWorld, category: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                >
                  <option value="dungeon">ダンジョン設定</option>
                  <option value="magic">魔法・技術体系</option>
                  <option value="culture">文化・食材・料理</option>
                  <option value="system">社会・国家体制</option>
                  <option value="other">その他</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">項目タイトル</label>
                <input
                  type="text"
                  value={editingWorld.title}
                  onChange={(e) => setEditingWorld({ ...editingWorld, title: e.target.value })}
                  placeholder="例: ダンジョン第45層「静寂の石室」"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">詳細説明</label>
                <textarea
                  rows={4}
                  value={editingWorld.content}
                  onChange={(e) => setEditingWorld({ ...editingWorld, content: e.target.value })}
                  placeholder="詳細な設定内容を記述..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsWorldModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveWorld}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 地理モーダル */}
      {isGeoModalOpen && editingGeo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-100">地理・マップの編集</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">場所名・エリア名</label>
                <input
                  type="text"
                  value={editingGeo.name}
                  onChange={(e) => setEditingGeo({ ...editingGeo, name: e.target.value })}
                  placeholder="例: パスタ処「アルド」"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">地理・構造・位置関係の説明</label>
                <textarea
                  rows={4}
                  value={editingGeo.description}
                  onChange={(e) => setEditingGeo({ ...editingGeo, description: e.target.value })}
                  placeholder="位置や概要、周辺環境を記述..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsGeoModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveGeo}
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
            if (onNext) onNext();
          }}
          className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors shadow-lg shadow-indigo-600/30"
        >
          <span>作品一覧に戻る</span>
        </button>
      </div>
    </div>
  );
};
