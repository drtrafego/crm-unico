import { StackMiddleware } from "@stackframe/stack";

export default StackMiddleware();

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
