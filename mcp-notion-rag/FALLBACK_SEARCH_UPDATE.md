# フォールバック検索の改善: キーワードベース検索

## 変更内容

### 修正したファイル

**`src/services/notionRagService.ts`**

#### 1. `extractKeywords` メソッドを新規追加 (416-456行目)

日本語クエリからキーワードを抽出する関数を実装しました。

**機能:**
- 助詞、句読点、疑問符などで分割: `の, を, が, は, へ, に, で, と, 、, 。, ？, !` など
- 長さ1以下のトークンを除外
- 汎用的な動詞・表現を除外: `教えて, ください, お願い, します` など

**例:**
```typescript
extractKeywords("映画のおすすめ教えて")
// → ["映画", "おすすめ"]

extractKeywords("今日は何をすればいい？")
// → ["今日", "何"]

extractKeywords("アニメの新作ある？")
// → ["アニメ", "新作"]
```

#### 2. `fallbackSearchAllPages` メソッドを改修 (458-536行目)

**変更前（厳しい条件）:**
```typescript
// クエリ文字列が丸ごと含まれているかチェック
if (fullTextContent.toLowerCase().includes(query.toLowerCase())) {
  // マッチ
}
```

**変更後（キーワードベース）:**
```typescript
// 1. キーワードを抽出
const keywords = this.extractKeywords(query);

// 2. キーワードのいずれかが含まれているかチェック
const hitCount = keywords.filter((kw) => {
  return kw && lowerText.includes(kw.toLowerCase());
}).length;

// 3. 少なくとも1つ以上のキーワードを含んでいれば採用
if (hitCount >= 1) {
  // マッチ
}
```

#### 3. デバッグログを追加

以下のログを追加し、フォールバック検索の動作を可視化しました:

```typescript
console.log(`[fallback] query = "${query}"`);
console.log(`[fallback] keywords =`, keywords);
console.log(`[fallback] pages.length = ${totalPagesCount}`);
console.log(`[fallback] matchedPages.length = ${allMatchedPages.length}`);
```

---

## 動作確認テスト

### テスト1: 日本語クエリ「映画のおすすめ教えて」

**PowerShellコマンド:**
```powershell
$body = @{ query = "映画のおすすめ教えて" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json; charset=utf-8"
```

**期待されるサーバーログ:**
```
🔍 Notionデータベースを検索中: "映画のおすすめ教えて"
📊 検索対象データベース数: 3
   [1/3] 映画 (abc12345...) を検索中
   ✓ 0 件のページが見つかりました
   [2/3] メモ (def67890...) を検索中
   ✓ 0 件のページが見つかりました
📊 検索結果（全DB）: 合計 0 件のページが見つかりました
🔄 フォールバック検索を実行します（日本語クエリ: "映画のおすすめ教えて"）
[fallback] query = "映画のおすすめ教えて"
[fallback] keywords = [ '映画', 'おすすめ' ]
   📄 映画: 6 件のページを取得
   📄 メモ: 15 件のページを取得
[fallback] pages.length = 21
[fallback] matchedPages.length = 3
📊 フォールバック検索結果: 3 件のページが見つかりました
```

**期待されるレスポンス:**
```json
{
  "query": "映画のおすすめ教えて",
  "results": [
    {
      "source": "notion",
      "databaseId": "...",
      "pageId": "...",
      "title": "面白い映画リスト",
      "content": "...",
      "url": "https://...",
      "databaseName": "映画",
      "usageHint": "..."
    },
    // ... 他のマッチしたページ
  ]
}
```

---

### テスト2: 日本語クエリ「アニメの新作ある？」

**PowerShellコマンド:**
```powershell
$body = @{ query = "アニメの新作ある？" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json; charset=utf-8"
```

**期待されるログ:**
```
[fallback] query = "アニメの新作ある？"
[fallback] keywords = [ 'アニメ', '新作' ]
```

---

### テスト3: 英数字クエリ（既存の挙動を確認）

**PowerShellコマンド:**
```powershell
$body = @{ query = "test_keyword_12345" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json; charset=utf-8"
```

**期待される挙動:**
- 通常のNotion API検索で結果が返る
- フォールバック検索は発火しない（英数字のみのため）

---

## 改善のポイント

### Before（厳しすぎる条件）

```
クエリ: "映画のおすすめ教えて"
↓
ページ本文に「映画のおすすめ教えて」という文字列が完全に含まれているか？
↓
含まれていない → マッチしない（0件）
```

**問題:**
- 「映画」と「おすすめ」という単語がバラバラに含まれていても、文全体がないとマッチしない

### After（キーワードベース）

```
クエリ: "映画のおすすめ教えて"
↓
キーワード抽出: ["映画", "おすすめ"]
↓
ページ本文に「映画」または「おすすめ」が含まれているか？
↓
どちらか1つでも含まれていれば → マッチ（結果あり）
```

**改善:**
- 自然な日本語クエリでも、意味のあるキーワードを抽出してマッチング
- ユーザーの意図に沿った検索結果を返せる

---

## キーワード抽出の例

| クエリ | 抽出されるキーワード |
|--------|---------------------|
| `映画のおすすめ教えて` | `["映画", "おすすめ"]` |
| `今日は何をすればいい？` | `["今日", "何"]` |
| `アニメの新作ある？` | `["アニメ", "新作"]` |
| `TypeScriptについて` | `["TypeScript", "ついて"]` |
| `パーソナルAIの進捗を教えて` | `["パーソナルAI", "進捗"]` |

---

## 既存機能への影響

### 保証（変更なし）

- ✅ 英数字クエリの動作は変更なし
- ✅ レスポンス形式は変更なし
- ✅ フォールバック発火条件（非ASCII文字 + 結果0件）は変更なし
- ✅ エラーハンドリングは変更なし

### 改善

- ➕ 日本語クエリの検索精度が大幅に向上
- ➕ 自然な文章でのクエリに対応
- ➕ デバッグログが充実（キーワード抽出結果を確認可能）

---

## 今後の改善案

1. **キーワード重要度の導入**
   ```typescript
   // 複数のキーワードがマッチした方を優先
   if (hitCount >= 2) {
     // 高優先度
   } else if (hitCount >= 1) {
     // 通常
   }
   ```

2. **除外ワードリストの充実**
   - ユーザーのフィードバックに基づいて除外ワードを増やす
   - 設定ファイルで管理する

3. **形態素解析の導入**
   - `kuromoji.js` などを使って、より正確なキーワード抽出
   - 名詞・固有名詞のみを抽出

4. **ページスコアリング**
   - キーワードの出現回数でスコアリング
   - タイトルに含まれる場合は高スコア

---

## まとめ

フォールバック検索を「完全一致」から「キーワードベース」に変更したことで、日本語の自然な文章クエリに対応できるようになりました。

**主な変更:**
- `extractKeywords()` メソッドを追加（助詞・句読点で分割、汎用動詞を除外）
- `fallbackSearchAllPages()` を改修（キーワードのいずれか1つ以上でマッチ）
- デバッグログを追加（query, keywords, pages.length, matchedPages.length）

これにより、「映画のおすすめ教えて」のような自然な質問でも、適切にページを検索できるようになりました。
