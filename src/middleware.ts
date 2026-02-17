import { stackServerApp } from "./stack";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    // Passa a requisição como tokenStore para que o Stack Auth possa ler os cookies
    const user = await stackServerApp.getUser({ tokenStore: request });

    if (!user) {
        return NextResponse.redirect(new URL("/handler/sign-in", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|handler|debug|_next/static|_next/image|favicon.ico).*)"],
};
