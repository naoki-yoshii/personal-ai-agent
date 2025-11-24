import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { SearchResult, SearchKnowledgeResponse } from '../types/searchTypes';

/**
 * Notion RAG サービスクラス
 *
 * このクラスは、Notion データベースと連携して知識検索を行うサービスです。
 * 現在は簡易版の実装で、タイトル部分検索のみ対応しています。
 * 将来的には、ベクトルDB を使用した本格的な RAG（Retrieval-Augmented Generation）機能を実装予定です。
 *
 * 【設計書との対応】
 * - docs/design_v1.txt の「4-2. MCP: Notion RAGサーバ」に対応しています
 * - 設計書に記載された「RAGの流れ（内部）」の処理を段階的に実装していきます
 *
 * 【現在の実装状況】
 * - ✅ Notion クライアントの初期化（環境変数 NOTION_TOKEN と NOTION_DATABASE_IDS を使用）
 * - ✅ 環境変数のバリデーション機能（未設定時に分かりやすいエラーメッセージを表示）
 * - ✅ 複数データベース対応（NOTION_DATABASE_IDS をカンマ区切りで指定可能）
 * - ✅ searchKnowledge() による基本的なデータベース検索
 *   - 複数の Notion データベースを並列検索
 *   - Notion データベース内の Name プロパティ（タイトル）に対して部分一致検索
 *   - 最大 5 件のページを返す（各DB）
 *   - ページタイトル（Name）、本文（Content）、URL を含む結果を返す
 *   - RAG用にLLMがコンテキストとして使いやすい形式で返す
 *
 * 【今後の実装予定（設計書の「RAGの流れ」に基づく本格的な RAG 機能）】
 *
 * 1. sync_notion_data() の本実装
 *    このメソッドで、Notion データをベクトルDB に同期します：
 *    - Notion API を使用してデータベースのページ一覧とコンテンツを取得
 *    - ページ本文をチャンク化（適切なサイズに分割）
 *    - 各チャンクの埋め込みベクトルを生成（OpenAI Embeddings API 等を使用）
 *    - ベクトルDB（ChromaDB 等）に保存
 *    - 定期的または手動トリガーで実行
 *
 * 2. searchKnowledge() のベクトル検索への差し替え
 *    現在のタイトル検索から、意味検索へアップグレードします：
 *    - ユーザーのクエリを埋め込みベクトル化
 *    - ベクトルDB で類似度検索を実行
 *    - 関連度の高い上位 N 件のドキュメントを取得
 *    - スコアリングして、LLM に渡しやすい形式で返す
 *
 * 3. その他の拡張機能
 *    - ページ本文も含めた全文検索
 *    - フィルタリング機能（タグ、日付等）
 *    - キャッシュ機能（検索結果の一時保存）
 */
export class NotionRagService {
  private notion: Client;
  private databaseIds: string[];

  constructor() {
    // 環境変数のバリデーション
    const notionToken = process.env.NOTION_TOKEN;
    const databaseIdsEnv = process.env.NOTION_DATABASE_IDS ?? '';

    if (!notionToken || notionToken.trim() === '') {
      throw new Error(
        '❌ NOTION_TOKEN が設定されていません。.env ファイルに NOTION_TOKEN を設定してください。\n' +
          '取得方法: https://www.notion.so/my-integrations から Integration を作成してトークンを取得'
      );
    }

    // NOTION_DATABASE_IDS をカンマ区切りでパースして配列にする
    const databaseIds = databaseIdsEnv
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (databaseIds.length === 0) {
      throw new Error(
        '❌ NOTION_DATABASE_IDS が設定されていません。.env ファイルに NOTION_DATABASE_IDS を設定してください。\n' +
          '設定方法: 複数のデータベースIDをカンマ区切りで指定（例：NOTION_DATABASE_IDS=dbid1,dbid2,dbid3）\n' +
          '取得方法: Notion のデータベースURLから ID を取得（例：https://notion.so/xxxxxxxx?v=... の xxxxxxxx 部分）'
      );
    }

    // Notion クライアントの初期化
    this.notion = new Client({ auth: notionToken });
    this.databaseIds = databaseIds;

    console.log('✅ Notion クライアントを初期化しました');
    console.log(`📊 データベース数: ${this.databaseIds.length}`);
    this.databaseIds.forEach((id, index) => {
      console.log(`   [${index + 1}] ${id.substring(0, 8)}...`);
    });
  }
  /**
   * Notion データベースから知識を検索する
   *
   * 【設計書との対応】
   * - docs/design_v1.txt の「4-2. MCP: Notion RAGサーバ」で定義されている
   *   「search_knowledge(query: string) -> [contexts...]」機能に対応しています
   *
   * 【現在の実装（簡易版）】
   * Notion データベース内のページを検索して、関連するページ情報を返します。
   * - ✅ Notion API の databases.query を使用してデータベースを検索
   * - ✅ Name プロパティ（ページタイトル）に query を含むページを検索（部分一致）
   * - ✅ 最大 5 件のページを返す
   * - ✅ 各ページのタイトル（Name）、本文（Content）、URL を含む結果を返す
   * - ✅ RAG用にLLMがコンテキストとして使いやすい形式（title + content + url）で返す
   *
   * 【今後の実装予定（本格的な RAG 機能への移行）】
   * 現在のタイトル検索は暫定的な実装です。将来的には、以下のようにベクトル検索へ移行します：
   *
   * 1. クエリの埋め込みベクトル化
   *    - OpenAI Embeddings API などを使用して、ユーザーのクエリをベクトル化
   *
   * 2. ベクトルDB での類似度検索
   *    - ChromaDB などのベクトルDB に対して、類似度検索を実行
   *    - ページタイトルだけでなく、本文も含めた検索が可能に
   *
   * 3. 関連度スコアに基づくランキング
   *    - 意味的な関連度を計算して、上位 N 件を取得
   *    - 現在の固定スコア 1.0 から、実際の類似度スコアへ変更
   *
   * 4. コンテキスト情報の充実
   *    - ページタイトルだけでなく、関連する本文の抜粋も返す
   *    - LLM がより正確な回答を生成できるようにする
   *
   * @param query 検索クエリ文字列（ユーザーが入力した質問や検索キーワード）
   * @returns 検索結果（query と results の配列を含む）
   * @throws Notion API 呼び出しに失敗した場合にエラーをスロー
   */
  async searchKnowledge(query: string): Promise<SearchKnowledgeResponse> {
    try {
      console.log(`🔍 Notionデータベースを検索中: "${query}"`);
      console.log(`📊 検索対象データベース数: ${this.databaseIds.length}`);

      // 複数のデータベースIDに対して並列検索を実行
      const allResults = await Promise.all(
        this.databaseIds.map(async (databaseId, index) => {
          console.log(`   [${index + 1}/${this.databaseIds.length}] ${databaseId.substring(0, 8)}... を検索中`);

          // Notion データベースを検索（Name プロパティに query を含むページ）
          const response = await this.notion.databases.query({
            database_id: databaseId,
            filter: {
              property: 'Name',
              title: {
                contains: query,
              },
            },
            page_size: 5, // 最大5件（各DB）
          });

          console.log(`   ✓ ${response.results.length} 件のページが見つかりました`);
          return { databaseId, results: response.results };
        })
      );

      // Notionの結果を SearchResult 型に変換
      const mappedResults: SearchResult[] = allResults.flatMap(({ databaseId, results }) =>
        results.map((page) => this.mapNotionPageToSearchResult(page as PageObjectResponse, databaseId))
      );

      console.log(`📊 検索結果（全DB）: 合計 ${mappedResults.length} 件のページが見つかりました`);

      const response: SearchKnowledgeResponse = {
        query,
        results: mappedResults,
      };

      return response;
    } catch (error) {
      console.error('❌ Notion API 呼び出しエラー:', error);

      // エラーメッセージを生成（null/undefined 対策）
      let errorMessage = 'Notion API 呼び出しに失敗しました';

      if (error instanceof Error) {
        errorMessage = `Notion API 呼び出しに失敗しました: ${error.message}`;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = `Notion API 呼び出しに失敗しました: ${String(error.message)}`;
      } else if (error) {
        errorMessage = `Notion API 呼び出しに失敗しました: ${String(error)}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Notionデータを同期（将来実装予定）
   *
   * 【設計書との対応】
   * - 「sync_notion_data()」に対応
   * - 「RAGの流れ（内部）」のステップ1に対応
   *
   * 【現在の実装】
   * - ⚠️ 未実装：ログ出力のみ
   *
   * 【将来の実装で差し替える箇所】
   * 以下の処理を実装予定：
   * 1. Notion API (@notionhq/client) で対象データベース・ページを取得
   * 2. 取得したテキストをチャンク化（文章の境界で分割）
   * 3. 各チャンクの埋め込みベクトルを生成（OpenAI Embeddings API）
   * 4. ベクトルDB（ChromaDB）に (embedding, text, meta) を保存
   * 5. 定期的または手動トリガーで実行
   */
  async syncNotionData(): Promise<void> {
    console.log('Notion データ同期は未実装です');
    console.log(`📦 Notion クライアントは初期化済みです: ${this.notion ? 'はい' : 'いいえ'}`);
    console.log(`📊 対象データベース数: ${this.databaseIds.length}`);
    this.databaseIds.forEach((id, index) => {
      console.log(`   [${index + 1}] ${id.substring(0, 8)}...`);
    });

    // 将来的には、以下のコードに差し替える：
    // 1. for (const databaseId of this.databaseIds) {
    //      const response = await this.notion.databases.query({
    //        database_id: databaseId,
    //      });
    //      for (const page of response.results) {
    //        const chunks = chunkText(page.content);
    //        for (const chunk of chunks) {
    //          const embedding = await generateEmbedding(chunk);
    //          await vectorDB.insert({ embedding, text: chunk, meta: {...} });
    //        }
    //      }
    //    }
  }

  /**
   * Notion ページからタイトルを抽出するヘルパー関数
   *
   * @param page Notion の PageObjectResponse
   * @returns ページタイトル（取得できない場合は "(no title)"）
   */
  private extractTitleFromPage(page: PageObjectResponse): string {
    const property = Object.values(page.properties).find(
      (prop) => prop.type === 'title'
    ) as Extract<(typeof page.properties)[string], { type: 'title' }> | undefined;

    if (!property) {
      return '(no title)';
    }

    return property.title.map((t) => t.plain_text).join('') || '(no title)';
  }

  /**
   * Notion ページの全プロパティからテキストコンテンツを抽出して連結するヘルパー関数
   *
   * @param page Notion の PageObjectResponse
   * @returns 抽出したテキストを改行で連結した文字列
   */
  private extractContentFromPage(page: PageObjectResponse): string {
    const texts: string[] = [];

    for (const prop of Object.values(page.properties)) {
      if (prop.type === 'title') {
        const t = prop.title.map((v) => v.plain_text).join('');
        if (t) texts.push(t);
      } else if (prop.type === 'rich_text') {
        const t = prop.rich_text.map((v) => v.plain_text).join('');
        if (t) texts.push(t);
      }
      // 必要があれば他の型（status, select など）もここに追加可能
    }

    return texts.join('\n');
  }

  /**
   * Notion ページ1件を SearchResult 型に変換する関数
   *
   * @param page Notion の PageObjectResponse
   * @param databaseId このページが属するデータベースのID
   * @returns SearchResult 型のオブジェクト
   */
  private mapNotionPageToSearchResult(page: PageObjectResponse, databaseId: string): SearchResult {
    const title = this.extractTitleFromPage(page);
    const content = this.extractContentFromPage(page);

    // NotionのページURLは page.url に入っているはずなので、それを使います。
    const url = 'url' in page ? page.url : undefined;

    return {
      source: 'notion',
      databaseId,
      pageId: page.id,
      title,
      content,
      url,
    };
  }
}

// シングルトンインスタンスをエクスポート
export const notionRagService = new NotionRagService();
