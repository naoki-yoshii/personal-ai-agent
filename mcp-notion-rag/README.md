# Notion RAG MCP Server

## プロジェクトの目的

NotionのデータをベースにしたRAG（Retrieval-Augmented Generation）機能を提供するMCPサーバーの最小実装です。
Notion APIと連携し、個人の知識ベースから関連情報を検索してAIエージェントに提供します。

**⚠️ 現在の実装状況:**
- ✅ Notion API との連携を実装済み（`@notionhq/client` を使用）
- ✅ データベース検索機能（Name プロパティに指定したクエリを含むページを検索）
- ⚠️ 簡易版の実装：タイトル部分検索のみ対応（ベクトルDB を使った本格的な RAG は未実装）
- 📚 設計書（`docs/design_v1.txt`）の「4-2. MCP: Notion RAGサーバ」に対応する最小構成を実装しています。

## 使用技術

- **TypeScript** - 型安全な開発環境
- **Node.js** - サーバーサイドランタイム（v18以上）
- **Express** - HTTPサーバーフレームワーク
- **@notionhq/client** - Notion API 公式 SDK
- **dotenv** - 環境変数管理

## インストール手順

### 1. 依存関係のインストール

```bash
cd mcp-notion-rag
npm install
```

### 2. Notion インテグレーションの作成とトークン取得

このアプリケーションは Notion API を使用するため、事前に Notion インテグレーションを作成してトークンを取得する必要があります。

#### 2-1. Notion インテグレーションの作成

1. [Notion Integrations ページ](https://www.notion.so/my-integrations) にアクセス
2. 「+ 新しいインテグレーション」をクリック
3. インテグレーション名を入力（例：「Personal AI Agent」）
4. 「送信」をクリックして作成
5. 表示される「Internal Integration Token」をコピー（これが `NOTION_TOKEN` になります）

#### 2-2. データベースへのアクセス許可

1. Notion で検索対象にしたいデータベースを開く
2. 右上の「…」メニューから「接続の追加」を選択
3. 先ほど作成したインテグレーション名を選択して接続

#### 2-3. データベース ID の取得

1. Notion でデータベースを開く
2. ブラウザのアドレスバーから URL をコピー
3. URL の形式：`https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
4. `?` の前の 32 文字が `NOTION_DATABASE_ID` です

#### 2-4. 環境変数ファイルの作成

`.env.example` をコピーして `.env` ファイルを作成します。

```bash
copy .env.example .env
```

`.env` ファイルを編集して、取得した情報を設定します：

```env
# Notion インテグレーションで取得したトークン
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 検索対象の Notion データベース ID
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# サーバーのポート番号（デフォルト: 3001）
PORT=3001
```

**⚠️ 重要:** `.env` ファイルには機密情報が含まれるため、Git にコミットしないでください（`.gitignore` に既に含まれています）。

## 開発用起動コマンド

開発モードで起動（ファイル変更を自動検知して再起動）：

```bash
npm run dev
```

サーバーが起動すると、以下のメッセージが表示されます：
```
mcp-notion-rag server is running on http://localhost:3001
```

本番ビルドと実行：

```bash
npm run build
npm start
```

## APIエンドポイント

### GET /health

ヘルスチェックエンドポイント。サーバーが正常に動作しているか確認します。

**URL:** `http://localhost:3001/health`

**レスポンス例:**
```json
{
  "status": "ok",
  "service": "mcp-notion-rag",
  "timestamp": "2025-01-16T12:34:56.789Z"
}
```

---

### POST /search_knowledge

**概要:**
Notion データベースを検索して、関連するページを取得します。

**URL:** `http://localhost:3001/search_knowledge`

**現在の実装:**
- Notion データベース内で **Name プロパティ（タイトル）に指定したクエリを含むページ** を検索します
- 最大 5 件のページを返します
- 簡易版の実装のため、タイトル部分一致検索のみ対応しています

**今後の改善予定:**
- ベクトルDB（ChromaDB）を使用した意味検索
- ページ本文も含めた全文検索
- 関連度スコアに基づくランキング

**リクエスト例:**
```json
{
  "query": "Python"
}
```

**成功時のレスポンス例:**
```json
{
  "query": "Python",
  "results": [
    {
      "source": "notion",
      "score": 1.0,
      "text": "Python 基礎学習ノート",
      "url": "https://www.notion.so/Python-123abc456def789"
    },
    {
      "source": "notion",
      "score": 1.0,
      "text": "Python for データ分析",
      "url": "https://www.notion.so/Python-for-456def789abc123"
    }
  ]
}
```

**検索結果なしの場合:**
```json
{
  "query": "存在しないキーワード",
  "results": []
}
```

**エラーレスポンス例（query が未指定の場合 - 400 Bad Request）:**
```json
{
  "error": "ValidationError",
  "message": "query パラメータは必須です（空でない文字列）",
  "timestamp": "2025-01-16T12:34:56.789Z"
}
```

**エラーレスポンス例（Notion API 呼び出し失敗 - 500 Internal Server Error）:**
```json
{
  "error": "InternalServerError",
  "message": "Notion API 呼び出しに失敗しました: APIトークンが無効です",
  "timestamp": "2025-01-16T12:34:56.789Z"
}
```

## 動作確認

### 1. サーバーを起動

```bash
npm run dev
```

### 2. ヘルスチェック

別のターミナルまたはブラウザで以下にアクセス：

**ブラウザの場合:**
```
http://localhost:3001/health
```

**curl の場合（Windows PowerShell）:**
```powershell
curl http://localhost:3001/health
```

**curl の場合（Windows コマンドプロンプト）:**
```cmd
curl http://localhost:3001/health
```

**期待される出力:**
```json
{
  "status": "ok",
  "service": "mcp-notion-rag",
  "timestamp": "2025-01-16T12:34:56.789Z"
}
```

### 3. 検索API（POST /search_knowledge）

**curl の場合（Windows PowerShell）:**
```powershell
curl -X POST http://localhost:3001/search_knowledge `
  -H "Content-Type: application/json" `
  -d '{"query": "Pythonのfor文について"}'
```

**curl の場合（Windows コマンドプロンプト）:**
```cmd
curl -X POST http://localhost:3001/search_knowledge ^
  -H "Content-Type: application/json" ^
  -d "{\"query\": \"Pythonのfor文について\"}"
```

**期待される出力:**
```json
{
  "query": "Pythonのfor文について",
  "results": [
    {
      "source": "dummy",
      "score": 1.0,
      "text": "Notion連携はまだ未実装です。ここに将来、Notionから取得した関連メモが入ります。"
    }
  ]
}
```

### 4. エラーケースのテスト（query なし）

**curl の場合（Windows PowerShell）:**
```powershell
curl -X POST http://localhost:3001/search_knowledge `
  -H "Content-Type: application/json" `
  -d '{}'
```

**期待される出力（400 Bad Request）:**
```json
{
  "error": "ValidationError",
  "message": "query パラメータは必須です（空でない文字列）",
  "timestamp": "2025-01-16T12:34:56.789Z"
}
```

### 5. Postman や Thunder Client などの使用

以下のHTTPクライアントツールでも動作確認できます：

- **Postman**: https://www.postman.com/
- **Thunder Client** (VS Code拡張): https://www.thunderclient.com/
- **REST Client** (VS Code拡張)

**設定例:**
- Method: `POST`
- URL: `http://localhost:3001/search_knowledge`
- Headers: `Content-Type: application/json`
- Body (JSON):
  ```json
  {
    "query": "テスト検索"
  }
  ```

## プロジェクト構成

```
mcp-notion-rag/
├── src/
│   ├── index.ts                    # エントリーポイント
│   ├── routes/
│   │   └── searchKnowledgeRoute.ts # 検索APIルート
│   ├── services/
│   │   └── notionRagService.ts     # Notion RAGサービス（現在はダミー実装）
│   └── types/
│       └── searchTypes.ts          # 型定義
├── dist/                            # ビルド出力
├── .env.example                     # 環境変数テンプレート
├── package.json
├── tsconfig.json
└── README.md
```

## 将来の実装予定

設計書（`docs/design_v1.txt`）の「4-2. MCP: Notion RAGサーバ」および「RAGの流れ（内部）」に基づき、以下の機能を実装予定です：

### 1. Notion API連携
- `@notionhq/client` を使用してNotionデータベース・ページを取得
- テキストのチャンク化（文章の境界で分割）

### 2. ベクトルDB統合
- ChromaDB または FAISS でベクトル検索機能を実装
- 埋め込みベクトルの保存と類似度検索

### 3. 埋め込み生成
- OpenAI Embeddings API でテキストの埋め込みベクトルを生成
- クエリとドキュメントの類似度計算

### 4. 追加エンドポイント
- `POST /sync_notion_data` - Notionデータの同期
- `GET /get_raw_page/:pageId` - 特定Notionページの取得（必要に応じて）

## ライセンス

MIT

## 作成者

naoki-yoshii
