
import { stackServerApp } from "../../stack";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function DebugPage() {
    const user = await stackServerApp.getUser();
    const headersList = await headers();
    const host = headersList.get("host");

    return (
        <div className="p-8 font-mono text-sm max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">CRM Debug Console</h1>

            <div className="grid gap-6">
                <Section title="Server Status">
                    <div>Host: {host}</div>
                    <div>Node Env: {process.env.NODE_ENV}</div>
                    <div>Time: {new Date().toISOString()}</div>
                </Section>

                <Section title="Stack Auth Config">
                    <div>Secret Key Present: {!!process.env.STACK_SECRET_SERVER_KEY ? "YES" : "NO"}</div>
                    <div>Project ID: {process.env.NEXT_PUBLIC_STACK_PROJECT_ID}</div>
                    <div>Client Key: {process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY?.substring(0, 10)}...</div>
                </Section>

                <Section title="Session Status">
                    <div>User: {user ? `${user.id} (${user.primaryEmail})` : "NULL (Not Logged In)"}</div>
                </Section>

                <Section title="Middleware & Routing">
                    <p>If you see this page, the server is UP and Middleware excluded this route correctly.</p>
                </Section>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="border p-4 rounded bg-slate-100 dark:bg-slate-900">
            <h3 className="font-bold mb-2 text-blue-600">{title}</h3>
            <div className="space-y-1">{children}</div>
        </div>
    );
}
