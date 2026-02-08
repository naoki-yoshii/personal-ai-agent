# Personal AI Agent Server

HTTP経由でパーソナルAIエージェントを呼び出すExpressベースのAPIサーバーです。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

必要に応じて `@types/cors` をインストール：

```bash
npm install --save-dev @types/cors
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、以下の環境変数を設定してください：

```bash
cp .env.example .env
```

`.env` の内容：

```env
# LLM API設定（agent/src/agentCore.ts が参照）
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_API_KEY=your-api-key-here
LLM_MODEL=gpt-4.1-mini

# MCP サーバー URL
NOTION_MCP_URL=http://127.0.0.1:3001
WEB_MCP_URL=http://127.0.0.1:3002
```

**重要**: MCP サーバー（`mcp-notion-rag` と `mcp-web-search`）が起動していることを確認してください。

## 使い方

### 開発モード

```bash
npm run dev
```

ファイル変更を監視して自動的に再起動します。

### ビルド

```bash
npm run build
```

TypeScriptをコンパイルして `dist/` ディレクトリに出力します。

### 本番起動

```bash
npm start
```

ビルド済みのコードを実行します（事前に `npm run build` が必要）。

## API エンドポイント

### ヘルスチェック

```bash
GET /health
```

**レスポンス:**
```json
{
  "status": "ok"
}
```

### エージェントへの質問

```bash
POST /ask
Content-Type: application/json

{
  "question": "TypeScriptについて教えて"
}
```

**レスポンス（成功時）:**
```json
{
  "answer": "TypeScriptは..."
}
```

**レスポンス（エラー時）:**
```json
{
  "error": "failed to run agent",
  "message": "エラーの詳細"
}
```

## cURLでのテスト例

### ヘルスチェック

```bash
curl http://localhost:3100/health
```

### 質問を送信

```bash
curl -X POST http://localhost:3100/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "今日は何をすればいい？"}'
```

## スマホからのアクセス

サーバーは `0.0.0.0` でリッスンしているため、同じネットワーク内のスマホからアクセス可能です。

1. サーバーを起動しているPCのIPアドレスを確認（例: `192.168.1.100`）
2. スマホのブラウザまたはアプリから `http://192.168.1.100:3100/ask` にリクエストを送信

## トラブルシューティング

### `Cannot find module '../../agent/src/agentCore.js'`

- モノレポのルートから `agent/` プロジェクトが正しくビルドされているか確認してください
- `agent/src/agentCore.ts` が存在することを確認してください

### ポートが使用中

```bash
# 別のポートを指定
PORT=3200 npm run dev
```

### MCP サーバーに接続できない

- `mcp-notion-rag` サーバー（ポート 3001）が起動しているか確認
- `mcp-web-search` サーバー（ポート 3002）が起動しているか確認
