import { StackServerApp, StackClientApp } from "@stackframe/stack";

export const stackApp = new StackClientApp({
    projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID!,
    publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY!,
} as any);

export const stackServerApp = new StackServerApp({
    tokenStore: "nextjs-cookie",
});
