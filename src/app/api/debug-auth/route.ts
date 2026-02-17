import { stackServerApp } from "@/stack";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const logs: string[] = [];

    try {
        logs.push("=== DEBUG CRM - INÍCIO ===");
        logs.push(`URL: ${request.url}`);
        logs.push(`Headers: ${JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2)}`);

        logs.push("\n=== Testando stackServerApp.getUser ===");

        const user = await stackServerApp.getUser({ tokenStore: request });

        logs.push(`Resultado: ${user ? "Usuário encontrado" : "Nenhum usuário"}`);
        if (user) {
            logs.push(`User ID: ${user.id}`);
            logs.push(`User email: ${user.primaryEmail}`);
        }

        logs.push("\n=== SUCESSO ===");

        return NextResponse.json({
            success: true,
            user: user ? { id: user.id, email: user.primaryEmail } : null,
            logs
        }, { status: 200 });

    } catch (error) {
        logs.push("\n=== ERRO CAPTURADO ===");
        logs.push(`Tipo: ${typeof error}`);
        logs.push(`É Error?: ${error instanceof Error}`);
        logs.push(`Mensagem: ${error instanceof Error ? error.message : String(error)}`);
        logs.push(`Stack: ${error instanceof Error ? error.stack : "N/A"}`);

        // Tenta pegar mais detalhes
        if (error && typeof error === 'object') {
            logs.push(`Propriedades: ${Object.getOwnPropertyNames(error).join(', ')}`);
            try {
                logs.push(`Serializado: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);
            } catch (e) {
                logs.push("Não foi possível serializar");
            }
        }

        return NextResponse.json({
            success: false,
            error: {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                type: typeof error,
                properties: error && typeof error === 'object' ? Object.getOwnPropertyNames(error) : []
            },
            logs
        }, { status: 500 });
    }
}
