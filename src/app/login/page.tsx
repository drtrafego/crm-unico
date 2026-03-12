import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { db } from "@/lib/db";
import { members, organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export default async function LoginPage() {
    const user = await getAuthenticatedUser();

    if (!user) {
        redirect("/handler/sign-in");
    }

    // Superadmin → painel de administração
    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    if (user.email && adminEmails.includes(user.email)) {
        redirect("/adm/dashboard");
    }

    // Cliente → primeira org vinculada
    const membership = await db.query.members.findFirst({
        where: eq(members.userId, user.id),
    });

    if (membership) {
        const org = await db.query.organizations.findFirst({
            where: eq(organizations.id, membership.organizationId),
        });
        if (org) {
            redirect(`/org/${org.slug}/kanban`);
        }
    }

    // Sem org ainda — volta para sign-in
    redirect("/handler/sign-in");
}
