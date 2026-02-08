/**
 * Personal AI Agent HTTP Server
 *
 * エージェント機能をHTTP経由で提供するExpressサーバ
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { join } from 'path';
import { existsSync } from 'fs';
import { runAgent } from '../../agent/src/agentCore.js';

// ESM環境で public ディレクトリのパスを取得
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

const app = express();
const PORT = process.env.PORT || 3100;

// ミドルウェア設定
app.use(cors()); // CORS有効化（スマホなどからのアクセスを許可）
app.use(express.json()); // JSONボディのパース

// 静的ファイル配信（public ディレクトリ）
console.log('publicDir=', publicDir);
console.log('index.html exists:', existsSync(join(publicDir, 'index.html')));
app.use(express.static(publicDir));

/**
 * チャットUIのルート
 *
 * GET / → public/index.html を明示的に配信
 */
app.get('/', (req: Request, res: Response) => {
  res.sendFile(join(publicDir, 'index.html'));
});

/**
 * ヘルスチェックエンドポイント
 *
 * GET /health
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * エージェントへの質問エンドポイント
 *
 * POST /ask
 * Body: { "question": "..." }
 */
app.post('/ask', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;

    // バリデーション: questionが空または未指定の場合
    if (!question || typeof question !== 'string' || question.trim() === '') {
      res.status(400).json({
        error: 'question is required',
        message: 'リクエストボディに空でない "question" フィールドを指定してください',
      });
      return;
    }

    console.log(`📨 質問を受け付けました: "${question}"`);

    // エージェントを実行
    const result = await runAgent(question.trim());

    // 回答を返す
    res.status(200).json({
      answer: result.answer,
    });

    console.log(`✅ 回答を返しました\n`);
  } catch (error) {
    // エラーハンドリング
    console.error('❌ エージェント実行エラー:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    res.status(500).json({
      error: 'failed to run agent',
      message: errorMessage,
    });
  }
});

// サーバー起動
app.listen(PORT, '0.0.0.0', async () => {
  console.log('='.repeat(60));
  console.log('🚀 Personal AI Agent Server が起動しました');
  console.log('='.repeat(60));
  console.log(`📡 ポート: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📱 ネットワーク経由のアクセスも可能です (0.0.0.0)`);
  console.log('');
  console.log('利用可能なエンドポイント:');
  console.log(`  GET  /        - チャットUI`);
  console.log(`  GET  /health  - ヘルスチェック`);
  console.log(`  POST /ask     - エージェントへの質問`);
  console.log('='.repeat(60));
  console.log('');

  // MCP サーバーの疎通確認
  const notionMcpUrl = process.env.NOTION_MCP_URL || 'http://127.0.0.1:3001';
  const webMcpUrl = process.env.WEB_MCP_URL || 'http://127.0.0.1:3002';

  console.log('🔍 MCP サーバーの疎通確認中...');
  console.log(`   Notion MCP: ${notionMcpUrl}`);
  console.log(`   Web MCP: ${webMcpUrl}`);
  console.log('');

  try {
    const notionHealthUrl = new URL('/health', notionMcpUrl).toString();
    const notionResponse = await fetch(notionHealthUrl);
    console.log(`   ✅ Notion MCP: ${notionResponse.ok ? 'OK' : 'NG'} (${notionResponse.status})`);
  } catch (error) {
    console.log(`   ❌ Notion MCP: 接続できません`);
    console.log(`      URL: ${notionMcpUrl}`);
    console.log(`      エラー: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const webHealthUrl = new URL('/health', webMcpUrl).toString();
    const webResponse = await fetch(webHealthUrl);
    console.log(`   ✅ Web MCP: ${webResponse.ok ? 'OK' : 'NG'} (${webResponse.status})`);
  } catch (error) {
    console.log(`   ❌ Web MCP: 接続できません`);
    console.log(`      URL: ${webMcpUrl}`);
    console.log(`      エラー: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('');
});
