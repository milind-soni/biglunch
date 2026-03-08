import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod/v4";
import { getSchemaContext } from "@/lib/duckdb";

export async function GET() {
  try {
    const schema = await getSchemaContext();

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5"),
      schema: z.object({
        suggestions: z.array(
          z.object({
            desktop: z.string().describe("Full question (5-8 words)"),
            mobile: z.string().describe("Short label (2-3 words)"),
          })
        ),
      }),
      prompt: `You are an e-commerce data analyst. Given this database schema, generate exactly 6 interesting and diverse query suggestions that a business user would want to ask.

Schema:
${schema}

Rules:
- Cover different tables and analytical angles (revenue, trends, comparisons, top-N, performance)
- Questions should be natural language, not SQL
- Keep desktop labels concise (5-8 words)
- Keep mobile labels very short (2-3 words)
- Make them specific to the actual columns and data available`,
    });

    return Response.json(object.suggestions);
  } catch (error) {
    // Fall back to generic suggestions if AI call fails
    return Response.json([
      { desktop: "Top 5 products by revenue", mobile: "Top products" },
      { desktop: "Monthly revenue trend", mobile: "Revenue trend" },
      { desktop: "Revenue breakdown by channel", mobile: "By channel" },
      { desktop: "Best performing ad campaigns", mobile: "Best ads" },
      { desktop: "Top customers by lifetime value", mobile: "Top customers" },
      { desktop: "Ad spend vs conversions by platform", mobile: "Ad performance" },
    ]);
  }
}
