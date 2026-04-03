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

    // LOG DIAGNOSTICO
    console.log(`[CRM MW] path=${pathname} params=${request.nextUrl.searchParams.toString().substring(0, 100)}`);
    console.log(`[CRM MW] cookies=${request.cookies.getAll().map(c => c.name).join(',')}`);

    // ── Injecao de tokens via URL (portal envia __st com tokens Stack Auth) ──
    const stParam = request.nextUrl.searchParams.get('__st');
    if (stParam) {
        try {
            const decoded = JSON.parse(Buffer.from(stParam, 'base64').toString());
            const cleanUrl = new URL(request.url);
            cleanUrl.searchParams.delete('__st');

            const response = NextResponse.redirect(cleanUrl);

            if (decoded.a) {
                response.cookies.set('stack-access', decoded.a, {
                    path: '/',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 30,
                });
            }
            if (decoded.rn && decoded.rv) {
                response.cookies.set(decoded.rn, decoded.rv, {
                    path: '/',
                    httpOnly: true,
                    secure: true,
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 30,
                });
            }

            console.log(`=== MIDDLEWARE CRM: tokens injetados via URL, redirecionando ===`);
            return response;
        } catch (e) {
            console.error("=== ERRO ao decodificar __st ===", e);
        }
    }

    try {
        console.log(`=== MIDDLEWARE CRM: ${pathname} ===`);
        const user = await stackServerApp.getUser({ tokenStore: request as any });

        if (!user && pathname !== '/') {
            return NextResponse.redirect(new URL("/handler/sign-in", request.url));
        }

        const response = NextResponse.next();

        response.headers.set(
            "Content-Security-Policy",
            "frame-ancestors 'self' https://cliente.casaldotrafego.com https://clientes.casaldotrafego.com"
        );

        return response;

    } catch (error) {
        console.error("=== ERRO NO MIDDLEWARE CRM ===");
        console.error(error);
        return NextResponse.redirect(new URL("/handler/sign-in", request.url));
    }
}

export const config = {
    matcher: ["/((?!api|handler|_next/static|_next/image|favicon.ico).*)"],
};
