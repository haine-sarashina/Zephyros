import { invoke } from '@tauri-apps/api/core';
import { Project, SettingBible, Glossary, ReviewComment } from '../types';

export class ObsidianSyncService {
  /**
   * 単一ファイルを Obsidian Vault 内の指定相対パスへ保存する
   */
  static async saveFile(vaultPath: string, relativePath: string, content: string): Promise<boolean> {
    if (!vaultPath || !vaultPath.trim()) return false;
    try {
      await invoke('save_obsidian_file', {
        vaultPath: vaultPath.trim(),
        relativePath: relativePath.trim(),
        content: content,
      });
      return true;
    } catch (err) {
      console.warn(`ObsidianVaultファイル保存失敗 [${relativePath}]:`, err);
      return false;
    }
  }

  /**
   * プロジェクト全体を Obsidian Vault へ一括同期・保存する
   */
  static async syncProject(vaultPath: string, project: Project): Promise<number> {
    if (!vaultPath || !vaultPath.trim() || !project) return 0;

    let savedFilesCount = 0;
    const projectDir = `proj_${project.id}`;

    // 1. overall.md (コンセプト ＆ 全体あらすじ)
    const overallMd = this.formatOverallMd(project);
    if (await this.saveFile(vaultPath, `${projectDir}/overall.md`, overallMd)) {
      savedFilesCount++;
    }

    // 2. setting.md (設定資料集)
    const settingMd = this.formatSettingMd(project.bible);
    if (await this.saveFile(vaultPath, `${projectDir}/setting.md`, settingMd)) {
      savedFilesCount++;
    }

    // 3. dictionary.md (特殊用語辞典)
    const dictionaryMd = this.formatDictionaryMd(project.glossary);
    if (await this.saveFile(vaultPath, `${projectDir}/dictionary.md`, dictionaryMd)) {
      savedFilesCount++;
    }

    // 4. episodes/ 各話・各シーンのあらすじ・本文・レビューログ
    if (project.novelData && Array.isArray(project.novelData.chapters)) {
      for (let cIdx = 0; cIdx < project.novelData.chapters.length; cIdx++) {
        const chapter = project.novelData.chapters[cIdx];
        const epNumStr = String(cIdx + 1).padStart(2, '0');
        const epDir = `${projectDir}/episodes/ep${epNumStr}`;

        // 話全体の概要 epYY_summary.md
        const chSummaryMd = `# 第${cIdx + 1}話: ${chapter.title || '無題'}\n\n## 話のあらすじ\n${chapter.synopsis || 'あらすじ策定中'}\n`;
        if (await this.saveFile(vaultPath, `${epDir}/ep${epNumStr}_summary.md`, chSummaryMd)) {
          savedFilesCount++;
        }

        if (Array.isArray(chapter.scenes)) {
          for (let sIdx = 0; sIdx < chapter.scenes.length; sIdx++) {
            const scene = chapter.scenes[sIdx];
            const scNumStr = String(sIdx + 1).padStart(2, '0');

            // シーンあらすじ scene_ZZ_synopsis.md
            const scSynMd = `# 第${cIdx + 1}話 シーン${sIdx + 1}: ${scene.title || '無題'}\n\n## シーンあらすじ\n${scene.summary || 'あらすじ策定中'}\n`;
            if (await this.saveFile(vaultPath, `${epDir}/scene_${scNumStr}_synopsis.md`, scSynMd)) {
              savedFilesCount++;
            }

            // シーン本文 (完成稿) scene_ZZ_text.md
            if (scene.content) {
              const scTextMd = `# 第${cIdx + 1}話 シーン${sIdx + 1} 本文\n\n${scene.content}\n`;
              if (await this.saveFile(vaultPath, `${epDir}/scene_${scNumStr}_text.md`, scTextMd)) {
                savedFilesCount++;
              }
            }

            // 校閲・推敲対話ログ (Obsidian Callout表記) logs/epYY_sceneZZ_review.md
            if (Array.isArray(scene.reviewComments) && scene.reviewComments.length > 0) {
              const reviewLogMd = this.formatReviewLogMd(cIdx + 1, sIdx + 1, scene.title, scene.reviewComments);
              if (await this.saveFile(vaultPath, `${projectDir}/logs/ep${epNumStr}_scene_${scNumStr}_review.md`, reviewLogMd)) {
                savedFilesCount++;
              }
            }
          }
        }
      }
    }

    return savedFilesCount;
  }

  /**
   * overall.md のフォーマット
   */
  private static formatOverallMd(project: Project): string {
    const title = project.novelData?.title || project.title || '無題の物語';
    const subtitle = project.novelData?.subtitle || '';
    const rating = project.promptSettings.rating === 'r18' ? 'R-18 (成人向け)' : '全年齢向け';
    const themes = project.promptSettings.themes.join(', ');

    return `# ${title}
${subtitle ? `> **${subtitle}**\n` : ''}
- **管理ID**: \`${project.id}\`
- **作成日**: ${project.createdDate}
- **最終更新日**: ${project.lastUpdatedDate}
- **お題タグ**: ${themes}
- **レーティング**: ${rating}
- **目標全話数**: ${project.promptSettings.targetChapterCount || 12} 話 (約 ${project.promptSettings.targetWordCount || 100000} 字)

---

## 💡 メインコンセプト・キャッチコピー
${project.promptSettings.storyConcept}

---

## 📖 全体あらすじ
${project.novelData?.synopsis || project.promptSettings.detailedPrompt}
`;
  }

  /**
   * setting.md (設定資料集) のフォーマット
   */
  private static formatSettingMd(bible: SettingBible): string {
    let md = `# 設定資料集\n\n`;

    // 登場人物
    md += `## 👥 登場人物一覧 (${bible.characters.length}名)\n\n`;
    bible.characters.forEach((c) => {
      md += `### ${c.name} ${c.ruby ? `(${c.ruby})` : ''}\n`;
      md += `- **役割/立場**: ${c.role}\n`;
      md += `- **一人称/二人称**: 一人称: 「${c.firstPerson}」 / 二人称: 「${c.secondPerson}」\n`;
      md += `- **容姿・外見**: ${c.appearance}\n`;
      md += `- **性格・口調**: ${c.personality}\n`;
      md += `- **背景・目的**: ${c.background}\n`;
      if (c.illustrationPrompt) {
        md += `- **挿絵プロンプト**: \`${c.illustrationPrompt}\`\n`;
      }
      md += `\n`;
    });

    // 世界観・品物・道具
    md += `## 🔮 世界観・品物・道具 (${bible.worldBuilding.length}件)\n\n`;
    bible.worldBuilding.forEach((w) => {
      md += `### ${w.title} [${w.category}]\n`;
      md += `${w.content}\n\n`;
    });

    // 地理・舞台
    md += `## 🗺️ 地名・舞台 (${bible.geography.length}件)\n\n`;
    bible.geography.forEach((g) => {
      md += `### ${g.name}\n`;
      md += `${g.description}\n\n`;
    });

    return md;
  }

  /**
   * dictionary.md (特殊用語辞典) のフォーマット
   */
  private static formatDictionaryMd(glossary: Glossary): string {
    let md = `# 特殊用語辞典・ルビ表記\n\n`;

    // 用語一覧
    md += `## 📚 固有用語・造語 (${glossary.terms.length}件)\n\n`;
    glossary.terms.forEach((t) => {
      md += `### ${t.term} ${t.reading ? `(${t.reading})` : ''}\n`;
      md += `${t.description}\n\n`;
    });

    // ルビ表記一覧
    md += `## ✒️ 特殊ルビ表記 (${glossary.rubies.length}件)\n\n`;
    glossary.rubies.forEach((r) => {
      md += `- **${r.notation || `${r.kanji}《${r.ruby}》`}** (${r.kanji} → ${r.ruby})\n`;
    });

    return md;
  }

  /**
   * レビューログ (Callout 形式) のフォーマット
   */
  private static formatReviewLogMd(
    chNum: number,
    scNum: number,
    scTitle: string,
    comments: ReviewComment[]
  ): string {
    let md = `# 【第${chNum}話 シーン${scNum}: ${scTitle}】推敲・校閲履歴\n\n`;

    comments.forEach((cm, idx) => {
      if (cm.type === 'contradiction' || cm.type === 'typo') {
        md += `> [!danger] 編集AIの校閲指摘 #${idx + 1} [${cm.type}]\n`;
        if (cm.originalText) md += `> **原文**: \`${cm.originalText}\`\n`;
        if (cm.suggestedText) md += `> **提案**: \`${cm.suggestedText}\`\n`;
        md += `> **指摘内容**: ${cm.comment}\n\n`;
      } else {
        md += `> [!info] 作家AIの修正・対応ノート #${idx + 1}\n`;
        md += `> ${cm.comment}\n\n`;
      }
    });

    return md;
  }
}
