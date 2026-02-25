"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOrganization, deleteOrganization } from "@/server/actions/admin-orgs";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";
import {
    getOrganizationMembers,
    addOrganizationMember,
    removeOrganizationMember,
    removeOrganizationInvitation
} from "@/server/actions/admin-orgs";
import { Trash2, UserPlus, Shield } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EditOrgDialogProps {
    organization: {
        id: string;
        name: string;
        slug: string;
        features?: { hasLaunchDashboard?: boolean } | null;
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface MemberType {
    id: string;
    role: string;
    createdAt: Date;
    user: { id: string; name: string | null; email: string | null; image: string | null; };
}

interface InvitationType {
    id: string;
    email: string;
    role: string;
    createdAt: Date;
}

export function EditOrgDialog({ organization, open, onOpenChange }: EditOrgDialogProps) {
    const [name, setName] = useState(organization.name);
    const [slug, setSlug] = useState(organization.slug);
    const [hasLaunchDashboard, setHasLaunchDashboard] = useState(
        organization.features?.hasLaunchDashboard || false
    );
    const [activeTab, setActiveTab] = useState<"general" | "features" | "members" | "danger">("general");
    const [isLoading, setIsLoading] = useState(false);

    // Members tab state
    const [newMemberEmail, setNewMemberEmail] = useState("");
    const [newMemberRole, setNewMemberRole] = useState("editor");
    const [membersList, setMembersList] = useState<MemberType[]>([]);
    const [invitationsList, setInvitationsList] = useState<InvitationType[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);

    const router = useRouter();

    const fetchMembers = async () => {
        setIsLoadingMembers(true);
        const res = await getOrganizationMembers(organization.id);
        if (res.success) {
            setMembersList(res.activeMembers || []);
            setInvitationsList(res.pendingInvitations || []);
        }
        setIsLoadingMembers(false);
    };

    const handleTabChange = (tab: "general" | "features" | "members" | "danger") => {
        setActiveTab(tab);
        if (tab === "members") {
            fetchMembers();
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        const res = await updateOrganization(organization.id, {
            name,
            slug,
            features: { hasLaunchDashboard },
        });
        setIsLoading(false);

        if (res.success) {
            alert("Organização atualizada com sucesso!");
            onOpenChange(false);
            router.refresh();
        } else {
            alert("Erro: " + res.error);
        }
    };

    const handleDelete = async () => {
        if (confirm(`Tem certeza que deseja excluir ${organization.name}? Esta ação é irreversível e apagará todos os leads e dados da empresa.`)) {
            setIsLoading(true);
            const res = await deleteOrganization(organization.id);
            setIsLoading(false);

            if (res.success) {
                alert("Organização excluída com sucesso.");
                onOpenChange(false);
                router.refresh();
            } else {
                alert("Erro: " + res.error);
            }
        }
    };

    const handleAddMember = async () => {
        if (!newMemberEmail) return;
        setIsLoading(true);
        const res = await addOrganizationMember(organization.id, newMemberEmail, newMemberRole);
        setIsLoading(false);
        if (res.success) {
            alert("Membro/Convite adicionado com sucesso.");
            setNewMemberEmail("");
            setNewMemberRole("editor");
            fetchMembers();
        } else {
            alert("Erro: " + res.error);
        }
    };

    const handleRemoveMember = async (id: string, type: 'member' | 'invitation') => {
        if (!confirm("Tem certeza que deseja remover este usuário?")) return;

        setIsLoading(true);
        const res = type === 'member'
            ? await removeOrganizationMember(id)
            : await removeOrganizationInvitation(id);
        setIsLoading(false);

        if (res.success) {
            alert("Removido com sucesso.");
            fetchMembers();
        } else {
            alert("Erro ao remover.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Configurações da Organização</DialogTitle>
                </DialogHeader>

                <div className="flex space-x-4 border-b pb-2 mb-4">
                    <button
                        onClick={() => handleTabChange("general")}
                        className={`text-sm font-medium ${activeTab === "general" ? "text-indigo-600 border-b-2 border-indigo-600 pb-1" : "text-slate-500"}`}
                    >
                        Geral
                    </button>
                    <button
                        onClick={() => handleTabChange("members")}
                        className={`text-sm font-medium ${activeTab === "members" ? "text-indigo-600 border-b-2 border-indigo-600 pb-1" : "text-slate-500"}`}
                    >
                        Membros
                    </button>
                    <button
                        onClick={() => handleTabChange("features")}
                        className={`text-sm font-medium ${activeTab === "features" ? "text-indigo-600 border-b-2 border-indigo-600 pb-1" : "text-slate-500"}`}
                    >
                        Módulos
                    </button>
                    <button
                        onClick={() => handleTabChange("danger")}
                        className={`text-sm font-medium ${activeTab === "danger" ? "text-red-600 border-b-2 border-red-600 pb-1" : "text-slate-500"}`}
                    >
                        Avançado
                    </button>
                </div>

                {activeTab === "general" && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug</Label>
                            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                        </div>
                    </div>
                )}

                {activeTab === "features" && (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between border dark:border-white/10 p-4 rounded-lg">
                            <div className="space-y-0.5">
                                <Label className="text-base dark:text-white/90">Módulo de Lançamentos</Label>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Habilita a aba lateral para o Dashboard de Leads de Lançamento.
                                </p>
                            </div>
                            <Switch
                                checked={hasLaunchDashboard}
                                onCheckedChange={setHasLaunchDashboard}
                                className="data-[state=unchecked]:bg-slate-200 dark:data-[state=unchecked]:bg-slate-700"
                            />
                        </div>
                    </div>
                )}

                {activeTab === "danger" && (
                    <div className="space-y-4 py-4 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-red-600 dark:text-red-400">Danger Zone</h4>
                        <p className="text-sm text-red-500 dark:text-red-400/80">
                            A exclusão removerá permanentemente todos os leads, colunas e configurações desta empresa.
                        </p>
                        <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
                            Excluir Organização
                        </Button>
                    </div>
                )}

                {activeTab === "members" && (
                    <div className="space-y-6 py-2">
                        <div className="flex gap-2 items-end">
                            <div className="space-y-2 flex-1">
                                <Label>Convidar Usuário (E-mail)</Label>
                                <Input
                                    placeholder="email@exemplo.com"
                                    value={newMemberEmail}
                                    onChange={(e) => setNewMemberEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2 w-[120px]">
                                <Label>Permissão</Label>
                                <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="editor">Editor</SelectItem>
                                        <SelectItem value="viewer">Leitor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleAddMember} disabled={isLoading || !newMemberEmail} className="mb-[2px]">
                                <UserPlus className="w-4 h-4" />
                            </Button>
                        </div>

                        {isLoadingMembers ? (
                            <div className="text-center py-4 text-sm text-slate-500">Carregando membros...</div>
                        ) : (
                            <div className="space-y-4">
                                {membersList.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                            <Shield className="w-4 h-4" /> Membros Ativos
                                        </h4>
                                        <div className="border dark:border-white/10 rounded-lg divide-y dark:divide-white/10">
                                            {membersList.map((m) => (
                                                <div key={m.id} className="flex items-center justify-between p-3 flex-wrap gap-2">
                                                    <div>
                                                        <p className="text-sm font-medium dark:text-white/90">{m.user.name || 'Sem Nome'}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{m.user.email}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-white/5 rounded font-medium text-slate-600 dark:text-slate-300">
                                                            {m.role}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                            onClick={() => handleRemoveMember(m.id, 'member')}
                                                            disabled={isLoading}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {invitationsList.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-slate-500">Convites Pendentes</h4>
                                        <div className="border border-dashed dark:border-white/10 rounded-lg divide-y dark:divide-white/10">
                                            {invitationsList.map((inv) => (
                                                <div key={inv.id} className="flex items-center justify-between p-3">
                                                    <div>
                                                        <p className="text-sm dark:text-white/80">{inv.email}</p>
                                                        <p className="text-xs text-slate-400">
                                                            Enviado {formatDistance(new Date(inv.createdAt), new Date(), { addSuffix: true, locale: ptBR })}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-slate-400">{inv.role}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                                                            onClick={() => handleRemoveMember(inv.id, 'invitation')}
                                                            disabled={isLoading}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {membersList.length === 0 && invitationsList.length === 0 && (
                                    <p className="text-sm text-center py-4 text-slate-500">Nenhum membro encontrado.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                    {(activeTab === "general" || activeTab === "features") && (
                        <Button onClick={handleSave} disabled={isLoading}>
                            {isLoading ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
