// Zephyros 状態管理 Store (マルチプロジェクト ＆ 個別作品永続化対応)

import { PromptSettings, SettingBible, Glossary, AISettings, Project } from '../types';

const STORAGE_KEYS = {
  PROJECTS: 'zephyros_projects_list',
  ACTIVE_PROJECT_ID: 'zephyros_active_project_id',
  AI_SETTINGS: 'zephyros_ai_settings',
};

// サンプル初期データ (新規作品作成時のデフォルトテンプレート)
export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  themes: ['異世界', 'ダンジョン', 'パスタ屋'],
  storyConcept: '異世界のダンジョンで経営しているパスタ屋の物語',
  detailedPrompt: 'ダンジョンの深層にひっそりと佇むパスタ専門店。魔物の肉や珍しいダンジョン野菜を活かした極上のパスタを求めて、冒険者や魔王軍の幹部までがお腹を空かせてやってくる。主人公は元イタリアンシェフで、ダンジョンに召喚された男。料理の腕と機転でダンジョンのトラブルを解決していく。',
  tone: 'ほのぼのコメディ＆グルメファンタジー',
  targetAudience: 'ライトノベルファン、ファンタジー・グルメ好き',
  targetChapterCount: 12,
  targetWordCount: 100000,
};

export const DEFAULT_SETTING_BIBLE: SettingBible = {
  characters: [
    {
      id: 'char-1',
      name: 'アルド (マルコ・アルド)',
      ruby: 'アルド',
      role: '主人公 / パスタ屋シェフ',
      firstPerson: '俺',
      secondPerson: 'あんた',
      appearance: '30代前半の男性。黒髪を後ろで縛り、白のコックコートの上に革の胸当てを着用。腕には料理傷と包丁ダコがある。',
      personality: '普段は温厚でマイペース。料理へのこだわりは非常に強く、食材の冒涜や店内での暴走行為には毅然とした態度を取る。',
      background: '元は東京の老舗イタリアンシェフ。突如ダンジョン深層へトリップし、遺された魔導厨房を使ってパスタ屋を開業した。',
      illustrationPrompt: 'handsome 30yo male chef, black tied hair, white chef coat with leather chest armor, dungeon kitchen background, fantasy anime style'
    },
    {
      id: 'char-2',
      name: 'ルシア',
      ruby: 'ルシア',
      role: 'ヒロイン / 看板娘・元冒険者',
      firstPerson: '私',
      secondPerson: 'アルドさん / あなた',
      appearance: '金髪サイドポニーのハーフエルフの少女。給仕服風の冒険者衣装。背中に小剣を刺している。',
      personality: '明るく元気が良い。食いしん坊。ダンジョン食材の知識が豊富で、接客と材料採集の手伝いをこなす。',
      background: 'ソロ冒険者として餓死寸前だったところをアルドの「ペペロンチーノ」に救われ、給仕として働くようになった。',
      illustrationPrompt: 'cute blonde half-elf waitress, adventurer outfit, serving pasta, energetic smile, dungeon restaurant background'
    }
  ],
  worldBuilding: [
    {
      id: 'wb-1',
      category: 'dungeon',
      title: 'ダンジョン第45層「静寂の石室」',
      content: '普段は強力な魔物が徘徊する深層だが、アルドの店周辺は「結界魔法陣」により絶対安全圏となっている。'
    },
    {
      id: 'wb-2',
      category: 'magic',
      title: '魔導調理器具',
      content: 'ダンジョンの魔素を熱源や冷蔵力に変換する古代遺物。パスタをアルデンテに茹で上げる魔力湯沸かし器が完備。'
    }
  ],
  geography: [
    {
      id: 'geo-1',
      name: 'パスタ処「アルド」',
      description: 'ダンジョン第45層のセーフゾーンに位置する店。カウンター8席、テーブル4卓。木の温もりがあるイタリアン大衆食堂風。'
    }
  ]
};

export const DEFAULT_GLOSSARY: Glossary = {
  terms: [
    {
      id: 'term-1',
      term: '魔導パスタ',
      reading: 'まどうぱすた',
      description: 'ダンジョン特産の魔素を含んだ麦で作られた小麦粉パスタ。茹で上がるとほのかに発光する。',
      ignoreInProofreading: true
    },
    {
      id: 'term-2',
      term: 'ペパロニ・ボア',
      reading: 'ぺぱろに・ぼあ',
      description: '第30層に生息する巨大なイノシシ型の魔物。肉が熟成サラミのような風味を持つ。',
      ignoreInProofreading: true
    }
  ],
  rubies: [
    {
      id: 'ruby-1',
      kanji: '異世界',
      ruby: 'いせかい',
      notation: '異世界《いせかい》'
    },
    {
      id: 'ruby-2',
      kanji: '魔導書',
      ruby: 'ルモワール',
      notation: '魔導書《ルモワール》'
    }
  ]
};

export const DEFAULT_AI_SETTINGS: AISettings = {
  ollamaUrl: 'http://localhost:11434',
  writerModel: 'qwen2.5:32b',
  editorModel: 'gemma2:27b',
  temperature: 0.7,
  topP: 0.9,
  thinkMode: 'nothink',
  keepAlive: '-1',
};

// 初期デフォルトプロジェクトの作成
const createDefaultSampleProject = (): Project => {
  return {
    id: `proj-${Date.now()}`,
    title: '異世界のダンジョンで経営しているパスタ屋の物語',
    createdDate: new Date().toLocaleDateString(),
    lastUpdatedDate: new Date().toLocaleDateString(),
    promptSettings: DEFAULT_PROMPT_SETTINGS,
    bible: DEFAULT_SETTING_BIBLE,
    glossary: DEFAULT_GLOSSARY,
    novelData: null,
  };
};

import { invoke } from '@tauri-apps/api/core';

const syncToDisk = (projects: Project[]) => {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    invoke('save_disk_projects', { jsonData: JSON.stringify(projects, null, 2) }).catch((e) => {
      console.warn('Failed to sync projects to disk:', e);
    });
  }
};

export class StoreManager {
  /**
   * ディスク (appData) からのプロジェクト読み込み & 連動同期
   */
  static async loadDiskProjectsAsync(): Promise<Project[]> {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      try {
        const raw = await invoke<string>('load_disk_projects');
        if (raw && raw.trim() !== '' && raw.trim() !== '[]') {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(parsed));
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Failed to load projects from disk:', e);
      }
    }
    const current = this.getProjects();
    syncToDisk(current);
    return current;
  }

  /**
   * 全プロジェクトの取得
   */
  static getProjects(): Project[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (!raw) {
      // 旧データからの移行チェック
      const oldPrompt = localStorage.getItem('zephyros_prompt_settings');
      const oldBible = localStorage.getItem('zephyros_setting_bible');
      const oldGlossary = localStorage.getItem('zephyros_glossary');
      const oldNovel = localStorage.getItem('zephyros_novel_data');

      let initialProj: Project;
      if (oldPrompt || oldNovel) {
        const parsedNovel = oldNovel ? JSON.parse(oldNovel) : null;
        initialProj = {
          id: `proj-${Date.now()}`,
          title: parsedNovel?.title || 'ダンジョンパスタ屋の物語',
          createdDate: new Date().toLocaleDateString(),
          lastUpdatedDate: new Date().toLocaleDateString(),
          promptSettings: oldPrompt ? JSON.parse(oldPrompt) : DEFAULT_PROMPT_SETTINGS,
          bible: oldBible ? JSON.parse(oldBible) : DEFAULT_SETTING_BIBLE,
          glossary: oldGlossary ? JSON.parse(oldGlossary) : DEFAULT_GLOSSARY,
          novelData: parsedNovel,
        };
      } else {
        initialProj = createDefaultSampleProject();
      }

      const list = [initialProj];
      localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(list));
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, initialProj.id);
      syncToDisk(list);
      return list;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * 現在アクティブなプロジェクトIDの取得
   */
  static getActiveProjectId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
  }

  /**
   * アクティブプロジェクトの変更設定
   */
  static setActiveProjectId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, id);
  }

  /**
   * IDによる特定プロジェクトの取得
   */
  static getProjectById(id: string): Project | null {
    const projects = this.getProjects();
    return projects.find((p) => p.id === id) || null;
  }

  /**
   * 新規作品（プロジェクト）の作成
   */
  static createNewProject(title?: string): Project {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      title: title || '新規作品',
      createdDate: new Date().toLocaleDateString(),
      lastUpdatedDate: new Date().toLocaleDateString(),
      promptSettings: {
        themes: ['ファンタジー', '冒険', '謎'],
        storyConcept: '新規作品のストーリーコンセプト',
        detailedPrompt: '',
        tone: 'ライトノベル・ファンタジー',
        targetAudience: '全年齢ファンタジー読者',
        targetChapterCount: 12,
        targetWordCount: 100000,
      },
      bible: {
        characters: [],
        worldBuilding: [],
        geography: [],
      },
      glossary: {
        terms: [],
        rubies: [],
      },
      novelData: null,
    };

    const projects = this.getProjects();
    const updatedList = [newProj, ...projects];
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(updatedList));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, newProj.id);
    syncToDisk(updatedList);
    return newProj;
  }

  /**
   * 特定プロジェクトの更新保存
   */
  static saveProject(project: Project): void {
    const projects = this.getProjects();
    const idx = projects.findIndex((p) => p.id === project.id);
    project.lastUpdatedDate = new Date().toLocaleDateString();
    
    if (idx !== -1) {
      projects[idx] = project;
    } else {
      projects.unshift(project);
    }
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    syncToDisk(projects);
  }

  /**
   * プロジェクトの削除
   */
  static deleteProject(id: string): void {
    const projects = this.getProjects().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    syncToDisk(projects);
    if (this.getActiveProjectId() === id) {
      if (projects.length > 0) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, projects[0].id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
      }
    }
  }

  /**
   * 共通 AI 設定
   */
  static getAISettings(): AISettings {
    const data = localStorage.getItem(STORAGE_KEYS.AI_SETTINGS);
    return data ? JSON.parse(data) : DEFAULT_AI_SETTINGS;
  }

  static saveAISettings(settings: AISettings): void {
    localStorage.setItem(STORAGE_KEYS.AI_SETTINGS, JSON.stringify(settings));
  }
}
