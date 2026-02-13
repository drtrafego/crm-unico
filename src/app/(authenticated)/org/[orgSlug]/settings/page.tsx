import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth-helper";
import { db } from "@/lib/db";
import { organizations, members } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getMembers } from "@/server/actions/members";
import { getSettings } from "@/server/actions/settings";
import { MembersList } from "./members-list";
import { SettingsClient } from "./settings-client";
import { IntegrationsCard } from "./integrations-card";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const session = await getAuthenticatedUser();
  const user = session;
  const { orgSlug } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug)
  });

  if (!org) {
    notFound();
  }

  // Get current user's role in this organization
  const currentMember = user?.id ? await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, org.id),
      eq(members.userId, user.id)
    )
  }) : null;

  const canEdit = currentMember?.role === 'admin' || currentMember?.role === 'owner';

  const allMembers = await getMembers(org.id);
  const settings = await getSettings(org.id);

  const webhookPayload = {
    name: "Nome do Cliente",
    email: "cliente@email.com",
    whatsapp: "11999999999",
    company: "Empresa LTDA",
    notes: "Interesse no plano premium...",
    campaignSource: "Instagram Ads",
    message: "Mensagem do cliente..."
  };

  // Construct webhook URL dynamically if possible, or use relative
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://seu-crm.com'}/api/webhooks/${orgSlug}`;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações - {org.name}</h1>
        <p className="text-slate-500 dark:text-slate-400">Gerencie as configurações da sua conta e preferências do CRM.</p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Perfil</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">Suas informações pessoais.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">Nome</Label>
              <Input id="name" defaultValue={user?.name || "Usuário Demo"} readOnly className="bg-slate-50 dark:bg-slate-800" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">Email</Label>
              <Input id="email" defaultValue={user?.email || "demo@bilderai.com"} readOnly className="bg-slate-50 dark:bg-slate-800" />
            </div>
          </CardContent>
          <CardFooter className="border-t p-4 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
            <Button variant="outline" disabled className="border-slate-200 dark:border-slate-700">Salvar Alterações</Button>
          </CardFooter>
        </Card>

        {/* Theme & View Mode Settings */}
        <SettingsClient orgId={org.id} orgSlug={orgSlug} initialViewMode={settings?.viewMode || 'kanban'} canEdit={canEdit} />

        {/* Members Section - Only admin/owner can manage */}
        <MembersList members={allMembers} orgId={org.id} canEdit={canEdit} />

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <CardTitle>Notificações</CardTitle>
            <CardDescription>Escolha como você quer ser notificado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Novos Leads</Label>
                <p className="text-sm text-slate-500">Receba um email quando um novo lead for criado.</p>
              </div>
              <div className="h-6 w-11 bg-indigo-600 rounded-full relative cursor-pointer">
                <div className="absolute right-1 top-1 h-4 w-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Resumo Semanal</Label>
                <p className="text-sm text-slate-500">Receba um resumo semanal das suas vendas.</p>
              </div>
              <div className="h-6 w-11 bg-slate-200 dark:bg-slate-700 rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 h-4 w-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integrations Section - Only admin/owner can see webhook */}
        {canEdit && <IntegrationsCard webhookUrl={webhookUrl} webhookPayload={webhookPayload} />}

      </div>
    </div>
  );
}
