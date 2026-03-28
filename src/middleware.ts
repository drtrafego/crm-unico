import { stackServerApp } from "./stack";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const { pathname } = new URL(request.url);

    // Ignorar caminhos de sistema e auth
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/handler') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    try {
        console.log(`=== MIDDLEWARE CRM: ${pathname} ===`);
        const user = await stackServerApp.getUser({ tokenStore: request as any });

        if (!user && pathname !== '/') {
            // Se não estiver logado e tentar acessar algo que não seja a Home
            return NextResponse.redirect(new URL("/handler/sign-in", request.url));
        }

        const response = NextResponse.next();

        // Adicionar cabeçalhos de segurança (necessário para o iframe deles)
        response.headers.set(
            "Content-Security-Policy",
            "frame-ancestors 'self' https://cliente.casaldotrafego.com https://clientes.casaldotrafego.com"
        );

        return response;

    } catch (error) {
        console.error("=== ERRO NO MIDDLEWARE CRM ===");
        console.error(error);
        // SECURITY: Fail-closed — redireciona para login em caso de erro de auth
        return NextResponse.redirect(new URL("/handler/sign-in", request.url));
    }
}

export const config = {
    matcher: ["/((?!api|handler|_next/static|_next/image|favicon.ico).*)"],
};
