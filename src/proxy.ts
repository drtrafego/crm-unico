import { stackServerApp } from "./stack";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    try {
        console.log("=== PROXY CRM - INÍCIO ===");
        // ... (rest of logic)
        const user = await stackServerApp.getUser({ tokenStore: request });

        let response: NextResponse;
        if (!user) {
            response = NextResponse.redirect(new URL("/handler/sign-in", request.url));
        } else {
            response = NextResponse.next();
        }

        // Add Security Headers
        response.headers.set(
            "Content-Security-Policy",
            "frame-ancestors 'self' https://cliente.casaldotrafego.com https://clientes.casaldotrafego.com"
        );

        // CORS for Webhooks
        if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
            response.headers.set("Access-Control-Allow-Credentials", "true");
            response.headers.set("Access-Control-Allow-Origin", "*");
            response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.headers.set("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Origin");
        }

        return response;

    } catch (error) {
        console.error("=== ERRO NO PROXY CRM ===");
        console.error(error);

        // Retorna next() em vez de travar o deploy
        return NextResponse.next();
    }
}

export const config = {
    matcher: ["/((?!api|handler|debug|audit|_next/static|_next/image|favicon.ico).*)"],
};
