import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export class AudioPlayer {
  /**
   * Windows で WAV ファイルを再生
   * PowerShell の SoundPlayer を使用して同期再生
   */
  play(wavFilePath: string): void {
    if (process.platform !== 'win32') {
      throw new Error('This audio player only supports Windows');
    }

    // 絶対パスに変換
    const absPath = path.resolve(wavFilePath);
    console.log(`[AudioPlayer] Playing: ${absPath}`);

    // WAV ファイルの存在確認とサイズログ
    if (fs.existsSync(absPath)) {
      const stats = fs.statSync(absPath);
      console.log(`[AudioPlayer] File exists: ${absPath} (${stats.size} bytes)`);
    } else {
      console.error(`[AudioPlayer] File does not exist: ${absPath}`);
      throw new Error(`WAV file not found: ${absPath}`);
    }

    // PowerShell コマンド
    const psCommand = `$p='${absPath.replace(/'/g, "''")}'; $sp=New-Object System.Media.SoundPlayer $p; $sp.Load(); $sp.PlaySync();`;

    // spawnSync で同期実行
    const result = spawnSync('powershell', ['-NoProfile', '-Command', psCommand], {
      encoding: 'utf-8',
      timeout: 30000, // 30秒タイムアウト
    });

    // 終了コードとログ
    console.log(`[AudioPlayer] Exit code: ${result.status}`);

    if (result.stderr) {
      console.log(`[AudioPlayer] stderr: ${result.stderr}`);
    }

    if (result.error) {
      throw new Error(`Failed to execute PowerShell: ${result.error.message}`);
    }

    if (result.status !== 0) {
      throw new Error(`PowerShell exited with code ${result.status}`);
    }

    console.log('[AudioPlayer] Playback completed');
  }

  /**
   * 再生可能かチェック（Windows のみ）
   */
  isSupported(): boolean {
    return process.platform === 'win32';
  }
}
