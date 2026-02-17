import { StackServerApp, StackClientApp } from "@stackframe/stack";

export const stackApp = new StackClientApp({
    projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID || "a40fb3c8-efc6-413b-b108-6f4918b528f3",
    publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || "pck_v491sr955v9vwtmc8kt7s4n4jrcsrwt896ms06b5ww4zr",
} as any);

export const stackServerApp = new StackServerApp({
    tokenStore: "nextjs-cookie",
});
