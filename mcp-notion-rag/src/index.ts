/**
 * MCP Notion RAG Server - エントリーポイント
 *
 * 【設計書との対応】
 * - docs/design_v1.txt の「4-2. MCP: Notion RAGサーバ」に対応
 * - HTTPサーバとして、AIエージェントからの検索リクエストを受け付ける
 *
 * 【現在の実装状況】
 * - ✅ HTTPサーバの起動
 * - ✅ ルーティング設定
 * - ✅ Notion連携（設定DBを使った動的なDB管理）
 *
 * 【設定DBによる動的なDB管理】
 * - .env には NOTION_CONFIG_DATABASE_ID（設定DB）のIDのみを指定
 * - 設定DBから検索対象DBのリストを動的に取得
 * - 各DBの用途説明（usage_hint）も設定DBから取得
 *
 * 【将来の実装予定】
 * - ベクトルDB（ChromaDB等）の統合
 * - 埋め込みベクトル生成（OpenAI API）
 */
import 'dotenv/config';
import express, { Express } from 'express';
import dotenv from 'dotenv';
import routes from './routes/searchKnowledgeRoute';

// 環境変数の読み込み
dotenv.config();

// 環境変数のバリデーション（サーバー起動前にチェック）
if (!process.env.NOTION_API_KEY) {
  console.error('❌ エラー: NOTION_API_KEY が設定されていません。');
  console.error('   .env ファイルに NOTION_API_KEY を設定してください。');
  console.error('   取得方法: https://www.notion.so/my-integrations から Integration を作成してトークンを取得');
  process.exit(1);
}

if (!process.env.NOTION_CONFIG_DATABASE_ID) {
  console.error('❌ エラー: NOTION_CONFIG_DATABASE_ID が設定されていません。');
  console.error('   設定DBのIDを .env に指定してください。');
  console.error('   設定DBには、検索対象とするDBのURLや用途(usage_hint)を登録します。');
  process.exit(1);
}

// Express アプリケーションを作成
const app: Express = express();

// ポート番号は環境変数 PORT があればそれを使い、なければ 3001 を使う
const PORT = process.env.PORT || 3001;

// JSONボディをパースできるようにする
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// /health と /search_knowledge のルートを読み込んでマウントする
app.use('/', routes);

// サーバー起動
app.listen(PORT, () => {
  console.log(`mcp-notion-rag server is running on http://localhost:${PORT}`);
});

export default app;
