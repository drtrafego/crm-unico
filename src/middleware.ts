import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "./stack";

export default StackHandler({ app: stackServerApp });

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
