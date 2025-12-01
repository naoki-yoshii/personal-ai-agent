# 日本語検索対応ガイド

## 変更内容

### 1. 修正したファイル

#### `src/services/notionRagService.ts`

**変更箇所:**

1. **`searchKnowledge` メソッドにフォールバック検索を追加** (行331-346)
   - 既存の検索結果が0件の場合
   - かつクエリに非ASCII文字（日本語など）が含まれる場合
   - → フォールバック検索を実行

2. **`fallbackSearchAllPages` メソッドを追加** (行416-472)
   - 各データベースから全ページを取得（最大100件）
   - 各ページの全文コンテンツを `buildPageContent()` で取得
   - `fullTextContent.toLowerCase().includes(query.toLowerCase())` で素朴な文字列マッチング
   - マッチしたページを `SearchResult` 型に変換して返す

### 2. フォールバック検索の流れ

```
1. ユーザーがクエリを送信
   ↓
2. 通常のNotion API検索を実行（既存ロジック）
   - Name プロパティに対する contains フィルタ
   ↓
3. 結果が0件 かつ 非ASCII文字を含む？
   Yes → フォールバック検索へ
   No  → そのまま結果を返す
   ↓
4. フォールバック検索
   - 各データベースから全ページを取得
   - 各ページの本文を `buildPageContent()` で構築
   - query.toLowerCase() を含むページを抽出
   ↓
5. マッチしたページを返す
```

### 3. 動作確認テストコマンド

#### PowerShellでのテスト

**前提条件:**
- `mcp-notion-rag` サーバーがポート3001で起動していること
- Notionに以下のテストデータが存在すること:
  - 英数字キーワード: `test_keyword_12345`
  - 日本語キーワード: `にほんごキーワード_0001` または `テスト` など

**テスト1: 英数字クエリ（既存の挙動を確認）**

```powershell
$body = '{"query": "test_keyword_12345"}'
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json"
```

**期待結果:**
- `results` 配列に1件以上のページが返る
- フォールバック検索は発火しない（通常検索で見つかるため）

**テスト2: 日本語クエリ（フォールバック検索を確認）**

```powershell
$body = '{"query": "にほんごキーワード_0001"}'
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json"
```

**期待結果:**
- サーバーログに「🔄 フォールバック検索を実行します」と表示される
- `results` 配列にマッチしたページが返る

**テスト3: 日本語クエリ（一般的な単語）**

```powershell
$body = '{"query": "アニメ"}'
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json"
```

または

```powershell
$body = '{"query": "テスト"}'
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json"
```

**期待結果:**
- Notion上に該当するページがあれば、フォールバック検索でヒットする
- サーバーログで検索の流れを確認できる

#### curlでのテスト（Git Bashなど）

```bash
# 英数字クエリ
curl -X POST http://localhost:3001/search_knowledge \
  -H "Content-Type: application/json" \
  -d '{"query": "test_keyword_12345"}'

# 日本語クエリ
curl -X POST http://localhost:3001/search_knowledge \
  -H "Content-Type: application/json" \
  -d '{"query": "にほんごキーワード_0001"}'

# 日本語クエリ（一般的な単語）
curl -X POST http://localhost:3001/search_knowledge \
  -H "Content-Type: application/json" \
  -d '{"query": "アニメ"}'
```

### 4. サーバーログの確認

フォールバック検索が発火すると、以下のようなログが出力されます:

```
🔍 Notionデータベースを検索中: "にほんごキーワード_0001"
📊 検索対象データベース数: 2
   [1/2] アニメリスト (abc12345...) を検索中
   ✓ 0 件のページが見つかりました
   [2/2] メモ (def67890...) を検索中
   ✓ 0 件のページが見つかりました
📊 検索結果（全DB）: 合計 0 件のページが見つかりました
🔄 フォールバック検索を実行します（日本語クエリ: "にほんごキーワード_0001"）
   📄 アニメリスト: 50 件のページを取得
   📄 メモ: 30 件のページを取得
📊 フォールバック検索結果: 1 件のページが見つかりました
```

### 5. パフォーマンスと制限事項

#### 現在の制限

- **ページ数の上限**: 各データベースあたり最大100件まで取得
  - Notion APIの `page_size` 制限に準拠
  - これを超えるページがある場合、ページネーション処理が必要

#### パフォーマンス上の注意点

1. **フォールバック検索は重い処理**
   - 全ページを取得するため、データベースが大きいと時間がかかる
   - 例: 3つのデータベース × 各100ページ = 300ページを取得・検索

2. **発火条件を限定**
   - 結果が0件 かつ 日本語クエリの場合のみ発火
   - 英数字クエリには影響なし

#### 将来の改善案

1. **ページネーション対応**
   ```typescript
   // has_more が true の場合、次のページを取得
   let hasMore = true;
   let cursor = undefined;
   
   while (hasMore) {
     const response = await this.notion.databases.query({
       database_id: config.databaseId,
       page_size: 100,
       start_cursor: cursor,
     });
     // ...
     hasMore = response.has_more;
     cursor = response.next_cursor;
   }
   ```

2. **キャッシュの導入**
   - ページ一覧をメモリやRedisにキャッシュ
   - 定期的に更新（例: 1時間ごと）

3. **取得件数の制限**
   ```typescript
   const MAX_PAGES_PER_DB = 50; // 各DBから最大50件まで
   ```

4. **並列処理の最適化**
   - 現在は各DBを順次処理
   - `Promise.all()` で並列化することで高速化可能

### 6. トラブルシューティング

#### フォールバック検索が発火しない

**原因:** 通常の検索で結果が返っている

**確認方法:**
- サーバーログを確認
- 「📊 検索結果（全DB）: 合計 X 件」が 1 以上の場合、フォールバックは発火しない

#### 日本語クエリで結果が返らない

**原因1:** Notion上に該当するページが存在しない

**確認方法:**
- Notion のWebUIで手動検索して確認

**原因2:** ページ内容に日本語キーワードが含まれていない

**確認方法:**
- `buildPageContent()` が取得する内容を確認
  - Title プロパティ
  - Rich text プロパティ
  - URL プロパティ
  - Select / Multi-select プロパティ

#### 文字化けが発生する

**原因:** 通常は発生しない（Node.jsはUTF-8をネイティブサポート）

**確認方法:**
- サーバーのログ出力を確認
- レスポンスのContent-Typeヘッダーを確認

### 7. 既存機能への影響

#### 変更なし（保証）

- ✅ 英数字クエリの動作は変更なし
- ✅ レスポンス形式（`SearchKnowledgeResponse`）は変更なし
- ✅ エンドポイント仕様は変更なし
- ✅ エラーハンドリングは変更なし

#### 追加のみ

- ➕ 日本語クエリでの検索成功率が向上
- ➕ フォールバック検索のログ出力

## まとめ

この変更により、`mcp-notion-rag` は以下のように動作します:

1. **英数字クエリ**: 従来通り、Notion APIの通常検索で高速に結果を返す
2. **日本語クエリ（通常検索で見つかる場合）**: 通常検索で結果を返す
3. **日本語クエリ（通常検索で見つからない場合）**: フォールバック検索で素朴な文字列マッチングを実行

既存の機能を壊さず、日本語検索の成功率を大幅に向上させることができました。
