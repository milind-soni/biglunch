import { Nango } from "@nangohq/node";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

function getNango() {
  return new Nango({ secretKey: process.env.NANGO_SECRET_KEY! });
}

// List all connections for the current user
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await getNango().listConnections({
    tags: { end_user_id: session.user.id },
  });

  return NextResponse.json(connections);
}
