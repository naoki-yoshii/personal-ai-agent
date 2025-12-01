/**
 * 検索リクエストの型定義
 */
export interface SearchKnowledgeRequest {
  query: string;
}

/**
 * 検索結果の型定義
 *
 * RAG（Retrieval-Augmented Generation）でLLMがコンテキストとして使いやすいように、
 * タイトル・本文・URLを含む構造になっています。
 */
export interface SearchResult {
  /** どのソースから取得した結果か。今回は固定で "notion" とします */
  source: 'notion';

  /** 検索対象となった Notion データベースのID */
  databaseId: string;

  /** Notion ページのID */
  pageId: string;

  /** ページのタイトル */
  title: string;

  /** RAG用に連結・整形したテキストコンテンツ */
  content: string;

  /** Notion ページへのURL（取得できる場合のみ設定） */
  url?: string;

  /** 設定DBに登録されているこのデータベースの名前（例：アニメリスト、メモ、日記） */
  databaseName?: string;

  /** 設定DBに登録されているこのデータベースの用途説明 */
  usageHint?: string;
}

/**
 * 検索レスポンスの型定義
 *
 * /search_knowledge エンドポイントが返すレスポンス型です。
 */
export interface SearchKnowledgeResponse {
  /** ユーザーから受け取った検索クエリ文字列 */
  query: string;

  /** 検索にヒットした結果の配列 */
  results: SearchResult[];
}

/**
 * ヘルスチェックレスポンスの型定義
 */
export interface HealthCheckResponse {
  status: string;
  service: string;
  timestamp: string;
}

/**
 * エラーレスポンスの型定義
 */
export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
}
