import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { VoicevoxService } from './services/voicevox.js';
import { AudioPlayer } from './services/audioPlayer.js';
import { AgentClient } from './services/agentClient.js';

// 環境変数の読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3201;
const DEFAULT_SPEAKER = parseInt(process.env.DEFAULT_SPEAKER || '3', 10);

// サービスの初期化
const voicevox = new VoicevoxService(process.env.VOICEVOX_URL);
const audioPlayer = new AudioPlayer();
const agentClient = new AgentClient(process.env.AGENT_SERVER_URL);

// ミドルウェア
app.use(cors());
app.use(express.json());

// ログミドルウェア
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * GET /health
 * ヘルスチェック
 */
app.get('/health', async (_req: Request, res: Response) => {
  res.json({ ok: true });
});

/**
 * POST /speak
 * テキストを音声合成して再生
 */
app.post('/speak', async (req: Request, res: Response) => {
  try {
    const { text, speaker = DEFAULT_SPEAKER } = req.body;

    if (!text) {
      res.status(400).json({ success: false, error: 'text is required' });
      return;
    }

    console.log(`[/speak] Text: "${text}", Speaker: ${speaker}`);

    // 音声生成
    const wavPath = await voicevox.generateSpeech(text, speaker);

    // 音声再生（同期処理）
    audioPlayer.play(wavPath);

    res.json({ success: true });
  } catch (error) {
    console.error('[/speak] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /ask_and_speak
 * Agent に質問して回答を音声で再生
 */
app.post('/ask_and_speak', async (req: Request, res: Response) => {
  try {
    const { question, speaker = DEFAULT_SPEAKER } = req.body;

    if (!question) {
      res.status(400).json({ success: false, error: 'question is required' });
      return;
    }

    console.log(`[/ask_and_speak] Question: "${question}"`);

    // Agent サーバーに質問
    const answer = await agentClient.ask(question);

    console.log(`[/ask_and_speak] Answer: "${answer}"`);

    // 音声生成
    const wavPath = await voicevox.generateSpeech(answer, speaker);

    // 音声再生（同期処理）
    audioPlayer.play(wavPath);

    res.json({ success: true, question, answer, speaker });
  } catch (error) {
    console.error('[/ask_and_speak] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🎤 TTS Bridge Server running on http://localhost:${PORT}`);
  console.log(`📢 VOICEVOX URL: ${process.env.VOICEVOX_URL || 'http://127.0.0.1:50021'}`);
  console.log(`🤖 Agent Server URL: ${process.env.AGENT_SERVER_URL || 'http://127.0.0.1:3100'}`);
  console.log(`🔊 Default Speaker: ${DEFAULT_SPEAKER}`);
  console.log(`🖥️  Platform: ${process.platform}`);

  // 起動時のヘルスチェック
  (async () => {
    const voicevoxOk = await voicevox.checkHealth();
    const agentOk = await agentClient.checkHealth();
    const audioOk = audioPlayer.isSupported();

    console.log(`\n📊 Service Status:`);
    console.log(`   VOICEVOX: ${voicevoxOk ? '✅ OK' : '❌ Not available'}`);
    console.log(`   Agent Server: ${agentOk ? '✅ OK' : '⚠️  Not available'}`);
    console.log(`   Audio Playback: ${audioOk ? '✅ OK' : '❌ Not supported'}`);
    console.log();
  })();
});
