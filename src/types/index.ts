// Zephyros データ型定義

export interface PromptSettings {
  themes: string[]; // お題タグ (3〜4個)
  storyConcept: string; // ストーリーコンセプト（例: 異世界のダンジョンで経営しているパスタ屋の物語）
  detailedPrompt: string; // 詳細な内容指定
  tone: string; // 作品のトーン＆マナー
  targetAudience: string; // ターゲット読者
  targetChapterCount: number; // 全話数 (デフォルト 12)
  targetWordCount: number; // 目標文字数 (デフォルト 100000)
}

export interface CharacterSetting {
  id: string;
  name: string; // 名前
  ruby: string; // ふりがな
  role: string; // 役割 (主人公、ヒロイン、ライバル、等)
  firstPerson: string; // 一人称 (僕、私、俺、等)
  secondPerson: string; // 二人称 (君、お前、あなた、等)
  appearance: string; // 外見・特徴
  personality: string; // 性格・口調
  background: string; // 背景・経歴
  illustrationPrompt: string; // 挿絵用生成キーワード
  updatedEpisode?: string; // 最終更新話 (例: 【第3話目以降】)
}

export interface WorldSetting {
  id: string;
  category: 'system' | 'magic' | 'dungeon' | 'culture' | 'other';
  title: string; // 設定項目名・品物名
  content: string; // 詳細説明
  updatedEpisode?: string; // 更新時期タグ (例: 【第1話登場時】)
}

export interface LocationSetting {
  id: string;
  name: string; // 場所名・ダンジョン階層名
  description: string; // 地理・概要
  parentLocationId?: string; // 上位の場所
  updatedEpisode?: string; // 更新時期タグ
}

export interface SettingBible {
  characters: CharacterSetting[];
  worldBuilding: WorldSetting[];
  geography: LocationSetting[];
}

export interface GlossaryTerm {
  id: string;
  term: string; // 固有名詞・造語
  reading: string; // 読み
  description: string; // 用語説明
  ignoreInProofreading: boolean; // 校閲時に誤字扱いしないフラグ
  updatedEpisode?: string; // 更新時期タグ
}

export interface RubySetting {
  id: string;
  kanji: string; // 漢字
  ruby: string; // ルビ
  notation: string; // 記法表記 (例: 異世界《いせかい》)
  updatedEpisode?: string; // 更新時期タグ
}

export interface Glossary {
  terms: GlossaryTerm[];
  rubies: RubySetting[];
}

export interface AISettings {
  ollamaUrl: string; // デフォルト: http://localhost:11434
  writerModel: string; // 執筆者モデル (例: qwen2.5:32b, qwen3.8:27b)
  editorModel: string; // 編集者モデル (例: gemma2:27b, gemma4:31b)
  temperature: number; // 0.7
  topP: number;
  thinkMode?: 'nothink' | 'think' | 'none'; // 思考プロンプト制御 ('nothink', 'think', 'none')
  keepAlive?: string; // ローカルAI常駐設定 ('-1', '5m', '10m', '30m', '60m', '0')
}

export interface ReviewComment {
  id: string;
  timestamp: string;
  type: 'typo' | 'contradiction' | 'suggestion' | 'praise';
  originalText?: string;
  suggestedText?: string;
  comment: string;
  resolved: boolean;
}

export interface Scene {
  id: number;
  title: string;
  summary: string;
  content: string;
  wordCount: number;
  status: 'pending' | 'writing' | 'editing' | 'completed';
  reviewComments: ReviewComment[];
}

export interface Chapter {
  id: number;
  title: string;
  synopsis: string;
  scenes: Scene[];
  wordCount: number;
  status: 'pending' | 'writing' | 'editing' | 'completed';
}

export interface NovelData {
  title: string;
  subtitle: string;
  synopsis: string;
  outline: string;
  chapters: Chapter[];
  totalWordCount: number;
  createdDate: string;
  lastUpdatedDate: string;
}

// 個別作品プロジェクト単位のデータ
export interface Project {
  id: string;
  title: string;
  createdDate: string;
  lastUpdatedDate: string;
  promptSettings: PromptSettings;
  bible: SettingBible;
  glossary: Glossary;
  novelData: NovelData | null;
  editorLogs?: string[];
}

export type ActiveTab = 'projects' | 'prompt' | 'bible' | 'glossary' | 'generate' | 'manuscript' | 'ai-settings';

// AIによる自動設定抽出レスポンス型
export interface ExtractedSettingDelta {
  newCharacters?: Array<{
    name: string;
    ruby?: string;
    role?: string;
    firstPerson?: string;
    secondPerson?: string;
    appearance?: string;
    personality?: string;
    background?: string;
    illustrationPrompt?: string;
  }>;
  updatedCharacters?: Array<{
    name: string;
    updateNote: string; // 追加情報や変化（例: 「実は女性であることが判明」）
  }>;
  newWorldItems?: Array<{
    category?: 'system' | 'magic' | 'dungeon' | 'culture' | 'other';
    title: string;
    content: string;
  }>;
  updatedWorldItems?: Array<{
    title: string;
    updateNote: string;
  }>;
  newLocations?: Array<{
    name: string;
    description: string;
  }>;
  updatedLocations?: Array<{
    name: string;
    updateNote: string;
  }>;
  newTerms?: Array<{
    term: string;
    reading?: string;
    description?: string;
  }>;
  newRubies?: Array<{
    kanji: string;
    ruby: string;
  }>;
}
