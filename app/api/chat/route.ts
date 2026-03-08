import { streamText, tool, stepCountIs, convertToModelMessages, UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod/v4";
import { queryDuckDB, getSchemaContext } from "@/lib/duckdb";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const schema = await getSchemaContext();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are an AI data analyst for a business called "biglunch". You have access to a DuckDB database that you can query using SQL.

Available tables and views:

${schema}

Notes on data sources:
- Tables like "orders", "ad_spend", "customers" contain sample e-commerce data
- Views prefixed with a service name (e.g. "hubspot_contacts", "shopify_orders") contain real synced data from connected integrations
- Columns prefixed with "properties__" come from external APIs (e.g. HubSpot) — use them directly in queries
- Columns starting with "_dlt_" are internal metadata from the data pipeline — ignore them in analysis

Instructions:
1. When the user asks a data question, use the execute_sql tool to query the database
2. Write valid DuckDB SQL (similar to PostgreSQL)
3. Only write SELECT queries — never modify data
4. After getting results, provide clear insights and analysis
5. Be concise and actionable in your analysis
6. If you need multiple queries to answer a question, run them sequentially
7. Today's date is 2026-03-08
8. Always include a visualization suggestion with your query:
   - Use "bar" for comparing categories (top N, by category, etc.)
   - Use "line" for time series and trends (monthly, daily, etc.)
   - Use "pie" for part-of-whole breakdowns with fewer than 8 categories
   - Use "area" for cumulative or stacked time series
   - Omit visualization for single-row results or metadata queries
   - Set xKey to the category/time column, yKeys to the numeric measure column(s)
   - Keep the title short (3-6 words)

Always query the data — never make up numbers.`,
    messages: await convertToModelMessages(messages),
    tools: {
      execute_sql: tool({
        description:
          "Execute a SQL query against the DuckDB database. Only SELECT queries are allowed. Use this to answer any data questions.",
        inputSchema: z.object({
          sql: z.string().describe("The DuckDB SQL SELECT query to execute"),
          visualization: z.object({
            type: z.enum(["bar", "line", "area", "pie"]).describe("Chart type"),
            xKey: z.string().describe("Column for x-axis or category labels"),
            yKeys: z.array(z.string()).describe("Column(s) for numeric values"),
            title: z.string().describe("Short chart title (3-6 words)"),
          }).optional().describe("Suggested chart visualization. Include for queries that would benefit from a chart."),
        }),
        execute: async ({ sql, visualization }) => {
          const lower = sql.trim().toLowerCase();
          if (
            !lower.startsWith("select") &&
            !lower.startsWith("with")
          ) {
            return { success: false, error: "Only SELECT queries are allowed", rows: [], columns: [] };
          }

          try {
            const rows = await queryDuckDB(sql);
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            return {
              success: true,
              columns,
              rows: rows.slice(0, 100),
              total_rows: rows.length,
              visualization: visualization ?? null,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : "Query failed",
              rows: [],
              columns: [],
            };
          }
        },
      }),
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
