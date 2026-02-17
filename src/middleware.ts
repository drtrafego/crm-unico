import { stackServerApp } from "./stack";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    try {
        console.log("=== MIDDLEWARE CRM - INÍCIO ===");
        console.log("URL:", request.url);
        console.log("Pathname:", request.nextUrl.pathname);
        console.log("Cookies disponíveis:", request.cookies.getAll().map(c => c.name));

        console.log("Chamando stackServerApp.getUser...");

        // Passa a requisição como tokenStore para que o Stack Auth possa ler os cookies
        const user = await stackServerApp.getUser({ tokenStore: request });

        console.log("Resultado do getUser:", user ? "Usuário encontrado" : "Nenhum usuário");
        if (user) {
            console.log("User ID:", user.id);
            console.log("User email:", user.primaryEmail);
        }

        if (!user) {
            console.log("Redirecionando para login...");
            return NextResponse.redirect(new URL("/handler/sign-in", request.url));
        }

        console.log("=== MIDDLEWARE CRM - SUCESSO ===");
        return NextResponse.next();

    } catch (error) {
        console.error("=== ERRO NO MIDDLEWARE CRM ===");
        console.error("Tipo do erro:", typeof error);
        console.error("Erro é objeto?:", error instanceof Object);
        console.error("Mensagem:", error instanceof Error ? error.message : String(error));
        console.error("Stack:", error instanceof Error ? error.stack : "N/A");
        console.error("Erro completo:", error);
        console.error("Propriedades do erro:", Object.getOwnPropertyNames(error));

        // Tenta serializar o erro
        try {
            console.error("Erro serializado:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        } catch (e) {
            console.error("Não foi possível serializar o erro");
        }

        // Re-throw para que o error boundary capture
        throw error;
    }
}

export const config = {
    matcher: ["/((?!api|handler|debug|_next/static|_next/image|favicon.ico).*)"],
};
