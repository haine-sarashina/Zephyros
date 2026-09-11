import React, { useState, useRef, useEffect } from 'react';
import { PromptSettings, SettingBible, Glossary, AISettings, NovelData, Chapter, ReviewComment } from '../types';
import { NovelEngine } from '../services/novelEngine';
import { Cpu, Play, Pause, ShieldCheck, FileText, Sparkles, RefreshCw, RotateCcw } from 'lucide-react';

interface GeneratorViewProps {
  projectId: string;
  promptSettings: PromptSettings;
  bible: SettingBible;
  glossary: Glossary;
  aiSettings: AISettings;
  novelData: NovelData | null;
  editorLogs?: string[];
  onSaveNovelData: (data: NovelData, projectId?: string) => void;
  onSaveBible: (bible: SettingBible, projectId?: string) => void;
  onSaveGlossary: (glossary: Glossary, projectId?: string) => void;
  onSaveBibleAndGlossary?: (bible: SettingBible, glossary: Glossary, projectId?: string) => void;
  onSaveEditorLogs?: (logs: string[], projectId?: string) => void;
  onViewManuscript: () => void;
}

interface ProjectSession {
  isGenerating: boolean;
  currentStatus: string;
  activeChapterIndex: number;
  activeSceneIndex: number;
  streamingText: string;
  editorLog: string[];
  abortController: AbortController | null;
}

const projectSessions: Record<string, ProjectSession> = {};

function getProjectSession(projectId: string): ProjectSession {
  if (!projectSessions[projectId]) {
    projectSessions[projectId] = {
      isGenerating: false,
      currentStatus: '待機中',
      activeChapterIndex: 0,
      activeSceneIndex: 0,
      streamingText: '',
      editorLog: [],
      abortController: null,
    };
  }
  return projectSessions[projectId];
}

export const GeneratorView: React.FC<GeneratorViewProps> = ({
  projectId,
  promptSettings,
  bible,
  glossary,
  aiSettings,
  novelData,
  editorLogs,
  onSaveNovelData,
  onSaveBible,
  onSaveGlossary,
  onSaveBibleAndGlossary,
  onSaveEditorLogs,
  onViewManuscript,
}) => {
  const [localNovelData, setLocalNovelData] = useState<NovelData | null>(novelData);

  useEffect(() => {
    setLocalNovelData(novelData);
  }, [novelData]);

  const currentNovelData = localNovelData || novelData;
  const currentSession = getProjectSession(projectId);

  // コンポーネント再マウント時にも作品別セッションまたは保存済みログから状態を復元
  const [isGenerating, setIsGeneratingState] = useState<boolean>(currentSession.isGenerating);
  const [currentStatus, setCurrentStatusState] = useState<string>(currentSession.currentStatus);
  const [startChapterIndex, setStartChapterIndex] = useState<number>(currentSession.activeChapterIndex);
  const [activeChapterIndex, setActiveChapterIndexState] = useState<number>(currentSession.activeChapterIndex);
  const [activeSceneIndex, setActiveSceneIndexState] = useState<number>(currentSession.activeSceneIndex);
  const [streamingText, setStreamingTextState] = useState<string>(currentSession.streamingText);

  const initialLogs = editorLogs || [];
  const [editorLog, setEditorLogState] = useState<string[]>(initialLogs);

  const streamingEndRef = useRef<HTMLDivElement>(null);

  // 親からの editorLogs または novelData/projectId 変更時の同期（別作品切り替え時に他作品のログが混入するのを完璧に遮断）
  useEffect(() => {
    const session = getProjectSession(projectId);
    setIsGeneratingState(session.isGenerating);
    setCurrentStatusState(session.currentStatus);
    setActiveChapterIndexState(session.activeChapterIndex);
    setActiveSceneIndexState(session.activeSceneIndex);
    setStreamingTextState(session.streamingText);

    const currentLogs = editorLogs || [];
    setEditorLogState(currentLogs);
    session.editorLog = currentLogs;

    if (!session.isGenerating) {
      session.streamingText = '';
      session.currentStatus = '待機中';
      setStreamingTextState('');
      setCurrentStatusState('待機中');
    }
  }, [projectId, editorLogs, novelData?.title]);

  // ステート変更を作品別セッションおよび親へ同期永続化
  const setIsGenerating = (val: boolean) => {
    currentSession.isGenerating = val;
    setIsGeneratingState(val);
  };

  const setCurrentStatus = (status: string) => {
    currentSession.currentStatus = status;
    setCurrentStatusState(status);
  };

  const setActiveChapterIndex = (idx: number) => {
    currentSession.activeChapterIndex = idx;
    setActiveChapterIndexState(idx);
  };

  const setActiveSceneIndex = (idx: number) => {
    currentSession.activeSceneIndex = idx;
    setActiveSceneIndexState(idx);
  };

  const setStreamingText = (updater: string | ((prev: string) => string)) => {
    setStreamingTextState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      currentSession.streamingText = next;
      return next;
    });
  };

  const formatLogWithTimestamp = (msg: string): string => {
    if (!msg || typeof msg !== 'string') return msg;
    if (/^\s*(?:\n\s*)?\[\d{2}:\d{2}(?::\d{2})?\]/.test(msg)) {
      return msg;
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timeTag = `[${hh}:${mm}:${ss}]`;

    if (msg.startsWith('\n')) {
      return `\n${timeTag} ${msg.trimStart()}`;
    }
    return `${timeTag} ${msg}`;
  };

  const setEditorLog = (updater: string[] | ((prev: string[]) => string[])) => {
    setEditorLogState((prev) => {
      const rawNext = typeof updater === 'function' ? updater(prev) : updater;
      const formattedNext = rawNext.map(formatLogWithTimestamp);
      currentSession.editorLog = formattedNext;
      if (onSaveEditorLogs) {
        onSaveEditorLogs(formattedNext, projectId);
      }
      return formattedNext;
    });
  };

  const isChapterCompleted = (ch: Chapter) => {
    if (ch.status === 'completed') return true;
    return ch.scenes.length > 0 && ch.scenes.every((sc) => sc.status === 'completed' || sc.wordCount > 0);
  };

  const isAllCompleted = currentNovelData?.chapters.length ? currentNovelData.chapters.every(isChapterCompleted) : false;

  // novelData 変更時に未完了の最初の章を自動検出して startChapterIndex に設定（非実行時のみ）
  useEffect(() => {
    if (!currentSession.isGenerating && currentNovelData && currentNovelData.chapters.length > 0) {
      let needsSave = false;
      const updatedNovel: NovelData = JSON.parse(JSON.stringify(currentNovelData));
      updatedNovel.chapters.forEach((ch) => {
        if (ch.status !== 'completed' && ch.scenes.length > 0 && ch.scenes.every((sc) => sc.wordCount > 0)) {
          ch.status = 'completed';
          needsSave = true;
        }
      });

      if (needsSave) {
        onSaveNovelData(updatedNovel);
        setLocalNovelData(updatedNovel);
      }

      const targetData = needsSave ? updatedNovel : currentNovelData;
      const firstIncompleteIdx = targetData.chapters.findIndex((ch) => !isChapterCompleted(ch));

      if (firstIncompleteIdx !== -1) {
        setStartChapterIndex(firstIncompleteIdx);
        setActiveChapterIndex(firstIncompleteIdx);
      } else {
        setStartChapterIndex(0);
        setActiveChapterIndex(0);
        if (currentSession.currentStatus === '待機中' || currentSession.currentStatus.includes('完了')) {
          setCurrentStatus(`全${targetData.chapters.length}話の執筆・校閲がすべて完了しました！（完結）`);
        }
      }
    }
  }, [currentNovelData]);

  // 1. プロット全体生成
  const handleGenerateOutline = async () => {
    // 別の作品の生成が進行中の場合はそれを安全に中断
    Object.entries(projectSessions).forEach(([id, s]) => {
      if (id !== projectId && s.isGenerating) {
        s.abortController?.abort();
        s.isGenerating = false;
        s.currentStatus = '他作品の生成が開始されたため中断されました';
      }
    });

    if (currentNovelData && currentNovelData.chapters.some((ch) => ch.scenes.some((sc) => sc.content && sc.content.trim().length > 0))) {
      if (!window.confirm('プロットを再生成すると、現在のプロット構成および執筆済みの原稿データが上書きされてリセットされます。実行してもよろしいですか？')) {
        return;
      }
    } else if (currentNovelData) {
      if (!window.confirm('現在のプロット案を破棄し、AIで新たに全話のプロットを再生成しますか？')) {
        return;
      }
    }

    setIsGenerating(true);
    const controller = new AbortController();
    currentSession.abortController = controller;

    setCurrentStatus(`執筆者AI (${aiSettings.writerModel}) が全話のプロット・構成案を策定中...`);
    setEditorLog(['[システム] プロット生成セッションを開始しました。']);

    try {
      const MAX_OUTLINE_RETRIES = 3;
      let outlineAttempt = 0;
      let result: any = null;

      while (outlineAttempt < MAX_OUTLINE_RETRIES && !result) {
        try {
          outlineAttempt++;
          result = await NovelEngine.generateOutline(
            aiSettings.ollamaUrl,
            aiSettings.writerModel,
            aiSettings.editorModel,
            promptSettings,
            bible,
            glossary,
            (msg) => setCurrentStatus(msg),
            controller.signal,
            aiSettings
          );
        } catch (err: any) {
          if (err.name === 'AbortError' || controller.signal.aborted) {
            throw err;
          }
          if (outlineAttempt < MAX_OUTLINE_RETRIES) {
            setEditorLog((prev) => [
              ...prev,
              `[警告] プロット生成中に一時的エラーが発生しました (${err.message})。自動リカバリ中 (リトライ ${outlineAttempt}/3 回目)...`,
            ]);
            setCurrentStatus(`一時的エラーのためプロット生成を自動リトライ中 (${outlineAttempt}/3 回目)...`);
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            throw new Error(`3回のリトライ後もプロットを生成できませんでした (${err.message})。`);
          }
        }
      }

      const newNovel: NovelData = {
        title: result.title,
        subtitle: result.subtitle,
        synopsis: result.synopsis,
        outline: result.outline,
        chapters: result.chapters,
        totalWordCount: 0,
        createdDate: new Date().toLocaleDateString(),
        lastUpdatedDate: new Date().toLocaleDateString(),
      };

      const nextBible = result.initialBible || bible;
      const nextGlossary = result.initialGlossary || glossary;

      if (onSaveBibleAndGlossary) {
        onSaveBibleAndGlossary(nextBible, nextGlossary, projectId);
      } else {
        if (result.initialBible) onSaveBible(result.initialBible, projectId);
        if (result.initialGlossary) onSaveGlossary(result.initialGlossary, projectId);
      }

      onSaveNovelData(newNovel, projectId);
      setLocalNovelData(newNovel);
      setStartChapterIndex(0);
      setActiveChapterIndex(0);

      const charCount = nextBible.characters.length;
      const worldCount = nextBible.worldBuilding.length;
      const geoCount = nextBible.geography.length;
      const termCount = nextGlossary.terms.length;
      const rubyCount = nextGlossary.rubies.length;

      setEditorLog((prev) => [
        ...prev,
        `[執筆者AI] タイトル「${result.title}」 全${result.chapters.length}話のプロット構築が完了しました！`,
        `[設定管理AI] 初期データ構築結果サマリー:`,
        `  - 設定資料集: 登場人物 ${charCount}名 / 世界観・品物 ${worldCount}件 / 地名 ${geoCount}件`,
        `  - 特殊用語辞典: 固有名詞・用語 ${termCount}件 / ルビ表記 ${rubyCount}件`,
        `[編集者AI] 全${result.chapters.length}話の構成案および設定データの整合性を承認しました。`,
      ]);
      setCurrentStatus('プロット作成完了。「執筆スタート / 再開」を押してください。');
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setCurrentStatus('プロット生成をキャンセルしました。');
      } else {
        console.error(e);
        setEditorLog((prev) => [...prev, `[エラー] ${e.message}`]);
        setCurrentStatus('エラーが発生しました。Ollamaの接続とモデル指定を確認してください。');
      }
    } finally {
      setIsGenerating(false);
      currentSession.abortController = null;
    }
  };

  // 2. 既にある生成済み原稿を一括スキャンして設定資料集 ＆ 特殊用語辞典へ反映
  // 3. 本文全自動執筆 & 校閲 ＆ 設定資料集・特殊用語自動抽出更新ループ
  const handleStartFullGeneration = async () => {
    // 別の作品の生成が進行中の場合はそれを安全に中断
    Object.entries(projectSessions).forEach(([id, s]) => {
      if (id !== projectId && s.isGenerating) {
        s.abortController?.abort();
        s.isGenerating = false;
        s.currentStatus = '他作品の生成が開始されたため中断されました';
      }
    });

    if (!currentNovelData || currentNovelData.chapters.length === 0) {
      alert('先にプロットを生成してください。');
      return;
    }

    let currentNovel: NovelData = JSON.parse(JSON.stringify(currentNovelData));
    let latestBible: SettingBible = JSON.parse(JSON.stringify(bible));
    let latestGlossary: Glossary = JSON.parse(JSON.stringify(glossary));

    // 全話完成時に「最初から再執筆」が押された場合は確認ダイアログを出して本文を初期化
    if (isAllCompleted && startChapterIndex === 0) {
      if (!window.confirm('全話の原稿本文をクリアして、第1話からすべて全自動で再執筆しますか？')) {
        return;
      }
      currentNovel.chapters.forEach((ch) => {
        ch.status = 'pending';
        ch.scenes.forEach((sc) => {
          sc.status = 'pending';
          sc.content = '';
          sc.wordCount = 0;
        });
        ch.wordCount = 0;
      });
      currentNovel.totalWordCount = 0;
      onSaveNovelData(currentNovel, projectId);
      setLocalNovelData(currentNovel);
    }

    setIsGenerating(true);
    const controller = new AbortController();
    currentSession.abortController = controller;

    try {
      setEditorLog((prev) => [
        ...prev,
        `\n>>> [システム] 第${startChapterIndex + 1}話 から自動執筆・校閲・設定抽出を開始します。`,
      ]);

      for (let cIdx = startChapterIndex; cIdx < currentNovel.chapters.length; cIdx++) {
        const chapter = currentNovel.chapters[cIdx];
        setActiveChapterIndex(cIdx);

        setEditorLog((prev) => [...prev, `\n=== 【${chapter.title}】 の執筆・校閲・設定更新を開始 ===`]);

        for (let sIdx = 0; sIdx < chapter.scenes.length; sIdx++) {
          // すでに本文が書かれていて完了しているシーンはスキップ
          const existingScene = chapter.scenes[sIdx];
          if (existingScene.status === 'completed' && existingScene.content && existingScene.content.trim().length > 500) {
            setEditorLog((prev) => [
              ...prev,
              `[システム] ${chapter.title} シーン ${sIdx + 1} は執筆済みのためスキップします (${existingScene.wordCount}字)。`,
            ]);
            continue;
          }

          // 中断チェック
          if (currentSession.abortController?.signal.aborted) {
            throw new DOMException('Aborted by user', 'AbortError');
          }

          // 1つのシーンの執筆・校閲・設定抽出に対する自動リカバリ・リトライ処理（最大3回）
          const MAX_SCENE_RETRIES = 3;
          let sceneAttempt = 0;
          let sceneSuccess = false;

          while (sceneAttempt < MAX_SCENE_RETRIES && !sceneSuccess) {
            try {
              sceneAttempt++;

              setActiveSceneIndex(sIdx);
              setStreamingText('');
              setCurrentStatus(
                sceneAttempt === 1
                  ? `執筆者AI (${aiSettings.writerModel}) が ${chapter.title} (シーン ${sIdx + 1}/3) を執筆中...`
                  : `一時的エラー発生のためシーン ${sIdx + 1} を自動リトライ執筆中 (${sceneAttempt}/3 回目)...`
              );

              // 直前の文脈サマリー（前話のあらすじ ＋ 直前シーンのラスト本文抜粋）
              let prevSummary = `【全体あらすじ】: ${currentNovel.synopsis}`;
              if (cIdx > 0) {
                const prevCh = currentNovel.chapters[cIdx - 1];
                prevSummary += `\n【前話（${prevCh.title}）あらすじ】: ${prevCh.synopsis}`;
              }

              let prevSceneExcerpt = '';
              if (sIdx > 0 && chapter.scenes[sIdx - 1]?.content) {
                const lastText = chapter.scenes[sIdx - 1].content.trim();
                prevSceneExcerpt = `\n【直前シーン（シーン ${sIdx}）のラスト本文】:\n...${lastText.slice(-600)}`;
              } else if (cIdx > 0) {
                const prevCh = currentNovel.chapters[cIdx - 1];
                const lastSceneOfPrevCh = prevCh.scenes[prevCh.scenes.length - 1];
                if (lastSceneOfPrevCh?.content) {
                  const lastText = lastSceneOfPrevCh.content.trim();
                  prevSceneExcerpt = `\n【前話（${prevCh.title}）最終シーンのラスト本文】:\n...${lastText.slice(-600)}`;
                }
              }

              if (prevSceneExcerpt) {
                prevSummary += prevSceneExcerpt;
              }

              // 執筆者AIがストリーミングで本文執筆
              let draftedContent = await NovelEngine.writeSceneContent(
                aiSettings.ollamaUrl,
                aiSettings.writerModel,
                promptSettings,
                latestBible,
                latestGlossary,
                chapter,
                sIdx,
                prevSummary,
                (chunk) => {
                  setStreamingText((prev) => {
                    const updated = prev + chunk;
                    if (streamingEndRef.current) {
                      streamingEndRef.current.scrollIntoView({ behavior: 'smooth' });
                    }
                    return updated;
                  });
                },
                currentSession.abortController.signal,
                aiSettings
              );

              if (!draftedContent || draftedContent.trim().length < 200) {
                throw new Error(`執筆者AIからの本文生成結果が空、または短すぎます (${draftedContent?.length || 0}字)。`);
              }

              // デジェネレーション（無限ループ・読点過多）のプログラム検知＆自動クレンジング
              const degenCheck = NovelEngine.detectAndFixDegeneration(draftedContent);
              if (degenCheck.hasDegeneration) {
                setEditorLog((prev) => [
                  ...prev,
                  `[システム警告] 生成文章に異常 (${degenCheck.reasons.join(' / ')}) を検知したため自動除染クレンジングを実行しました。`,
                ]);
                draftedContent = degenCheck.cleanedText;
              }

              // 中間原稿キャッシュ保存
              try {
                localStorage.setItem(`zephyros_temp_draft_ch_${cIdx + 1}_sc_${sIdx + 1}`, draftedContent);
              } catch {}

              // 編集者AI Gemma が校閲＆矛盾チェック
              const MAX_PROOFREAD_RETRIES = 2;
              let proofreadAttempt = 0;
              let isPassed = false;
              let lastReviewComments: ReviewComment[] = [];

              while (proofreadAttempt < MAX_PROOFREAD_RETRIES && !isPassed) {
                proofreadAttempt++;

                setCurrentStatus(
                  proofreadAttempt === 1
                    ? `編集者AI (${aiSettings.editorModel}) が設定矛盾・誤字脱字を校閲中...`
                    : `編集者AI (${aiSettings.editorModel}) が修正後の原稿を再校閲 (ダブルチェック ${proofreadAttempt}回目) 中...`
                );

                setEditorLog((prev) => [
                  ...prev,
                  proofreadAttempt === 1
                    ? `[執筆者AI] シーン ${sIdx + 1} の初稿執筆完了 (${draftedContent.length}字)。校閲中...`
                    : `[システム] 修正後の原稿 (${draftedContent.length}字) を編集者AIが再校閲 (ダブルチェック) 中...`
                ]);

                const review = await NovelEngine.proofreadScene(
                  aiSettings.ollamaUrl,
                  aiSettings.editorModel,
                  draftedContent,
                  latestBible,
                  latestGlossary,
                  chapter.title,
                  prevSummary,
                  currentSession.abortController.signal,
                  aiSettings
                );

                lastReviewComments = review.comments;

                if (review.comments.length > 0) {
                  // 1. 詳細ログ出力
                  review.comments.forEach((comm) => {
                    const typeLabel = comm.type === 'contradiction' ? '設定矛盾' : comm.type === 'typo' ? '誤字脱字' : '表現提案';
                    const orig = comm.originalText ? ` (対象箇所: "${comm.originalText}"` : '';
                    const sugg = comm.suggestedText ? ` → 修正案: "${comm.suggestedText}"` : '';
                    const endBracket = orig ? ')' : '';
                    setEditorLog((prev) => [
                      ...prev,
                      `[校閲指摘 (${typeLabel})] ${comm.comment}${orig}${sugg}${endBracket}`,
                    ]);
                  });

                  // 2. 誤字脱字(typo)のピンポイント自動置換処理
                  let autoFixedCount = 0;
                  review.comments.forEach((comm) => {
                    if (comm.type === 'typo' && comm.originalText && comm.suggestedText) {
                      if (draftedContent.includes(comm.originalText)) {
                        draftedContent = draftedContent.split(comm.originalText).join(comm.suggestedText);
                        autoFixedCount++;
                        setEditorLog((prev) => [
                          ...prev,
                          `[ピンポイント自動修正] 誤字脱字「${comm.originalText}」→「${comm.suggestedText}」に置換修正しました。`,
                        ]);
                      }
                    }
                  });

                  // 3. 重大な設定矛盾がある場合のみ全文リライト
                  if (review.hasCriticalError) {
                    if (proofreadAttempt < MAX_PROOFREAD_RETRIES) {
                      setEditorLog((prev) => [
                        ...prev,
                        `[編集者AI] 致命的な設定矛盾が検出されたため、執筆者AIに原稿の自動リライトを指示しています...`
                      ]);
                      setCurrentStatus(`執筆者AI (${aiSettings.writerModel}) が校閲指摘を反映して原稿を自動修正中...`);
                      setStreamingText('');

                      draftedContent = await NovelEngine.rewriteSceneWithFeedback(
                        aiSettings.ollamaUrl,
                        aiSettings.writerModel,
                        promptSettings,
                        latestBible,
                        latestGlossary,
                        chapter,
                        sIdx,
                        prevSummary,
                        draftedContent,
                        review.comments,
                        (chunk) => {
                          setStreamingText((prev) => {
                            const updated = prev + chunk;
                            if (streamingEndRef.current) {
                              streamingEndRef.current.scrollIntoView({ behavior: 'smooth' });
                            }
                            return updated;
                          });
                        },
                        currentSession.abortController.signal,
                        aiSettings
                      );

                      const rewriteDegen = NovelEngine.detectAndFixDegeneration(draftedContent);
                      if (rewriteDegen.hasDegeneration) {
                        setEditorLog((prev) => [
                          ...prev,
                          `[システム警告] リライト文章に異常を検知したため自動除染クレンジングを実行しました。`,
                        ]);
                        draftedContent = rewriteDegen.cleanedText;
                      }
                    } else {
                      setEditorLog((prev) => [
                        ...prev,
                        `[編集者AI] リトライ上限に達したため、現在稿で確定し次の処理へ進みます。`
                      ]);
                      isPassed = true;
                    }
                  } else {
                    isPassed = true;
                    setEditorLog((prev) => [
                      ...prev,
                      autoFixedCount > 0
                        ? `[編集者AI] 誤字脱字(${autoFixedCount}件)のピンポイント修正を完了し、原稿を承認しました！`
                        : `[編集者AI] 重大な設定矛盾なし。指摘内容を確認のうえ原稿を承認しました！`
                    ]);
                  }
                } else {
                  isPassed = true;
                  setEditorLog((prev) => [
                    ...prev,
                    proofreadAttempt === 1
                      ? `[編集者AI] 設定との矛盾なし・校閲クリア！`
                      : `[編集者AI] ★ 再校閲完了！ 修正箇所の検証クリア！新たな矛盾はありません！`
                  ]);
                }
              }

              // 原稿の整律・未閉じルビ《》の最終補正 ＆ 終了インジケーター付与
              const totalScenes = chapter.scenes.length;
              const isLastSceneInChapter = (sIdx === totalScenes - 1);
              const totalChapters = promptSettings.targetChapterCount || currentNovel.chapters.length || 12;
              const isLastChapter = (cIdx === totalChapters - 1);

              let endingIndicator = '';
              if (!isLastSceneInChapter) {
                endingIndicator = `（シーン${sIdx + 2}に続く）`;
              } else if (!isLastChapter) {
                endingIndicator = `（第${cIdx + 2}話に続く）`;
              } else {
                endingIndicator = `（全${totalChapters}話・完）`;
              }

              draftedContent = NovelEngine.sanitizeManuscript(draftedContent, endingIndicator);

              // 設定管理AIによる新要素の抽出 ＆ 設定資料集への反映
              setCurrentStatus('設定管理AIが校閲済み原稿から新登場の人物・品物・地名・用語を抽出中...');
              const episodeTag = `【第${cIdx + 1}話 ${sIdx === 0 ? '登場時' : '以降'}】`;
              const extractResult = await NovelEngine.extractAndUpdateBibleAndGlossary(
                aiSettings.ollamaUrl,
                aiSettings.editorModel,
                draftedContent,
                latestBible,
                latestGlossary,
                episodeTag,
                currentSession.abortController.signal,
                aiSettings
              );

              latestBible = extractResult.updatedBible;
              latestGlossary = extractResult.updatedGlossary;

              if (extractResult.updateLogs.length > 0) {
                extractResult.updateLogs.forEach((log) => {
                  setEditorLog((prev) => [...prev, log]);
                });
              }

              if (onSaveBibleAndGlossary) {
                onSaveBibleAndGlossary(latestBible, latestGlossary, projectId);
              } else {
                onSaveBible(latestBible, projectId);
                if (onSaveGlossary) onSaveGlossary(latestGlossary, projectId);
              }

              // 原稿データ更新
              chapter.scenes[sIdx].content = draftedContent;
              chapter.scenes[sIdx].wordCount = draftedContent.length;
              chapter.scenes[sIdx].status = 'completed';
              chapter.scenes[sIdx].reviewComments = lastReviewComments;

              // 話・全体文字数の再計算
              chapter.wordCount = chapter.scenes.reduce((sum, sc) => sum + sc.wordCount, 0);
              currentNovel.totalWordCount = currentNovel.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
              currentNovel.lastUpdatedDate = new Date().toLocaleDateString();

              onSaveNovelData(currentNovel, projectId);
              setLocalNovelData(currentNovel);

              sceneSuccess = true;
            } catch (sceneErr: any) {
              if (sceneErr.name === 'AbortError' || currentSession.abortController?.signal.aborted) {
                throw sceneErr;
              }

              if (sceneAttempt < MAX_SCENE_RETRIES) {
                setEditorLog((prev) => [
                  ...prev,
                  `[警告] ${chapter.title} シーン ${sIdx + 1} の処理中にエラーが発生しました (${sceneErr.message})。自動リカバリ中 (リトライ ${sceneAttempt}/3 回目)...`,
                ]);
                setCurrentStatus(`一時的エラーのためシーン ${sIdx + 1} を自動リカバリ中 (リトライ ${sceneAttempt}/3 回目)...`);
                setStreamingText('');
                await new Promise((resolve) => setTimeout(resolve, 2000));
              } else {
                throw new Error(`3回のリトライ後も ${chapter.title} シーン ${sIdx + 1} を生成できませんでした (${sceneErr.message})。`);
              }
            }
          }
        }
        chapter.status = 'completed';
        onSaveNovelData(currentNovel, projectId);
        setLocalNovelData(currentNovel);
      }

      setCurrentStatus('指定された話までの執筆・校閲・設定資料自動更新が完了しました！');
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setCurrentStatus('執筆処理を一時停止しました。いつでも「再開」ボタンで続きから執筆できます。');
      } else {
        console.error(e);
        setEditorLog((prev) => [...prev, `[エラー] 執筆処理中断: ${e.message}`]);
        setCurrentStatus('エラーにより執筆処理が中断しました。「再開」ボタンで続きから復帰できます。');
      }
    } finally {
      setIsGenerating(false);
      currentSession.abortController = null;
    }
  };

  const handlePause = () => {
    if (currentSession.abortController) {
      currentSession.abortController.abort();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 画面ヘッダー ＆ コントロールパネル */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <Cpu className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-slate-100">長編自動生成パイプライン</h2>
          </div>
          <p className="text-slate-400 text-xs">
            執筆者AI (<span className="text-indigo-300 font-semibold">{aiSettings.writerModel}</span>) と編集者AI (
            <span className="text-purple-300 font-semibold">{aiSettings.editorModel}</span>) が協調して自動生成します。
          </p>
        </div>

        {/* ボタン＆再開コントロール */}
        <div className="flex flex-wrap items-center gap-3">
          {!currentNovelData ? (
            <button
              onClick={handleGenerateOutline}
              disabled={isGenerating}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>1. 全話プロット生成</span>
            </button>
          ) : (
            <>
              {/* 開始話（再開位置）選択ドロップダウン */}
              <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] text-slate-400 font-medium">執筆開始位置:</span>
                <select
                  value={startChapterIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    setStartChapterIndex(idx);
                    setActiveChapterIndex(idx);
                  }}
                  disabled={isGenerating}
                  className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  {currentNovelData.chapters.map((ch, idx) => {
                    const isCompleted = isChapterCompleted(ch);
                    return (
                      <option key={ch.id} value={idx} className="bg-slate-900 text-slate-200">
                        {ch.title} {isCompleted ? '(執筆済み)' : '(未執筆)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <button
                onClick={handleGenerateOutline}
                disabled={isGenerating}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl transition-colors"
                title="プロット再生成"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {!isGenerating ? (
                <button
                  onClick={handleStartFullGeneration}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {isAllCompleted
                      ? '全話完結（最初から再執筆）'
                      : startChapterIndex > 0
                      ? `第${startChapterIndex + 1}話から執筆再開`
                      : '全話自動執筆スタート'}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>一時停止</span>
                </button>
              )}

              <button
                onClick={onViewManuscript}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>原稿閲覧</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ステータスバー */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isGenerating ? 'bg-indigo-400 animate-ping' : 'bg-slate-600'}`} />
          <span className="text-slate-300 font-medium">ステータス: {currentStatus}</span>
        </div>

        {currentNovelData && (
          <div className="flex items-center space-x-4 font-mono">
            <span className="text-slate-400">
              進捗: <strong className="text-indigo-300">{activeChapterIndex + 1}</strong> / {currentNovelData.chapters.length} 話 (シーン <strong className="text-purple-300">{activeSceneIndex + 1}</strong>)
            </span>
            <span className="text-slate-400">
              文字数: <strong className="text-emerald-400">{currentNovelData.totalWordCount.toLocaleString()}</strong> / {(promptSettings.targetWordCount || 100000).toLocaleString()} 字
            </span>
          </div>
        )}
      </div>

      {/* メイン 2カラム レイアウト (左: リアルタイム本文執筆, 右: 編集者AI校閲ログ) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左 2カラム: 本文執筆リアルタイムビュー */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col h-[560px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>
                {currentNovelData ? currentNovelData.title : '未生成'} — 本文執筆モニター
              </span>
            </h3>
            {streamingText && (
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800">
                生成中: {streamingText.length.toLocaleString()} 字
              </span>
            )}
          </div>

          <div className="flex-1 bg-slate-950 rounded-xl p-4 overflow-y-auto border border-slate-800/80 font-sans leading-relaxed text-sm text-slate-200 whitespace-pre-wrap selection:bg-indigo-900 select-text">
            {streamingText ? (
              <>
                {streamingText}
                <div ref={streamingEndRef} />
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 text-center">
                <Sparkles className="w-8 h-8 text-slate-600" />
                <p className="text-xs">
                  「執筆スタート / 再開」を押すと、執筆者AIがストリーミングで本文を執筆します。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 右 1カラム: 編集者AI (Gemma) 校閲・矛盾検出パネル */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 flex flex-col h-[560px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>編集者AI (Gemma) 校閲ログ</span>
            </h3>
          </div>

          <div className="flex-1 bg-slate-950 rounded-xl p-3 overflow-y-auto border border-slate-800/80 space-y-2 text-xs font-mono">
            {editorLog.length > 0 ? (
              editorLog.map((log, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-lg leading-relaxed whitespace-pre-wrap break-words ${
                    log.includes('[エラー]')
                      ? 'bg-rose-950/70 border border-rose-800 text-rose-300'
                      : log.includes('[編集者AI]')
                      ? 'bg-purple-950/60 border border-purple-800/80 text-purple-200'
                      : log.includes('[設定資料集') || log.includes('[特殊用語辞典')
                      ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-200'
                      : log.includes('[校閲指摘')
                      ? 'bg-amber-950/60 border border-amber-800/80 text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {log}
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 text-center text-xs">
                原稿の校閲結果・矛盾検出・設定自動更新ログがここに表示されます。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
