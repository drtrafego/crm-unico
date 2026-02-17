
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        env: {
            hasStackSecret: !!process.env.STACK_SECRET_SERVER_KEY,
            nodeEnv: process.env.NODE_ENV
        }
    });
}
