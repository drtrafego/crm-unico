import { stackServerApp } from "./stack";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const user = await stackServerApp.getUser();

    if (!user) {
        return NextResponse.redirect(new URL("/handler/sign-in", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
