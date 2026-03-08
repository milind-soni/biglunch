import { Nango } from "@nangohq/node";
import { NextResponse } from "next/server";

const nango = new Nango({ secretKey: process.env.NANGO_SECRET_KEY! });

// List all connections for the current user
export async function GET() {
  const connections = await nango.listConnections({
    tags: { end_user_id: "demo-user" },
  });

  return NextResponse.json(connections);
}
