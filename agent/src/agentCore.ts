/**
 * Personal AI Agent - Core Logic
 *
 * エージェントの中核ロジックを提供するモジュール
 */

import 'dotenv/config';
import axios from 'axios';

/**
 * Notion ページの検索結果を表す型
 */
interface SearchResult {
  source: 'notion';
  databaseId: string;
  pageId: string;
  title: string;
  content: string;
  url?: string;
}

/**
 * /search_knowledge エンドポイントのレスポンス型
 */
interface SearchKnowledgeResponse {
  query: string;
  results: SearchResult[];
}

/**
 * Web検索結果を表す型
 */
interface WebSearchResult {
  source: 'web';
  title: string;
  snippet: string;
  url: string;
}

/**
 * Web検索レスポンス型
 */
interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
}

/**
 * runAgent のオプション
 */
export interface AgentOptions {
  /** 検索モード: default (両方), notion-only (Notionのみ), web-only (Webのみ) */
  mode?: 'default' | 'notion-only' | 'web-only';
}

/**
 * runAgent の戻り値
 */
export interface AgentResult {
  /** LLMが生成した回答 */
  answer: string;
  /** デバッグログ（オプション） */
  debugLog?: string;
}

/**
 * mcp-notion-rag サーバの URL
 */
const MCP_SERVER_URL = process.env.NOTION_MCP_URL || 'http://127.0.0.1:3001';

/**
 * mcp-web-search サーバの URL
 */
const WEB_SEARCH_URL = process.env.WEB_MCP_URL || 'http://127.0.0.1:3002';

/**
 * LLM API を呼び出して回答を生成する
 *
 * @param prompt LLM に送信するプロンプト
 * @returns LLM からの回答テキスト
 */
async function callLlm(prompt: string): Promise<string> {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!apiUrl || !apiKey || !model) {
    throw new Error('LLM_API_URL / LLM_API_KEY / LLM_MODEL が設定されていません。');
  }

  // TODO: 利用するLLMサービスのAPI仕様に合わせて body を調整してください。
  const response = await axios.post(
    apiUrl,
    {
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  // TODO: レスポンス構造は実際のAPI仕様に合わせてください。
  const text = response.data.choices?.[0]?.message?.content ?? '';
  return text;
}

/**
 * Notion検索MCPを呼び出す
 *
 * @param query 検索クエリ
 * @returns Notion検索結果
 */
async function callNotionSearch(query: string): Promise<SearchKnowledgeResponse> {
  console.log(`\n🔍 Notion検索を実行します: "${query}"`);

  const url = new URL('/search_knowledge', MCP_SERVER_URL).toString();
  const body = { query };

  console.log(`[DEBUG] Notion検索URL: ${url}`);
  console.log(`[DEBUG] Request body:`, JSON.stringify(body));

  try {
    const response = await axios.post<SearchKnowledgeResponse>(
      url,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`[ERROR] Notion検索が失敗しました`);
      console.error(`[ERROR] Status: ${error.response.status}`);
      console.error(`[ERROR] Response data:`, error.response.data);
    }
    throw error;
  }
}

/**
 * Web検索MCPを呼び出す
 *
 * @param query 検索クエリ
 * @returns Web検索結果
 */
async function callWebSearch(query: string): Promise<WebSearchResponse> {
  console.log(`\n🌐 Web検索を実行します: "${query}"`);

  const url = new URL('/web_search', WEB_SEARCH_URL).toString();
  const body = { query };

  console.log(`[DEBUG] Web検索URL: ${url}`);
  console.log(`[DEBUG] Request body:`, JSON.stringify(body));

  try {
    const response = await axios.post<WebSearchResponse>(
      url,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error(`[ERROR] Web検索が失敗しました`);
      console.error(`[ERROR] Status: ${error.response.status}`);
      console.error(`[ERROR] Response data:`, error.response.data);
    }
    throw error;
  }
}

/**
 * 検索クエリを生成する
 *
 * 「に関する」という文字列があれば、その前までをキーワードとして抽出
 *
 * @param question ユーザーの質問
 * @returns 検索クエリ
 */
function generateSearchQuery(question: string): string {
  const marker = 'に関する';
  const index = question.indexOf(marker);
  if (index === -1) {
    return question.trim();
  }
  return question.slice(0, index).trim();
}

/**
 * エージェントのコア処理
 *
 * ユーザーの質問を受け取り、Notion/Web検索を実行し、LLMで回答を生成します。
 *
 * @param question ユーザーの質問
 * @param options エージェントのオプション
 * @returns 回答とデバッグログ
 */
export async function runAgent(
  question: string,
  options?: AgentOptions
): Promise<AgentResult> {
  const mode = options?.mode ?? 'default';

  // 検索クエリの生成
  const searchQuery = generateSearchQuery(question);

  // ユーザーの質問と検索クエリを表示
  console.log(`🧑‍💻 ユーザーの質問: "${question}"`);
  console.log(`🔍 検索クエリ: "${searchQuery}"`);
  console.log('');

  try {
    let notionResults: SearchResult[] = [];
    let webResults: WebSearchResult[] = [];

    // モードに応じて検索を実行
    if (mode === 'default') {
      // 両方を並列で検索
      const [notionResponse, webResponse] = await Promise.all([
        callNotionSearch(searchQuery),
        callWebSearch(searchQuery),
      ]);
      notionResults = notionResponse.results;
      webResults = webResponse.results;
    } else if (mode === 'notion-only') {
      // Notionのみ検索
      const notionResponse = await callNotionSearch(searchQuery);
      notionResults = notionResponse.results;
    } else if (mode === 'web-only') {
      // Webのみ検索
      const webResponse = await callWebSearch(searchQuery);
      webResults = webResponse.results;
    }

    // ヒット件数を表示
    console.log(`📊 Notionヒット件数: ${notionResults.length}件`);
    console.log(`🌐 Webヒット件数: ${webResults.length}件`);
    console.log('');

    // 両方とも0件の場合
    if (notionResults.length === 0 && webResults.length === 0) {
      const noResultMessage = '💡 NotionにもWebにも該当する情報が見つかりませんでした。';
      console.log(noResultMessage);
      return {
        answer: noResultMessage,
      };
    }

    // Notion の情報を整形
    const notionSnippets =
      notionResults.length === 0
        ? '（Notion側のメモはヒットしませんでした）'
        : notionResults
            .slice(0, 10)
            .map((r, idx) => {
              const preview =
                r.content.length > 200 ? r.content.slice(0, 200) + '...' : r.content;
              return `## Doc${idx + 1}: ${r.title}\n${preview}\nURL: ${r.url ?? 'URLなし'}`;
            })
            .join('\n\n');

    // Web の情報を整形
    const webSnippets =
      webResults.length === 0
        ? '（Web側の情報はヒットしませんでした）'
        : webResults
            .slice(0, 10)
            .map((r, idx) => {
              const preview =
                r.snippet.length > 200 ? r.snippet.slice(0, 200) + '...' : r.snippet;
              return `## Web${idx + 1}: ${r.title}\n${preview}\nURL: ${r.url}`;
            })
            .join('\n\n');

    // LLM に渡すプロンプトを組み立て
    console.log('🤖 LLM で回答を生成中...\n');

    const prompt = `
あなたは私専用のアシスタントです。
以下の情報を使って、ユーザーの質問に日本語で丁寧に回答してください。

## 基本的な優先順位
- まず Notion の情報（私自身がメモした内容）を最優先の根拠として使ってください。
- Web の情報は補助的に使い、Notion に情報がない部分を補う形で使ってください。

## 【重要】おすすめ系の質問に関する共通ルール

ユーザーが「おすすめ」を求めていると判断できる質問をした場合（「おすすめの〇〇を教えて」「〇〇でどこがいい？」「〇〇なら何がいい？」など）、
あなたは次の手順で行動してください。この手順は、映画・アニメ・漫画・ゲーム・旅行先など、ジャンルを問わず共通です。

### 1. Notionデータの正しい解釈
- Notionから取得したデータベースの情報は、「ユーザーの視聴/体験履歴・嗜好のサンプル」として扱ってください。
- これらをそのまま「おすすめ候補」として列挙してはいけません。
- ページタイトル（作品名・場所名）、評価、ジャンル、メモなどを読み取り、「ユーザーがどんなものを好んでいるか」を把握します。

### 2. 嗜好プロファイルの作成
- Notionのデータから「嗜好プロファイル」を作成してください。
  - 特に評価が高いものの共通点
  - よく登録されているジャンル・カテゴリ
  - よく登場するエリア（旅行の場合）、作品傾向（シリアス/コメディ/SF/ファンタジーなど）
  - 簡潔に、ユーザーの好みを要約してください。

### 3. 外部から新しい候補を探す
- 嗜好プロファイルに合いそうな候補を、Web検索などの外部情報から探してください。
  - 映画・アニメ・漫画・ゲーム → 一般的な作品情報サイトやランキングなど
  - 旅行 → 観光情報サイト、ブログ、まとめ記事など
  - 可能な範囲で、ユーザーの好みとマッチしそうなものを優先して候補を選定します。

### 4. Notionにない候補を優先
- 候補を選ぶときは、できる限り「Notionにまだ登録されていない（未視聴・未体験と思われる）もの」を優先してください。
- Notionに既に存在する作品/場所と同じ名前があれば、原則として新しい候補から除外します。
- どうしてもその作品/場所を強くすすめたい場合は、「これは既にNotionに登録されている（過去に体験済み）かもしれませんが、特におすすめです」といった注釈を添えてください。

### 5. 最終的な回答の形式
以下の情報をセットで提示してください：
- **おすすめ候補の名前**（作品名/スポット名など）
- **ユーザーの嗜好との関連性**（Notionのどんな履歴からそう判断したか）
- **簡単な説明**（あらすじ・特徴・雰囲気・どんな人に向いているか）
- 必要に応じて、候補を2〜5件程度に絞って提示してください。

### 6. 禁止事項
- **Notionのデータベースに入っている項目を、そのまま「おすすめリスト」として列挙するだけで終わってはいけません。**
- 「おすすめしてほしい」と言われたときは、必ず「Notionの履歴や好みを読み取る → 外部の情報から新しい候補を探す」という流れで回答してください。

---

# ユーザーの質問
${question}

# Notionから取得した情報
${notionSnippets}

# Webから取得した情報
${webSnippets}
    `.trim();

    // LLM を呼び出して回答を生成
    const answer = await callLlm(prompt);

    // 参考にした情報一覧を出力
    console.log('=== 参考にした情報 ===');

    if (notionResults.length > 0) {
      console.log('\n[Notion]');
      notionResults.slice(0, 10).forEach((r, idx) => {
        console.log(`  [${idx + 1}] ${r.title} (${r.url ?? 'URLなし'})`);
      });
    }

    if (webResults.length > 0) {
      console.log('\n[Web]');
      webResults.slice(0, 10).forEach((r, idx) => {
        console.log(`  [${idx + 1}] ${r.title} (${r.url})`);
      });
    }

    console.log('');

    return {
      answer,
    };
  } catch (error) {
    // エラーハンドリング
    console.error('❌ エラーが発生しました');
    console.log('');

    if (axios.isAxiosError(error)) {
      if (error.response) {
        // サーバーからエラーレスポンスが返ってきた場合
        console.error(`HTTPエラー: ${error.response.status} ${error.response.statusText}`);
        console.error('レスポンス:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        // リクエストは送信されたがレスポンスが返ってこなかった場合
        console.error('サーバーに接続できませんでした。');
        console.error(
          'mcp-notion-rag / mcp-web-search / LLM API サーバーが起動しているか確認してください。'
        );
        console.error(`Notion MCP URL: ${MCP_SERVER_URL}`);
        console.error(`Web Search URL: ${WEB_SEARCH_URL}`);
        console.error(`LLM API URL: ${process.env.LLM_API_URL ?? '(未設定)'}`);
      } else {
        // リクエストの設定中にエラーが発生した場合
        console.error('リクエストの準備中にエラーが発生しました:', error.message);
      }
    } else if (error instanceof Error) {
      // その他のエラー（環境変数未設定など）
      console.error('エラー:', error.message);
    } else {
      // 予期しないエラー
      console.error('予期しないエラー:', error);
    }

    throw error;
  }
}
