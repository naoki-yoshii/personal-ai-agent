# mcp-notion-rag サーバ仕様書

## 1. サーバの概要

**mcp-notion-rag** は、Notion データベースを検索して、RAG（Retrieval-Augmented Generation）用の情報を返す MCP サーバです。

### 主な特徴

- 複数の Notion データベースを検索対象として指定可能（`NOTION_DATABASE_IDS` 環境変数）
- Notion ページのタイトルと本文を検索し、RAG 向けに整形されたデータを返す
- Express を使用した HTTP API サーバとして実装
- 複数データベースに対して並列検索を実行し、結果を統合して返す

---

## 2. エンドポイント仕様

### 2-1. GET /health

**概要**

サーバのヘルスチェックを行うエンドポイント。

**リクエスト**

なし

**レスポンス例**

```json
{
  "status": "ok",
  "service": "mcp-notion-rag",
  "timestamp": "2025-11-23T03:00:00.000Z"
}
```

**ステータスコード**

- `200 OK`: サーバが正常に動作している

---

### 2-2. POST /search_knowledge

**概要**

クエリ文字列にマッチする Notion ページを検索し、RAG 向けに整形して返すエンドポイント。

複数の Notion データベースを並列検索し、Name プロパティ（タイトル）に対して部分一致検索を実行します。

**リクエスト**

**Content-Type**: `application/json`

**リクエストボディ**

```json
{
  "query": "検索キーワード"
}
```

| フィールド | 型     | 必須 | 説明                           |
| ---------- | ------ | ---- | ------------------------------ |
| query      | string | ✅   | 検索キーワード（空文字列不可） |

**レスポンス**

レスポンスは `SearchKnowledgeResponse` 型です。

```json
{
  "query": "検索キーワード",
  "results": [
    {
      "source": "notion",
      "databaseId": "abc123...",
      "pageId": "def456...",
      "title": "ページタイトル",
      "content": "タイトル\n本文のテキスト...",
      "url": "https://www.notion.so/def456..."
    }
  ]
}
```

**ステータスコード**

- `200 OK`: 検索成功
- `400 Bad Request`: バリデーションエラー（query が空文字列など）
- `500 Internal Server Error`: サーバエラー（Notion API 呼び出し失敗など）

**エラーレスポンス例**

```json
{
  "error": "ValidationError",
  "message": "query パラメータは必須です（空でない文字列）",
  "timestamp": "2025-11-23T03:00:00.000Z"
}
```

---

## 3. 型定義の説明

### SearchResult 型

Notion ページの検索結果を表す型です。

| フィールド | 型     | 必須 | 説明                                       |
| ---------- | ------ | ---- | ------------------------------------------ |
| source     | string | ✅   | データソース（固定値: `"notion"`）         |
| databaseId | string | ✅   | 検索対象となった Notion データベースの ID  |
| pageId     | string | ✅   | Notion ページの ID                         |
| title      | string | ✅   | ページのタイトル                           |
| content    | string | ✅   | RAG 用に連結・整形したテキストコンテンツ   |
| url        | string | -    | Notion ページへの URL（取得できる場合のみ）|

**TypeScript 定義**

```typescript
export interface SearchResult {
  source: 'notion';
  databaseId: string;
  pageId: string;
  title: string;
  content: string;
  url?: string;
}
```

---

### SearchKnowledgeResponse 型

`/search_knowledge` エンドポイントのレスポンス型です。

| フィールド | 型             | 必須 | 説明                             |
| ---------- | -------------- | ---- | -------------------------------- |
| query      | string         | ✅   | ユーザーから受け取った検索クエリ |
| results    | SearchResult[] | ✅   | 検索にヒットした結果の配列       |

**TypeScript 定義**

```typescript
export interface SearchKnowledgeResponse {
  query: string;
  results: SearchResult[];
}
```

---

## 4. 環境変数

mcp-notion-rag サーバを起動する前に、以下の環境変数を `.env` ファイルに設定してください。

### 必須の環境変数

| 環境変数名          | 説明                                             | 例                                    |
| ------------------- | ------------------------------------------------ | ------------------------------------- |
| NOTION_TOKEN        | Notion インテグレーションのシークレットトークン  | `secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`|
| NOTION_DATABASE_IDS | 検索対象データベース ID をカンマ区切りで指定     | `dbid1,dbid2,dbid3`                   |

### オプションの環境変数

| 環境変数名 | 説明                     | デフォルト値 |
| ---------- | ------------------------ | ------------ |
| PORT       | サーバのポート番号       | `3001`       |

### .env ファイルの例

```env
# Notion のインテグレーショントークン
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 検索対象にする Notion データベース ID をカンマ区切りで指定
# 例: NOTION_DATABASE_IDS=dbid1,dbid2,dbid3
NOTION_DATABASE_IDS=abc123def456,ghi789jkl012

# MCP サーバが listen するポート番号
PORT=3001
```

### Notion の設定

1. **Integration の作成**
   - https://www.notion.so/my-integrations にアクセス
   - 新しい Integration を作成し、トークンを取得
   - 取得したトークンを `NOTION_TOKEN` に設定

2. **データベース ID の取得**
   - Notion でデータベースを開く
   - URL から ID を取得: `https://notion.so/xxxxxxxx?v=...` の `xxxxxxxx` 部分
   - 複数のデータベース ID をカンマ区切りで `NOTION_DATABASE_IDS` に設定

3. **Integration の接続**
   - 検索対象の各データベースで、Integration をコネクションに追加

---

## 5. 動作確認手順メモ

### サーバの起動

```bash
# mcp-notion-rag ディレクトリに移動
cd mcp-notion-rag

# 依存関係のインストール（初回のみ）
npm install

# 開発サーバの起動
npm run dev
```

サーバが正常に起動すると、以下のようなログが表示されます：

```
✅ Notion クライアントを初期化しました
📊 データベース数: 2
   [1] abc123de...
   [2] ghi789jk...
Server is running on http://localhost:3001
```

---

### PowerShell からのテスト例

#### 1. ヘルスチェック

```powershell
# GET /health
Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET | Select-Object -ExpandProperty Content
```

**期待される結果**

```json
{
  "status": "ok",
  "service": "mcp-notion-rag",
  "timestamp": "2025-11-23T03:00:00.000Z"
}
```

---

#### 2. 知識検索

```powershell
# POST /search_knowledge
$body = @{
    query = "検索キーワード"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/search_knowledge" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body | Select-Object -ExpandProperty Content
```

**期待される結果**

```json
{
  "query": "検索キーワード",
  "results": [
    {
      "source": "notion",
      "databaseId": "abc123...",
      "pageId": "def456...",
      "title": "マッチしたページタイトル",
      "content": "タイトル\n本文のテキスト...",
      "url": "https://www.notion.so/def456..."
    }
  ]
}
```

---

#### 3. curl を使用したテスト（Windows PowerShell）

```powershell
# GET /health
curl http://localhost:3001/health

# POST /search_knowledge
curl -X POST http://localhost:3001/search_knowledge `
    -H "Content-Type: application/json" `
    -d '{\"query\":\"検索キーワード\"}'
```

---

## 6. 今後の拡張予定

現在は簡易版の実装（タイトル部分一致検索）ですが、将来的には以下の機能を実装予定です：

1. **ベクトル検索への移行**
   - OpenAI Embeddings API を使用してクエリとページをベクトル化
   - ChromaDB などのベクトル DB で意味検索を実行
   - タイトルだけでなく、ページ本文も含めた全文検索に対応

2. **sync_notion_data エンドポイントの追加**
   - Notion データをベクトル DB に同期する機能
   - 定期的または手動でデータ同期を実行

3. **高度な検索機能**
   - フィルタリング機能（タグ、日付等）
   - ページ本文のチャンク化と部分検索
   - 関連度スコアリングの改善

---

## 7. トラブルシューティング

### エラー: NOTION_TOKEN が設定されていません

**原因**: `.env` ファイルに `NOTION_TOKEN` が設定されていない

**解決方法**: https://www.notion.so/my-integrations から Integration を作成し、トークンを `.env` に設定

---

### エラー: NOTION_DATABASE_IDS が設定されていません

**原因**: `.env` ファイルに `NOTION_DATABASE_IDS` が設定されていない

**解決方法**: Notion データベースの URL から ID を取得し、カンマ区切りで `.env` に設定

---

### エラー: Notion API 呼び出しに失敗しました

**考えられる原因**:
1. Notion Integration がデータベースに接続されていない
2. データベース ID が間違っている
3. Notion API のアクセス権限が不足している

**解決方法**:
1. Notion でデータベースを開き、Integration をコネクションに追加
2. データベース ID が正しいか確認
3. Integration の権限設定を確認
