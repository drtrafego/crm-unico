import { redirect } from "next/navigation";

export default function DebugPage() {
    // SECURITY: Debug pages are disabled in production
    redirect("/");
}
