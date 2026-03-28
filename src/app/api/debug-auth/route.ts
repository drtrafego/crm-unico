import { NextResponse } from "next/server";

// Debug endpoint desativado em produção por segurança
export async function GET() {
    return NextResponse.json({ error: "Endpoint disabled" }, { status: 404 });
}
