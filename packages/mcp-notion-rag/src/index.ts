#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

/**
 * Notion RAG MCP Server
 *
 * このサーバーは、Notionと連携してRAG（Retrieval-Augmented Generation）を提供します。
 * 現在は最小実装版で、search_knowledgeツールのダミー実装のみ含まれています。
 */

// サーバーインスタンスの作成
const server = new Server(
  {
    name: "mcp-notion-rag",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 利用可能なツールの定義
const TOOLS: Tool[] = [
  {
    name: "search_knowledge",
    description:
      "Notionに保存された個人の知識ベースを検索します。質問に関連する情報を取得できます。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "検索クエリ（質問や探したいキーワード）",
        },
      },
      required: ["query"],
    },
  },
];

// ツール一覧のリクエストハンドラ
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// ツール呼び出しのリクエストハンドラ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "search_knowledge") {
    const query = args?.query as string;

    if (!query) {
      throw new Error("query パラメータは必須です");
    }

    // ダミーの応答を返す
    const dummyResponse = {
      query: query,
      message: "まだNotion連携は未実装です",
      status: "dummy",
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(dummyResponse, null, 2),
        },
      ],
    };
  }

  throw new Error(`未知のツール: ${name}`);
});

/**
 * サーバーの起動
 */
async function main() {
  console.error("Notion RAG MCP Server を起動しています...");
  console.error("バージョン: 1.0.0");
  console.error("利用可能なツール:", TOOLS.map((t) => t.name).join(", "));

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("サーバーが起動しました。接続を待機中...");
}

// エラーハンドリング付きで起動
main().catch((error) => {
  console.error("サーバー起動エラー:", error);
  process.exit(1);
});
