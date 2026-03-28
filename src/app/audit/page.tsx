import { redirect } from "next/navigation";

export default function AuditPage() {
    // SECURITY: Audit pages are disabled in production
    redirect("/");
}
