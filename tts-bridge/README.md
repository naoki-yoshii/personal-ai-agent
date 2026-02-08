# TTS Bridge

VOICEVOX を使用してテキストを音声合成し、Windows で再生して VSeeFace の口パクに入力するためのブリッジサーバー。

## 機能

- **音声合成**: VOICEVOX API を使用してテキストから音声を生成
- **Windows 再生**: PowerShell の `System.Media.SoundPlayer` を使用した確実な同期再生
- **Agent 連携**: agent-server と連携して質問に対する回答を音声で再生
- **VSeeFace 対応**: VB-CABLE を経由して VSeeFace のリップシンクに対応

## 必要な環境

- **OS**: Windows
- **Node.js**: v18 以上
- **VOICEVOX**: ローカルで起動済み（デフォルト: http://127.0.0.1:50021）
- **VB-CABLE**: VSeeFace の口パク入力用（オプション）

## セットアップ

### 1. 依存関係のインストール

```bash
cd tts-bridge
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成:

```bash
cp .env.example .env
```

`.env` の内容を必要に応じて編集:

```env
PORT=3201
VOICEVOX_URL=http://127.0.0.1:50021
DEFAULT_SPEAKER=3
AGENT_SERVER_URL=http://127.0.0.1:3100
```

#### Speaker ID の例

- `1`: 四国めたん (ノーマル)
- `3`: ずんだもん (ノーマル)
- `8`: 春日部つむぎ (ノーマル)
- `10`: 雨晴はう (ノーマル)

詳細は VOICEVOX エディタまたは `/speakers` エンドポイントで確認してください。

### 3. VOICEVOX の起動

VOICEVOX エディタを起動し、HTTP サーバーモードを有効にします。

デフォルトで `http://127.0.0.1:50021` で起動します。

### 4. VB-CABLE のセットアップ（VSeeFace 使用時）

#### VB-CABLE のインストール

1. [VB-CABLE](https://vb-audio.com/Cable/) をダウンロード・インストール
2. Windows を再起動

#### Windows の再生デバイス設定

1. タスクバーのスピーカーアイコンを右クリック → 「サウンド設定を開く」
2. **既定の再生デバイスを「CABLE Input」に設定**
   - これにより、tts-bridge が再生する音声が VB-CABLE に出力されます

#### VSeeFace のマイク設定

1. VSeeFace を起動
2. 設定画面でマイク入力を **「CABLE Output」** に設定
3. これで Windows の音声出力（CABLE Input）が VSeeFace のマイク入力（CABLE Output）に届き、口パクが動作します

#### 注意事項

- **既定の再生デバイスを CABLE Input にすると、PC の他の音（ブラウザ、音楽など）も VSeeFace に届きます**
- PC のスピーカーから音を聞きたい場合は、別途ミキサーソフトウェアなどで CABLE Input からスピーカーへルーティングする必要があります
- テスト時は VSeeFace を起動していない状態で音声が聞こえるか確認してください

## 使い方

### 開発モード

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

### 本番実行

```bash
npm start
```

## API エンドポイント

### `GET /health`

サーバーとサービスの状態を確認

```bash
curl http://localhost:3201/health
```

レスポンス例:

```json
{
  "ok": true
}
```

### `POST /speak`

テキストを音声合成して再生

```bash
curl -X POST http://localhost:3201/speak \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"こんにちは、テストです\"}"
```

パラメータ:

- `text` (必須): 読み上げるテキスト
- `speaker` (オプション): Speaker ID（デフォルト: 3）

### `POST /ask_and_speak`

agent-server に質問して、回答を音声で再生

```bash
curl -X POST http://localhost:3201/ask_and_speak \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"今日の天気は？\"}"
```

パラメータ:

- `question` (必須): agent-server への質問
- `speaker` (オプション): Speaker ID（デフォルト: 3）

## テスト例

### 1. 基本的な音声再生テスト

```bash
curl -X POST http://localhost:3201/speak \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"テスト音声です\"}"
```

### 2. 異なる Speaker での再生

```bash
# ずんだもん (ID: 3)
curl -X POST http://localhost:3201/speak \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"ずんだもんだよ\", \"speaker\": 3}"

# 四国めたん (ID: 1)
curl -X POST http://localhost:3201/speak \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"四国めたんです\", \"speaker\": 1}"
```

### 3. Agent 連携テスト

agent-server が起動している状態で:

```bash
curl -X POST http://localhost:3201/ask_and_speak \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"自己紹介してください\"}"
```

## トラブルシューティング

### VOICEVOX に接続できない

- VOICEVOX が起動しているか確認
- `.env` の `VOICEVOX_URL` が正しいか確認
- ファイアウォールの設定を確認

### 音声が再生されない

- Windows のサウンド設定で既定の再生デバイスを確認
- VB-CABLE を使用している場合、CABLE Input が既定のデバイスになっているか確認
- PowerShell の実行ポリシーを確認（必要に応じて `Set-ExecutionPolicy RemoteSigned` を実行）

### VSeeFace の口が動かない

- VSeeFace のマイク設定が「CABLE Output」になっているか確認
- Windows の既定の再生デバイスが「CABLE Input」になっているか確認
- VSeeFace のマイク感度設定を確認

### Agent サーバーに接続できない

- agent-server が起動しているか確認
- `.env` の `AGENT_SERVER_URL` が正しいか確認

## ディレクトリ構成

```
tts-bridge/
├── src/
│   ├── index.ts              # Express サーバー
│   └── services/
│       ├── voicevox.ts       # VOICEVOX API クライアント
│       ├── audioPlayer.ts    # Windows 音声再生
│       └── agentClient.ts    # Agent サーバークライアント
├── out/                      # 音声ファイル出力先
├── dist/                     # ビルド出力
├── .env                      # 環境変数（未コミット）
├── .env.example              # 環境変数のテンプレート
├── package.json
├── tsconfig.json
└── README.md
```

## ライセンス

ISC
