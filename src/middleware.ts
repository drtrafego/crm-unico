import { StackHandler } from "@stackframe/stack";

export default StackHandler();

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
