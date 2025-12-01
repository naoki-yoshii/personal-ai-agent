import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { SearchResult, SearchKnowledgeResponse } from '../types/searchTypes';

/**
 * データベース設定の型定義
 *
 * 設定DBから取得した各対象DBの情報を保持します。
 */
export interface DatabaseConfig {
  /** database_url から抽出したデータベースID（32文字） */
  databaseId: string;

  /** 設定DBの Name プロパティ（例：アニメリスト、メモ、日記） */
  databaseName: string;

  /** usage_hint のテキスト（このDBの用途説明） */
  usageHint: string;
}

/**
 * Notion データベースURLから DB ID を抽出する
 *
 * @param url Notion データベースのURL（例：https://www.notion.so/WorkspaceName/DatabaseName-abc123...?v=...）
 * @returns 抽出された32文字のDB ID、または抽出失敗時は null
 */
function extractDatabaseIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // NotionのURLパターン:
    // https://www.notion.so/WorkspaceName/DatabaseName-<32桁のID>
    // https://www.notion.so/WorkspaceName/DatabaseName-<32桁のID>?v=...
    // または、
    // https://www.notion.so/<32桁のID>?v=...

    // URLから最後の'/'以降を取得
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];

    if (!lastPart) {
      return null;
    }

    // クエリパラメータがあれば除去
    const withoutQuery = lastPart.split('?')[0];

    // '-' で分割して最後の部分を取得（DatabaseName-<ID> のパターン）
    const segments = withoutQuery.split('-');
    const idCandidate = segments[segments.length - 1];

    // 32文字の16進数文字列かチェック
    if (idCandidate && /^[a-f0-9]{32}$/i.test(idCandidate)) {
      return idCandidate;
    }

    // ハイフンなしのパターンもチェック（URLが直接IDを含む場合）
    if (withoutQuery && /^[a-f0-9]{32}$/i.test(withoutQuery)) {
      return withoutQuery;
    }

    return null;
  } catch (error) {
    console.warn(`URL解析エラー: ${url}`, error);
    return null;
  }
}

/**
 * Notion RAG サービスクラス
 *
 * このクラスは、Notion データベースと連携して知識検索を行うサービスです。
 * 設定DBから検索対象DBのリストを動的に取得し、それらのDBに対して検索を行います。
 *
 * 【設計書との対応】
 * - docs/design_v1.txt の「4-2. MCP: Notion RAGサーバ」に対応しています
 * - 設計書に記載された「RAGの流れ（内部）」の処理を段階的に実装していきます
 *
 * 【現在の実装状況】
 * - ✅ Notion クライアントの初期化（環境変数 NOTION_API_KEY と NOTION_CONFIG_DATABASE_ID を使用）
 * - ✅ 設定DBから検索対象DBリストを動的に取得
 * - ✅ 環境変数のバリデーション機能（未設定時に分かりやすいエラーメッセージを表示）
 * - ✅ 複数データベース対応（設定DBから enabled=true のDBのみを検索対象とする）
 * - ✅ searchKnowledge() による基本的なデータベース検索
 *   - 複数の Notion データベースを並列検索
 *   - Notion データベース内の Name プロパティ（タイトル）に対して部分一致検索
 *   - 最大 5 件のページを返す（各DB）
 *   - ページタイトル（Name）、本文（Content）、URL、データベース名、用途説明を含む結果を返す
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
  private configDatabaseId: string;

  constructor() {
    // 環境変数のバリデーション
    const notionApiKey = process.env.NOTION_API_KEY;
    const configDatabaseId = process.env.NOTION_CONFIG_DATABASE_ID;

    if (!notionApiKey || notionApiKey.trim() === '') {
      throw new Error(
        '❌ NOTION_API_KEY が設定されていません。.env ファイルに NOTION_API_KEY を設定してください。\n' +
          '取得方法: https://www.notion.so/my-integrations から Integration を作成してトークンを取得'
      );
    }

    if (!configDatabaseId || configDatabaseId.trim() === '') {
      throw new Error(
        '❌ NOTION_CONFIG_DATABASE_ID が設定されていません。設定DBのIDを .env に指定してください。\n' +
          '設定DBには、検索対象とするDBのURLや用途(usage_hint)を登録します。'
      );
    }

    // Notion クライアントの初期化
    this.notion = new Client({ auth: notionApiKey });
    this.configDatabaseId = configDatabaseId.trim();

    console.log('✅ Notion クライアントを初期化しました');
    console.log(`📊 設定データベースID: ${this.configDatabaseId.substring(0, 8)}...`);
  }

  /**
   * 設定DBから検索対象DBのリストを取得する
   *
   * 設定DB（AI設定_対象DB一覧）から、enabled=true の行のみを取得し、
   * 各行の database_url, Name, usage_hint を解析して DatabaseConfig[] を返します。
   *
   * @returns 検索対象DBの設定リスト
   * @throws 設定DBの取得に失敗した場合、またはURLからIDを抽出できない場合
   */
  async loadDatabaseConfigs(): Promise<DatabaseConfig[]> {
    try {
      console.log('🔍 設定DBから検索対象DBリストを取得中...');

      // 設定DBをクエリ（enabled=true のみ）
      const response = await this.notion.databases.query({
        database_id: this.configDatabaseId,
        filter: {
          property: 'enabled',
          checkbox: {
            equals: true,
          },
        },
      });

      const configs: DatabaseConfig[] = [];

      for (const page of response.results) {
        if (!('properties' in page)) {
          continue;
        }

        const pageObj = page as PageObjectResponse;

        // Name プロパティ（タイトル）を取得
        const nameProperty = pageObj.properties.Name;
        const name =
          nameProperty && 'title' in nameProperty && nameProperty.title.length > 0
            ? nameProperty.title[0].plain_text
            : 'Unknown';

        // database_url プロパティを取得
        const urlProperty = pageObj.properties.database_url;
        const url = urlProperty && 'url' in urlProperty ? urlProperty.url ?? '' : '';

        // enabled プロパティを確認（念のため）
        const enabledProperty = pageObj.properties.enabled;
        const enabled =
          enabledProperty && 'checkbox' in enabledProperty ? enabledProperty.checkbox === true : false;

        if (!enabled) {
          continue;
        }

        // usage_hint プロパティを取得
        const usageHintProperty = pageObj.properties.usage_hint;
        const usageHint =
          usageHintProperty && 'rich_text' in usageHintProperty
            ? usageHintProperty.rich_text.map((t: any) => t.plain_text).join('')
            : '';

        // database_url から DB ID を抽出
        const databaseId = extractDatabaseIdFromUrl(url);

        if (!databaseId) {
          console.warn(`⚠️ スキップ: database_url から ID を抽出できませんでした（Name: ${name}, URL: ${url}）`);
          continue;
        }

        configs.push({
          databaseId,
          databaseName: name,
          usageHint,
        });

        console.log(`   ✓ ${name}: ${databaseId.substring(0, 8)}...`);
      }

      console.log(`✅ 検索対象DB数: ${configs.length}`);

      if (configs.length === 0) {
        console.warn('⚠️ 設定DBに有効なデータベース設定が見つかりませんでした（enabled=true の行がありません）');
      }

      return configs;
    } catch (error) {
      console.error('❌ 設定DBの取得エラー:', error);

      let errorMessage = '設定DBの取得に失敗しました';

      if (error instanceof Error) {
        errorMessage = `設定DBの取得に失敗しました: ${error.message}`;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = `設定DBの取得に失敗しました: ${String(error.message)}`;
      } else if (error) {
        errorMessage = `設定DBの取得に失敗しました: ${String(error)}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Notion データベースから知識を検索する
   *
   * 【設計書との対応】
   * - docs/design_v1.txt の「4-2. MCP: Notion RAGサーバ」で定義されている
   *   「search_knowledge(query: string) -> [contexts...]」機能に対応しています
   *
   * 【現在の実装（簡易版）】
   * 設定DBから取得した検索対象DBリストに対して、Notion データベース内のページを検索して、
   * 関連するページ情報を返します。
   * - ✅ 設定DBから検索対象DBリストを動的に取得
   * - ✅ Notion API の databases.query を使用してデータベースを検索
   * - ✅ Name プロパティ（ページタイトル）に query を含むページを検索（部分一致）
   * - ✅ 最大 5 件のページを返す（各DB）
   * - ✅ 各ページのタイトル（Name）、本文（Content）、URL、データベース名、用途説明を含む結果を返す
   * - ✅ RAG用にLLMがコンテキストとして使いやすい形式（title + content + url + databaseName + usageHint）で返す
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

      // 設定DBから検索対象DBリストを取得
      const configs = await this.loadDatabaseConfigs();

      if (configs.length === 0) {
        console.warn('⚠️ 検索対象DBが見つかりませんでした');
        return { query, results: [] };
      }

      console.log(`📊 検索対象データベース数: ${configs.length}`);

      // 複数のデータベースIDに対して並列検索を実行
      const allResults = await Promise.all(
        configs.map(async (config, index) => {
          console.log(`   [${index + 1}/${configs.length}] ${config.databaseName} (${config.databaseId.substring(0, 8)}...) を検索中`);

          // Notion データベースを検索（Name プロパティに query を含むページ）
          const response = await this.notion.databases.query({
            database_id: config.databaseId,
            filter: {
              property: 'Name',
              title: {
                contains: query,
              },
            },
            page_size: 5, // 最大5件（各DB）
          });

          console.log(`   ✓ ${response.results.length} 件のページが見つかりました`);
          return { config, results: response.results };
        })
      );

      // Notionの結果を SearchResult 型に変換
      const mappedResults: SearchResult[] = allResults.flatMap(({ config, results }) =>
        results.map((page) =>
          this.mapNotionPageToSearchResult(page as PageObjectResponse, config)
        )
      );

      console.log(`📊 検索結果（全DB）: 合計 ${mappedResults.length} 件のページが見つかりました`);

      // 日本語フォールバック検索
      // 結果が0件 かつ 非ASCII文字（日本語など）が含まれる場合のみ実行
      const hasNonAscii = /[^\x00-\x7F]/.test(query);

      if (mappedResults.length === 0 && hasNonAscii) {
        console.log(`🔄 フォールバック検索を実行します（日本語クエリ: "${query}"）`);
        const fallbackResults = await this.fallbackSearchAllPages(query, configs);
        console.log(`📊 フォールバック検索結果: ${fallbackResults.length} 件のページが見つかりました`);

        const response: SearchKnowledgeResponse = {
          query,
          results: fallbackResults,
        };

        return response;
      }

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

    // 設定DBから検索対象DBリストを取得
    const configs = await this.loadDatabaseConfigs();
    console.log(`📊 対象データベース数: ${configs.length}`);
    configs.forEach((config, index) => {
      console.log(`   [${index + 1}] ${config.databaseName}: ${config.databaseId.substring(0, 8)}...`);
    });

    // 将来的には、以下のコードに差し替える：
    // 1. for (const config of configs) {
    //      const response = await this.notion.databases.query({
    //        database_id: config.databaseId,
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
   * クエリ文字列からキーワードを抽出する
   *
   * 日本語の助詞や句読点で分割し、意味のあるキーワードのみを抽出します。
   *
   * @param query 検索クエリ
   * @returns 抽出されたキーワードの配列
   */
  private extractKeywords(query: string): string[] {
    // 助詞、句読点、疑問符などで分割
    const separators = /[のをがはへにでと、。？！\s]+/;
    const tokens = query.split(separators).filter((t) => t.length > 0);

    // 除外する汎用的な動詞・表現（ハードコーディング）
    const excludeWords = new Set([
      '教えて',
      'ください',
      'お願い',
      'します',
      'ある',
      'いる',
      'する',
      'なる',
      'くれ',
      'ほしい',
      '見せて',
      '知りたい',
      'たい',
      'ます',
      'です',
    ]);

    // フィルタリング: 長さ1以下は除外、除外ワードも除外
    const keywords = tokens.filter((token) => {
      if (token.length <= 1) return false;
      if (excludeWords.has(token)) return false;
      return true;
    });

    return keywords;
  }

  /**
   * フォールバック検索: 全ページを取得してキーワードで絞り込む
   *
   * 通常のNotion API検索で結果が返らない場合（特に日本語クエリ）に使用します。
   * 各データベースの全ページを取得し、ページ内容に対してキーワードベースのマッチングを行います。
   *
   * 【検索ロジック】
   * 1. クエリから意味のあるキーワードを抽出（助詞や句読点で分割）
   * 2. 各ページの全文コンテンツを取得
   * 3. キーワードのいずれか1つ以上が含まれていればマッチ
   *
   * 【注意】
   * - ページ数が多い場合、この処理は重くなる可能性があります
   * - 将来的には、ページ数の制限やキャッシュの導入を検討してください
   *
   * @param query 検索クエリ
   * @param configs 検索対象のデータベース設定
   * @returns マッチしたページの配列
   */
  private async fallbackSearchAllPages(
    query: string,
    configs: DatabaseConfig[]
  ): Promise<SearchResult[]> {
    // クエリからキーワードを抽出
    const keywords = this.extractKeywords(query);

    console.log(`[fallback] query = "${query}"`);
    console.log(`[fallback] keywords =`, keywords);

    const allMatchedPages: SearchResult[] = [];
    let totalPagesCount = 0;
    let isFirstPage = true; // デバッグログ用（最初のページのみログ出力）

    for (const config of configs) {
      try {
        // データベースから全ページを取得（フィルタなし）
        // ページサイズは100件まで（Notion APIの制限）
        const response = await this.notion.databases.query({
          database_id: config.databaseId,
          page_size: 100,
        });

        console.log(`   📄 ${config.databaseName}: ${response.results.length} 件のページを取得`);
        totalPagesCount += response.results.length;

        // 各ページの全文コンテンツを取得してマッチング
        for (const page of response.results) {
          if (!('properties' in page)) {
            continue;
          }

          const pageObj = page as PageObjectResponse;

          // ページを SearchResult 型に変換（title, content, databaseName, usageHint を取得するため）
          const result = this.mapNotionPageToSearchResult(pageObj, config);

          // 検索対象テキストを構築
          // タイトル、DB名、usageHint、本文のすべてを含める
          const fullTextForSearch = [
            result.databaseName ?? '',
            result.usageHint ?? '',
            result.title ?? '',
            result.content ?? '',
          ]
            .filter((text) => text.length > 0)
            .join('\n');

          // デバッグログ（最初のページのみ）
          if (isFirstPage) {
            console.log('[fallback] page sample =', {
              databaseName: result.databaseName,
              title: result.title,
            });
            console.log(
              '[fallback] fullTextForSearch (first 200 chars) =',
              fullTextForSearch.slice(0, 200)
            );
            isFirstPage = false;
          }

          // キーワードのいずれかが含まれているかチェック
          const lowerText = fullTextForSearch.toLowerCase();
          const hitCount = keywords.filter((kw) => {
            return kw && lowerText.includes(kw.toLowerCase());
          }).length;

          // 少なくとも1つ以上のキーワードを含んでいれば採用
          if (hitCount >= 1) {
            allMatchedPages.push(result);
          }
        }
      } catch (error) {
        console.error(`⚠️ ${config.databaseName} のフォールバック検索でエラー:`, error);
        // エラーが発生しても、他のデータベースの検索は続行
        continue;
      }
    }

    console.log(`[fallback] pages.length = ${totalPagesCount}`);
    console.log(`[fallback] matchedPages.length = ${allMatchedPages.length}`);

    return allMatchedPages;
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
  private buildPageContent(page: PageObjectResponse): string {
    const props = page.properties ?? {};
    const parts: string[] = [];

    // 各プロパティをループして、テキスト情報を収集
    for (const key of Object.keys(props)) {
      const prop = props[key];

      // Title プロパティ
      if (prop.type === 'title') {
        const text = prop.title.map((t: any) => t.plain_text).join('');
        if (text.trim()) {
          parts.push(text);
        }
      }

      // Rich text プロパティ
      if (prop.type === 'rich_text') {
        const text = prop.rich_text.map((t: any) => t.plain_text).join('');
        if (text.trim()) {
          parts.push(text);
        }
      }

      // URL プロパティ
      if (prop.type === 'url' && typeof prop.url === 'string') {
        if (prop.url.trim()) {
          parts.push(prop.url);
        }
      }

      // Select プロパティ
      if (prop.type === 'select' && prop.select?.name) {
        if (prop.select.name.trim()) {
          parts.push(prop.select.name);
        }
      }

      // Multi-select プロパティ
      if (prop.type === 'multi_select' && Array.isArray(prop.multi_select)) {
        const names = prop.multi_select.map((s: any) => s.name).join(' ');
        if (names.trim()) {
          parts.push(names);
        }
      }
    }

    return parts
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join('\n');
  }

  /**
   * Notion ページ1件を SearchResult 型に変換する関数
   *
   * @param page Notion の PageObjectResponse
   * @param config このページが属するデータベースの設定情報
   * @returns SearchResult 型のオブジェクト
   */
  private mapNotionPageToSearchResult(
    page: PageObjectResponse,
    config: DatabaseConfig
  ): SearchResult {
    const title = this.extractTitleFromPage(page);
    const content = this.buildPageContent(page);

    // NotionのページURLは page.url に入っているはずなので、それを使います。
    const url = 'url' in page ? page.url : undefined;

    return {
      source: 'notion',
      databaseId: config.databaseId,
      pageId: page.id,
      title,
      content,
      url,
      databaseName: config.databaseName,
      usageHint: config.usageHint,
    };
  }
}

// シングルトンインスタンスをエクスポート
export const notionRagService = new NotionRagService();
