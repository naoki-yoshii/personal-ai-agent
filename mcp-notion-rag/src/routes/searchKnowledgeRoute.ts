/**
 * MCP Notion RAG Server - API ルート定義
 *
 * このファイルでは、Notion RAG MCP サーバーの HTTP エンドポイントを定義しています。
 * Express Router を使用して、各エンドポイントのルーティングとリクエスト処理を実装しています。
 *
 * 【設計書との対応】
 * - docs/design_v1.txt の「4-2. MCP: Notion RAGサーバ」に対応しています
 * - 設計書の「提供する主な機能（エンドポイント例）」として記載された機能を HTTP API として実装
 *   - search_knowledge(query: string) -> [contexts...] ← POST /search_knowledge として実装
 *
 * 【現在の実装状況】
 * - ✅ GET /health - ヘルスチェック
 *   - サーバーが正常に動作しているかを確認するエンドポイント
 *
 * - ✅ POST /search_knowledge - Notion データベース検索（基本実装）
 *   - Notion データベース内の Name プロパティ（タイトル）に対して部分一致検索
 *   - 最大 5 件のページ情報を返す
 *   - 現在は簡易版の実装（タイトル検索のみ）
 *
 * 【今後の実装予定（本格的な RAG 機能への拡張）】
 *
 * 1. POST /sync_notion_data エンドポイントの追加
 *    - Notion データベースからデータを取得し、ベクトルDB に同期
 *    - 定期的または手動でデータ同期を実行できるようにする
 *
 * 2. GET /get_raw_page/:pageId エンドポイントの追加（必要に応じて）
 *    - 特定の Notion ページの詳細情報を取得
 *
 * 3. POST /search_knowledge の拡張
 *    - 現在のタイトル検索から、ベクトルDB を使った意味検索へアップグレード
 *    - ページ本文も含めた全文検索に対応
 *    - より高精度な検索結果を返せるようにする
 */

import { Router, Request, Response } from 'express';
import { notionRagService } from '../services/notionRagService';
import {
  SearchKnowledgeRequest,
  SearchKnowledgeResponse,
  HealthCheckResponse,
  ErrorResponse,
} from '../types/searchTypes';

const router = Router();

/**
 * GET /health
 *
 * ヘルスチェックエンドポイント
 */
router.get('/health', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    service: 'mcp-notion-rag',
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

/**
 * POST /search_knowledge
 *
 * Notion データベース内の知識を検索するエンドポイント
 *
 * このエンドポイントは、ユーザーが入力したクエリに基づいて、
 * Notion データベースから関連するページを検索して返します。
 *
 * 【設計書との対応】
 * - docs/design_v1.txt の「4-2. MCP: Notion RAGサーバ」で定義されている
 *   「search_knowledge(query: string) -> [contexts...]」機能を HTTP API として実装
 *
 * 【現在の実装（簡易版）】
 * - ✅ リクエストボディから query パラメータを受け取る
 * - ✅ query のバリデーション（空文字列や未指定の場合は 400 エラーを返す）
 * - ✅ notionRagService.searchKnowledge() を呼び出して Notion データベースを検索
 * - ✅ 検索結果を JSON 形式で返す
 * - ✅ エラーハンドリング（Notion API 呼び出し失敗時は 500 エラーを返す）
 *
 * 現在は Name プロパティ（タイトル）に対する部分一致検索を行っています。
 *
 * 【今後の実装予定（本格的な RAG 機能への拡張）】
 * notionRagService.searchKnowledge() 内で、以下の処理を実装予定です：
 *
 * 1. クエリの埋め込みベクトル化
 *    - OpenAI Embeddings API などを使用してクエリをベクトル化
 *
 * 2. ベクトルDB での意味検索
 *    - ChromaDB などのベクトルDB に対して類似度検索を実行
 *    - タイトルだけでなく、ページ本文も含めた全文検索に対応
 *
 * 3. 関連度の高い情報を取得
 *    - 意味的な関連度に基づいて、上位 N 件のドキュメントを取得
 *    - 各結果に関連度スコアを付与
 *
 * 4. LLM が利用しやすい形式で返す
 *    - ページタイトル、本文の抜粋、URL、スコアなどを含む構造化されたデータを返す
 *    - AIエージェントが正確な回答を生成できるように、十分なコンテキスト情報を提供
 *
 * @route POST /search_knowledge
 * @param {SearchKnowledgeRequest} req.body - { query: string }
 * @returns {SearchKnowledgeResponse} 検索結果（200 OK）
 * @returns {ErrorResponse} バリデーションエラー（400 Bad Request）
 * @returns {ErrorResponse} サーバーエラー（500 Internal Server Error）
 */
router.post('/search_knowledge', async (req: Request, res: Response) => {
  try {
    const { query } = req.body as SearchKnowledgeRequest;

    // バリデーション：query が無い場合は 400 を返す
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      const errorResponse: ErrorResponse = {
        error: 'ValidationError',
        message: 'query パラメータは必須です（空でない文字列）',
        timestamp: new Date().toISOString(),
      };
      return res.status(400).json(errorResponse);
    }

    // Notion RAG サービスを呼び出して検索を実行
    // 現在は Name プロパティ（タイトル）の部分一致検索を実行
    // 将来的には、ベクトルDB を使った意味検索に差し替える予定
    const result = await notionRagService.searchKnowledge(query.trim());

    // 結果をJSONで返す
    return res.status(200).json(result);
  } catch (error) {
    console.error('検索エラー:', error);

    const errorResponse: ErrorResponse = {
      error: 'InternalServerError',
      message: error instanceof Error ? error.message : '不明なエラーが発生しました',
      timestamp: new Date().toISOString(),
    };

    return res.status(500).json(errorResponse);
  }
});

export default router;
