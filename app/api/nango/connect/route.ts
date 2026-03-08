import { Nango } from "@nangohq/node";
import { NextResponse } from "next/server";

const nango = new Nango({ secretKey: process.env.NANGO_SECRET_KEY! });

// Create a connect session token for the frontend
export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    const { data } = await nango.createConnectSession({
      tags: {
        end_user_id: userId || "demo-user",
        end_user_email: email || "demo@biglunch.com",
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
