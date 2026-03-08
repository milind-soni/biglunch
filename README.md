# biglunch

AI-powered e-commerce analytics platform. Connect your data sources and chat with your data using natural language.

## What it does

Users connect e-commerce data sources (Shopify, Stripe, Meta Ads, Google Ads, etc.) and an AI agent lets them ask questions in natural language. The agent writes SQL, executes it against DuckDB, and returns insights with inline results.

## Current state: POC

The POC uses in-memory DuckDB with sample e-commerce data (orders, ad spend, customers) to demonstrate the core chat-with-data experience.

### Sample data

| Table | Rows | Description |
|-------|------|-------------|
| `orders` | 30 | E-commerce transactions (Jan-Mar 2026) with products, categories, channels (Shopify/Amazon), regions |
| `ad_spend` | 15 | Campaign performance across Meta Ads, Google Ads, TikTok Ads (monthly snapshots) |
| `customers` | 15 | Customer profiles with lifetime value, acquisition source, order history |

## Tech stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion
- **AI**: Vercel AI SDK v6, Anthropic Claude (claude-sonnet-4-20250514)
- **Database**: DuckDB (in-memory, ephemeral)
- **Streaming**: Server-sent events via `streamText` + `toUIMessageStreamResponse`
- **Tool calling**: AI generates SQL → executes against DuckDB → returns results → AI analyzes

## Architecture

```
User question
  → useChat (AI SDK v6, @ai-sdk/react)
  → POST /api/chat
  → streamText with execute_sql tool
  → Claude generates SQL
  → DuckDB executes query
  → Results streamed back
  → Claude provides analysis
  → UI renders tool calls + text inline
```

## Key files

```
app/
  page.tsx          — Chat UI with useChat, tool call rendering, markdown formatting
  api/chat/route.ts — Streaming chat endpoint with execute_sql tool
  layout.tsx        — Root layout with theme provider
lib/
  duckdb.ts         — DuckDB singleton, sample data seeding, BigInt conversion
```

## Running locally

```bash
cp .env.example .env.local  # Add your ANTHROPIC_API_KEY
npm install --legacy-peer-deps
npm run dev
```

## AI SDK v6 notes

Key differences from v3 that tripped us up:

- `inputSchema` instead of `parameters` in `tool()` definitions
- `import { z } from "zod/v4"` — required for proper JSON Schema conversion with zod 3.25.x
- `stopWhen: stepCountIs(5)` instead of `maxSteps: 5`
- `toUIMessageStreamResponse()` instead of `toDataStreamResponse()`
- `useChat` from `@ai-sdk/react` — uses `sendMessage()`, `status`, and `message.parts` instead of `handleSubmit`/`isLoading`/`message.content`
- DuckDB returns BigInt for aggregates — must convert to Number before JSON serialization

## Future: production architecture

- **Connectors**: [dlt (dlthub)](https://dlthub.com/) for data ingestion from Shopify, Stripe, ad platforms
- **Auth/OAuth**: [Nango](https://www.nango.dev/) for managing third-party credentials
- **Multi-tenant storage**: S3/Parquet per tenant, DuckDB queries on demand
- **Database**: Each tenant's data stored as Parquet files, queried ephemerally with DuckDB
- **Infra**: Vercel for frontend, serverless functions for API, S3 for data lake
