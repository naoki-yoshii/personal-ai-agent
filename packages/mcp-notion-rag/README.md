# MCP Notion RAG Server

Notionと連携してRAG（Retrieval-Augmented Generation）を提供するMCPサーバーです。

## 📋 概要

このMCPサーバーは、Notionに蓄積された個人の知識ベースを検索し、AIエージェントに提供します。現在は最小実装版（ダミー実装）です。

## 🚀 セットアップ

### 前提条件

- Node.js 18.0.0 以上
- npm または yarn

### インストール手順

1. **依存関係のインストール**

```bash
cd packages/mcp-notion-rag
npm install
```

2. **環境変数の設定**

`.env.example` をコピーして `.env` ファイルを作成します：

```bash
# Windowsの場合
copy .env.example .env

# macOS/Linuxの場合
cp .env.example .env
```

`.env` ファイルを編集して、必要なAPIキーを設定してください（現在のダミー実装では不要）。

## 💻 使用方法

### 開発モードで起動

```bash
npm run dev
```

### ビルドして起動

```bash
npm run build
npm start
```

### ウォッチモード（ファイル変更を自動検知）

```bash
npm run watch
```

## 🔧 利用可能なツール

### `search_knowledge`

Notionに保存された知識ベースを検索します。

**パラメータ:**
- `query` (string, 必須): 検索クエリ

**現在の実装:**
ダミーレスポンスとして「まだNotion連携は未実装です」というメッセージを返します。

**使用例:**
```json
{
  "query": "Pythonのfor文について"
}
```

**レスポンス例:**
```json
{
  "query": "Pythonのfor文について",
  "message": "まだNotion連携は未実装です",
  "status": "dummy",
  "timestamp": "2025-01-16T12:34:56.789Z"
}
```

## 📁 プロジェクト構成

```
mcp-notion-rag/
├── src/
│   └── index.ts          # MCPサーバーのメインコード
├── dist/                 # ビルド出力（自動生成）
├── .env.example          # 環境変数のテンプレート
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔜 今後の実装予定

- [ ] Notion API連携
- [ ] ベクトルDB（ChromaDB）の統合
- [ ] 埋め込みベクトル生成（OpenAI API）
- [ ] チャンク化とテキスト分割
- [ ] `sync_notion_data` ツールの実装
- [ ] 実際のRAG検索機能

## 📝 ライセンス

MIT

## 👤 作成者

naoki-yoshii
