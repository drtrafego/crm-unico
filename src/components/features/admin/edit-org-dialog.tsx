"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    updateOrganization,
    deleteOrganization,
    getOrganizationMembers,
    addOrganizationMember,
    removeOrganizationMember,
    removeOrganizationInvitation,
    updateMemberRole,
} from "@/server/actions/admin-orgs";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, Shield, Settings, Users, Zap, AlertTriangle, Rocket, Save, X } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatDistance } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

type TabType = "general" | "features" | "members" | "danger";

export function EditOrgDialog({ organization, open, onOpenChange }: EditOrgDialogProps) {
    const [name, setName] = useState(organization.name);
    const [slug, setSlug] = useState(organization.slug);
    const [hasLaunchDashboard, setHasLaunchDashboard] = useState(
        organization.features?.hasLaunchDashboard || false
    );
    const [activeTab, setActiveTab] = useState<TabType>("general");
    const [isLoading, setIsLoading] = useState(false);

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

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        if (tab === "members") fetchMembers();
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

    const handleUpdateRole = async (memberId: string, newRole: string) => {
        const res = await updateMemberRole(memberId, newRole);
        if (res.success) {
            setMembersList(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
        } else {
            alert("Erro ao atualizar permissão: " + res.error);
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

    const handleRemoveMember = async (id: string, type: "member" | "invitation") => {
        if (!confirm("Tem certeza que deseja remover este usuário?")) return;
        setIsLoading(true);
        const res = type === "member"
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

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: "general", label: "Geral", icon: <Settings className="w-3.5 h-3.5" /> },
        { id: "members", label: "Membros", icon: <Users className="w-3.5 h-3.5" /> },
        { id: "features", label: "Módulos", icon: <Zap className="w-3.5 h-3.5" /> },
        { id: "danger", label: "Avançado", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px] p-0 border-0 overflow-hidden bg-slate-900 text-white shadow-2xl rounded-2xl">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-white/5">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-white">
                            Configurações da Organização
                        </DialogTitle>
                        <p className="text-sm text-slate-400 mt-0.5">{organization.name}</p>
                    </DialogHeader>
                </div>

                {/* Tab Navigation */}
                <div className="flex px-4 gap-1 border-b border-white/5 bg-slate-900/80">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-3 text-xs font-semibold transition-all duration-200 border-b-2 -mb-px",
                                activeTab === tab.id
                                    ? tab.id === "danger"
                                        ? "border-red-500 text-red-400"
                                        : "border-indigo-500 text-indigo-400"
                                    : "border-transparent text-slate-500 hover:text-slate-300"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="px-6 py-5 min-h-[200px]">

                    {/* GERAL TAB */}
                    {activeTab === "general" && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome da Empresa</Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-xl"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Slug (URL de acesso)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">/org/</span>
                                    <Input
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-xl pl-12"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MEMBROS TAB */}
                    {activeTab === "members" && (
                        <div className="space-y-5">
                            <div className="flex gap-2 items-end">
                                <div className="space-y-1.5 flex-1">
                                    <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Convidar por E-mail</Label>
                                    <Input
                                        placeholder="email@exemplo.com"
                                        value={newMemberEmail}
                                        onChange={(e) => setNewMemberEmail(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-1.5 w-[115px]">
                                    <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Permissão</Label>
                                    <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                                        <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-white/10 text-white">
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="editor">Editor</SelectItem>
                                            <SelectItem value="viewer">Leitor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    onClick={handleAddMember}
                                    disabled={isLoading || !newMemberEmail}
                                    size="icon"
                                    className="shrink-0 bg-indigo-600 hover:bg-indigo-500 rounded-xl"
                                >
                                    <UserPlus className="w-4 h-4" />
                                </Button>
                            </div>

                            {isLoadingMembers ? (
                                <div className="text-center py-8 text-sm text-slate-500">Carregando...</div>
                            ) : (
                                <div className="space-y-4 max-h-[240px] overflow-y-auto pr-1">
                                    {membersList.length > 0 && (
                                        <div className="space-y-1.5">
                                            <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                                <Shield className="w-3.5 h-3.5 text-indigo-400" /> Membros Ativos
                                            </h4>
                                            <div className="rounded-xl overflow-hidden divide-y divide-white/5 border border-white/8">
                                                {membersList.map((m) => (
                                                    <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors">
                                                        <div>
                                                            <p className="text-sm font-medium text-white">{m.user.name || "Sem Nome"}</p>
                                                            <p className="text-xs text-slate-500">{m.user.email}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Select
                                                                value={m.role}
                                                                onValueChange={(val) => handleUpdateRole(m.id, val)}
                                                            >
                                                                <SelectTrigger className="h-7 px-2 text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg w-[90px]">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-slate-800 border-white/10 text-white text-xs">
                                                                    <SelectItem value="admin">Admin</SelectItem>
                                                                    <SelectItem value="editor">Editor</SelectItem>
                                                                    <SelectItem value="viewer">Leitor</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <button
                                                                title="Remover membro"
                                                                className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                                                                onClick={() => handleRemoveMember(m.id, "member")}
                                                                disabled={isLoading}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {invitationsList.length > 0 && (
                                        <div className="space-y-1.5">
                                            <h4 className="text-xs font-semibold text-slate-500">Convites Pendentes</h4>
                                            <div className="rounded-xl overflow-hidden divide-y divide-white/5 border border-dashed border-white/8">
                                                {invitationsList.map((inv) => (
                                                    <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                                                        <div>
                                                            <p className="text-sm text-slate-300">{inv.email}</p>
                                                            <p className="text-xs text-slate-600">
                                                                Enviado {formatDistance(new Date(inv.createdAt), new Date(), { addSuffix: true, locale: ptBR })}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-600">{inv.role}</span>
                                                            <button
                                                                title="Cancelar convite"
                                                                className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                                                                onClick={() => handleRemoveMember(inv.id, "invitation")}
                                                                disabled={isLoading}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {membersList.length === 0 && invitationsList.length === 0 && (
                                        <div className="text-center py-8">
                                            <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                                            <p className="text-sm text-slate-500">Nenhum membro cadastrado.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* MÓDULOS TAB */}
                    {activeTab === "features" && (
                        <div className="space-y-3">
                            {/* Custom Toggle Card for Launch Dashboard */}
                            <button
                                onClick={() => setHasLaunchDashboard(!hasLaunchDashboard)}
                                className={cn(
                                    "w-full text-left flex items-center justify-between p-4 rounded-xl border transition-all duration-200",
                                    hasLaunchDashboard
                                        ? "bg-indigo-500/10 border-indigo-500/30"
                                        : "bg-white/3 border-white/8 hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        hasLaunchDashboard ? "bg-indigo-500/20" : "bg-white/5"
                                    )}>
                                        <Rocket className={cn("w-4 h-4", hasLaunchDashboard ? "text-indigo-400" : "text-slate-500")} />
                                    </div>
                                    <div>
                                        <p className={cn("text-sm font-semibold", hasLaunchDashboard ? "text-indigo-300" : "text-slate-300")}>
                                            Módulo de Lançamentos
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Dashboard exclusivo de leads do lançamento
                                        </p>
                                    </div>
                                </div>
                                {/* Custom visual toggle */}
                                <div className={cn(
                                    "relative w-11 h-6 rounded-full transition-colors duration-300 shrink-0",
                                    hasLaunchDashboard ? "bg-indigo-600" : "bg-slate-700"
                                )}>
                                    <div className={cn(
                                        "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300",
                                        hasLaunchDashboard ? "translate-x-5" : "translate-x-0.5"
                                    )} />
                                </div>
                            </button>
                        </div>
                    )}

                    {/* AVANÇADO TAB */}
                    {activeTab === "danger" && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                                <div className="flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-red-400 text-sm">Excluir Organização</h4>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            Esta ação é <strong className="text-slate-400">permanente e irreversível</strong>. Todos os leads, colunas, membros e configurações desta empresa serão excluídos.
                                        </p>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleDelete}
                                            disabled={isLoading}
                                            className="mt-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs"
                                        >
                                            {isLoading ? "Excluindo..." : "Confirmar Exclusão"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/5 bg-slate-900/60">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="text-slate-400 hover:text-white hover:bg-white/10 rounded-xl gap-1.5"
                    >
                        <X className="w-3.5 h-3.5" /> Fechar
                    </Button>
                    {(activeTab === "general" || activeTab === "features") && (
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isLoading}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl gap-1.5"
                        >
                            <Save className="w-3.5 h-3.5" />
                            {isLoading ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
