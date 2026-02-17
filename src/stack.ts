import { StackServerApp, StackClientApp } from "@stackframe/stack";

// Initialize Stack Client
export const stackApp = new StackClientApp({
    projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID || "a40fb3c8-efc6-413b-b108-6f4918b528f3",
    publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || "pck_v491sr955v9vwtmc8kt7s4n4jrcsrwt896ms06b5ww4zr",
} as any);

// Initialize Stack Server with Safety Check
let serverAppInstance;
try {
    serverAppInstance = new StackServerApp({
        tokenStore: "nextjs-cookie",
        cookieDomain: ".casaldotrafego.com", // Force shared cookie for all subdomains
    });
} catch (e) {
    console.error("CRITICAL: Failed to initialize StackServerApp. Check STACK_SECRET_SERVER_KEY.", e);
    // Fallback mock to prevent crash, will fail at runtime usage but allow boot
    serverAppInstance = {
        getUser: async () => null,
        urls: { signIn: '/handler/sign-in', signUp: '/handler/sign-up' }
    } as any;
}

export const stackServerApp = serverAppInstance;
