import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { db } from "@/lib/db";
import { members, organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { isSuperAdmin } from "@/lib/super-admin";

export default async function LoginPage() {
    const user = await getAuthenticatedUser();

    if (!user) {
        redirect("/handler/sign-in");
    }

    // Superadmin → painel de administração
    if (isSuperAdmin(user.email)) {
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

    // Sem org: redireciona para / (mostra mensagem "sem organizacao")
    redirect("/");
}
