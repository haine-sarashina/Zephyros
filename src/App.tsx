import { useState, useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask } from '@tauri-apps/plugin-dialog';
import { ActiveTab, PromptSettings, SettingBible, Glossary, AISettings, NovelData, Project } from './types';
import { StoreManager } from './store/novelStore';
import { OllamaService } from './services/ollamaService';
import { Header } from './components/Header';
import { ProjectListView } from './components/ProjectListView';
import { PromptSetupView } from './components/PromptSetupView';
import { SettingBibleView } from './components/SettingBibleView';
import { GlossaryView } from './components/GlossaryView';
import { AISettingsView } from './components/AISettingsView';
import { GeneratorView } from './components/GeneratorView';
import './App.css';

interface AppWindowState {
  windowX?: number | null;
  windowY?: number | null;
  windowWidth?: number | null;
  windowHeight?: number | null;
  isMaximized?: boolean;
}

export function App() {
  // 初期表示タブを「作品一覧 (projects)」に指定
  const [activeTab, setActiveTab] = useState<ActiveTab>('projects');

  // 全作品リスト ＆ アクティブ作品ID
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // 共通 AI 設定
  const [aiSettings, setAiSettings] = useState<AISettings>(StoreManager.getAISettings());
  const [ollamaConnected, setOllamaConnected] = useState<boolean>(false);

  // 自動アップデート確認
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const update = await check();
        if (update) {
          const yes = await ask(
            `新しいバージョン (${update.version}) が見つかりました。\nアップデートをダウンロード・インストールして再起動しますか？`,
            { title: "Zephyros 更新通知", kind: "info" }
          );
          if (yes) {
            await update.downloadAndInstall();
            await relaunch();
          }
        }
      } catch (e) {
        console.log("アプデ確認スキップ (開発モードやオフライン等):", e);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // ウィンドウ位置・サイズの復元
  useEffect(() => {
    getVersion().then((ver) => {
      getCurrentWindow().setTitle(`Zephyros v${ver} - 小説自動生成`).catch(() => {});
    }).catch(() => {});

    invoke<AppWindowState>("load_app_state")
      .then(async (state) => {
        const win = getCurrentWindow();
        const dpi = await import("@tauri-apps/api/dpi");
        if (state.isMaximized) {
          try { await win.maximize(); } catch {}
        } else {
          if (state.windowWidth && state.windowHeight) {
            try {
              await win.setSize(new dpi.LogicalSize(state.windowWidth, state.windowHeight));
            } catch {}
          }
          if (state.windowX != null && state.windowY != null) {
            try {
              await win.setPosition(new dpi.LogicalPosition(state.windowX, state.windowY));
            } catch {}
          }
        }
        await win.show();
      })
      .catch(async () => {
        try {
          await getCurrentWindow().show();
        } catch {}
      });
  }, []);

  // 定期的なウィンドウ状態保存（5秒ごと）+ 終了時保存
  const saveStateRef = useRef<() => Promise<void>>(async () => {});
  saveStateRef.current = async () => {
    try {
      const win = getCurrentWindow();
      const size = await win.innerSize();
      const pos = await win.outerPosition();
      const factor = await win.scaleFactor();
      const maximized = await win.isMaximized();
      const state: AppWindowState = {
        windowX: maximized ? null : Math.round(pos.x / factor),
        windowY: maximized ? null : Math.round(pos.y / factor),
        windowWidth: maximized ? null : Math.round(size.width / factor),
        windowHeight: maximized ? null : Math.round(size.height / factor),
        isMaximized: maximized,
      };
      await invoke("save_app_state", { state });
    } catch {}
  };

  useEffect(() => {
    const interval = setInterval(() => { saveStateRef.current?.(); }, 5000);
    const handler = () => { saveStateRef.current?.(); };
    window.addEventListener("beforeunload", handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handler);
    };
  }, []);

  // 初回マウント時に全プロジェクト読み込み（ディスクファイル projects.json と自動同期）
  useEffect(() => {
    StoreManager.loadDiskProjectsAsync().then((loadedProjects) => {
      setProjects(loadedProjects);
      let actId = StoreManager.getActiveProjectId();
      if (!actId || !loadedProjects.some((p) => p.id === actId)) {
        if (loadedProjects.length > 0) {
          actId = loadedProjects[0].id;
          StoreManager.setActiveProjectId(actId);
        }
      }
      setActiveProjectId(actId);
    });
  }, []);

  const checkOllamaStatus = async () => {
    try {
      const connected = await OllamaService.isServerConnected(aiSettings.ollamaUrl);
      setOllamaConnected(connected);
    } catch {
      setOllamaConnected(false);
    }
  };

  useEffect(() => {
    checkOllamaStatus();
  }, [aiSettings.ollamaUrl]);

  // 現在アクティブなプロジェクトオブジェクトの取得
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  // 各種更新・保存ハンドラー (作品単位で独立保存)
  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId);
    StoreManager.setActiveProjectId(projectId);
  };

  const handleCreateNewProject = () => {
    const newProj = StoreManager.createNewProject();
    const updatedProjects = StoreManager.getProjects();
    setProjects(updatedProjects);
    setActiveProjectId(newProj.id);
    // 新規作成時にお題設定タブへ自動遷移！
    setActiveTab('prompt');
  };

  const handleDeleteProject = (projectId: string) => {
    StoreManager.deleteProject(projectId);
    const updatedProjects = StoreManager.getProjects();
    setProjects(updatedProjects);
    const newActId = StoreManager.getActiveProjectId();
    setActiveProjectId(newActId);
  };

  const getCurrentProject = () => {
    if (activeProjectId) {
      const p = StoreManager.getProjectById(activeProjectId);
      if (p) return p;
    }
    return activeProject;
  };

  const isWritingStarted = Boolean(
    activeProject?.novelData &&
    (activeProject.novelData.chapters.length > 0 || activeProject.novelData.totalWordCount > 0)
  );

  const handleSavePrompt = (newSettings: PromptSettings) => {
    const current = getCurrentProject();
    if (!current) return;
    const writingStarted = Boolean(
      current.novelData &&
      (current.novelData.chapters.length > 0 || current.novelData.totalWordCount > 0)
    );
    if (writingStarted) return;
    const updated = { ...current, promptSettings: newSettings };
    StoreManager.saveProject(updated);
    setProjects(StoreManager.getProjects());
  };

  const handleSaveBible = (newBible: SettingBible) => {
    const current = getCurrentProject();
    if (!current) return;
    const updated = { ...current, bible: newBible };
    StoreManager.saveProject(updated);
    setProjects(StoreManager.getProjects());
  };

  const handleSaveGlossary = (newGlossary: Glossary) => {
    const current = getCurrentProject();
    if (!current) return;
    const updated = { ...current, glossary: newGlossary };
    StoreManager.saveProject(updated);
    setProjects(StoreManager.getProjects());
  };

  const handleSaveBibleAndGlossary = (newBible: SettingBible, newGlossary: Glossary) => {
    const current = getCurrentProject();
    if (!current) return;
    const updated = { ...current, bible: newBible, glossary: newGlossary };
    StoreManager.saveProject(updated);
    setProjects(StoreManager.getProjects());
  };

  const handleSaveNovelData = (newNovelData: NovelData) => {
    const current = getCurrentProject();
    if (!current) return;
    const updated = {
      ...current,
      title: newNovelData.title || current.title,
      novelData: newNovelData
    };
    StoreManager.saveProject(updated);
    setProjects(StoreManager.getProjects());
  };

  const handleSaveEditorLogs = (logs: string[]) => {
    const current = getCurrentProject();
    if (!current) return;
    const updated = { ...current, editorLogs: logs };
    StoreManager.saveProject(updated);
    setProjects(StoreManager.getProjects());
  };

  const handleSaveAISettings = (newAISettings: AISettings) => {
    setAiSettings(newAISettings);
    StoreManager.saveAISettings(newAISettings);
    checkOllamaStatus();
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* ヘッダー */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProjectTitle={activeProject?.novelData?.title || activeProject?.title || '作品未選択'}
        totalWordCount={activeProject?.novelData?.totalWordCount || 0}
        ollamaConnected={ollamaConnected}
        onCheckOllama={checkOllamaStatus}
      />

      {/* メインコンテンツエリア */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* 初期画面: 作品一覧 */}
        {activeTab === 'projects' && (
          <ProjectListView
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={handleSelectProject}
            onCreateNewProject={handleCreateNewProject}
            onDeleteProject={handleDeleteProject}
            onUpdateNovelData={handleSaveNovelData}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {/* お題・設定 */}
        {activeTab === 'prompt' && activeProject && (
          <PromptSetupView
            key={`prompt-${activeProject.id}`}
            settings={activeProject.promptSettings}
            onSave={handleSavePrompt}
            onNext={() => setActiveTab('projects')}
            isWritingStarted={isWritingStarted}
            aiSettings={aiSettings}
          />
        )}

        {/* 設定資料集 */}
        {activeTab === 'bible' && activeProject && (
          <SettingBibleView
            key={`bible-${activeProject.id}`}
            bible={activeProject.bible}
            glossary={activeProject.glossary}
            editorLogs={activeProject.editorLogs}
            onSave={handleSaveBible}
            onSaveGlossary={handleSaveGlossary}
            onSaveBibleAndGlossary={handleSaveBibleAndGlossary}
            onNext={() => setActiveTab('projects')}
          />
        )}

        {/* 特殊用語辞典 */}
        {activeTab === 'glossary' && activeProject && (
          <GlossaryView
            key={`glossary-${activeProject.id}`}
            glossary={activeProject.glossary}
            onSave={handleSaveGlossary}
            onNext={() => setActiveTab('projects')}
          />
        )}

        {/* 長編生成パイプライン */}
        {activeTab === 'generate' && activeProject && (
          <GeneratorView
            key={`generate-${activeProject.id}`}
            promptSettings={activeProject.promptSettings}
            bible={activeProject.bible}
            glossary={activeProject.glossary}
            aiSettings={aiSettings}
            novelData={activeProject.novelData}
            editorLogs={activeProject.editorLogs}
            onSaveNovelData={handleSaveNovelData}
            onSaveBible={handleSaveBible}
            onSaveGlossary={handleSaveGlossary}
            onSaveBibleAndGlossary={handleSaveBibleAndGlossary}
            onSaveEditorLogs={handleSaveEditorLogs}
            onViewManuscript={() => setActiveTab('projects')}
          />
        )}

        {/* AI・LLM設定 */}
        {activeTab === 'ai-settings' && (
          <AISettingsView
            settings={aiSettings}
            onSave={handleSaveAISettings}
            onCheckStatus={checkOllamaStatus}
          />
        )}
      </main>
    </div>
  );
}

export default App;
