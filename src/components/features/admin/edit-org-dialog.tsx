"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateOrganization, deleteOrganization } from "@/server/actions/admin-orgs";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";

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

export function EditOrgDialog({ organization, open, onOpenChange }: EditOrgDialogProps) {
    const [name, setName] = useState(organization.name);
    const [slug, setSlug] = useState(organization.slug);
    const [hasLaunchDashboard, setHasLaunchDashboard] = useState(
        organization.features?.hasLaunchDashboard || false
    );
    const [activeTab, setActiveTab] = useState<"general" | "features" | "danger">("general");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Configurações da Organização</DialogTitle>
                </DialogHeader>

                <div className="flex space-x-4 border-b pb-2 mb-4">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`text-sm font-medium ${activeTab === "general" ? "text-indigo-600 border-b-2 border-indigo-600 pb-1" : "text-slate-500"}`}
                    >
                        Geral
                    </button>
                    <button
                        onClick={() => setActiveTab("features")}
                        className={`text-sm font-medium ${activeTab === "features" ? "text-indigo-600 border-b-2 border-indigo-600 pb-1" : "text-slate-500"}`}
                    >
                        Módulos
                    </button>
                    <button
                        onClick={() => setActiveTab("danger")}
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
                        <div className="flex items-center justify-between border p-4 rounded-lg">
                            <div className="space-y-0.5">
                                <Label className="text-base">Módulo de Lançamentos</Label>
                                <p className="text-sm text-slate-500">
                                    Habilita a aba lateral para o Dashboard de Leads de Lançamento.
                                </p>
                            </div>
                            <Switch
                                checked={hasLaunchDashboard}
                                onCheckedChange={setHasLaunchDashboard}
                            />
                        </div>
                    </div>
                )}

                {activeTab === "danger" && (
                    <div className="space-y-4 py-4 border border-red-200 bg-red-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-red-600">Danger Zone</h4>
                        <p className="text-sm text-red-500">
                            A exclusão removerá permanentemente todos os leads, colunas e configurações desta empresa.
                        </p>
                        <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
                            Excluir Organização
                        </Button>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    {activeTab !== "danger" && (
                        <Button onClick={handleSave} disabled={isLoading}>
                            {isLoading ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
