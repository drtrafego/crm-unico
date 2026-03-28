import { redirect } from "next/navigation";

export default function DebugAuthPage() {
    // SECURITY: Debug pages are disabled in production
    redirect("/");
}
