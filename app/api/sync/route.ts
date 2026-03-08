import { NextResponse } from "next/server";
import { reloadParquetData } from "@/lib/duckdb";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { connectionId, provider } = await req.json();

  if (!connectionId || !provider) {
    return NextResponse.json(
      { error: "connectionId and provider are required" },
      { status: 400 }
    );
  }

  const nangoSecretKey = process.env.NANGO_SECRET_KEY;
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;

  if (!nangoSecretKey || !workerUrl || !workerSecret) {
    return NextResponse.json(
      { error: "Missing server configuration" },
      { status: 500 }
    );
  }

  try {
    const resp = await fetch(`${workerUrl}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
      },
      body: JSON.stringify({
        provider,
        connection_id: connectionId,
        nango_secret_key: nangoSecretKey,
      }),
    });

    if (!resp.ok) {
      const error = await resp.text();
      return NextResponse.json(
        { status: "error", error },
        { status: resp.status }
      );
    }

    const result = await resp.json();

    // Reload DuckDB views with new parquet data from S3
    await reloadParquetData();

    return NextResponse.json({ status: "success", ...result });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", error: error.message },
      { status: 500 }
    );
  }
}
