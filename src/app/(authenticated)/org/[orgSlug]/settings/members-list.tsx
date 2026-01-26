'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { addMember, removeMember, updateMemberRole } from "@/server/actions/members";
import { Trash2, UserPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  status?: "active" | "pending";
}

export function MembersList({ members, orgId }: { members: Member[], orgId: string }) {
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleAdd() {
    if (!newEmail) return;
    setIsLoading(true);
    try {
      await addMember(newEmail, orgId, newRole);
      setNewEmail("");
      setNewRole("viewer");
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Erro ao adicionar membro");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Tem certeza?")) return;
    await removeMember(memberId, orgId);
    router.refresh();
  }

  async function handleRoleChange(memberId: string, newRole: "admin" | "editor" | "viewer" | "owner") {
    try {
      await updateMemberRole(memberId, orgId, newRole);
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Erro ao atualizar permissão");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membros da Equipe</CardTitle>
        <CardDescription>Gerencie quem tem acesso a esta organização.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Member Form */}
        <div className="flex gap-2 items-end">
          <div className="grid gap-2 flex-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              placeholder="email@exemplo.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2 w-32">
            <Label htmlFor="role">Permissão</Label>
            <Select value={newRole} onValueChange={(v: "admin" | "viewer") => setNewRole(v)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Visualizador</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Convidar
          </Button>
        </div>

        {/* Members List */}
        <div className="space-y-4">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={member.image || ""} />
                  <AvatarFallback>{member.name?.[0] || member.email?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {member.name || "Sem nome"}
                    {member.status === 'pending' && <span className="ml-2 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Pendente</span>}
                  </p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={member.role}
                  onValueChange={(v: "admin" | "editor" | "viewer" | "owner") => handleRoleChange(member.id, v)}
                  disabled={member.role === 'owner'} // Prevent changing owner role directly here for safety/simplicity
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner" disabled>Dono</SelectItem>
                  </SelectContent>
                </Select>

                {member.role !== 'owner' && (
                  <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleRemove(member.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum membro encontrado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
