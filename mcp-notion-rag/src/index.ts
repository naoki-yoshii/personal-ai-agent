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
 * - ⚠️ Notion連携は未実装（ダミーデータを返す）
 *
 * 【将来の実装予定】
 * - Notion API連携による実データ取得
 * - ベクトルDB（ChromaDB等）の統合
 * - 埋め込みベクトル生成（OpenAI API）
 */
import 'dotenv/config';
import express, { Express } from 'express';
import dotenv from 'dotenv';
import routes from './routes/searchKnowledgeRoute';

// 環境変数の読み込み
dotenv.config();

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
