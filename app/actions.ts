"use server";

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from 'zod/v3';
import { queryDuckDB } from "@/lib/duckdb";
import { Config, Result } from "@/lib/types";

const SCHEMA_DESCRIPTION = `You have access to a DuckDB database with the following tables:

**orders** - E-commerce order transactions
Columns: order_id (INTEGER), customer_name (VARCHAR), product (VARCHAR), category (VARCHAR - Electronics/Beauty/Footwear/Fitness), quantity (INTEGER), unit_price (DECIMAL), total (DECIMAL), channel (VARCHAR - Shopify/Amazon), region (VARCHAR - US-East/US-West/EU), order_date (DATE, range: 2026-01-05 to 2026-03-08)

**ad_spend** - Advertising campaign performance
Columns: campaign_id (INTEGER), platform (VARCHAR - Meta Ads/Google Ads/TikTok Ads), campaign_name (VARCHAR), spend (DECIMAL), impressions (INTEGER), clicks (INTEGER), conversions (INTEGER), date (DATE, monthly snapshots: Jan/Feb/Mar 2026)

**customers** - Customer profiles
Columns: customer_id (INTEGER), name (VARCHAR), email (VARCHAR), total_orders (INTEGER), total_spent (DECIMAL), first_order (DATE), last_order (DATE), source (VARCHAR - Meta Ads/Google Ads/TikTok Ads/Organic)

Today's date is 2026-03-08.`;

export const generateQuery = async (input: string) => {
  "use server";
  const result = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are a DuckDB SQL expert. Generate a SELECT query for the user's question.
${SCHEMA_DESCRIPTION}
- Only generate SELECT queries. Never generate INSERT, UPDATE, DELETE, DROP, etc.
- Use DuckDB SQL syntax (similar to PostgreSQL but with some differences).
- Always alias computed columns with readable names.
- Keep queries efficient and results concise (use LIMIT when appropriate).
- For time-based analysis, use date_trunc or extract functions.`,
    prompt: `Generate a DuckDB SQL query for: "${input}"`,
    schema: z.object({
      query: z.string().describe("The DuckDB SQL SELECT query"),
    }),
  });
  return result.object.query;
};

export const runGeneratedSQLQuery = async (query: string) => {
  "use server";
  if (
    !query.trim().toLowerCase().startsWith("select") ||
    query.trim().toLowerCase().includes("drop") ||
    query.trim().toLowerCase().includes("delete") ||
    query.trim().toLowerCase().includes("insert") ||
    query.trim().toLowerCase().includes("update") ||
    query.trim().toLowerCase().includes("alter") ||
    query.trim().toLowerCase().includes("truncate") ||
    query.trim().toLowerCase().includes("create") ||
    query.trim().toLowerCase().includes("grant") ||
    query.trim().toLowerCase().includes("revoke")
  ) {
    throw new Error("Only SELECT queries are allowed");
  }

  const rows = await queryDuckDB(query);
  return rows as Result[];
};

export const generateChartConfig = async (
  results: Result[],
  userQuery: string,
) => {
  "use server";
  const columns = results.length > 0 ? Object.keys(results[0]) : [];
  const sampleRows = results.slice(0, 5);

  const result = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You generate chart configurations based on SQL query results. Choose the best chart type to visualize the data.`,
    prompt: `Given the user's question: "${userQuery}"
And the query results with columns: ${JSON.stringify(columns)}
Sample data: ${JSON.stringify(sampleRows)}
Total rows: ${results.length}

Generate a chart configuration. Choose the most appropriate chart type:
- "bar" for comparisons between categories
- "line" for trends over time
- "area" for cumulative trends
- "pie" for proportions (only when <= 8 categories)

Rules:
- xKey should be the categorical/time column
- yKeys should be the numeric columns to plot
- If comparing multiple categories over time, set multipleLines=true and provide lineCategories`,
    schema: z.object({
      type: z.enum(["bar", "line", "area", "pie"]),
      xKey: z.string(),
      yKeys: z.array(z.string()),
      title: z.string(),
      description: z
        .string()
        .describe("Brief description of what the chart shows"),
      takeaway: z.string().describe("Key insight from the data"),
      legend: z.boolean(),
      multipleLines: z.boolean().optional(),
      lineCategories: z.array(z.string()).optional(),
      measurementColumn: z.string().optional(),
    }),
  });

  return result.object as Config;
};

export const explainQuery = async (query: string, userQuery: string) => {
  "use server";
  const result = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You explain SQL queries in simple terms. Break the query into logical sections and explain each part.`,
    prompt: `Explain this DuckDB SQL query that was generated to answer: "${userQuery}"
Query: ${query}`,
    schema: z.object({
      explanations: z.array(
        z.object({
          section: z.string().describe("The SQL section/clause"),
          explanation: z.string().describe("Plain English explanation"),
        }),
      ),
    }),
  });
  return result.object.explanations;
};
