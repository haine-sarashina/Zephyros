import React, { useState, useEffect } from 'react';
import { PromptSettings, AISettings } from '../types';
import { OllamaService } from '../services/ollamaService';
import { Sparkles, Plus, X, Save, Check, Lock, Dices, Loader2, AlertCircle } from 'lucide-react';

interface PromptSetupViewProps {
  settings: PromptSettings;
  onSave: (settings: PromptSettings) => void;
  onNext: () => void;
  isWritingStarted?: boolean;
  aiSettings?: AISettings;
}

export const PromptSetupView: React.FC<PromptSetupViewProps> = ({
  settings,
  onSave,
  onNext,
  isWritingStarted = false,
  aiSettings,
}) => {
  const [formState, setFormState] = useState<PromptSettings>(settings);
  const [newTagInput, setNewTagInput] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [isGeneratingGacha, setIsGeneratingGacha] = useState(false);
  const [gachaError, setGachaError] = useState<string | null>(null);

  // 外部からの初期設定更新時のみ同期（再レンダリング無限ループを防止）
  useEffect(() => {
    setFormState(settings);
  }, [settings.storyConcept, settings.detailedPrompt, settings.tone, settings.targetAudience, settings.targetChapterCount, settings.targetWordCount, settings.themes.join(',')]);

  // 状態更新と同時に親状態へ安全に保存・同期するヘルパー
  const updateStateAndSave = (updater: (prev: PromptSettings) => PromptSettings) => {
    setFormState((prev) => {
      const next = updater(prev);
      if (!isWritingStarted) {
        onSave(next);
      }
      return next;
    });
  };

  const extractJson = (text: string): string => {
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
    const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (markdownMatch) {
      cleaned = markdownMatch[1];
    }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return cleaned.slice(firstBrace, lastBrace + 1);
    }
    return cleaned;
  };

  // ガチャ (AIによるコンセプト ＆ あらすじリアルタイム生成)
  const handleGachaRoll = async () => {
    if (isWritingStarted || isGeneratingGacha) return;

    setIsGeneratingGacha(true);
    setGachaError(null);

    const baseUrl = aiSettings?.ollamaUrl || 'http://localhost:11434';
    const model = aiSettings?.writerModel || 'qwen2.5:32b';
    const themes = formState.themes.length > 0 ? formState.themes : ['異世界', 'ダンジョン', 'パスタ屋'];

    const systemPrompt = `あなたはプロのライトノベル作家・アイデア発想AIです。
ユーザーが指定した【お題キーワード】を全て活かし、日本語として自然で美しく、読者がワクワクする長編小説の「メインコンセプト（キャッチコピー）」と「あらすじ」を創作してください。

【重要制約】
・お題キーワードに指定された要素のみを軸にし、キーワードに含まれていないメタ単語（「ガチャ」等）を勝手にストーリーのテーマや作中設定として挿入しないでください。

必ず以下のJSON形式のみを出力してください。思考プロセス(<think>)や解説、Markdown装飾は含めないでください。

{
  "storyConcept": "メインコンセプト・キャッチコピー（50字程度。キーワードを自然に組み合わせたキャッチーな文言）",
  "detailedPrompt": "【あらすじ】\\nから始まる詳しく魅力的なあらすじ（300〜500字程度。主人公の設定、舞台、メイン展開など）"
}`;

    const userPrompt = `【お題キーワード】: ${themes.join(', ')}

上記のお題をすべて自然に組み込んだ、オリジナルで魅力的な物語を1案作成してください。
実行するたびに異なる切り口やジャンル感（コメディ、バトルファンタジー、スローライフ、ミステリー、日常系など）、展開のアイデアにしてください。`;

    try {
      const useThink = aiSettings?.thinkCommandTargets?.gacha !== false;
      const aiOptions = {
        thinkMode: useThink ? ('nothink' as const) : ('none' as const),
        keepAlive: aiSettings?.keepAlive || '-1',
      };

      const rawResponse = await OllamaService.chat(baseUrl, model, systemPrompt, userPrompt, 0.85, undefined, false, aiOptions);
      const jsonStr = extractJson(rawResponse);
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // AIがJSON形式で返さなかった場合のテキスト抽出フォールバック
        parsed = {
          storyConcept: rawResponse.slice(0, 60).replace(/[\r\n]+/g, ' '),
          detailedPrompt: rawResponse,
        };
      }

      if (parsed.storyConcept || parsed.detailedPrompt) {
        updateStateAndSave((prev) => ({
          ...prev,
          storyConcept: parsed.storyConcept || `${themes.join('×')}の物語`,
          detailedPrompt: parsed.detailedPrompt || rawResponse,
        }));
      } else {
        throw new Error('AIからの応答フォーマットを抽出できませんでした。');
      }
    } catch (err: any) {
      console.error('Gacha AI generation error:', err);
      const msg = err?.message || String(err);
      if (msg.includes('not found') || msg.includes('404')) {
        setGachaError(`指定されたモデル '${model}' がOllamaにインストールされていません。設定画面でローカルに存在するモデルを選択するか、ターミナルで 'ollama pull ${model}' を実行してください。`);
      } else {
        setGachaError(`AIコンセプトの生成に失敗しました (${msg})。設定画面でモデル名や接続状態を確認してください。`);
      }
    } finally {
      setIsGeneratingGacha(false);
    }
  };

  const handleAddTag = () => {
    if (isWritingStarted) return;
    if (!newTagInput.trim()) return;
    if (formState.themes.includes(newTagInput.trim())) return;
    updateStateAndSave((prev) => ({
      ...prev,
      themes: [...prev.themes, newTagInput.trim()],
    }));
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    if (isWritingStarted) return;
    updateStateAndSave((prev) => ({
      ...prev,
      themes: prev.themes.filter((t) => t !== tag),
    }));
  };

  const handleSave = () => {
    if (isWritingStarted) return;
    onSave(formState);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 執筆開始済みロック警告バナー */}
      {isWritingStarted && (
        <div className="bg-amber-950/60 border border-amber-800/80 rounded-2xl p-4 flex items-center space-x-3 text-amber-200 shadow-md">
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs leading-relaxed">
            <strong className="block text-amber-300 font-bold mb-0.5 text-sm">
              お題・基本設定はロックされています
            </strong>
            この作品はすでに執筆（またはプロット構成）が開始されているため、設定の矛盾や物語の破綻を防ぐ目的でお題・プロンプト・構成数値の変更は不可となっています。
          </div>
        </div>
      )}

      {/* 画面ヘッダー */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-2">
          <Sparkles className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-slate-100">作品のお題・基本設定</h2>
        </div>
        <p className="text-slate-400 text-sm">
          物語のコアとなる3〜4個のお題キーワードと、物語のコンセプト・詳細なプロンプトを指定します。
        </p>
      </div>

      {/* 1. お題キーワード (タグ) 設定 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
          <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
          <span>お題キーワード (3〜4個設定)</span>
        </h3>

        <div className="flex flex-wrap gap-2 items-center">
          {formState.themes.map((theme) => (
            <span
              key={theme}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-sm font-medium shadow-sm"
            >
              <span>#{theme}</span>
              {!isWritingStarted && (
                <button
                  onClick={() => handleRemoveTag(theme)}
                  className="hover:text-rose-400 text-indigo-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          ))}

          {!isWritingStarted && formState.themes.length < 6 && (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="新しいお題 (例: パスタ屋)"
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 w-44"
              />
              <button
                onClick={handleAddTag}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. ストーリーコンセプト ＆ 詳細プロンプト */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
            <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
            <span>ストーリーコンセプト ＆ 詳細指示</span>
          </h3>

          {!isWritingStarted && (
            <button
              onClick={handleGachaRoll}
              disabled={isGeneratingGacha}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isGeneratingGacha ? 'animate-pulse' : ''
              }`}
            >
              {isGeneratingGacha ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI思考中...</span>
                </>
              ) : (
                <>
                  <Dices className="w-4 h-4" />
                  <span>AIガチャ（コンセプト自動生成）</span>
                </>
              )}
            </button>
          )}
        </div>

        {gachaError && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-300 p-3 rounded-xl text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{gachaError}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              メインコンセプト・キャッチコピー
            </label>
            <input
              type="text"
              disabled={isWritingStarted}
              value={formState.storyConcept}
              onChange={(e) => updateStateAndSave((prev) => ({ ...prev, storyConcept: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-950/50"
              placeholder="例: 異世界のダンジョンで経営しているパスタ屋の物語"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              あらすじ・詳細な指定（キャラクター、世界観、ストーリーの展開など）
            </label>
            <textarea
              rows={6}
              disabled={isWritingStarted}
              value={formState.detailedPrompt}
              onChange={(e) => updateStateAndSave((prev) => ({ ...prev, detailedPrompt: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-950/50"
              placeholder="展開や主人公の設定などを詳しく記述できます..."
            />
          </div>
        </div>
      </div>

      {/* 3. トーン ＆ 構成指定 (12話 10万字) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
          <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
          <span>作品属性 ＆ 文字数構成</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">作風 / トーン</label>
            <input
              type="text"
              disabled={isWritingStarted}
              value={formState.tone}
              onChange={(e) => updateStateAndSave((prev) => ({ ...prev, tone: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-950/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">想定読者層</label>
            <input
              type="text"
              disabled={isWritingStarted}
              value={formState.targetAudience}
              onChange={(e) => updateStateAndSave((prev) => ({ ...prev, targetAudience: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-950/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">全話数（連載構成）</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                disabled={isWritingStarted}
                value={formState.targetChapterCount}
                onChange={(e) => updateStateAndSave((prev) => ({ ...prev, targetChapterCount: parseInt(e.target.value) || 12 }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-950/50"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">話</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">目標全文字数（文庫本1冊分）</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step="1000"
                disabled={isWritingStarted}
                value={formState.targetWordCount}
                onChange={(e) => updateStateAndSave((prev) => ({ ...prev, targetWordCount: parseInt(e.target.value) || 100000 }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-950/50"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">文字</span>
            </div>
          </div>
        </div>
      </div>

      {/* フッターアクション */}
      <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-800">
        {savedNotice && (
          <span className="text-xs text-emerald-400 flex items-center space-x-1">
            <Check className="w-4 h-4" />
            <span>設定を保存しました</span>
          </span>
        )}
        {!isWritingStarted && (
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>保存</span>
          </button>
        )}
        <button
          onClick={() => {
            if (!isWritingStarted) handleSave();
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
