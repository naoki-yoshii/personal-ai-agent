# Personal AI Agent

> Notion 知識ベース × Web 検索 × LLM を統合した、マイクロサービス型 AI エージェント

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-v4%2Fv5-000000?logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-blue)](./LICENSE)

---

## Project Overview

個人のノウハウを蓄積した **Notion データベース** と **リアルタイム Web 検索**を組み合わせ、LLM が文脈に即した回答を生成する AI エージェントシステム。

**3 つのインターフェースから利用可能：**
- `CLI` — コマンドラインから直接質問
- `Web UI` — ブラウザベースのチャット画面
- `Voice` — VOICEVOX 連携による音声入出力（実験的）

### 解決している課題

| 課題 | アプローチ |
|------|-----------|
| LLM の知識が個人データを持っていない | Notion 知識ベースを検索してコンテキストに注入 |
| 情報が古い／ハルシネーション | Web 検索（Serper.dev）で最新情報をリアルタイム補完 |
| 単一障害点になりやすい | 機能ごとに独立したマイクロサービス構成 |

---

## Architecture

### System Diagram

#### 現在のアーキテクチャ（ローカル開発）

![Architecture Diagram](./docs/architecture.png)

> draw.io ソース: [docs/architecture.drawio](./docs/architecture.drawio)

#### サービスマップ

```
┌─────────────────────────────────────────────────────┐
│                   Application Layer                 │
│                                                     │
│  [CLI: agent]   [Web UI: agent-server]  [tts-bridge]│
│  npm run dev       :3100 (Express v5)    :3201      │
└────────────┬────────────┬───────────────────────────┘
             │ HTTP POST  │ 並列呼び出し
┌────────────┴────────────┴───────────────────────────┐
│                  MCP Service Layer                  │
│                                                     │
│    [mcp-notion-rag :3001]   [mcp-web-search :3002]  │
│     Notion Knowledge          Serper.dev (Google)   │
└────────────┬────────────────────────┬───────────────┘
             │                        │
             ▼                        ▼
        Notion API              Serper.dev API
             │                        │
             └───────────┬────────────┘
                         ▼
                     LLM API
                  (Answer Generation)
```

#### ポート構成

| サービス | ポート | 役割 |
|---------|-------|------|
| `mcp-notion-rag` | 3001 | Notion 知識ベース検索 API |
| `mcp-web-search` | 3002 | Web 検索 API (Serper.dev / Google) |
| `agent-server` | 3100 | エージェント HTTP API + Chat UI |
| `tts-bridge` | 3201 | 音声合成 API (VOICEVOX 連携) |
| VOICEVOX | 50021 | ローカル TTS エンジン（別途起動） |

### Request Flow

```
1. User が質問を入力（CLI / Web UI / Voice）
2. agent / agent-server が mcp-notion-rag と mcp-web-search を並列呼び出し
3. mcp-notion-rag  → Notion API からユーザーの知識データを検索・取得
4. mcp-web-search  → Serper.dev 経由で Google 検索結果を取得
5. 両検索結果を統合し、LLM API にコンテキストとして渡す
6. LLM が回答を生成し、ユーザーへ返却
   └── Voice の場合は VOICEVOX で音声合成して再生
```

---

## Tech Stack

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| 言語 | **TypeScript 5.x** | 全サービス（86.8%） |
| ランタイム | **Node.js 18+** | サーバー実行環境 |
| Web フレームワーク | **Express v4 / v5** | 各 MCP サービスの HTTP API |
| 知識ソース | **Notion API** (`@notionhq/client`) | ユーザー知識ベース |
| Web 検索 | **Serper.dev** (Google Search API) | リアルタイム情報取得 |
| LLM 統合 | HTTP-compatible LLM API | 回答生成（プロバイダー非依存） |
| TTS | **VOICEVOX** | ローカル音声合成（Windows） |
| モジュールシステム | ESM (`type: "module"`) | 主要サービスで採用 |
| ビルドツール | `tsc` / `tsx` | TypeScript コンパイル / 開発起動 |

---

## Design Philosophy

### 1. 関心の分離 — マイクロサービスによる疎結合

各機能（Notion 検索 / Web 検索 / TTS）を独立した Express サーバーとして実装。
1 サービスの障害や変更が、他サービスに波及しない構成にした。

```
理由: 「LLM プロバイダーを変えたい」「Notion をやめて他のDBにしたい」
      という変更が 1 サービスの修正で完結する
```

### 2. HTTP-first な内部通信

サービス間の通信を **HTTP REST** に統一。gRPC や独自プロトコルを使わないことで、
curl や Postman で各サービスを単独テスト・デバッグできる。

```
理由: ローカル開発の生産性 ＋ コンテナ化・クラウド移行時の変更コストを最小化
```

### 3. ヘルスチェックファーストの設計

全サービスが `/health` エンドポイントを標準実装。
`agent-server` 起動時は依存サービス（:3001, :3002）への接続確認を自動実行する。

```
理由: コンテナオーケストレーション（ECS / K8s）での liveness probe に直結
```

### 4. 環境変数による設定分離

APIキー・ポート番号・接続先URLをすべて `.env` で管理。
コードと設定を分離し、環境（dev / staging / prod）ごとの切り替えを容易にした。

```
理由: 12-factor app 準拠 ＋ Secret Manager や Parameter Store への移行が容易
```

---

## Infrastructure Considerations

### 現在の構成（ローカル開発）

```
[Local Machine]
  ├── mcp-notion-rag  (Node.js process :3001)
  ├── mcp-web-search  (Node.js process :3002)
  ├── agent-server    (Node.js process :3100)
  ├── tts-bridge      (Node.js process :3201)
  └── VOICEVOX        (external app :50021)
```

- プロセス管理: 各サービスを個別ターミナルで起動
- サービスディスカバリ: localhost + 固定ポート

### AWS 移行計画

```
[Internet]
     │
[ALB (Application Load Balancer)]
     │
[ECS Fargate]
  ├── agent-server container    (Task definition: CPU 256 / Memory 512)
  ├── mcp-notion-rag container  (Task definition: CPU 256 / Memory 512)
  └── mcp-web-search container  (Task definition: CPU 256 / Memory 256)
     │
     ├── S3          ← 静的アセット / 将来的な知識データのバックアップ
     ├── CloudWatch  ← ログ集約 / メトリクス / アラート
     ├── IAM         ← サービスロール / 最小権限
     └── Secrets Manager ← APIキー管理（現在の .env を移行）
```

#### 移行時の変更点

| 項目 | 現在 | AWS 移行後 |
|------|------|-----------|
| サービス起動 | 手動（ターミナル） | ECS Task / Auto Scaling |
| ポート解決 | localhost 固定 | ALB ルールベース or Service Connect |
| 設定管理 | `.env` ファイル | Secrets Manager |
| ログ | stdout | CloudWatch Logs |
| 監視 | なし | CloudWatch Metrics + Alarms |

> 各サービスがすでに `/health` エンドポイントを実装済みのため、
> ECS の **liveness / readiness probe** はコード変更なしで設定可能。

---

## Future Improvements

| 優先度 | 項目 | 現状 |
|-------|------|------|
| ★★★ | **ベクトル検索への移行** | 現在はキーワード部分一致検索。OpenAI Embeddings + ベクトル DB（pgvector 等）で精度向上 |
| ★★★ | **Docker コンテナ化** | 各サービスの `Dockerfile` + `docker-compose.yml` 作成 |
| ★★☆ | **AWS ECS デプロイ** | Fargate タスク定義 + ALB 構成 |
| ★★☆ | **音声入力（STT）追加** | Whisper API または Azure Speech で voice → text 変換 |
| ★☆☆ | **CI/CD パイプライン** | GitHub Actions での自動テスト・デプロイ |
| ★☆☆ | **モニタリング強化** | CloudWatch Dashboard + Slack アラート |

---

## Getting Started

### 前提条件

- Node.js 18 以上
- Notion API キー + データベース ID
- Serper.dev API キー（Google 検索用）
- HTTP 互換の LLM API エンドポイント
- VOICEVOX（音声機能を使う場合のみ）

### 起動手順

```bash
# 1. Notion RAG サービスを起動
cd mcp-notion-rag && cp .env.example .env  # .env にAPIキーを設定
npm install && npm run dev

# 2. Web 検索サービスを起動（別ターミナル）
cd mcp-web-search && cp .env.example .env
npm install && npm run dev

# 3. エージェントサーバーを起動（別ターミナル）
cd agent-server
npm install && npm run dev
# → http://localhost:3100 でチャット UI にアクセス

# 4. CLI で直接質問する場合
cd agent
npm install && npm run dev "最近のAI動向を教えて"
```

### 環境変数（主要）

| 変数名 | サービス | 説明 |
|-------|---------|------|
| `NOTION_API_KEY` | mcp-notion-rag | Notion Integration Token |
| `NOTION_CONFIG_DATABASE_ID` | mcp-notion-rag | 設定管理用 DB の ID |
| `SERPER_API_KEY` | mcp-web-search | Serper.dev の API キー |
| `LLM_API_URL` | agent / agent-server | LLM API エンドポイント |

---

## Directory Structure

```
personal-ai-agent/
├── agent/                  # CLI エージェント（TypeScript / ESM）
│   └── src/
│       ├── main.ts         # CLI エントリーポイント
│       └── agentCore.ts    # 並列検索 + LLM 統合ロジック
├── agent-server/           # HTTP API + Web チャット UI
│   └── src/
│       └── index.ts        # Express v5 サーバー
├── mcp-notion-rag/         # Notion 知識ベース検索サービス
│   └── src/
│       ├── routes/         # REST API ルーター
│       └── services/       # Notion API 統合ロジック
├── mcp-web-search/         # Web 検索サービス (Serper.dev)
│   └── src/
│       ├── routes/
│       └── services/
├── tts-bridge/             # 音声合成サービス（VOICEVOX / Windows）
│   └── src/
│       └── services/
│           ├── voicevox.ts      # VOICEVOX API クライアント
│           ├── audioPlayer.ts   # PowerShell 経由の音声再生
│           └── agentClient.ts   # agent-server クライアント
└── docs/                   # アーキテクチャ図・設計資料
    ├── architecture.drawio
    └── architecture.png
```

---

## Author

**Naoki Yoshii** — AI インフラエンジニア志望
GitHub: [@naoki-yoshii](https://github.com/naoki-yoshii)
