import { NextResponse } from "next/server";

// Endpoint de manutenção desativado em produção por segurança
export async function GET() {
    return NextResponse.json({ error: "Endpoint disabled" }, { status: 404 });
}
