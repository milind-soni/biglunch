import { queryDuckDB } from "@/lib/duckdb";

export async function GET() {
  try {
    const tables = await queryDuckDB(
      `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name`
    );

    const result = [];

    for (const table of tables) {
      const name = table.table_name as string;
      const type = table.table_type === "VIEW" ? "view" : "table";

      const columns = await queryDuckDB(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'main' AND table_name = '${name}' ORDER BY ordinal_position`
      );

      const rowCountResult = await queryDuckDB(
        `SELECT COUNT(*) as count FROM "${name}"`
      );
      const rowCount = rowCountResult[0]?.count ?? 0;

      const sampleRows = await queryDuckDB(
        `SELECT * FROM "${name}" LIMIT 3`
      );

      result.push({
        name,
        type,
        rowCount,
        columns: columns.map((c) => ({
          name: c.column_name as string,
          type: c.data_type as string,
        })),
        sampleRows,
      });
    }

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to get schema" },
      { status: 500 }
    );
  }
}
