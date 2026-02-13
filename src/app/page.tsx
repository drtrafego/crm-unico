
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { db } from "@/lib/db";
import { members, organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function HomePage() {
  const session = await getAuthenticatedUser();

  if (session) {
    const userEmail = session.email;
    const userId = session.id;

    // Verificar se é Super Admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    if (userEmail && adminEmails.includes(userEmail)) {
      redirect("/adm/dashboard");
    }

    // Buscar a organização do usuário
    if (userId) {
      const userMember = await db.query.members.findFirst({
        where: eq(members.userId, userId)
      });

      if (userMember) {
        // Buscar o slug da organização
        const org = await db.query.organizations.findFirst({
          where: eq(organizations.id, userMember.organizationId)
        });

        if (org) {
          // Redirecionar diretamente para o kanban da organização
          redirect(`/org/${org.slug}/kanban`);
        }
      }
    }

    // Se não tem organização, mostrar página de "sem acesso"
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <div className="text-center space-y-6 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Bem-vindo!
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Sua conta ainda não está vinculada a nenhuma organização. Entre em contato com o administrador para receber um convite.
          </p>

          <Link
            href="/handler/sign-out"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-200 text-slate-900 hover:bg-slate-300 h-11 px-8 py-2 w-full"
          >
            Sair
          </Link>
        </div>
      </div>
    );
  }

  // Se não estiver logado, mostra uma landing page simples com botão de login
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          CRM - Gestão de Leads
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Gerencie seus leads e oportunidades com inteligência artificial.
        </p>

        <Link
          href="/handler/sign-in"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-indigo-600 text-white hover:bg-indigo-700 h-11 px-8 py-2 w-full shadow-lg"
        >
          Entrar
        </Link>
      </div>
    </div>
  );
}
