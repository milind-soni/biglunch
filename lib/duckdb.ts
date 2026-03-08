import { Database } from "duckdb-async";
import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.create(":memory:");
    await setupS3(db);
    await loadParquetData(db);
  }
  return db;
}

async function setupS3(database: Database) {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION;

  if (!accessKey || !secretKey || !region) return;

  try {
    await database.exec("INSTALL httpfs; LOAD httpfs;");
    await database.exec(`SET s3_access_key_id='${accessKey}'`);
    await database.exec(`SET s3_secret_access_key='${secretKey}'`);
    await database.exec(`SET s3_region='${region}'`);
    console.log("DuckDB S3 httpfs configured");
  } catch (err) {
    console.error("Failed to configure DuckDB S3:", err);
  }
}

/** Reload Parquet data from data/ directory (call after a sync) */
export async function reloadParquetData(): Promise<void> {
  const database = await getDb();
  await loadParquetData(database);
}

async function loadParquetData(database: Database) {
  const s3Bucket = process.env.S3_BUCKET_NAME;

  if (s3Bucket) {
    await loadParquetFromS3(database, s3Bucket);
  } else {
    await loadParquetFromLocal(database);
  }
}

async function loadParquetFromS3(database: Database, bucket: string) {
  try {
    const s3 = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    // List all objects to discover provider/table structure
    const objects: string[] = [];
    let continuationToken: string | undefined;
    do {
      const resp = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        })
      );
      for (const obj of resp.Contents || []) {
        if (obj.Key?.endsWith(".parquet")) objects.push(obj.Key);
      }
      continuationToken = resp.NextContinuationToken;
    } while (continuationToken);

    if (objects.length === 0) {
      console.log("No parquet files found in S3");
      return;
    }

    // Group by provider/table: e.g. "shopify/orders/123.parquet" → shopify_orders
    const tableMap = new Map<string, string>();
    for (const key of objects) {
      const parts = key.split("/");
      if (parts.length >= 3) {
        const provider = parts[0];
        const table = parts[1];
        if (table.startsWith("_dlt_")) continue;
        const viewName = `${provider}_${table}`;
        tableMap.set(viewName, `s3://${bucket}/${provider}/${table}/*.parquet`);
      }
    }

    for (const [viewName, s3Path] of Array.from(tableMap.entries())) {
      try {
        await database.exec(`DROP VIEW IF EXISTS "${viewName}"`);
        await database.exec(
          `CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${s3Path}')`
        );
        console.log(`Loaded S3 parquet view: ${viewName}`);
      } catch (err) {
        console.error(`Failed to load S3 parquet for ${viewName}:`, err);
      }
    }
  } catch (err) {
    console.error("Failed to discover S3 parquet files:", err);
  }
}

async function loadParquetFromLocal(database: Database) {
  const dataDir = path.join(process.cwd(), "data");
  if (!existsSync(dataDir)) return;

  const datasets = readdirSync(dataDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dataset of datasets) {
    const datasetPath = path.join(dataDir, dataset.name);
    const tables = readdirSync(datasetPath, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const table of tables) {
      const tablePath = path.join(datasetPath, table.name);
      const parquetFiles = readdirSync(tablePath).filter((f) =>
        f.endsWith(".parquet")
      );
      if (parquetFiles.length === 0) continue;

      const viewName = `${dataset.name}_${table.name}`;
      const globPath = path.join(tablePath, "*.parquet");

      try {
        await database.exec(`DROP VIEW IF EXISTS "${viewName}"`);
        await database.exec(
          `CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${globPath}')`
        );
        console.log(`Loaded parquet view: ${viewName}`);
      } catch (err) {
        console.error(`Failed to load parquet for ${viewName}:`, err);
      }
    }
  }
}

function loadAnnotations(): Record<string, { description?: string; columns?: Record<string, string> }> {
  try {
    const filePath = path.join(process.cwd(), "data", "annotations.json");
    if (!existsSync(filePath)) return {};
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

export async function getSchemaContext(): Promise<string> {
  try {
    const tables = await queryDuckDB(
      `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name`
    );

    if (tables.length === 0) return "No tables available.";

    const annotations = loadAnnotations();
    const schemaLines: string[] = [];

    for (const table of tables) {
      const name = table.table_name as string;
      const type = table.table_type === "VIEW" ? "view" : "table";
      const tableAnnotation = annotations[name];

      const columns = await queryDuckDB(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'main' AND table_name = '${name}' ORDER BY ordinal_position`
      );

      const colStr = columns
        .map((c) => {
          const colName = c.column_name as string;
          const colDesc = tableAnnotation?.columns?.[colName];
          return colDesc
            ? `${colName} (${c.data_type}) — ${colDesc}`
            : `${colName} (${c.data_type})`;
        })
        .join(", ");

      const header = tableAnnotation?.description
        ? `**${name}** (${type}) — ${tableAnnotation.description}`
        : `**${name}** (${type})`;

      schemaLines.push(`${header}\nColumns: ${colStr}`);
    }

    return schemaLines.join("\n\n");
  } catch {
    return "Schema discovery failed.";
  }
}

export async function queryDuckDB(
  sql: string
): Promise<Record<string, unknown>[]> {
  const database = await getDb();
  const rows = await database.all(sql);
  // Convert BigInt values to numbers (DuckDB returns BigInt for COUNT, SUM, etc.)
  return rows.map((row) => {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      converted[key] = typeof value === "bigint" ? Number(value) : value;
    }
    return converted;
  });
}

