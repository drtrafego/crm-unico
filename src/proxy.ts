import { stackServerApp } from "./stack";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    try {
        console.log("=== PROXY CRM - INÍCIO ===");
        // ... (rest of logic)
        const user = await stackServerApp.getUser({ tokenStore: request });

        if (!user) {
            return NextResponse.redirect(new URL("/handler/sign-in", request.url));
        }

        return NextResponse.next();

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
