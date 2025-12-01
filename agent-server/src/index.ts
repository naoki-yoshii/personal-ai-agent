/**
 * Personal AI Agent HTTP Server
 *
 * エージェント機能をHTTP経由で提供するExpressサーバ
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { runAgent } from '../../agent/src/agentCore.js';

const app = express();
const PORT = process.env.PORT || 3100;

// ミドルウェア設定
app.use(cors()); // CORS有効化（スマホなどからのアクセスを許可）
app.use(express.json()); // JSONボディのパース

/**
 * チャットUIのルート
 *
 * GET /
 */
app.get('/', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personal AI Agent - Chat UI</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 800px;
      width: 100%;
      padding: 32px;
    }

    h1 {
      color: #667eea;
      font-size: 28px;
      margin-bottom: 8px;
      text-align: center;
    }

    .subtitle {
      color: #666;
      text-align: center;
      margin-bottom: 32px;
      font-size: 14px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
      font-size: 14px;
    }

    textarea {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      font-family: inherit;
      resize: vertical;
      min-height: 120px;
      transition: border-color 0.2s;
    }

    textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    button {
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }

    button:active {
      transform: translateY(0);
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
      transform: none;
    }

    #status {
      margin-top: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }

    #status.loading {
      display: block;
      background: #e3f2fd;
      color: #1976d2;
      border-left: 4px solid #1976d2;
    }

    #status.success {
      display: block;
      background: #e8f5e9;
      color: #2e7d32;
      border-left: 4px solid #2e7d32;
    }

    #status.error {
      display: block;
      background: #ffebee;
      color: #c62828;
      border-left: 4px solid #c62828;
    }

    #answer {
      margin-top: 24px;
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      min-height: 100px;
      white-space: pre-wrap;
      line-height: 1.6;
      color: #333;
      display: none;
    }

    #answer:not(:empty) {
      display: block;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #1976d2;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 Personal AI Agent</h1>
    <p class="subtitle">パーソナルAIエージェントに質問してみましょう</p>

    <div class="form-group">
      <label for="question">質問を入力してください：</label>
      <textarea id="question" placeholder="例: パーソナルAIの今の進捗を教えて"></textarea>
    </div>

    <button id="send">送信</button>

    <div id="status"></div>
    <div id="answer"></div>
  </div>

  <script>
    const questionInput = document.getElementById('question');
    const sendButton = document.getElementById('send');
    const statusDiv = document.getElementById('status');
    const answerDiv = document.getElementById('answer');

    sendButton.addEventListener('click', async () => {
      const question = questionInput.value.trim();

      if (!question) {
        statusDiv.className = 'error';
        statusDiv.innerHTML = '❌ 質問を入力してください';
        return;
      }

      // UI更新: ローディング状態
      sendButton.disabled = true;
      statusDiv.className = 'loading';
      statusDiv.innerHTML = '<span class="spinner"></span>エージェントが回答を生成中...';
      answerDiv.textContent = '';
      answerDiv.style.display = 'none';

      try {
        const response = await fetch('/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ question })
        });

        const data = await response.json();

        if (response.ok) {
          // 成功
          statusDiv.className = 'success';
          statusDiv.innerHTML = '✅ 回答が完了しました';
          answerDiv.textContent = data.answer;
          answerDiv.style.display = 'block';
        } else {
          // エラーレスポンス
          statusDiv.className = 'error';
          statusDiv.innerHTML = \`❌ エラー: \${data.message || response.statusText}\`;
        }
      } catch (error) {
        // ネットワークエラーなど
        statusDiv.className = 'error';
        statusDiv.innerHTML = \`❌ エラー: \${error.message}\`;
      } finally {
        sendButton.disabled = false;
      }
    });

    // Enterキー（Ctrl+Enter）で送信
    questionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        sendButton.click();
      }
    });
  </script>
</body>
</html>
  `.trim();

  res.type('html').send(html);
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
app.listen(PORT, '0.0.0.0', () => {
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
});
