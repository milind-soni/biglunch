import { Nango } from "@nangohq/node";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

function getNango() {
  return new Nango({ secretKey: process.env.NANGO_SECRET_KEY! });
}

// Create a connect session token for the frontend
export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await getNango().createConnectSession({
      tags: {
        end_user_id: session.user.id,
        end_user_email: session.user.email,
      },
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Nango connect session error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create connect session" },
      { status: 500 }
    );
  }
}
