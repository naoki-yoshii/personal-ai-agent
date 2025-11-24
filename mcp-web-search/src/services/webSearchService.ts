/**
 * Web Search Service
 *
 * Serper.dev を使ったWeb検索機能を提供するサービス
 */

import 'dotenv/config';
import axios from 'axios';

/**
 * Web検索結果を表す型
 */
export interface WebSearchResult {
  source: 'web';
  title: string;
  snippet: string;
  url: string;
}

/**
 * Web検索レスポンス型
 */
export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
}

/**
 * Serper.dev のレスポンス型（organic 配列の要素）
 */
interface SerperOrganicResult {
  title: string;
  link: string;
  snippet?: string;
}

/**
 * Serper.dev のレスポンス型
 */
interface SerperResponse {
  organic?: SerperOrganicResult[];
}

/**
 * Serper.dev を使ってWeb検索を実行する
 *
 * @param query 検索クエリ
 * @returns 検索結果
 */
export async function searchWeb(query: string): Promise<WebSearchResponse> {
  const apiKey = process.env.SERPER_API_KEY;
  const endpoint = process.env.SERPER_SEARCH_ENDPOINT ?? 'https://google.serper.dev/search';

  if (!apiKey) {
    throw new Error('SERPER_API_KEY が設定されていません。.env ファイルに SERPER_API_KEY を設定してください。');
  }

  const response = await axios.post<SerperResponse>(
    endpoint,
    { q: query },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
    }
  );

  const organic = response.data.organic ?? [];

  const results: WebSearchResult[] = organic.map((item) => ({
    source: 'web',
    title: item.title,
    snippet: item.snippet ?? '',
    url: item.link,
  }));

  return {
    query,
    results,
  };
}
