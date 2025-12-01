# フォールバック検索の強化: DB名・タイトル・usageHintを検索対象に追加

## 変更内容

### 修正したファイル

**`src/services/notionRagService.ts`**

#### `fallbackSearchAllPages` メソッドを改修 (477-560行目)

---

## 主な変更点

### Before（本文のみ検索）

```typescript
// ページの本文のみを検索対象にしていた
const fullTextContent = this.buildPageContent(pageObj);
const lowerText = fullTextContent.toLowerCase();

const hitCount = keywords.filter((kw) => {
  return kw && lowerText.includes(kw.toLowerCase());
}).length;
```

**問題点:**
- タイトルにしか情報がないページがヒットしない
- DB名（例: "漫画"）が検索対象に含まれない
- usageHint（DBの用途説明）が検索対象に含まれない

---

### After（DB名・タイトル・usageHint・本文すべて検索）

```typescript
// 1. ページをSearchResult型に変換（必要な情報を取得）
const result = this.mapNotionPageToSearchResult(pageObj, config);

// 2. 検索対象テキストを構築（すべて含める）
const fullTextForSearch = [
  result.databaseName ?? '',  // DB名（例: "漫画"）
  result.usageHint ?? '',     // 用途説明（例: "読んだ漫画のリスト"）
  result.title ?? '',         // ページタイトル（例: "ワンピース"）
  result.content ?? '',       // ページ本文
]
  .filter((text) => text.length > 0)
  .join('\n');

// 3. キーワードマッチング
const lowerText = fullTextForSearch.toLowerCase();
const hitCount = keywords.filter((kw) => {
  return kw && lowerText.includes(kw.toLowerCase());
}).length;

if (hitCount >= 1) {
  allMatchedPages.push(result);
}
```

**改善点:**
- ✅ DB名が検索対象に含まれる → 「漫画」DBは「漫画」クエリでヒット
- ✅ タイトルが検索対象に含まれる → タイトルのみのページもヒット
- ✅ usageHintが検索対象に含まれる → DBの説明文からも検索可能

---

## デバッグログの追加

最初のページに対してのみ、以下のログを出力するようにしました：

```typescript
console.log('[fallback] page sample =', {
  databaseName: result.databaseName,
  title: result.title,
});
console.log(
  '[fallback] fullTextForSearch (first 200 chars) =',
  fullTextForSearch.slice(0, 200)
);
```

---

## 動作例

### ケース1: 「おすすめの漫画を教えて」

**Before（本文のみ）:**
```
クエリ: "おすすめの漫画を教えて"
キーワード: ["漫画", "おすすめ"]

漫画DB内のページ:
  - タイトル: "ワンピース"
  - 本文: （空）
  
検索対象: ""（空文字）
→ "漫画" を含まない → マッチしない ❌
```

**After（DB名・タイトル・usageHint・本文）:**
```
クエリ: "おすすめの漫画を教えて"
キーワード: ["漫画", "おすすめ"]

漫画DB内のページ:
  - databaseName: "漫画"
  - usageHint: "読んだ漫画のリスト"
  - タイトル: "ワンピース"
  - 本文: （空）
  
検索対象: "漫画\n読んだ漫画のリスト\nワンピース"
→ "漫画" を含む → マッチ ✅
```

---

### ケース2: 「映画のおすすめ教えて」

**Before:**
```
映画DB内のページ:
  - タイトル: "インターステラー"
  - 本文: （空）
  
検索対象: ""
→ "映画" を含まない → マッチしない ❌
```

**After:**
```
映画DB内のページ:
  - databaseName: "映画"
  - usageHint: "見た映画のメモ"
  - タイトル: "インターステラー"
  - 本文: （空）
  
検索対象: "映画\n見た映画のメモ\nインターステラー"
→ "映画" を含む → マッチ ✅
```

---

## テストコマンド

### テスト1: 漫画クエリ

```powershell
$body = @{ query = "おすすめの漫画を教えて" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json; charset=utf-8"
```

**期待されるサーバーログ:**
```
🔄 フォールバック検索を実行します（日本語クエリ: "おすすめの漫画を教えて"）
[fallback] query = "おすすめの漫画を教えて"
[fallback] keywords = [ '漫画', 'おすすめ' ]
   📄 プロフィール: 1 件のページを取得
   📄 映画: 6 件のページを取得
   📄 漫画: 21 件のページを取得
[fallback] page sample = { databaseName: 'プロフィール', title: '自己紹介' }
[fallback] fullTextForSearch (first 200 chars) = プロフィール
基本情報
自己紹介
...
[fallback] pages.length = 28
[fallback] matchedPages.length = 21
📊 フォールバック検索結果: 21 件のページが見つかりました
```

**期待される結果:**
- 漫画DBの全ページ（21件）がヒット
- DB名に「漫画」が含まれるため、キーワード「漫画」にマッチ

---

### テスト2: 映画クエリ

```powershell
$body = @{ query = "映画のおすすめ教えて" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3001/search_knowledge -Method Post -Body $body -ContentType "application/json; charset=utf-8"
```

**期待される結果:**
- 映画DBの全ページがヒット
- DB名に「映画」が含まれるため、キーワード「映画」にマッチ

---

## 既存機能への影響

### 保証（変更なし）

- ✅ 英数字クエリの動作は変更なし
- ✅ レスポンス形式は変更なし
- ✅ フォールバック発火条件は変更なし
- ✅ エラーハンドリングは変更なし

### 改善

- ➕ DB名が検索対象に含まれる
- ➕ タイトルが検索対象に含まれる
- ➕ usageHintが検索対象に含まれる
- ➕ 本文が空のページもヒットするようになった
- ➕ デバッグログが充実（fullTextForSearchの内容を確認可能）

---

## 実装の詳細

### 検索対象テキストの構築

```typescript
const fullTextForSearch = [
  result.databaseName ?? '',  // 1. DB名
  result.usageHint ?? '',     // 2. 用途説明
  result.title ?? '',         // 3. タイトル
  result.content ?? '',       // 4. 本文
]
  .filter((text) => text.length > 0)  // 空文字を除外
  .join('\n');  // 改行で結合
```

**ポイント:**
- `mapNotionPageToSearchResult` を先に呼び出して、必要な情報を取得
- 空文字を除外してから結合
- 改行で区切ることで、各要素が独立して検索される

---

## パフォーマンスへの影響

### Before

- `buildPageContent(pageObj)` を1回呼び出し
- キーワードマッチング

### After

- `mapNotionPageToSearchResult(pageObj, config)` を1回呼び出し
  - この中で `buildPageContent(pageObj)` が呼ばれる
- 検索対象テキストを構築（配列の結合）
- キーワードマッチング

**影響:**
- ほぼ同等（追加コストは配列の結合のみ）
- `mapNotionPageToSearchResult` は最終的に必要なので、先に呼ぶだけ

---

## まとめ

この変更により、以下のケースでも適切に検索結果が返るようになりました：

1. **本文が空のページ**
   - タイトルやDB名でマッチング可能

2. **DB名が重要な情報を持つケース**
   - 「漫画」DBなら、「漫画」クエリで全ページヒット

3. **usageHintに詳細な説明があるケース**
   - 「このDBには何が入っているか」の説明からも検索可能

これにより、より自然で直感的な検索体験を提供できます。
