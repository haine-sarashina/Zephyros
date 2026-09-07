import JSZip from 'jszip';

export function sanitizeFilename(name: string): string {
  if (!name) return 'untitled';
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

export interface ExportableNovelData {
  title: string;
  subtitle?: string;
  synopsis?: string;
  chapters: Array<{
    title: string;
    scenes: Array<{
      title: string;
      content: string;
    }>;
  }>;
}

/**
 * シーンごとに分割したテキストファイルを小説タイトルフォルダ内にまとめてZip出力
 */
export async function exportNovelAsSplitTxtZip(novelData: ExportableNovelData) {
  if (!novelData || !novelData.chapters) return;

  const zip = new JSZip();
  const folderName = sanitizeFilename(novelData.title || 'Zephyros_原稿');
  const folder = zip.folder(folderName) || zip;

  let sceneCounter = 1;

  novelData.chapters.forEach((ch) => {
    const chTitleClean = sanitizeFilename(ch.title);
    ch.scenes.forEach((sc) => {
      const scTitleClean = sanitizeFilename(sc.title);
      const numStr = String(sceneCounter).padStart(3, '0');
      const fileName = `${numStr}_${chTitleClean}_${scTitleClean}.txt`;

      folder.file(fileName, sc.content || '');
      sceneCounter++;
    });
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * シーンごとに分割したMarkdownファイルを小説タイトルフォルダ内にまとめてZip出力
 */
export async function exportNovelAsSplitMdZip(novelData: ExportableNovelData) {
  if (!novelData || !novelData.chapters) return;

  const zip = new JSZip();
  const folderName = sanitizeFilename(novelData.title || 'Zephyros_原稿');
  const folder = zip.folder(folderName) || zip;

  let sceneCounter = 1;

  novelData.chapters.forEach((ch) => {
    const chTitleClean = sanitizeFilename(ch.title);
    ch.scenes.forEach((sc) => {
      const scTitleClean = sanitizeFilename(sc.title);
      const numStr = String(sceneCounter).padStart(3, '0');
      const fileName = `${numStr}_${chTitleClean}_${scTitleClean}.md`;

      const content = `# ${ch.title} - ${sc.title}\n\n${sc.content || ''}\n`;
      folder.file(fileName, content);
      sceneCounter++;
    });
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}_Markdown.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
