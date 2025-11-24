/**
 * Personal AI Agent CLI
 *
 * ユーザーの質問を受け取り、mcp-notion-rag の /search_knowledge を叩いて結果を表示し、
 * LLM で最終回答を生成する CLI ツール
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
 * mcp-notion-rag サーバの URL
 */
const MCP_SERVER_URL = 'http://localhost:3001';

/**
 * mcp-web-search サーバの URL
 */
const WEB_SEARCH_URL = 'http://localhost:3002';

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
 * Web検索MCPを呼び出す
 *
 * @param query 検索クエリ
 * @returns Web検索結果
 */
async function callWebSearch(query: string): Promise<WebSearchResponse> {
  const url = `${WEB_SEARCH_URL}/web_search`;

  console.log(`\n🌐 Web検索を実行します: "${query}"`);

  const response = await axios.post<WebSearchResponse>(
    url,
    { query },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * メイン処理
 */
async function main() {
  // コマンドライン引数からユーザーの質問文字列を取得
  const userQuestion = process.argv.slice(2).join(' ').trim();

  // 質問が指定されていない場合はエラーメッセージを表示して終了
  if (!userQuestion) {
    console.error('❌ エラー: 質問を指定してください');
    console.log('');
    console.log('使い方:');
    console.log('  npm run dev -- "あなたの質問"');
    console.log('  npm start -- "あなたの質問"');
    console.log('');
    console.log('例:');
    console.log('  npm run dev -- "今日は何をすればいい？"');
    console.log('  npm run dev -- "TypeScriptについて教えて"');
    console.log('  npm run dev -- "TypeScriptに関する情報を教えて"');
    process.exit(1);
  }

  // Notion 検索用クエリの生成
  // 「に関する」という文字列があれば、その前までをキーワードとして抽出
  const searchQueryForNotion = (() => {
    const marker = 'に関する';
    const index = userQuestion.indexOf(marker);
    if (index === -1) {
      return userQuestion.trim();
    }
    return userQuestion.slice(0, index).trim();
  })();

  // ユーザーの質問と Notion 検索クエリを表示
  console.log(`🧑‍💻 ユーザーの質問: "${userQuestion}"`);
  console.log(`🔍 Notion検索クエリ: "${searchQueryForNotion}"`);
  console.log('');

  try {
    // Notion と Web を並列で検索
    const notionPromise = axios.post<SearchKnowledgeResponse>(
      `${MCP_SERVER_URL}/search_knowledge`,
      { query: searchQueryForNotion },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const webPromise = callWebSearch(searchQueryForNotion);

    const [notionResponse, webResponse] = await Promise.all([notionPromise, webPromise]);

    const notionResults = notionResponse.data.results;
    const webResults = webResponse.results;

    // ヒット件数を表示
    console.log(`📊 Notionヒット件数: ${notionResults.length}件`);
    console.log(`🌐 Webヒット件数: ${webResults.length}件`);
    console.log('');

    // 両方とも0件の場合は終了
    if (notionResults.length === 0 && webResults.length === 0) {
      console.log('💡 NotionにもWebにも該当する情報が見つかりませんでした。');
      process.exit(0);
    }

    // Notion の情報を整形
    const notionSnippets = notionResults.length === 0
      ? '（Notion側のメモはヒットしませんでした）'
      : notionResults
          .slice(0, 10)
          .map((r, idx) => {
            const preview = r.content.length > 200 ? r.content.slice(0, 200) + '...' : r.content;
            return `## Doc${idx + 1}: ${r.title}\n${preview}\nURL: ${r.url ?? 'URLなし'}`;
          })
          .join('\n\n');

    // Web の情報を整形
    const webSnippets = webResults.length === 0
      ? '（Web側の情報はヒットしませんでした）'
      : webResults
          .slice(0, 10)
          .map((r, idx) => {
            const preview = r.snippet.length > 200 ? r.snippet.slice(0, 200) + '...' : r.snippet;
            return `## Web${idx + 1}: ${r.title}\n${preview}\nURL: ${r.url}`;
          })
          .join('\n\n');

    // LLM に渡すプロンプトを組み立て
    console.log('🤖 LLM で回答を生成中...\n');

    const prompt = `
あなたは私専用のアシスタントです。
以下の情報を使って、ユーザーの質問に日本語で丁寧に回答してください。

優先順位:
- まず Notion の情報（私自身がメモした内容）を最優先の根拠として使ってください。
- Web の情報は補助的に使い、Notion に情報がない部分を補う形で使ってください。

# ユーザーの質問
${userQuestion}

# Notionから取得した情報
${notionSnippets}

# Webから取得した情報
${webSnippets}
    `.trim();

    // LLM を呼び出して回答を生成
    const answer = await callLlm(prompt);

    // 回答を表示
    console.log('=== 回答 ===');
    console.log(answer);
    console.log('');

    // 参考にした情報一覧を表示
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
        console.error('mcp-notion-rag / mcp-web-search / LLM API サーバーが起動しているか確認してください。');
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

    process.exit(1);
  }
}

// メイン処理を実行
main().catch((error) => {
  console.error('❌ 致命的なエラーが発生しました:', error);
  process.exit(1);
});
