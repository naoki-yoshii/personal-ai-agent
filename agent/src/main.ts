/**
 * Personal AI Agent CLI
 *
 * ユーザーの質問を受け取り、エージェントコアに処理を委譲する CLI エントリーポイント
 */

import { runAgent } from './agentCore.js';

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

  try {
    // エージェントコアを実行
    const result = await runAgent(userQuestion);

    // 回答を表示
    console.log('=== 回答 ===');
    console.log(result.answer);
    console.log('');
  } catch (error) {
    // エラーはエージェントコア内で既に詳細出力されているため、ここでは終了コードのみ設定
    process.exit(1);
  }
}

// メイン処理を実行
main().catch((error) => {
  console.error('❌ 致命的なエラーが発生しました:', error);
  process.exit(1);
});
