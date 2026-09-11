// 小説自動生成 ＆ マルチエージェント協調エンジン (設定・用語自動抽出・履歴管理機能付き)

import { PromptSettings, SettingBible, Glossary, Chapter, ReviewComment, ExtractedSettingDelta, CharacterSetting, WorldSetting, LocationSetting, GlossaryTerm, RubySetting, NovelData, SystemPrompts } from '../types';
import { OllamaService } from './ollamaService';

export const DEFAULT_SYSTEM_PROMPTS: SystemPrompts = {
  generateOutlineStep1: `あなたはプロの長編小説構成作家・ストーリーディレクターです。
ユーザーの設定プロンプトに基づき、長編小説のタイトル・作品概要・【主要登場人物】【世界観設定】【地名・地理】【初期特殊用語】のみを策定してください。

必ず以下のJSON形式のみを出力してください：
{
  "title": "作品タイトル",
  "subtitle": "サブタイトル・キャッチコピー",
  "synopsis": "全体あらすじ（300〜500字程度）",
  "characters": [
    { "name": "名前", "ruby": "ふりがな", "role": "主人公/ヒロイン等", "firstPerson": "「私」", "secondPerson": "「あなた」", "appearance": "外見", "personality": "性格", "background": "背景" }
  ],
  "worldBuilding": [
    { "title": "設定名", "category": "culture", "content": "詳細解説" }
  ],
  "geography": [
    { "name": "地名・施設名", "description": "概要" }
  ],
  "terms": [
    { "term": "用語名", "reading": "よみがな（ひらがな）", "description": "用語の意味・背景・詳細解説" }
  ],
  "rubies": [
    { "kanji": "対象漢字", "ruby": "ルビ/読み（ひらがな）" }
  ]
}`,

  generateOutlineStep2: `あなたはプロの長編小説構成作家です。
第{{chNum}}話の【章タイトル】【話のあらすじ】【2〜4つの詳細シーン構成】を作成してください。

必ず以下のJSON形式のみを出力してください：
{
  "title": "第{{chNum}}話の章タイトル",
  "synopsis": "第{{chNum}}話のあらすじ（150〜300字）",
  "scenes": [
    { "title": "シーン1", "summary": "シーン1のテーマ・展開・情景・登場人物" },
    { "title": "シーン2", "summary": "シーン2のテーマ・展開・情景・登場人物" }
  ]
}`,

  writeSceneContent: `あなたは長編小説のプロ執筆者（ライターAI）です。
情景描写、感情描写、登場人物の対話を用いて、物語の本文を執筆してください。

【執筆・文章ルール（厳格順守）】
1. 1つのシーンにつき 1,500字〜2,500字程度の描写を書き上げ、途中で切れずにシーンとしてきれいに完結させてください。
2. **台詞の末尾に句点（。）を絶対に付けないでください**（誤: 『「〜〜。」』 → 正: 『「〜〜」』）。台詞の最後は必ず『」』で閉じてください。
3. **文章の最後は必ず『。』『」』『！』『？』『……』などの適切な終止記号で締めくくってください**。文章の途中でブツッと切れた不完全な状態で終わらせないでください。
4. **前後関係の接続と整合性**: 提供された「直前シーンのラスト本文」および状況を引き継ぎ、登場人物の行動・位置関係や時間の流れが自然につながるように記述してください。不自然な場面飛躍や設定矛盾を防止してください。
5. 設定資料集に登録されている口調・一人称・二人称・人間関係を厳格に守ってください。
6. 特殊用語辞典に登録されている造語やルビ表記（例: 異世界《いせかい》）を積極的に活用してください。
7. 地名や作品固有コード等を除き、本文内に不必要な英単語（例: oversized）をそのまま使用せず、必ずカタカナ（例: オーバーサイズ）で記述してください。
8. **ルビのルール（厳格順守）**:
   - ひらがなやカタカナ表記の単語にはルビを付けないでください（例: 『パン』『あした』等にルビは不要です）。
   - ルビは人名・地名等の固有名詞の漢字部分、または『強敵《とも》』『宇宙《そら》』などの特殊な読みを行う漢字にのみ付与してください。
   - ルビは『ひらがな』だけでなく、『火球魔法《ファイアーボール》』『聖剣《エクスカリバー》』のようにカタカナのルビも使用可能です。
   - ルビを付与する場合は必ず「漢字《ルビ》」の形式とし、《 を開いた場合は必ず 》 で閉じてください。
9. JSONフォーマット、HTMLタグ、思考プロセス(<think>)は出力しないでください。純粋な日本語の小説本文のみを出力してください。`,

  proofreadScene: `あなたは文芸誌のベテラン編集者（校閲エディター）です。
出来上がった原稿をチェックし、設定との【致命的な設定矛盾】や【明確な誤字脱字・表記崩れ】を検出してください。

【厳律・校閲チェックルール】
0. **原稿形式の判定（原稿不備の絶対却下）**: もし校閲対象の原稿が日本語の小説本文（地の文やセリフ）ではなく、JSON構造や設定データ（\`newCharacters\`, \`updatedCharacters\`等）になっている場合は原稿不成立の致命的エラーです。即座に hasCriticalError: true とし、"type": "contradiction", "comment": "原稿が小説の本文ではなく設定JSONデータになっています。設定データではなく地の文と対話で構成された日本語の小説本文として執筆し直してください。" を返してください。
1. 特殊用語辞典に登録されている造語や特殊ルビ表記は「誤字ではありません」。
2. 設定との致命的な矛盾（一人称・性格・外見・役割等の食い違い）が存在する場合のみ hasCriticalError: true としてください。
3. 単純な誤字脱字（typo）や語尾・表現の提案（suggestion）は hasCriticalError: false としてください。
4. **英単語・アルファベット混入のチェック**: 地名や作品固有コード等を除き、日本語の本文内に不用意に残っている英単語（例: "oversized" → "オーバーサイズ"、"casual" → "カジュアル" など）は typo として指摘し、必ず "originalText" ('oversized') と "suggestedText" ('オーバーサイズ') を指定してください。
5. **ルビ表記・記号崩れのチェック**: 《 の閉じ忘れ（例: "夕暮れ《ゆうぐれ" → "夕暮れ《ゆうぐれ》"）やルビの脱落・カッコ崩れは typo として指摘し、必ず "originalText" と "suggestedText" を指定してください。
6. **台詞末尾の句点（。）および文末切れのチェック**: 台詞の末尾に「。」が含まれる場合（例: 『「〜〜。」』）や、文章の最後が句点・終止記号なく途切れている場合は typo（表記崩れ）として指摘し、"originalText" と "suggestedText" を指定してください。
7. **文章崩れ・フレーズ連続反復・読点異常のチェック**: 同一文節の無限繰り返しや読点（、）の過剰多用が含まれる場合は即座に hasCriticalError: true とし、"type": "contradiction", "comment": "文章の同一フレーズ無限ループまたは読点過剰崩れを検出" と指定してください。
8. typo（誤字脱字・表記崩れ）を指摘する場合は、必ず "originalText" (誤りの原文) と "suggestedText" (正解・置換後のテキスト) の両方を正確に指定してください。
9. 本文の再生成は行わず、指示通りのJSONフォーマットのみを返してください。

必ず以下のJSON形式でのみ出力してください：

{
  "hasCriticalError": false,
  "comments": [
    {
      "type": "contradiction" または "typo" または "suggestion",
      "originalText": "対象箇所の原文",
      "suggestedText": "修正後の正しいテキスト（typoの場合必須）",
      "comment": "指摘理由"
    }
  ]
}`,

  rewriteSceneWithFeedback: `あなたは長編小説のプロ執筆者（ライターAI）です。
編集者AIから提出された校閲指摘（矛盾点や誤字脱字）を修正し、完成度の高い修正稿を執筆してください。

【修正・文章ルール】
1. 指摘された矛盾点や表現の不整合を確実に修正してください。
2. **台詞の末尾に句点（。）を絶対に付けないでください**（誤: 『「〜〜。」』 → 正: 『「〜〜」』）。台詞の最後は必ず『」』で閉じてください。
3. **文章の最後は必ず『。』『」』『！』『？』『……』などの適切な終止記号で締めくくってください**。文章の途中でブツッと切れた不完全な状態で終わらせないでください。
4. 前のシーン・前話との状況・時間のつながりに不自然な飛躍がないよう自然に接続してください。
5. **ルビのルール**: ひらがな・カタカナ単語にルビを付けず、固有名詞や『強敵《とも》』『火球魔法《ファイアーボール》』のように漢字部分にのみ付与してください。
6. 本文中に不用意な英単語（例: oversized）が含まれている場合はカタカナ表記に修正してください。
7. ルビ表記（《ルビ》）の閉じ忘れや形式不備がある場合は修復してください。
8. 修正箇所以外の優れた情景描写、感情描写、文体や対話のテンポは保持してください。
9. 解説や挨拶、思考プロセス(<think>)は一切含めず、純粋な修正本文のみを出力してください。`,

  extractSettingDelta: `あなたは小説の設定・用語抽出エージェントです。
渡された小説の原稿本文から、登場する「人物」「品物・アイテム」「地名・場所」「固有用語」「ルビ」を抽出し、現在の設定資料集と比較して新規追加要素または設定の変化・追記情報を判断してください。

【厳格な抽出禁止ルール（絶対厳守）】
1. セリフの一節、日常会話のフレーズ、文章の断片（例: 「～は休養中」「～で伝える」「～残ってる」等）は【絶対抽出禁止】です。
2. 「1 の 1」「第X章」「◯の部屋」「〜の比喩」などの数値、章節の見出し記号、文章の文脈比喩表現は【絶対抽出禁止】です。
3. 明確な名詞句・固有の固有名詞（例: 「アルド」「静寂の石室」「魔導調理器具」「ペペロンチーノ」など）のみを厳格に抽出してください。
4. "category" は項目に応じて厳格に分類してください:
   - "culture": 品物・道具・料理・武器・防具・文化
   - "magic": 魔法・スキル・能力・呪文・結界
   - "dungeon": ダンジョン階層・部屋・罠・セーフゾーン
   - "system": 社会制度・ギルド・通貨・階級・国家

必ず以下のJSON形式でのみ出力してください：

{
  "newCharacters": [
    { "name": "キャラクターの本名（「（主人公）」等の注釈カッコ不可）", "ruby": "ふりがな（ひらがな）", "role": "役割・職業", "firstPerson": "一人称代名詞1語のみ（例: 「私」「俺」）", "secondPerson": "二人称代名詞1語のみ（例: 「あなた」「君」）", "appearance": "外見", "personality": "性格", "background": "背景", "illustrationPrompt": "画像生成AI用の英語タグ（例: 1girl, silver hair, anime style）" }
  ],
  "updatedCharacters": [
    { "name": "既存キャラ名", "updateNote": "新しく判明した事実や変化の説明" }
  ],
  "newWorldItems": [
    { "title": "品物・料理・道具名", "category": "culture", "content": "説明" }
  ],
  "updatedWorldItems": [
    { "title": "既存品物名", "updateNote": "追加説明や新情報" }
  ],
  "newLocations": [
    { "name": "場所名", "description": "説明" }
  ],
  "updatedLocations": [
    { "name": "既存場所名", "updateNote": "追加説明" }
  ],
  "newTerms": [
    { "term": "固有名詞・造語", "reading": "読み", "description": "説明" }
  ],
  "newRubies": [
    { "kanji": "漢字", "ruby": "ルビ" }
  ]
}`
};

export class NovelEngine {
  /**
   * 1. 設定資料・特殊用語を含むシステムコンテキストの生成
   */
  private static buildBibleContext(bible: SettingBible, glossary: Glossary): string {
    let context = '【設定資料集 (Setting Bible)】\n';
    
    context += '\n■ 登場人物:\n';
    bible.characters.forEach(c => {
      context += `- ${c.name} (${c.ruby}) / 役割:${c.role} / 一人称:${c.firstPerson} / 二人称:${c.secondPerson}\n  口調・性格: ${c.personality}\n  外見: ${c.appearance}\n  背景: ${c.background}\n`;
    });

    context += '\n■ 世界観・背景・品物:\n';
    bible.worldBuilding.forEach(w => {
      context += `- [${w.category}] ${w.title}: ${w.content}\n`;
    });

    context += '\n■ 地理・場所:\n';
    bible.geography.forEach(g => {
      context += `- ${g.name}: ${g.description}\n`;
    });

    context += '\n【特殊用語辞典（固有名詞・造語・特殊ルビ）】\n';
    context += '※ 以下の語句は作品固有の正規表現または造語であり、誤字ではありません。優先して使用してください:\n';
    glossary.terms.forEach(t => {
      context += `- ${t.term} (${t.reading}): ${t.description}\n`;
    });
    glossary.rubies.forEach(r => {
      context += `- ${r.kanji} 《${r.ruby}》 (表記ルール: ${r.notation})\n`;
    });

    return context;
  }

  /**
   * LLMの出力結果が小説本文ではなくJSONオブジェクトであるか判定する
   */
  static isJsonOutput(text: string): boolean {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('```json')) return true;
    if (/^[\s\r\n]*\{\s*"(?:newCharacters|updatedCharacters|newWorldItems|updatedWorldItems|title|chapters)"/i.test(trimmed)) return true;
    if (/"newCharacters"\s*:|"updatedCharacters"\s*:|"newWorldItems"\s*:/i.test(trimmed)) return true;
    return false;
  }

  /**
   * 誤ってJSON形式で出力された応答の中から、小説本文（prose/content/text等）の文字列値をレスキュー・抽出する
   */
  static extractProseFromAmbiguousJson(text: string): string {
    if (!text) return '';
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        const candidate = parsed.prose || parsed.content || parsed.text || parsed.story || parsed.manuscript || parsed.scene || parsed.body;
        if (typeof candidate === 'string' && candidate.trim().length >= 100) {
          return candidate.trim();
        }
      }
    } catch (_) {
      const match = text.match(/"(?:prose|content|text|story|manuscript|body)"\s*:\s*"([^"]{100,})"/i);
      if (match) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
    }
    return '';
  }

  /**
   * 途切れた未完成のJSON文字列を、LIFOスタックにより直前の完結要素まで巻戻して完全修復・パースする
   */
  private static repairPartialJson(jsonStr: string): string {
    let str = jsonStr.trim();
    if (!str) return '{}';

    try {
      JSON.parse(str);
      return str;
    } catch (_) {}

    // 全体に対して二重引用符の修正を事前適用
    const fixedStr = this.fixUnescapedQuotes(str);
    try {
      JSON.parse(fixedStr);
      return fixedStr;
    } catch (_) {}

    const tryClose = (candidate: string): string | null => {
      let s = candidate
        .replace(/,\s*$/, '')
        .replace(/:\s*$/, '')
        .replace(/,\s*([\}\]])/g, '$1');

      let inString = false;
      let escaped = false;
      const stack: string[] = [];

      for (let i = 0; i < s.length; i++) {
        const char = s[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') stack.push('}');
          else if (char === '[') stack.push(']');
          else if (char === '}' || char === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === char) {
              stack.pop();
            }
          }
        }
      }

      if (inString) {
        if (s.endsWith('\\')) s = s.slice(0, -1);
        s += '"';
      }

      s = s.replace(/,\s*$/, '').replace(/:\s*$/, '');

      for (let i = stack.length - 1; i >= 0; i--) {
        s += stack[i];
      }

      s = s.replace(/,\s*([\}\]])/g, '$1');

      try {
        JSON.parse(s);
        return s;
      } catch (_) {
        return null;
      }
    };

    // 末尾から文字単位で巻き戻しテスト
    for (let len = fixedStr.length; len > 0; len--) {
      const candidate = fixedStr.slice(0, len).trim();
      const result = tryClose(candidate);
      if (result) return result;
    }

    return str;
  }

  /**
   * 日本語文字列内の未エスケープの二重引用符 (") を ” に修正する
   */
  private static fixUnescapedQuotes(jsonStr: string): string {
    let result: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (char === '\\' && !escaped) {
        escaped = true;
        result.push(char);
        continue;
      }

      if (char === '"' && !escaped) {
        if (!inString) {
          inString = true;
          result.push(char);
        } else {
          const rest = jsonStr.slice(i + 1).trimStart();
          if (/^(?:,|:|\}|\]|\n|\r|$)/.test(rest)) {
            inString = false;
            result.push(char);
          } else {
            result.push('”');
          }
        }
      } else {
        if (escaped) escaped = false;
        result.push(char);
      }
    }
    return result.join('');
  }

  /**
   * JSON文字列値内部の未エスケープの改行・タブ文字を \n や \t に変換する
   */
  private static fixUnescapedNewlinesInStringValues(jsonStr: string): string {
    let result: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (char === '\\' && !escaped) {
        escaped = true;
        result.push(char);
        continue;
      }

      if (char === '"' && !escaped) {
        inString = !inString;
        result.push(char);
        continue;
      }

      if (inString) {
        if (char === '\n') {
          result.push('\\n');
        } else if (char === '\r') {
          // skip CR
        } else if (char === '\t') {
          result.push('\\t');
        } else {
          result.push(char);
        }
      } else {
        result.push(char);
      }

      if (escaped) escaped = false;
    }
    return result.join('');
  }

  /**
   * JSONパース不可能な生のLLMテキストからプロット情報を正規表現で救出する最終フォールバック
   */
  // @ts-ignore
  private static _extractOutlineFromRawText(text: string, _targetChapterCount: number = 12): any {
    const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/) || text.match(/タイトル[：:]\s*([^\n]+)/);
    const subtitleMatch = text.match(/"subtitle"\s*:\s*"([^"]+)"/);
    const synopsisMatch = text.match(/"synopsis"\s*:\s*"([^"]+)"/) || text.match(/あらすじ[：:]\s*([^\n]+)/);

    const title = titleMatch ? titleMatch[1] : '無題の物語';
    const subtitle = subtitleMatch ? subtitleMatch[1] : '';
    const synopsis = synopsisMatch ? synopsisMatch[1] : text.slice(0, 200).replace(/[\r\n]+/g, ' ');

    const chapters: any[] = [];
    const chapterMatches = text.matchAll(/\{\s*"id"\s*:\s*(\d+)\s*,\s*"title"\s*:\s*"([^"]+)"\s*(?:,\s*"synopsis"\s*:\s*"([^"]+)")?/g);
    for (const m of chapterMatches) {
      chapters.push({
        id: parseInt(m[1], 10),
        title: m[2],
        synopsis: m[3] || ''
      });
    }

    if (chapters.length === 0) {
      const rawChapterMatches = text.matchAll(/(第\d+話[^\n:]*)[：:]?\s*([^\n]*)/g);
      let idx = 1;
      for (const m of rawChapterMatches) {
        chapters.push({
          id: idx++,
          title: m[1].trim(),
          synopsis: m[2].trim()
        });
      }
    }

    return {
      title,
      subtitle,
      synopsis,
      outline: synopsis,
      chapters,
      characters: [],
      worldBuilding: [],
      geography: [],
      terms: [],
      rubies: []
    };
  }

  /**
   * 補助: LLMの生の返答から堅牢にJSONを抽出・復元・パース
   */
  private static cleanAndParseJson<T = any>(text: string): T {
    if (!text || !text.trim()) {
      throw new Error('LLMからの応答が空でした。');
    }

    // 1. 思考プロセス (<think>...</think>, <thought>..., <reasoning>...) の徹底除去
    let cleaned = text
      .replace(/<(?:think|thought|reasoning|details)>[\s\S]*?<\/(?:think|thought|reasoning|details)>/gi, '')
      .replace(/<(?:think|thought|reasoning|details)>[\s\S]*$/gi, ''); // 未閉じ思考タグの末尾削除

    // 2. Markdownコードブロック ```json ... ``` の抽出
    const markdownMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (markdownMatch) {
      cleaned = markdownMatch[1];
    } else {
      const startMatch = cleaned.match(/```(?:json)?\s*([\s\S]*)$/i);
      if (startMatch) {
        cleaned = startMatch[1];
      }
    }

    // 3. 最も外側の波カッコ { または 角カッコ [ から開始
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    if (startIdx !== -1) {
      cleaned = cleaned.slice(startIdx);
    }

    cleaned = cleaned.trim();

    // 試行1: 通常パース
    try {
      return JSON.parse(cleaned);
    } catch (_) {}

    // 試行2: 改行文字修正 ＋ 通常パース
    const newlineFixed = this.fixUnescapedNewlinesInStringValues(cleaned);
    try {
      return JSON.parse(newlineFixed);
    } catch (_) {}

    // 試行3: 内部引用符修正 ＋ 通常パース
    const quoteFixed = this.fixUnescapedQuotes(newlineFixed);
    try {
      return JSON.parse(quoteFixed);
    } catch (_) {}

    // 試行4: スタックベースの途切れJSON復元 (repairPartialJson)
    try {
      const repaired = this.repairPartialJson(cleaned);
      return JSON.parse(repaired);
    } catch (_) {}

    // 試行5: 引用符・改行修正済みテキストに対するスタック復元
    try {
      const repairedQuote = this.repairPartialJson(quoteFixed);
      return JSON.parse(repairedQuote);
    } catch (_) {}

    // 試行6: 末尾カンマ・コメント・制御文字除去 ＋ スタック復元
    const sanitized = quoteFixed
      .replace(/,\s*([\}\]])/g, '$1')
      .replace(/\/\/.*/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    try {
      const finalRepaired = this.repairPartialJson(sanitized);
      return JSON.parse(finalRepaired);
    } catch (_) {}

    const snippet = text.length > 600
      ? `【応答冒頭200字】:\n${text.slice(0, 200)}\n...\n【応答末尾300字】:\n${text.slice(-300)}`
      : `【応答全文】:\n${text}`;

    console.error('All JSON parse attempts failed:', { length: text.length, snippet, rawText: text });
    throw new Error(`JSONパースエラー: LLM応答の解析に失敗しました（応答長: ${text.length}字）。\n${snippet}`);
  }

  /**
   * カタカナおよび誤読表記をひらがなに変換・正規化するヘルパー
   */
  static toHiragana(str: string): string {
    if (!str) return '';
    // カタカナ (ァ-ヶ \u30a1-\u30f6) を ひらがな (ぁ-ヶ \u3041-\u3096) に変換
    let hira = str.replace(/[\u30a1-\u30f6]/g, (match) =>
      String.fromCharCode(match.charCodeAt(0) - 0x60)
    );
    // LLMの誤読・タイポ傾向の補正 (例: にゅーたいん -> にゅーたうん)
    hira = hira.replace(/にゅーたいん/g, 'にゅーたうん');
    return hira.trim();
  }

  /**
   * 1.5 編集者AIによるプロット・設定資料・ルビの校閲と整合性チェック
   */
  static async proofreadOutlineAndSettings(
    baseUrl: string,
    editorModel: string,
    draftData: any,
    onProgress?: (msg: string) => void,
    signal?: AbortSignal,
    aiSettings?: any
  ): Promise<any> {
    if (onProgress) onProgress(`編集者AI (${editorModel}) がプロット構成案・ルビ・読みの整合性を検証中...`);

    const systemPrompt = `あなたは優秀な小説編集者AIです。
作家AIが作成した長編小説の「プロット構成案」および「初期設定集（人物・世界観・固有名詞・ルビ）」の校閲を行ってください。

【校閲・検証指示】
1. 作品タイトル、あらすじ、各話構成が日本語として自然で魅力的に整っているか確認・微修正してください。
2. キャラクター名、地名、特殊用語のルビ・よみがなが正確かチェックしてください。（例: 「多摩ニュータウン」の読みは「たまにゅーたうん」です。「たまにゅーたいん」などの誤読は「たまにゅーたうん」に修正してください）
3. ルビや読みがカタカナ表記になっている場合は、必ず「ひらがな」に修正してください。

思考プロセスや解説テキストは一切含めず、入力と同構造のJSONフォーマットのみを出力してください。`;

    const userPrompt = `【原案データ】:
${JSON.stringify(draftData, null, 2)}

上記データに対する校閲・誤読修正を行い、修正後のJSONを出力してください。`;

    try {
      const rawResponse = await OllamaService.chat(baseUrl, editorModel, systemPrompt, userPrompt, 0.2, signal, true, aiSettings);
      const parsed = this.cleanAndParseJson(rawResponse);
      return {
        title: parsed.title || draftData.title,
        subtitle: parsed.subtitle || draftData.subtitle,
        synopsis: parsed.synopsis || draftData.synopsis,
        outline: parsed.outline || draftData.outline,
        chapters: Array.isArray(parsed.chapters) && parsed.chapters.length > 0 ? parsed.chapters : draftData.chapters,
        characters: Array.isArray(parsed.characters) && parsed.characters.length > 0 ? parsed.characters : draftData.characters,
        worldBuilding: Array.isArray(parsed.worldBuilding) && parsed.worldBuilding.length > 0 ? parsed.worldBuilding : draftData.worldBuilding,
        geography: Array.isArray(parsed.geography) && parsed.geography.length > 0 ? parsed.geography : draftData.geography,
        terms: Array.isArray(parsed.terms) && parsed.terms.length > 0 ? parsed.terms : draftData.terms,
        rubies: Array.isArray(parsed.rubies) && parsed.rubies.length > 0 ? parsed.rubies : draftData.rubies,
      };
    } catch (e) {
      console.warn('Editor AI proofread outlined data failed, proceeding with draft data:', e);
      return draftData;
    }
  }

  /**
   * 2. 全話の大枠プロット・章構成の生成 (執筆者AI Qwen + 編集者AI Gemmaによる校閲)
   */
  static async generateOutline(
    baseUrl: string,
    writerModel: string,
    _editorModel: string,
    promptSettings: PromptSettings,
    bible: SettingBible,
    glossary: Glossary,
    onProgress?: (msg: string) => void,
    signal?: AbortSignal,
    aiSettings?: any
  ): Promise<{
    title: string;
    subtitle: string;
    synopsis: string;
    outline: string;
    chapters: Chapter[];
    initialBible?: SettingBible;
    initialGlossary?: Glossary;
  }> {
    const targetChapterCount = promptSettings.targetChapterCount || 12;

    // --- STEP 1: あらすじ・登場人物・世界観・用語集の基本枠生成 (高速 Call 1) ---
    if (onProgress) onProgress('プロット準備中 (コア構想・キャラクター・世界観設定を構築中)...');

    const step1System = aiSettings?.systemPrompts?.generateOutlineStep1 || DEFAULT_SYSTEM_PROMPTS.generateOutlineStep1 || `あなたはプロの長編小説構成作家・ストーリーディレクターです。`;

    const step1User = `【お題タグ】: ${promptSettings.themes.join(', ')}
【ストーリーコンセプト】: ${promptSettings.storyConcept}
【詳細指定】: ${promptSettings.detailedPrompt}
【トーン】: ${promptSettings.tone}
【想定読者】: ${promptSettings.targetAudience}

${this.buildBibleContext(bible, glossary)}

上記設定を踏まえ、全${targetChapterCount}話構成の作品タイトル・全体あらすじ・初期設定資料集を作成してください。`;

    let step1Raw = '';
    try {
      step1Raw = await OllamaService.chat(baseUrl, writerModel, step1System, step1User, 0.3, signal, true, aiSettings);
    } catch (e: any) {
      if (signal?.aborted) throw e;
      step1Raw = await OllamaService.chat(baseUrl, writerModel, step1System, step1User, 0.4, signal, false, aiSettings);
    }

    let step1Parsed: any = {};
    try {
      step1Parsed = this.cleanAndParseJson(step1Raw);
    } catch {
      step1Parsed = {
        title: `${promptSettings.themes.join('×')}の物語`,
        subtitle: promptSettings.storyConcept,
        synopsis: promptSettings.detailedPrompt || promptSettings.storyConcept,
      };
    }

    const initialBible: SettingBible = {
      characters: (step1Parsed.characters || []).map((c: any, idx: number) => {
        const { cleanName, extractedRole } = NovelEngine.sanitizeCharacterName(c.name || `登場人物${idx + 1}`);
        const role = c.role || extractedRole || '主要人物';
        const appearance = c.appearance || '初期プロットにて設定';
        const illustrationPrompt = NovelEngine.buildIllustrationPrompt({
          name: cleanName,
          appearance,
          role,
          illustrationPrompt: c.illustrationPrompt,
        });
        return {
          id: `char-init-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          name: cleanName,
          ruby: NovelEngine.toHiragana(c.ruby || ''),
          role,
          firstPerson: NovelEngine.sanitizePronoun(c.firstPerson, '私', false),
          secondPerson: NovelEngine.sanitizePronoun(c.secondPerson, 'あなた', true),
          appearance,
          personality: c.personality || '初期プロットにて設定',
          background: c.background || '初期プロットにて設定',
          illustrationPrompt,
          updatedEpisode: '【初期プロット策定時】',
        };
      }),
      worldBuilding: (step1Parsed.worldBuilding || []).map((w: any, idx: number) => {
        const title = (w.title || w.name || `設定${idx + 1}`).trim();
        return {
          id: `wb-init-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          category: w.category || NovelEngine.classifyCategory(title),
          title: title,
          content: w.content || w.description || '初期プロットにて設定',
          updatedEpisode: '【初期プロット策定時】',
        };
      }),
      geography: (step1Parsed.geography || []).map((g: any, idx: number) => {
        const name = (g.name || g.title || `地名${idx + 1}`).trim();
        return {
          id: `geo-init-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          name,
          description: g.description || g.content || '初期プロットにて設定',
          updatedEpisode: '【初期プロット策定時】',
        };
      }),
    };

    const initialGlossary: Glossary = {
      terms: (step1Parsed.terms || []).map((t: any, idx: number) => {
        const term = (t.term || t.name || '').trim();
        const reading = NovelEngine.toHiragana(t.reading || t.ruby || '');
        const description = t.description || t.meaning || t.content || '初期プロットにて設定された特殊用語';
        return {
          id: `term-init-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          term: term || '特殊用語',
          reading: reading,
          description: description,
          ignoreInProofreading: true,
          updatedEpisode: '【初期プロット策定時】',
        };
      }),
      rubies: (step1Parsed.rubies || []).map((r: any, idx: number) => {
        const kanji = (r.kanji || '').trim();
        const ruby = NovelEngine.toHiragana((r.ruby || '').trim());
        return {
          id: `ruby-init-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          kanji: kanji || '漢字',
          ruby: ruby || 'ルビ',
          notation: kanji && ruby ? `${kanji}《${ruby}》` : kanji || ruby,
          updatedEpisode: '【初期プロット策定時】',
        };
      }),
    };

    // --- STEP 2: 話ごとのプロット順次生成 (第 1 話〜第 N 話まで分割Call) ---
    const chapters: Chapter[] = [];

    for (let cIdx = 0; cIdx < targetChapterCount; cIdx++) {
      if (signal?.aborted) throw new DOMException('Aborted by user', 'AbortError');

      const chNum = cIdx + 1;
      if (onProgress) {
        onProgress(`全プロット構成中 (第 ${chNum} / ${targetChapterCount} 話の章題・シーン展開を作成中)...`);
      }

      const prevChapterTitles = chapters.map((c) => `第${c.id}話: ${c.title} (${c.synopsis})`).join('\n');

      const rawStep2System = aiSettings?.systemPrompts?.generateOutlineStep2 || DEFAULT_SYSTEM_PROMPTS.generateOutlineStep2 || `あなたはプロの長編小説構成作家です。`;
      const step2System = rawStep2System.replace(/\{\{chNum\}\}/g, String(chNum));

      const step2User = `【作品タイトル】: ${step1Parsed.title || promptSettings.themes.join('×')}
【全体あらすじ】: ${step1Parsed.synopsis || promptSettings.storyConcept}
【既存の全話展開】:
${prevChapterTitles || 'ここから物語が始まります。'}

【作成対象】: 第${chNum}話（全${targetChapterCount}話中）

上記を踏まえ、第${chNum}話の章タイトル・あらすじ・シーン構成案を作成してください。`;

      let step2Raw = '';
      try {
        step2Raw = await OllamaService.chat(baseUrl, writerModel, step2System, step2User, 0.4, signal, true, aiSettings);
      } catch (e: any) {
        if (signal?.aborted) throw e;
        step2Raw = await OllamaService.chat(baseUrl, writerModel, step2System, step2User, 0.4, signal, false, aiSettings);
      }

      let step2Parsed: any = {};
      try {
        step2Parsed = this.cleanAndParseJson(step2Raw);
      } catch {
        step2Parsed = {
          title: `第${chNum}話`,
          synopsis: `第${chNum}話の展開`,
          scenes: [
            { title: '前半', summary: `第${chNum}話 前半展開` },
            { title: '後半', summary: `第${chNum}話 後半展開` },
          ],
        };
      }

      const rawScenes = Array.isArray(step2Parsed.scenes) && step2Parsed.scenes.length > 0
        ? step2Parsed.scenes
        : [
            { title: '前半', summary: `第${chNum}話 前半展開` },
            { title: '後半', summary: `第${chNum}話 後半展開` },
          ];

      const chapterScenes = rawScenes.map((sc: any, sIdx: number) => ({
        id: sIdx + 1,
        title: sc.title || `シーン${sIdx + 1}`,
        summary: sc.summary || `${step2Parsed.title || ''} シーン${sIdx + 1}`,
        content: '',
        status: 'pending' as const,
        wordCount: 0,
        reviewComments: [],
      }));

      const newChapter: Chapter = {
        id: chNum,
        title: step2Parsed.title || `第${chNum}話`,
        synopsis: step2Parsed.synopsis || `第${chNum}話の物語。`,
        scenes: chapterScenes,
        status: 'pending' as const,
        wordCount: 0,
      };

      chapters.push(newChapter);

      // ディスク中間ファイル保存
      try {
        localStorage.setItem(`zephyros_temp_outline_ch_${chNum}`, JSON.stringify(newChapter));
      } catch {}
    }

    if (onProgress) onProgress('全プロットおよび初期設定データの検証・統合完了。');

    return {
      title: step1Parsed.title || `${promptSettings.themes.join('×')}の物語`,
      subtitle: step1Parsed.subtitle || '',
      synopsis: step1Parsed.synopsis || promptSettings.storyConcept,
      outline: step1Parsed.synopsis || promptSettings.storyConcept,
      chapters,
      initialBible,
      initialGlossary,
    };
  }

  /**
   * 既存のプロット・あらすじから設定資料集（登場人物・世界観・地名）をAIで一括生成
   */
  static async generateBibleFromPlot(
    baseUrl: string,
    editorModel: string,
    promptSettings: PromptSettings,
    novelData: NovelData,
    currentBible: SettingBible,
    onProgress?: (msg: string) => void,
    signal?: AbortSignal
  ): Promise<{ updatedBible: SettingBible; importedCount: number }> {
    if (onProgress) onProgress('AIがプロットとあらすじから主要登場人物・世界観・地名を分析・策定中...');

    const systemPrompt = `あなたは小説の設定構築エージェントです。
与えられた小説の「タイトル」「全体あらすじ」「プロット」「各話あらすじ」から、物語に必要な【主要登場人物】【世界観・アイテム設定】【地理・場所設定】を分析・作成してください。

必ず以下のJSONフォーマットのみを出力してください。
JSON構造:
{
  "characters": [
    {
      "name": "キャラクター名（本名のみ。「（主人公）」等の注釈カッコ不可）",
      "ruby": "ふりがな（ひらがな）",
      "role": "役割・職業",
      "firstPerson": "一人称代名詞1語のみ（例: 「私」「俺」「僕」等。文章不可）",
      "secondPerson": "二人称代名詞1語のみ（例: 「あなた」「君」「お前」等。文章不可）",
      "appearance": "外見の特徴",
      "personality": "性格・口調の特徴",
      "background": "背景設定",
      "illustrationPrompt": "画像生成AI用の英語タグ（例: 1girl, silver hair, priestess robe, anime style）"
    }
  ],
  "worldBuilding": [
    {
      "title": "キーアイテム・魔法・道具・世界観・制度名",
      "category": "culture",
      "content": "詳細説明"
    }
  ],
  "geography": [
    {
      "name": "主要な地名・場所名",
      "description": "説明"
    }
  ]
}`;

    const chapterSummaries = novelData.chapters
      .map((ch, idx) => `第${idx + 1}話【${ch.title}】: ${ch.synopsis}`)
      .join('\n');

    const userPrompt = `【お題】: ${promptSettings.themes.join(', ')} / ${promptSettings.storyConcept}
【作品タイトル】: ${novelData.title}
【全体あらすじ】: ${novelData.synopsis}
【各話あらすじ】:
${chapterSummaries}

上記プロットから、主要登場人物（2〜5名）、キーアイテム/世界観設定（2〜5件）、主要地名（1〜3件）を作成し、JSON形式で返してください。`;

    let rawResponse = '';
    try {
      rawResponse = await OllamaService.chat(baseUrl, editorModel, systemPrompt, userPrompt, 0.5, signal, true);
    } catch (e: any) {
      if (signal?.aborted) throw e;
      rawResponse = await OllamaService.chat(baseUrl, editorModel, systemPrompt, userPrompt, 0.5, signal, false);
    }

    let parsed: any;
    try {
      parsed = this.cleanAndParseJson(rawResponse);
    } catch (parseErr) {
      if (signal?.aborted) throw parseErr;
      const fallbackRaw = await OllamaService.chat(baseUrl, editorModel, systemPrompt, userPrompt, 0.5, signal, false);
      parsed = this.cleanAndParseJson(fallbackRaw);
    }

    const updatedBible: SettingBible = JSON.parse(JSON.stringify(currentBible));
    let importedCount = 0;

    const rawChars = parsed.characters || parsed.newCharacters || [];
    if (Array.isArray(rawChars)) {
      rawChars.forEach((c: any) => {
        if (!c.name || !c.name.trim() || NovelEngine.isJunkTitle(c.name)) return;
        const { cleanName, extractedRole } = NovelEngine.sanitizeCharacterName(c.name);
        if (!updatedBible.characters.some((ex) => ex.name.trim() === cleanName)) {
          const role = c.role || extractedRole || '主要登場人物';
          const firstPerson = NovelEngine.sanitizePronoun(c.firstPerson, '私', false);
          const secondPerson = NovelEngine.sanitizePronoun(c.secondPerson, 'あなた', true);
          const appearance = c.appearance || 'プロット分析より自動策定';
          const illustrationPrompt = NovelEngine.buildIllustrationPrompt({
            name: cleanName,
            appearance,
            role,
            illustrationPrompt: c.illustrationPrompt,
          });

          updatedBible.characters.push({
            id: `char-auto-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: cleanName,
            ruby: NovelEngine.toHiragana(c.ruby || ''),
            role,
            firstPerson,
            secondPerson,
            appearance,
            personality: c.personality || 'プロット分析より自動策定',
            background: c.background || 'プロット分析より自動策定',
            illustrationPrompt,
            updatedEpisode: '【プロット分析設定】',
          });
          importedCount++;
        }
      });
    }

    const rawWorld = parsed.worldBuilding || parsed.newWorldItems || [];
    if (Array.isArray(rawWorld)) {
      rawWorld.forEach((w: any) => {
        const title = (w.title || w.name || '').trim();
        if (!title || NovelEngine.isJunkTitle(title)) return;
        if (!updatedBible.worldBuilding.some((ex) => ex.title.trim() === title)) {
          updatedBible.worldBuilding.push({
            id: `wb-auto-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            category: w.category || NovelEngine.classifyCategory(title),
            title: title,
            content: w.content || w.description || 'プロット分析より自動策定',
            updatedEpisode: '【プロット分析設定】',
          });
          importedCount++;
        }
      });
    }

    const rawGeo = parsed.geography || parsed.newLocations || [];
    if (Array.isArray(rawGeo)) {
      rawGeo.forEach((g: any) => {
        const name = (g.name || g.title || '').trim();
        if (!name || NovelEngine.isJunkTitle(name)) return;
        if (!updatedBible.geography.some((ex) => ex.name.trim() === name)) {
          updatedBible.geography.push({
            id: `geo-auto-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: name,
            description: g.description || g.content || 'プロット分析より自動策定',
            updatedEpisode: '【プロット分析設定】',
          });
          importedCount++;
        }
      });
    }

    return { updatedBible, importedCount };
  }

  /**
   * 3. 各シーンの本文執筆 (執筆者AI Qwen)
   */
  static async writeSceneContent(
    baseUrl: string,
    writerModel: string,
    promptSettings: PromptSettings,
    bible: SettingBible,
    glossary: Glossary,
    chapter: Chapter,
    sceneIndex: number,
    previousContextSummary: string,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    aiSettings?: any
  ): Promise<string> {
    const scene = chapter.scenes[sceneIndex];
    const totalScenes = chapter.scenes.length;
    const isLastSceneInChapter = (sceneIndex === totalScenes - 1);
    const totalChapters = promptSettings.targetChapterCount || 12;
    const isLastChapter = (chapter.id === totalChapters);

    let endingIndicator = '';
    if (!isLastSceneInChapter) {
      endingIndicator = `（シーン${sceneIndex + 2}に続く）`;
    } else if (!isLastChapter) {
      endingIndicator = `（第${chapter.id + 1}話に続く）`;
    } else {
      endingIndicator = `（全${totalChapters}話・完）`;
    }

    const systemPrompt = aiSettings?.systemPrompts?.writeSceneContent || DEFAULT_SYSTEM_PROMPTS.writeSceneContent || `あなたは長編小説のプロ執筆者（ライターAI）です。`;

    // 以前の文脈にJSONが混入していないか安全クレンジング
    const cleanPrevSummary = previousContextSummary && !NovelEngine.isJsonOutput(previousContextSummary)
      ? previousContextSummary
      : '';

    const cleanConcept = NovelEngine.sanitizePromptConcept(promptSettings.storyConcept);
    const userPrompt = `【作品テーマ/トーン】: ${cleanConcept} (${promptSettings.tone})
【現在の話】: ${chapter.title} - あらすじ: ${chapter.synopsis}
【執筆対象シーン】: シーン ${sceneIndex + 1} / 全 ${chapter.scenes.length} シーン (テーマ: ${scene.summary})
【これまでのあらすじ・直前シーンのラスト本文】:
${cleanPrevSummary || 'ここから物語が始まります。'}

${this.buildBibleContext(bible, glossary)}

上記を踏まえ、シーン ${sceneIndex + 1} の地の文と会話文で構成された日本語小説本文のみを即座に書き出してください。`;

    let raw = await OllamaService.chatStream(
      baseUrl,
      writerModel,
      systemPrompt,
      userPrompt,
      onChunk,
      0.75,
      signal,
      false,
      aiSettings
    );

    // JSON出力誤爆の堅牢な検知＆リカバリ再呼び出し (最大2回)
    let isJson = NovelEngine.isJsonOutput(raw);
    let attempts = 0;
    while (isJson && attempts < 2) {
      attempts++;
      console.warn(`[writeSceneContent] Writer AI outputted JSON (attempt ${attempts}). Retrying with strict prose system prompt...`);
      const retrySystem = `${systemPrompt}\n\n【絶対遵守命令】JSONフォーマット、キー名（newCharacters等）、コードブロックは絶対に出力しないでください。純粋な日本語の小説本文（地の文・会話文）のみを出力してください。`;
      raw = await OllamaService.chat(
        baseUrl,
        writerModel,
        retrySystem,
        userPrompt,
        0.7,
        signal,
        false,
        aiSettings
      );
      isJson = NovelEngine.isJsonOutput(raw);
    }

    if (NovelEngine.isJsonOutput(raw)) {
      const rescued = NovelEngine.extractProseFromAmbiguousJson(raw);
      if (rescued && rescued.length >= 100) {
        raw = rescued;
      } else {
        raw = raw.replace(/```(?:json)?[\s\S]*?```/gi, '').replace(/\{[\s\S]*\}/gi, '').trim();
      }
    }

    return NovelEngine.sanitizeManuscript(raw, endingIndicator);
  }

  /**
   * 3.5. 校閲指摘を受けた執筆者AIによる原稿の自動修正・リライト
   */
  static async rewriteSceneWithFeedback(
    baseUrl: string,
    writerModel: string,
    promptSettings: PromptSettings,
    bible: SettingBible,
    glossary: Glossary,
    chapter: Chapter,
    sceneIndex: number,
    previousContextSummary: string,
    originalDraft: string,
    feedbackComments: ReviewComment[],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    aiSettings?: any
  ): Promise<string> {
    const scene = chapter.scenes[sceneIndex];
    const totalScenes = chapter.scenes.length;
    const isLastSceneInChapter = (sceneIndex === totalScenes - 1);
    const totalChapters = promptSettings.targetChapterCount || 12;
    const isLastChapter = (chapter.id === totalChapters);

    let endingIndicator = '';
    if (!isLastSceneInChapter) {
      endingIndicator = `（シーン${sceneIndex + 2}に続く）`;
    } else if (!isLastChapter) {
      endingIndicator = `（第${chapter.id + 1}話に続く）`;
    } else {
      endingIndicator = `（全${totalChapters}話・完）`;
    }

    const systemPrompt = aiSettings?.systemPrompts?.rewriteSceneWithFeedback || DEFAULT_SYSTEM_PROMPTS.rewriteSceneWithFeedback || `あなたは長編小説のプロ執筆者（ライターAI）です。`;

    const isOriginalDraftJson = NovelEngine.isJsonOutput(originalDraft);
    const cleanOriginalDraft = isOriginalDraftJson
      ? '(※前回の提出原稿は設定JSON形式の不備により破棄されました。ゼロから小説本文を書き出してください。)'
      : originalDraft;

    const feedbackText = feedbackComments
      .map((c) => {
        const origText = c.originalText && !NovelEngine.isJsonOutput(c.originalText)
          ? `(該当箇所: "${c.originalText.slice(0, 100)}")`
          : '';
        return `- 指摘 [${c.type}]: ${c.comment} ${origText}`;
      })
      .join('\n');

    const cleanPrevSummary = previousContextSummary && !NovelEngine.isJsonOutput(previousContextSummary)
      ? previousContextSummary
      : '';

    const cleanConcept = NovelEngine.sanitizePromptConcept(promptSettings.storyConcept);
    const userPrompt = `【作品テーマ/トーン】: ${cleanConcept} (${promptSettings.tone})
【現在の話】: ${chapter.title} - あらすじ: ${chapter.synopsis}
【執筆対象シーン】: シーン ${sceneIndex + 1} / 全 ${chapter.scenes.length} シーン (テーマ: ${scene?.summary || ''})
【これまでのあらすじ・直前シーンのラスト本文】: ${cleanPrevSummary || 'なし'}

${this.buildBibleContext(bible, glossary)}

【編集者AIからの校閲修正指示】:
${feedbackText}
${isOriginalDraftJson ? '\n【絶対命令】前回の提出原稿は誤って設定JSONデータで出力されたため編集部により即座に却下されました。今回はJSON・コードブロック・設定項目は絶対に出力せず、地の文と会話文で構成された純粋な日本語の小説本文のみを即座に書き出してください。' : ''}

【修正対象の初稿原稿】:
${cleanOriginalDraft}

上記【校閲修正指示】を踏まえ、矛盾を修正した改訂原稿本文のみを即座に書き出してください。`;

    let raw = await OllamaService.chatStream(
      baseUrl,
      writerModel,
      systemPrompt,
      userPrompt,
      onChunk,
      0.7,
      signal,
      false,
      aiSettings
    );

    let isJson = NovelEngine.isJsonOutput(raw);
    let attempts = 0;
    while (isJson && attempts < 2) {
      attempts++;
      console.warn(`[rewriteSceneWithFeedback] Writer AI outputted JSON (attempt ${attempts}). Retrying with strict prose system prompt...`);
      const retrySystem = `${systemPrompt}\n\n【絶対遵守命令】JSONフォーマット、キー名（newCharacters等）、コードブロックは絶対に出力しないでください。純粋な日本語の小説本文（地の文・会話文）のみを出力してください。`;
      raw = await OllamaService.chat(
        baseUrl,
        writerModel,
        retrySystem,
        userPrompt,
        0.7,
        signal,
        false,
        aiSettings
      );
      isJson = NovelEngine.isJsonOutput(raw);
    }

    if (NovelEngine.isJsonOutput(raw)) {
      const rescued = NovelEngine.extractProseFromAmbiguousJson(raw);
      if (rescued && rescued.length >= 100) {
        raw = rescued;
      } else {
        raw = raw.replace(/```(?:json)?[\s\S]*?```/gi, '').replace(/\{[\s\S]*\}/gi, '').trim();
      }
    }

    return NovelEngine.sanitizeManuscript(raw, endingIndicator);
  }

  /**
   * 原稿テキストの自動整律・ルビ記号の補正・句点整形ヘルパー
   */
  static sanitizeManuscript(text: string, endingIndicator?: string): string {
    if (!text) return '';
    let sanitized = text.trim();

    // 1. 未閉じルビ 《ルビ の自動補正 (例: 夕暮れ《ゆうぐれ -> 夕暮れ《ゆうぐれ》)
    sanitized = sanitized.replace(/(《[^》\r\n]+)(?=[。、！？\r\n\s]|$)/g, '$1》');

    // 2. 二重ルビ記号の補正
    sanitized = sanitized.replace(/《《+/g, '《').replace(/》》+/g, '》');

    // 3. 空ルビの削除
    sanitized = sanitized.replace(/《\s*》/g, '');

    // 4. ひらがな・カタカナ単語に付与された不要ルビの自動削除 (例: パン《ぱん》 -> パン、あした《あした》 -> あした)
    sanitized = sanitized.replace(/(^|[^一-龠々〆ヵヶ])([ぁ-んァ-ヶa-zA-Z0-9ー]+)《[^》]+》/g, '$1$2');

    // 5. 台詞の末尾の「。」の自動削除 (例: 「〜〜。」 → 「〜〜」)
    sanitized = sanitized.replace(/。+(?=」)/g, '');
    sanitized = sanitized.replace(/。+(?=』)/g, '');

    // 6. 未閉じのカギ括弧「 の自動補正
    const openQuotes = (sanitized.match(/「/g) || []).length;
    const closeQuotes = (sanitized.match(/」/g) || []).length;
    if (openQuotes > closeQuotes) {
      for (let i = 0; i < openQuotes - closeQuotes; i++) {
        sanitized += '」';
      }
    }

    // 7. 末尾の句点・終止記号チェック（『。,」,）,】,！,？,……』等で終わっていない場合に『。』を補填）
    const validEnds = /[。!！?？…』」\)）\]】〕＞>'"\s]$/;
    if (!validEnds.test(sanitized)) {
      if (!/（.+に続く）$/.test(sanitized) && !/（全?\d*話?・?完）$/.test(sanitized)) {
        sanitized += '。';
      }
    }

    // 8. 終了インジケーター（「（シーン2に続く）」「（第2話に続く）」「（全12話・完）」等）の付与・重複除去
    if (endingIndicator && endingIndicator.trim()) {
      sanitized = sanitized.replace(/\s*（(?:シーン\d+に続く|第\d+話に続く|全?\d*話?・?完|つづく)）\s*$/g, '');
      sanitized = `${sanitized.trim()}\n\n${endingIndicator.trim()}`;
    }

    return sanitized;
  }

  /**
   * 本文の文章崩れ（同一フレーズ無限ループ・読点「、」過剰連打）の自動判定および修復
   */
  static detectAndFixDegeneration(text: string): {
    hasDegeneration: boolean;
    cleanedText: string;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let cleaned = text || '';
    let hasDegeneration = false;

    if (!cleaned || cleaned.trim().length === 0) {
      return { hasDegeneration: false, cleanedText: text, reasons: [] };
    }

    // 1. 同一フレーズ反復ループ（6文字以上の連続重複パターン）の検知と切除
    const minLoopLen = 6;
    for (let len = 15; len >= minLoopLen; len--) {
      for (let i = 0; i < cleaned.length - len * 2; i++) {
        const sub = cleaned.substring(i, i + len);
        if (/^[、。・\s]+$/.test(sub)) continue;

        let repeatCount = 1;
        let nextPos = i + len;
        while (nextPos + len <= cleaned.length && cleaned.substring(nextPos, nextPos + len) === sub) {
          repeatCount++;
          nextPos += len;
        }

        if (repeatCount >= 3) {
          hasDegeneration = true;
          reasons.push(`同一フレーズ反復ループ検出 ("${sub.slice(0, 15)}..." が${repeatCount}回出現)`);
          cleaned = cleaned.substring(0, i + len);
          break;
        }
      }
      if (hasDegeneration) break;
    }

    // 2. 読点「、」過剰連打の検知と自動除外 (通常文の「、」出現率は 2%〜6% 程度。12% を超えたら異常判定)
    const totalChars = cleaned.replace(/\s+/g, '').length;
    const commaMatches = cleaned.match(/、/g) || [];
    const commaRatio = totalChars > 0 ? commaMatches.length / totalChars : 0;

    if (commaRatio > 0.12 && commaMatches.length >= 8) {
      hasDegeneration = true;
      reasons.push(`読点「、」の過剰出現を検出 (全文字数の ${(commaRatio * 100).toFixed(1)}% が読点)`);
      cleaned = cleaned.replace(/(が|の|を|に|は|と|で|て|も|より|から|へ)、/g, '$1');
    }

    // 3. 連続読点・句点の修復
    cleaned = cleaned.replace(/、{2,}/g, '、').replace(/。{2,}/g, '。');

    return {
      hasDegeneration,
      cleanedText: cleaned,
      reasons,
    };
  }

  /**
   * 4. 編集者AIによる原稿の軽量校閲 & 矛盾点チェック (編集者AI Gemma)
   */
  static async proofreadScene(
    baseUrl: string,
    editorModel: string,
    draftContent: string,
    bible: SettingBible,
    glossary: Glossary,
    chapterTitle: string,
    previousContextSummary: string,
    signal?: AbortSignal,
    aiSettings?: any
  ): Promise<{ comments: ReviewComment[]; hasCriticalError: boolean }> {
    if (NovelEngine.isJsonOutput(draftContent)) {
      return {
        hasCriticalError: true,
        comments: [
          {
            id: `rev-json-reject-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'contradiction',
            originalText: draftContent.slice(0, 100),
            suggestedText: '',
            comment: '【編集部却下】原稿が小説の本文ではなく設定JSONデータで提出されています。設定データではなく地の文・セリフを含む日本語の小説本文として執筆し直してください。',
            resolved: false,
          },
        ],
      };
    }

    const systemPrompt = aiSettings?.systemPrompts?.proofreadScene || DEFAULT_SYSTEM_PROMPTS.proofreadScene || `あなたは文芸誌のベテラン編集者（校閲エディター）です。`;

    const userPrompt = `【校閲対象章】: ${chapterTitle}
【直前までのあらすじ】: ${previousContextSummary}

${this.buildBibleContext(bible, glossary)}

【チェック対象原稿】:
${draftContent.slice(0, 12000)}

上記原稿を簡単に校閲し、JSON形式で指摘事項を出力してください。問題がなければ "comments": [] で返してください。`;

    try {
      const rawResponse = await OllamaService.chat(baseUrl, editorModel, systemPrompt, userPrompt, 0.2, signal, true, aiSettings);
      const parsed = this.cleanAndParseJson(rawResponse);

      const comments: ReviewComment[] = (parsed.comments || []).map((c: any, index: number) => ({
        id: `rev-${Date.now()}-${index}`,
        timestamp: new Date().toLocaleTimeString(),
        type: c.type || 'suggestion',
        originalText: c.originalText || c.original || '',
        suggestedText: c.suggestedText || c.suggested || c.replacement || '',
        comment: c.comment || '',
        resolved: false
      }));

      const hasCritical = typeof parsed.hasCriticalError === 'boolean'
        ? parsed.hasCriticalError
        : comments.some((c) => c.type === 'contradiction');

      return {
        comments,
        hasCriticalError: hasCritical
      };
    } catch (e) {
      console.warn('Editor response parse error, assuming no critical errors:', e);
      return { comments: [], hasCriticalError: false };
    }
  }

  /**
   * 5. 新規登場人物・地名・品物・特殊用語の自動抽出と設定資料集・用語辞典への自動反映
   */
  static async extractAndUpdateBibleAndGlossary(
    baseUrl: string,
    editorModel: string,
    draftContent: string,
    currentBible: SettingBible,
    currentGlossary: Glossary,
    episodeTag: string, // 例: "【第3話登場時】"
    signal?: AbortSignal,
    aiSettings?: any
  ): Promise<{ updatedBible: SettingBible; updatedGlossary: Glossary; updateLogs: string[] }> {
    const systemPrompt = aiSettings?.systemPrompts?.extractSettingDelta || DEFAULT_SYSTEM_PROMPTS.extractSettingDelta || `あなたは小説の設定・用語抽出エージェントです。`;

    const userPrompt = `【現在の設定資料集の登録済み名前】:
- 人物: ${currentBible.characters.map(c => c.name).join(', ') || 'なし'}
- 品物/世界観: ${currentBible.worldBuilding.map(w => w.title).join(', ') || 'なし'}
- 地名: ${currentBible.geography.map(g => g.name).join(', ') || 'なし'}
- 用語: ${currentGlossary.terms.map(t => t.term).join(', ') || 'なし'}

【分析対象原稿本文】:
${draftContent.slice(0, 10000)}

上記本文から、人物・品物・地名・用語・ルビの新規登場および設定の変化を抽出し、JSON形式で返してください。`;

    const updateLogs: string[] = [];
    const updatedBible: SettingBible = JSON.parse(JSON.stringify(currentBible));
    const updatedGlossary: Glossary = JSON.parse(JSON.stringify(currentGlossary));

    try {
      const rawResponse = await OllamaService.chat(baseUrl, editorModel, systemPrompt, userPrompt, 0.2, signal, true, aiSettings);
      const rawDelta: any = this.cleanAndParseJson(rawResponse);

      // LLMによるキー命名の揺らぎを吸収・正規化 (日本語キー含む)
      const delta: ExtractedSettingDelta = {
        newCharacters: rawDelta.newCharacters || rawDelta.new_characters || rawDelta.characters || rawDelta.characterList || rawDelta["キャラクター"] || rawDelta["人物"] || rawDelta["登場人物"] || [],
        updatedCharacters: rawDelta.updatedCharacters || rawDelta.updated_characters || rawDelta.characterUpdates || rawDelta["キャラクター更新"] || rawDelta["人物更新"] || [],
        newWorldItems: rawDelta.newWorldItems || rawDelta.new_world_items || rawDelta.worldItems || rawDelta.items || rawDelta.new_items || rawDelta["品物/設定"] || rawDelta["設定/品物"] || rawDelta["品物・道具・世界観"] || rawDelta["背景・世界観"] || rawDelta["品物・設定"] || rawDelta["品物"] || rawDelta["道具"] || rawDelta["アイテム"] || rawDelta["世界観"] || rawDelta["設定"] || [],
        updatedWorldItems: rawDelta.updatedWorldItems || rawDelta.updated_world_items || rawDelta.itemUpdates || rawDelta["品物/設定更新"] || rawDelta["設定/品物更新"] || rawDelta["品物更新"] || rawDelta["道具更新"] || rawDelta["世界観更新"] || [],
        newLocations: rawDelta.newLocations || rawDelta.new_locations || rawDelta.locations || rawDelta.places || rawDelta["地名"] || rawDelta["場所"] || [],
        updatedLocations: rawDelta.updatedLocations || rawDelta.updated_locations || rawDelta.locationUpdates || rawDelta["地名更新"] || rawDelta["場所更新"] || [],
        newTerms: rawDelta.newTerms || rawDelta.new_terms || rawDelta.terms || rawDelta["用語"] || rawDelta["特殊用語"] || rawDelta["固有名詞"] || [],
        newRubies: rawDelta.newRubies || rawDelta.new_rubies || rawDelta.rubies || rawDelta["ルビ"] || [],
      };

      // A. 新規キャラクターの追加
      if (delta.newCharacters && delta.newCharacters.length > 0) {
        delta.newCharacters.forEach((c) => {
          if (!c.name || !c.name.trim() || NovelEngine.isJunkTitle(c.name)) return;
          const { cleanName, extractedRole } = NovelEngine.sanitizeCharacterName(c.name);
          const exists = updatedBible.characters.some((ex) => ex.name.trim() === cleanName);
          if (exists) return;

          const role = c.role || extractedRole || '登場人物';
          const firstPerson = NovelEngine.sanitizePronoun(c.firstPerson || '', '私', false);
          const secondPerson = NovelEngine.sanitizePronoun(c.secondPerson || '', 'あなた', true);
          const appearance = `${episodeTag} ${c.appearance || '情報なし'}`;
          const illustrationPrompt = NovelEngine.buildIllustrationPrompt({
            name: cleanName,
            appearance,
            role,
            illustrationPrompt: c.illustrationPrompt,
          });

          const newChar: CharacterSetting = {
            id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: cleanName,
            ruby: NovelEngine.toHiragana(c.ruby || ''),
            role,
            firstPerson,
            secondPerson,
            appearance,
            personality: `${episodeTag} ${c.personality || '情報なし'}`,
            background: `${episodeTag} ${c.background || '情報なし'}`,
            illustrationPrompt,
            updatedEpisode: episodeTag
          };
          updatedBible.characters.push(newChar);
          updateLogs.push(`[設定資料集 自動登録] キャラクター「${cleanName}」を登録しました。${episodeTag}`);
        });
      }

      // B. 既存キャラクターの追記・変化
      if (delta.updatedCharacters && delta.updatedCharacters.length > 0) {
        delta.updatedCharacters.forEach((uc) => {
          if (!uc.name || !uc.updateNote || NovelEngine.isJunkTitle(uc.name)) return;
          const cleanName = uc.name.trim();
          const target = updatedBible.characters.find((c) => c.name.trim() === cleanName || c.name.trim().includes(cleanName) || cleanName.includes(c.name.trim()));
          if (target) {
            target.background += `\n${episodeTag} 追記: ${uc.updateNote}`;
            target.updatedEpisode = episodeTag;
            updateLogs.push(`[設定資料集 追記更新] キャラクター「${target.name}」に新情報を追記しました。${episodeTag}`);
          }
        });
      }

      // C. 新規品物・世界観設定の追加
      if (delta.newWorldItems && delta.newWorldItems.length > 0) {
        delta.newWorldItems.forEach((w) => {
          if (!w.title || !w.title.trim() || NovelEngine.isJunkTitle(w.title)) return;
          const cleanTitle = w.title.trim();
          const exists = updatedBible.worldBuilding.some((ex) => ex.title.trim() === cleanTitle);
          if (exists) return;

          const newWorld: WorldSetting = {
            id: `wb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            category: w.category || 'culture',
            title: cleanTitle,
            content: `${episodeTag} ${w.content || '説明なし'}`,
            updatedEpisode: episodeTag
          };
          updatedBible.worldBuilding.push(newWorld);
          updateLogs.push(`[設定資料集 自動登録] 品物・道具・世界観「${cleanTitle}」を登録しました。${episodeTag}`);
        });
      }

      // D. 既存品物・世界観設定の追記
      if (delta.updatedWorldItems && delta.updatedWorldItems.length > 0) {
        delta.updatedWorldItems.forEach((uw) => {
          if (!uw.title || !uw.updateNote || NovelEngine.isJunkTitle(uw.title)) return;
          const cleanTitle = uw.title.trim();
          const target = updatedBible.worldBuilding.find((w) => w.title.trim() === cleanTitle || w.title.trim().includes(cleanTitle) || cleanTitle.includes(w.title.trim()));
          if (target) {
            target.content += `\n${episodeTag} 追記: ${uw.updateNote}`;
            target.updatedEpisode = episodeTag;
            updateLogs.push(`[設定資料集 追記更新] 品物・道具・世界観「${target.title}」に新情報を追記しました。${episodeTag}`);
          }
        });
      }

      // E. 新規地名の追加
      if (delta.newLocations && delta.newLocations.length > 0) {
        delta.newLocations.forEach((l) => {
          if (!l.name || !l.name.trim() || NovelEngine.isJunkTitle(l.name)) return;
          const cleanName = l.name.trim();
          const exists = updatedBible.geography.some((ex) => ex.name.trim() === cleanName);
          if (exists) return;

          const newGeo: LocationSetting = {
            id: `geo-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: cleanName,
            description: `${episodeTag} ${l.description || '説明なし'}`,
            updatedEpisode: episodeTag
          };
          updatedBible.geography.push(newGeo);
          updateLogs.push(`[設定資料集 自動登録] 地名「${cleanName}」を登録しました。${episodeTag}`);
        });
      }

      // F. 既存地名の追記
      if (delta.updatedLocations && delta.updatedLocations.length > 0) {
        delta.updatedLocations.forEach((ul) => {
          if (!ul.name || !ul.updateNote || NovelEngine.isJunkTitle(ul.name)) return;
          const cleanName = ul.name.trim();
          const target = updatedBible.geography.find((g) => g.name.trim() === cleanName || g.name.trim().includes(cleanName) || cleanName.includes(g.name.trim()));
          if (target) {
            target.description += `\n${episodeTag} 追記: ${ul.updateNote}`;
            target.updatedEpisode = episodeTag;
            updateLogs.push(`[設定資料集 追記更新] 地名「${target.name}」に新情報を追記しました。${episodeTag}`);
          }
        });
      }

      // G. 新規特殊用語の追加
      if (delta.newTerms && delta.newTerms.length > 0) {
        delta.newTerms.forEach((t) => {
          if (!t.term || !t.term.trim() || NovelEngine.isJunkTitle(t.term)) return;
          const cleanTerm = t.term.trim();
          const exists = updatedGlossary.terms.some((ex) => ex.term.trim() === cleanTerm);
          if (exists) return;

          const newTerm: GlossaryTerm = {
            id: `term-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            term: cleanTerm,
            reading: NovelEngine.toHiragana(t.reading || ''),
            description: `${episodeTag} ${t.description || ''}`,
            ignoreInProofreading: true,
            updatedEpisode: episodeTag
          };
          updatedGlossary.terms.push(newTerm);
          updateLogs.push(`[特殊用語辞典 自動登録] 用語「${cleanTerm}」を校閲除外リストに登録しました。${episodeTag}`);
        });
      }

      // H. 新規ルビの追加
      if (delta.newRubies && delta.newRubies.length > 0) {
        delta.newRubies.forEach((r) => {
          if (!r.kanji || !r.ruby || !r.kanji.trim() || !r.ruby.trim()) return;
          const cleanKanji = r.kanji.trim();
          const cleanRuby = NovelEngine.toHiragana(r.ruby.trim());
          if (!cleanKanji || !cleanRuby) return;
          const exists = updatedGlossary.rubies.some((ex) => ex.kanji.trim() === cleanKanji && ex.ruby.trim() === cleanRuby);
          if (exists) return;

          const newRuby: RubySetting = {
            id: `ruby-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            kanji: cleanKanji,
            ruby: cleanRuby,
            notation: `${cleanKanji}《${cleanRuby}》`,
            updatedEpisode: episodeTag
          };
          updatedGlossary.rubies.push(newRuby);
          updateLogs.push(`[特殊用語辞典 自動登録] ルビ「${cleanKanji}《${cleanRuby}》」を登録しました。${episodeTag}`);
        });
      }

    } catch (e) {
      console.warn('Extraction of setting delta failed, skipping auto-update:', e);
    }

    return { updatedBible, updatedGlossary, updateLogs };
  }

  /**
   * 6. 【すでに生成済みの原稿を一括スキャン】して設定資料集・特殊用語辞典を更新
   */
  static async scanAllManuscriptsAndUpdateBible(
    baseUrl: string,
    editorModel: string,
    novelData: NovelData,
    currentBible: SettingBible,
    currentGlossary: Glossary,
    onProgress: (msg: string) => void,
    onUpdateBible: (bible: SettingBible) => void,
    onUpdateGlossary: (glossary: Glossary) => void,
    signal?: AbortSignal
  ): Promise<{ updatedBible: SettingBible; updatedGlossary: Glossary; allLogs: string[] }> {
    let runningBible: SettingBible = JSON.parse(JSON.stringify(currentBible));
    let runningGlossary: Glossary = JSON.parse(JSON.stringify(currentGlossary));
    const allLogs: string[] = [];

    for (let cIdx = 0; cIdx < novelData.chapters.length; cIdx++) {
      const chapter = novelData.chapters[cIdx];
      const fullChapterText = chapter.scenes
        .map((s) => s.content)
        .filter((c) => c && c.trim().length > 50)
        .join('\n\n');

      if (!fullChapterText || fullChapterText.trim().length < 100) continue;

      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const episodeTag = `【第${cIdx + 1}話登場時】`;
      onProgress(`既存原稿をAI深層スキャン中: ${chapter.title} (${cIdx + 1}/${novelData.chapters.length}話)...`);

      const result = await this.extractAndUpdateBibleAndGlossary(
        baseUrl,
        editorModel,
        fullChapterText,
        runningBible,
        runningGlossary,
        episodeTag,
        signal
      );

      if (result.updateLogs.length > 0) {
        allLogs.push(...result.updateLogs);
        runningBible = result.updatedBible;
        runningGlossary = result.updatedGlossary;
        // 各話の解析完了ごとにリアルタイムで親へ保存・通知
        onUpdateBible(runningBible);
        onUpdateGlossary(runningGlossary);
      }
    }

    return { updatedBible: runningBible, updatedGlossary: runningGlossary, allLogs };
  }

  /**
   * 単なる台詞や文章断片（ゴミ設定）を除外する判定
   */
  public static isJunkTitle(title: string): boolean {
    if (!title || title.trim().length === 0) return true;
    const clean = title.trim().replace(/^['"「『【]/, '').replace(/['"」』】]$/, '');
    if (clean.length < 2 || clean.length > 25) return true;

    // 数値や「1 の 1」「第X章」「シーンX」のような章番号・見出し記号の除外
    if (/^\d+(?:\s*の\s*\d+)?$/i.test(clean)) return true;
    if (/^(?:第?\d+[話章節幕]|シーン\d+|[0-9]+)$/i.test(clean)) return true;

    // メタ情報・プロンプト見出し用語の除外 (例: "本シーン登場", "あらすじ", "チェック対象", "登場人物")
    if (/(?:本シーン|登場人物|概要|テーマ|あらすじ|前提|設定|登場時|これまでのあらすじ|作品テーマ|トーン|チェック対象|校閲対象|進行状態|全シーン|完成済み|新規追加)/.test(clean)) return true;

    // 「〜の部屋」「〜の比喩」「〜の件」などの文脈フレーズの除外
    if (/(?:の部屋|の比喩|の件|の話|のこと|の例え|の様子|の場所)$/.test(clean) && !/(?:王|姫|神|勇者|魔王|聖女|皇帝)/.test(clean)) return true;

    // 記号や文章終わりの除外
    if (/[。！？!?～…\n]/.test(clean)) return true;
    if (/(?:休養中|残ってる|伝える|でした|ます|です|である|ている|ていた|について|こと|もの|から|まで|という|する|した|なる|なった|言った|思う|なさる|だろ|よね|ね|よ|な|さ)$/.test(clean)) return true;
    if (/(?:は、|が、|を、|で、|に、)/.test(clean)) return true;
    const stripped = clean.replace(/[「」『』【】]/g, '');
    if (stripped.length > 8 && /(?:は|が|を|で|に|の|へ|より|から|と)/.test(stripped) && !/(?:の|室|階|層|店|人|手|神|王|法|具|器|肉|書|服|物|館|街|島|山|川|海|湖|門|城|塔|兵|隊|組|派|家)/.test(stripped.slice(-1))) return true;
    return false;
  }

  /**
   * タイトルから適切なカテゴリを自動分類
   */
  public static classifyCategory(title: string): 'culture' | 'magic' | 'dungeon' | 'system' {
    if (/(?:魔|術|法|スキル|能力|召喚|結界|呪|聖|暗黒)/.test(title)) return 'magic';
    if (/(?:層|室|階|迷宮|ダンジョン|エリア|罠|宝箱|セーフゾーン|洞窟|塔)/.test(title)) return 'dungeon';
    if (/(?:国|王|教|ギルド|システム|法|軍|階級|通貨|帝国|王国|組織)/.test(title)) return 'system';
    return 'culture';
  }

  /**
   * JSONやMarkdownコードブロックで汚染されたプロンプトコンセプト文をプレーンテキストに純化
   */
  public static sanitizePromptConcept(concept: string): string {
    if (!concept) return '';
    let str = concept.trim();
    if (str.includes('```json') || str.includes('```')) {
      str = str.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
    }
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const parsed = JSON.parse(str);
        if (parsed.storyConcept) return this.sanitizePromptConcept(parsed.storyConcept);
        if (parsed.synopsis) return this.sanitizePromptConcept(parsed.synopsis);
        if (parsed.detailedPrompt) return this.sanitizePromptConcept(parsed.detailedPrompt);
      } catch {}
    }
    return str;
  }

  /**
   * キャラクター名からカッコ付きの注釈（「（主人公）」など）を取り除く
   */
  public static sanitizeCharacterName(rawName: string): { cleanName: string; extractedRole?: string } {
    if (!rawName) return { cleanName: '' };
    let name = rawName.trim();
    const match = name.match(/^(.+?)[（\(](.+?)[）\)]$/);
    if (match) {
      return {
        cleanName: match[1].trim(),
        extractedRole: match[2].trim(),
      };
    }
    return { cleanName: name };
  }

  /**
   * 一人称・二人称を「俺」「私」「君」などのシンプルな代名詞に補正する
   */
  public static sanitizePronoun(raw: string, defaultPronoun: string, isSecondPerson = false): string {
    if (!raw || !raw.trim()) return defaultPronoun;
    let text = raw.trim();

    // 文章・セリフが入力されている場合の代名詞抽出
    if (text.length > 8 || /[。！？!？「」『』\n]/.test(text)) {
      if (!isSecondPerson) {
        const fpMatch = text.match(/(私|俺|僕|わし|自分|我|あたい|わたくし|余|拙者|ミー|おいら|うち|ボク|オレ|ワタシ)/);
        if (fpMatch) return fpMatch[1];
      } else {
        const spMatch = text.match(/(あなた|君|お前|あんた|貴様|先輩|おぬし|お前さん|きみ|アナタ|オマエ|マスター|プロデューサー|主様|旦那)/);
        if (spMatch) return spMatch[1];
      }
      // 代名詞が見つからない場合、カギカッコや句点を除去して最初の単語を取得
      text = text.replace(/^[「『]/, '').replace(/[。！？!？「」『』\n].*$/, '').trim();
      const particleMatch = text.match(/^([^\sはがをもにでねよか]+)/);
      if (particleMatch && particleMatch[1].length <= 6) {
        return particleMatch[1];
      }
    }

    // 「俺は」「あなたは」などの助詞を除去
    if (text.length <= 8) {
      const cleanParticle = text.replace(/(?:は|が|の|を|に|で|よ|ね)$/, '');
      if (cleanParticle.length >= 1) return cleanParticle;
    }

    return text.slice(0, 8);
  }

  /**
   * キャラクターの外見・役割から画像生成AI用の英語タグ (illustrationPrompt) を自動構築
   */
  public static buildIllustrationPrompt(c: { name: string; appearance?: string; role?: string; illustrationPrompt?: string }): string {
    let prompt = (c.illustrationPrompt || '').trim();
    prompt = prompt.replace(/[（\(].*?[）\)]/g, '').trim();

    // すでに適切な英語タグが含まれている場合
    if (prompt && /[a-zA-Z]{3,}/.test(prompt) && !/[\u3000-\u30fe\u4e00-\u9fa5]/.test(prompt)) {
      return prompt;
    }

    const { cleanName } = this.sanitizeCharacterName(c.name);
    const textToAnalyze = `${c.role || ''} ${c.appearance || ''} ${cleanName}`;
    const baseTags: string[] = [];

    if (/(?:女|少女|ヒロイン|聖女|魔導士|魔女|回復|妹|姫|女性)/.test(textToAnalyze)) {
      baseTags.push('1girl');
    } else if (/(?:男|少年|青年|主人公|料理人|シェフ|騎士|戦士|ライバル|男性)/.test(textToAnalyze)) {
      baseTags.push('1boy');
    } else {
      baseTags.push('1person');
    }

    if (/(?:銀髪|白髪)/.test(textToAnalyze)) baseTags.push('silver hair');
    else if (/(?:金髪)/.test(textToAnalyze)) baseTags.push('blonde hair');
    else if (/(?:黒髪)/.test(textToAnalyze)) baseTags.push('black hair');
    else if (/(?:赤髪)/.test(textToAnalyze)) baseTags.push('red hair');
    else if (/(?:茶髪)/.test(textToAnalyze)) baseTags.push('brown hair');
    else if (/(?:青髪)/.test(textToAnalyze)) baseTags.push('blue hair');

    if (/(?:聖女|回復|修道女|癒やし)/.test(textToAnalyze)) baseTags.push('priestess robe');
    else if (/(?:料理人|シェフ|パスタ)/.test(textToAnalyze)) baseTags.push('chef apron, casual clothes');
    else if (/(?:騎士|戦士|ライバル|甲冑|鎧|剣士)/.test(textToAnalyze)) baseTags.push('armor, warrior outfit');
    else if (/(?:魔術師|魔法使い|魔導)/.test(textToAnalyze)) baseTags.push('mage robe, magic user');

    baseTags.push('anime style character');

    return baseTags.join(', ');
  }

  /**
   * でたらめな文章断片・ゴミ設定を一括掃除・クリーンアップ
   */
  public static cleanJunkSettings(
    bible: SettingBible,
    glossary: Glossary
  ): { cleanedBible: SettingBible; cleanedGlossary: Glossary; removedCount: number } {
    const cleanedBible: SettingBible = JSON.parse(JSON.stringify(bible));
    const cleanedGlossary: Glossary = JSON.parse(JSON.stringify(glossary));
    let removedCount = 0;

    const initialWbCount = cleanedBible.worldBuilding.length;
    cleanedBible.worldBuilding = cleanedBible.worldBuilding.filter((w) => !this.isJunkTitle(w.title));
    removedCount += (initialWbCount - cleanedBible.worldBuilding.length);

    const initialCharCount = cleanedBible.characters.length;
    cleanedBible.characters = cleanedBible.characters
      .filter((c) => !this.isJunkTitle(c.name))
      .map((c) => {
        const { cleanName, extractedRole } = this.sanitizeCharacterName(c.name);
        const firstPerson = this.sanitizePronoun(c.firstPerson, '私', false);
        const secondPerson = this.sanitizePronoun(c.secondPerson, 'あなた', true);
        const illustrationPrompt = this.buildIllustrationPrompt({
          name: cleanName,
          appearance: c.appearance,
          role: c.role || extractedRole,
          illustrationPrompt: c.illustrationPrompt,
        });

        return {
          ...c,
          name: cleanName,
          role: c.role || extractedRole || '登場人物',
          firstPerson,
          secondPerson,
          illustrationPrompt,
        };
      });
    removedCount += (initialCharCount - cleanedBible.characters.length);

    const initialGeoCount = cleanedBible.geography.length;
    cleanedBible.geography = cleanedBible.geography.filter((g) => !this.isJunkTitle(g.name));
    removedCount += (initialGeoCount - cleanedBible.geography.length);

    const initialTermCount = cleanedGlossary.terms.length;
    cleanedGlossary.terms = cleanedGlossary.terms.filter((t) => !this.isJunkTitle(t.term));
    removedCount += (initialTermCount - cleanedGlossary.terms.length);

    return { cleanedBible, cleanedGlossary, removedCount };
  }

  /**
   * 7. 編集者AIの【校閲ログ文字列配列から直接即時パース・一括登録】
   * LLMを再呼び出しせず、既存のログ出力文字列からその場で0.01秒で復元・登録
   */
  static parseAndImportFromLogs(
    logs: string[],
    currentBible: SettingBible,
    currentGlossary: Glossary
  ): { updatedBible: SettingBible; updatedGlossary: Glossary; importedCount: number } {
    const updatedBible: SettingBible = JSON.parse(JSON.stringify(currentBible));
    const updatedGlossary: Glossary = JSON.parse(JSON.stringify(currentGlossary));
    let importedCount = 0;

    logs.forEach((log) => {
      const episodeMatch = log.match(/【[^】]+】/);
      const episodeTag = episodeMatch ? episodeMatch[0] : '';

      // 1. ルビ自動登録: 「漢字《ルビ》」
      const rubyMatch = log.match(/ルビ「([^《]+)《([^》]+)》」/);
      if (rubyMatch) {
        const kanji = rubyMatch[1].trim();
        const ruby = rubyMatch[2].trim();
        if (kanji && ruby && !NovelEngine.isJunkTitle(kanji) && !updatedGlossary.rubies.some((r) => r.kanji.trim() === kanji && r.ruby.trim() === ruby)) {
          updatedGlossary.rubies.push({
            id: `ruby-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            kanji,
            ruby,
            notation: `${kanji}《${ruby}》`,
            updatedEpisode: episodeTag,
          });
          importedCount++;
        }
        return;
      }

      // 2. 特殊用語辞典 自動登録: [特殊用語辞典 ...] 用語「...」
      if (log.includes('[特殊用語辞典')) {
        const termMatch = log.match(/「([^」]+)」/);
        if (termMatch) {
          const term = termMatch[1].trim();
          if (term && !NovelEngine.isJunkTitle(term) && !updatedGlossary.terms.some((t) => t.term.trim() === term)) {
            updatedGlossary.terms.push({
              id: `term-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              term,
              reading: '',
              description: `${episodeTag} 原稿ログより自動復元登録`,
              ignoreInProofreading: true,
              updatedEpisode: episodeTag,
            });
            importedCount++;
          }
        }
        return;
      }

      // 3. 設定資料集 自動登録: [設定資料集 ...] <カテゴリ>「<名前>」
      if (log.includes('[設定資料集')) {
        const nameMatch = log.match(/「([^」]+)」/);
        if (!nameMatch) return;
        const name = nameMatch[1].trim();
        if (!name || NovelEngine.isJunkTitle(name)) return;

        if (log.includes('キャラクター') || log.includes('人物') || log.includes('登場人物')) {
          const { cleanName, extractedRole } = NovelEngine.sanitizeCharacterName(name);
          if (!updatedBible.characters.some((c) => c.name.trim() === cleanName)) {
            const role = extractedRole || '登場人物';
            const appearance = `${episodeTag} 原稿ログより自動復元登録`;
            const illustrationPrompt = NovelEngine.buildIllustrationPrompt({
              name: cleanName,
              appearance,
              role,
            });

            updatedBible.characters.push({
              id: `char-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              name: cleanName,
              ruby: '',
              role,
              firstPerson: '私',
              secondPerson: 'あなた',
              appearance,
              personality: '未設定',
              background: `${episodeTag} 原稿本文に登場`,
              illustrationPrompt,
              updatedEpisode: episodeTag,
            });
            importedCount++;
          }
        } else if (log.includes('地名') || log.includes('場所')) {
          if (!updatedBible.geography.some((g) => g.name.trim() === name)) {
            updatedBible.geography.push({
              id: `geo-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              name,
              description: `${episodeTag} 原稿ログより自動復元登録された地名`,
              updatedEpisode: episodeTag,
            });
            importedCount++;
          }
        } else {
          if (!updatedBible.worldBuilding.some((w) => w.title.trim() === name)) {
            updatedBible.worldBuilding.push({
              id: `wb-log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              category: NovelEngine.classifyCategory(name),
              title: name,
              content: `${episodeTag} 原稿ログより自動復元登録された品物・道具・設定`,
              updatedEpisode: episodeTag,
            });
            importedCount++;
          }
        }
      }
    });

    return { updatedBible, updatedGlossary, importedCount };
  }

  /**
   * 8. 【原稿本文から高速即時抽出 (0.1秒)】
   * LLMを呼び出さず、完成済み原稿からルビ《》、固有名詞【】『』、登場人物、アイテム等を0.1秒で即時パース・一括登録
   */
  static fastScanManuscriptsAndExtractSettings(
    novelData: NovelData,
    promptSettings: PromptSettings,
    currentBible: SettingBible,
    currentGlossary: Glossary
  ): { updatedBible: SettingBible; updatedGlossary: Glossary; importedCount: number; logs: string[] } {
    const updatedBible: SettingBible = JSON.parse(JSON.stringify(currentBible));
    const updatedGlossary: Glossary = JSON.parse(JSON.stringify(currentGlossary));
    const logs: string[] = [];
    let importedCount = 0;

    // 0. お題キーワード設定からのテーマ抽出
    if (promptSettings.themes && promptSettings.themes.length > 0) {
      promptSettings.themes.forEach((theme) => {
        const cleanTheme = theme.trim();
        if (cleanTheme && !updatedBible.worldBuilding.some((w) => w.title === cleanTheme)) {
          updatedBible.worldBuilding.push({
            id: `wb-fast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            category: 'culture',
            title: cleanTheme,
            content: `お題キーワードより自動登録されたテーマ設定`,
            updatedEpisode: '【お題設定】',
          });
          logs.push(`[設定資料集 自動登録] 品物・道具・世界観「${cleanTheme}」を登録しました。【お題設定】`);
          importedCount++;
        }
      });
    }

    for (let cIdx = 0; cIdx < novelData.chapters.length; cIdx++) {
      const chapter = novelData.chapters[cIdx];
      const episodeTag = `【第${cIdx + 1}話】`;

      // 章タイトル内の括弧要素
      const chBracketMatches = Array.from(chapter.title.matchAll(/(?:【|『|「)([^】』」]+)(?:】|』|」)/g));
      for (const match of chBracketMatches) {
        const item = match[1].trim();
        if (item.length >= 2 && !NovelEngine.isJunkTitle(item) && !updatedBible.worldBuilding.some((w) => w.title === item)) {
          updatedBible.worldBuilding.push({
            id: `wb-fast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            category: NovelEngine.classifyCategory(item),
            title: item,
            content: `${episodeTag} 原稿の章タイトルより自動抽出された設定項目`,
            updatedEpisode: episodeTag,
          });
          logs.push(`[設定資料集 自動登録] 品物・道具・世界観「${item}」を登録しました。${episodeTag}`);
          importedCount++;
        }
      }

      for (let sIdx = 0; sIdx < chapter.scenes.length; sIdx++) {
        const scene = chapter.scenes[sIdx];
        if (!scene.content) continue;

        const text = scene.content;

        // 1. ルビ抽出 漢字《ルビ》
        const rubyMatches = Array.from(text.matchAll(/([一-龠+々ヶ]+)《([^》]+)》/g));
        for (const match of rubyMatches) {
          const kanji = match[1].trim();
          const ruby = match[2].trim();
          if (kanji && ruby && !NovelEngine.isJunkTitle(kanji) && !updatedGlossary.rubies.some((r) => r.kanji === kanji && r.ruby === ruby)) {
            updatedGlossary.rubies.push({
              id: `ruby-fast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              kanji,
              ruby,
              notation: `${kanji}《${ruby}》`,
              updatedEpisode: episodeTag,
            });
            logs.push(`[特殊用語辞典 自動登録] ルビ「${kanji}《${ruby}》」を登録しました。${episodeTag}`);
            importedCount++;
          }
        }

        // 2. 二重括弧 『特殊用語・アイテム』
        const doubleBrackets = Array.from(text.matchAll(/『([^』]+)』/g));
        for (const match of doubleBrackets) {
          const term = match[1].trim();
          if (term.length >= 2 && term.length <= 25 && !NovelEngine.isJunkTitle(term)) {
            // 用語登録
            if (!updatedGlossary.terms.some((t) => t.term === term)) {
              updatedGlossary.terms.push({
                id: `term-fast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                term,
                reading: '',
                description: `${episodeTag} 原稿本文『』記号より自動抽出`,
                ignoreInProofreading: true,
                updatedEpisode: episodeTag,
              });
              logs.push(`[特殊用語辞典 自動登録] 用語「${term}」を校閲除外リストに登録しました。${episodeTag}`);
              importedCount++;
            }
            // 世界観・品物登録
            if (!updatedBible.worldBuilding.some((w) => w.title === term)) {
              updatedBible.worldBuilding.push({
                id: `wb-fast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                category: NovelEngine.classifyCategory(term),
                title: term,
                content: `${episodeTag} 原稿本文『』記号より自動抽出された品物・世界観設定`,
                updatedEpisode: episodeTag,
              });
              logs.push(`[設定資料集 自動登録] 品物・道具・世界観「${term}」を登録しました。${episodeTag}`);
              importedCount++;
            }
          }
        }

        // 3. 隅付き括弧 【地名・拠点・設定】
        const cornerBrackets = Array.from(text.matchAll(/【([^】]+)】/g));
        for (const match of cornerBrackets) {
          const geoOrSetting = match[1].trim();
          if (geoOrSetting.length >= 2 && geoOrSetting.length <= 25 && !geoOrSetting.includes('話') && !NovelEngine.isJunkTitle(geoOrSetting)) {
            if (!updatedBible.geography.some((g) => g.name === geoOrSetting)) {
              updatedBible.geography.push({
                id: `geo-fast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                name: geoOrSetting,
                description: `${episodeTag} 原稿本文【】記号より自動抽出された地名・場所`,
                updatedEpisode: episodeTag,
              });
              logs.push(`[設定資料集 自動登録] 地名「${geoOrSetting}」を登録しました。${episodeTag}`);
              importedCount++;
            }
          }
        }

        // 4. セリフ直前のカタカナ名 (例: 「アルドは「」「マルコが「」)
        const speakerMatches = Array.from(text.matchAll(/([ァ-ヴー]{2,10})(?:は|が|の)?「/g));
        const ignoreList = ['ダンジョン', 'ペペロンチーノ', 'イタリアン', 'パスタ', 'メニュー', 'カウンター', 'テーブル', 'シェフ', 'マスター'];
        for (const match of speakerMatches) {
          const name = match[1].trim();
          if (name.length >= 2 && !ignoreList.includes(name) && !NovelEngine.isJunkTitle(name)) {
            const { cleanName, extractedRole } = NovelEngine.sanitizeCharacterName(name);
            if (!updatedBible.characters.some((c) => c.name.includes(cleanName))) {
              const role = extractedRole || '登場人物';
              const appearance = `${episodeTag} 原稿セリフより自動抽出`;
              const illustrationPrompt = NovelEngine.buildIllustrationPrompt({
                name: cleanName,
                appearance,
                role,
              });

              updatedBible.characters.push({
                id: `char-fast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                name: cleanName,
                ruby: '',
                role,
                firstPerson: '私',
                secondPerson: 'あなた',
                appearance,
                personality: '未設定',
                background: `${episodeTag} 原稿本文に登場`,
                illustrationPrompt,
                updatedEpisode: episodeTag,
              });
              logs.push(`[設定資料集 自動登録] キャラクター「${cleanName}」を登録しました。${episodeTag}`);
              importedCount++;
            }
          }
        }
      }
    }

    return { updatedBible, updatedGlossary, importedCount, logs };
  }
}
