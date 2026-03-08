import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { reloadParquetData } from "@/lib/duckdb";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  const { connectionId, provider } = await req.json();

  if (!connectionId || !provider) {
    return NextResponse.json(
      { error: "connectionId and provider are required" },
      { status: 400 }
    );
  }

  const nangoSecretKey = process.env.NANGO_SECRET_KEY;
  if (!nangoSecretKey) {
    return NextResponse.json(
      { error: "NANGO_SECRET_KEY not configured" },
      { status: 500 }
    );
  }

  const pipelinesDir = path.join(process.cwd(), "pipelines");
  const dataDir = path.join(process.cwd(), "data");

  try {
    const { stdout, stderr } = await execAsync(
      `uv run python sync.py --provider "${provider}" --nango-secret-key "${nangoSecretKey}" --connection-id "${connectionId}" --data-dir "${dataDir}"`,
      { cwd: pipelinesDir, timeout: 120000 }
    );

    // Reload DuckDB views with new parquet data
    await reloadParquetData();

    return NextResponse.json({
      status: "success",
      output: stdout,
      warnings: stderr || undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        error: error.message,
        stderr: error.stderr,
      },
      { status: 500 }
    );
  }
}
