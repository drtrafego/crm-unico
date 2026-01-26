'use client';

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createLead } from "@/server/actions/leads";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
      {pending ? "Salvando..." : "Salvar Lead"}
    </Button>
  );
}

import { CRMActionOverrides } from "@/types/crm-actions";

export function NewLeadDialog({ orgId, overrides }: { orgId: string; overrides?: CRMActionOverrides }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Action override
  const createLeadAction = overrides?.createLead || createLead;

  async function handleSubmit(formData: FormData) {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await createLeadAction(formData, orgId);
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Adicionar Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-white">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Novo Lead</DialogTitle>
          <DialogDescription className="text-slate-500">
            Preencha as informações do lead abaixo. Ele será adicionado à coluna &quot;Novos Leads&quot;.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-slate-700">Nome</Label>
              <Input id="name" name="name" placeholder="Nome do cliente" required className="bg-white border-slate-200 focus-visible:ring-indigo-500" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="whatsapp" className="text-slate-700">Whatsapp (Principal)</Label>
              <Input id="whatsapp" name="whatsapp" placeholder="(11) 99999-9999" required className="bg-white border-slate-200 focus-visible:ring-indigo-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-slate-700">Email (Opcional)</Label>
              <Input id="email" name="email" type="email" placeholder="cliente@email.com" className="bg-white border-slate-200 focus-visible:ring-indigo-500" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company" className="text-slate-700">Empresa (Opcional)</Label>
              <Input id="company" name="company" placeholder="Nome da empresa" className="bg-white border-slate-200 focus-visible:ring-indigo-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="value" className="text-slate-700">Valor (R$)</Label>
              <Input id="value" name="value" type="number" step="0.01" placeholder="0,00" className="bg-white border-slate-200 focus-visible:ring-indigo-500" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes" className="text-slate-700">Obs</Label>
            <Textarea id="notes" name="notes" placeholder="Observações adicionais..." className="bg-white border-slate-200 focus-visible:ring-indigo-500 min-h-[100px]" />
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : "Salvar Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
