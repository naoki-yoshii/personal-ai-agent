# personal-ai-agent

個人用のAIエージェントシステムです。Notion上のデータベースをRAG（Retrieval Augmented Generation）として活用し、Web検索機能と組み合わせて質問に回答するパーソナルAIアシスタントを実現します。

## プロジェクト概要

このプロジェクトは、以下の3つの主要コンポーネントで構成されています：

1. **Notion RAG機能**：Notionデータベースから情報を取得・検索
2. **Web検索機能**：外部Web情報を取得
3. **AIエージェントCLI**：上記の機能を統合し、ユーザーの質問に回答

これらを組み合わせることで、個人のナレッジベース（Notion）と最新のWeb情報の両方を活用した高度なAIアシスタントを構築できます。

## ディレクトリ構成

```
personal-ai-agent/
├── mcp-notion-rag/       # Notion RAG MCP Server（HTTP API）
├── mcp-web-search/       # Web検索 MCP Server（HTTP API）
├── agent/                # AIエージェント CLI ツール
├── docs/                 # ドキュメント
└── README.md            # このファイル
```

### 各コンポーネントの役割

#### mcp-notion-rag

Notion APIを利用したRAG（Retrieval Augmented Generation）サーバーです。Notionデータベースに保存されたデータを検索・取得し、HTTP APIとして提供します。

- **技術スタック**: Node.js, TypeScript, Express, Notion API
- **主な機能**:
  - Notionデータベースの検索
  - ページコンテンツの取得
  - RAGベースの情報検索

#### mcp-web-search

Web検索機能を提供するMCPサーバーです。外部のWeb検索APIを利用して、最新の情報を取得します。

- **技術スタック**: Node.js, TypeScript, Express, Axios
- **主な機能**:
  - Web検索クエリの実行
  - 検索結果の取得と整形
  - HTTP APIとしての提供

#### agent

上記2つのMCPサーバーを統合し、ユーザーからの質問に対して回答を生成するCLIツールです。

- **技術スタック**: Node.js, TypeScript
- **主な機能**:
  - コマンドラインから質問を受付
  - Notion RAGとWeb検索の統合利用
  - AIによる回答生成

## 前提条件

このプロジェクトを実行するには、以下のツールが必要です：

- **Node.js** v18.0.0 以上
- **npm** (Node.jsに付属)
- **Git**
- **Notionアカウント** とAPIトークン（Notion RAG機能使用時）
- **Web検索APIキー**（Web検索機能使用時）

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/naoki-yoshii/personal-ai-agent.git
cd personal-ai-agent
```

### 2. 各コンポーネントのセットアップ

#### mcp-notion-rag のセットアップ

```bash
cd mcp-notion-rag
npm install

# .envファイルを作成し、必要な環境変数を設定
# 例: NOTION_API_KEY=your_notion_api_key
cp .env.example .env  # .env.exampleがある場合
# エディタで .env を編集

# 開発サーバーの起動
npm run dev
```

#### mcp-web-search のセットアップ

```bash
cd mcp-web-search
npm install

# .envファイルを作成し、必要な環境変数を設定
# 例: WEB_SEARCH_API_KEY=your_api_key
cp .env.example .env  # .env.exampleがある場合
# エディタで .env を編集

# 開発サーバーの起動
npm run dev
```

#### agent のセットアップ

```bash
cd agent
npm install

# .envファイルを作成し、必要な環境変数を設定
# 例: MCP_NOTION_RAG_URL=http://localhost:3001
#     MCP_WEB_SEARCH_URL=http://localhost:3002
cp .env.example .env  # .env.exampleがある場合
# エディタで .env を編集

# CLIツールの実行（質問を渡す）
npm run dev -- "TypeScriptの最新バージョンは？"
```

## 使用方法

### 開発環境での実行

各コンポーネントを別々のターミナルで起動します：

```bash
# ターミナル1: Notion RAG サーバー
cd mcp-notion-rag
npm run dev

# ターミナル2: Web検索サーバー
cd mcp-web-search
npm run dev

# ターミナル3: エージェント CLI
cd agent
npm run dev -- "質問内容をここに入力"
```

### 本番環境での実行

```bash
# 各コンポーネントでビルド
cd mcp-notion-rag && npm run build && cd ..
cd mcp-web-search && npm run build && cd ..
cd agent && npm run build && cd ..

# 実行
cd mcp-notion-rag && npm start &
cd mcp-web-search && npm start &
cd agent && npm start "質問内容"
```

## 環境変数の設定

### 重要な注意事項

⚠️ **`.env` ファイルには機密情報（APIキー、トークンなど）が含まれます。絶対にGitにコミットしないでください。**

`.env` ファイルは `.gitignore` に含まれており、リポジトリには含まれません。各開発者は自身の環境で `.env` ファイルを作成する必要があります。

### 必要な環境変数の例

#### mcp-notion-rag/.env
```
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
```

#### mcp-web-search/.env
```
WEB_SEARCH_API_KEY=xxxxxxxxxxxxxxxxxxxxx
PORT=3002
```

#### agent/.env
```
MCP_NOTION_RAG_URL=http://localhost:3001
MCP_WEB_SEARCH_URL=http://localhost:3002
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx  # AIモデル使用時
```

## ライセンス

MIT

## 作者

naoki-yoshii

## 貢献

プルリクエストやIssueの報告を歓迎します。

## トラブルシューティング

### よくある問題

1. **ポートが既に使用されている**
   - `.env` ファイルでポート番号を変更してください

2. **Notion APIエラー**
   - Notion APIキーが正しく設定されているか確認
   - NotionデータベースIDが正しいか確認
   - Notionインテグレーションにデータベースへのアクセス権限があるか確認

3. **依存関係のインストールエラー**
   - Node.jsのバージョンを確認（v18.0.0以上が必要）
   - `node_modules` を削除して再度 `npm install` を実行

## 開発

### プロジェクトのビルド

```bash
# 各プロジェクトでビルド
npm run build
```

### TypeScriptの型チェック

```bash
# 各プロジェクトで実行
npx tsc --noEmit
```

## 今後の拡張予定

- [ ] 他のデータソースの統合（Google Drive、Slackなど）
- [ ] Webインターフェースの追加
- [ ] 回答の精度向上
- [ ] マルチモーダル対応（画像、音声など）
