import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AudioQuery {
  accent_phrases: Array<{
    moras: Array<{
      text: string;
      consonant?: string;
      consonant_length?: number;
      vowel: string;
      vowel_length: number;
      pitch: number;
    }>;
    accent: number;
    pause_mora?: {
      text: string;
      consonant?: string;
      consonant_length?: number;
      vowel: string;
      vowel_length: number;
      pitch: number;
    };
    is_interrogative?: boolean;
  }>;
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  outputSamplingRate: number;
  outputStereo: boolean;
  kana?: string;
}

export class VoicevoxService {
  private baseUrl: string;
  private outputDir: string;

  constructor(baseUrl: string = 'http://127.0.0.1:50021') {
    this.baseUrl = baseUrl;
    // プロジェクトルートの out/ ディレクトリを使用
    this.outputDir = path.resolve(__dirname, '../../out');

    // 出力ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * テキストから音声クエリを生成
   */
  async createAudioQuery(text: string, speaker: number): Promise<AudioQuery> {
    const url = `${this.baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`;

    const response = await fetch(url, { method: 'POST' });

    if (!response.ok) {
      throw new Error(`VOICEVOX audio_query failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as AudioQuery;
  }

  /**
   * 音声クエリから音声を合成
   */
  async synthesis(audioQuery: AudioQuery, speaker: number): Promise<Buffer> {
    const url = `${this.baseUrl}/synthesis?speaker=${speaker}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(audioQuery),
    });

    if (!response.ok) {
      throw new Error(`VOICEVOX synthesis failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * テキストから音声ファイルを生成して保存
   */
  async generateSpeech(text: string, speaker: number): Promise<string> {
    console.log(`[VOICEVOX] Generating speech for: "${text}" (speaker: ${speaker})`);

    // 音声クエリを作成
    const audioQuery = await this.createAudioQuery(text, speaker);

    // 音声を合成
    const wavData = await this.synthesis(audioQuery, speaker);

    // ファイルに保存
    const outputPath = path.join(this.outputDir, 'voice.wav');
    fs.writeFileSync(outputPath, wavData);

    console.log(`[VOICEVOX] Speech saved to: ${outputPath}`);
    return outputPath;
  }

  /**
   * VOICEVOX サーバーの接続確認
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/version`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}
