"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateCompanyName } from "@/server/actions/settings";

export function CompanyOnboarding({ hasCompanyName, orgId }: { hasCompanyName: boolean, orgId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only open if explicitly NOT has company name (meaning it's loaded and false)
    // But parent passes boolean.
    if (!hasCompanyName) {
      setOpen(true);
    }
  }, [hasCompanyName]);

  async function handleSubmit(formData: FormData) {
    const name = formData.get("companyName") as string;
    if (name) {
        await updateCompanyName(name, orgId);
        setOpen(false);
    }
  }

  // Prevent closing by clicking outside if it's mandatory
  return (
    <Dialog open={open} onOpenChange={(val) => !val && hasCompanyName && setOpen(false)}>
      <DialogContent onInteractOutside={(e) => {
          if (!hasCompanyName) e.preventDefault();
      }}>
        <DialogHeader>
          <DialogTitle>Bem-vindo ao seu CRM!</DialogTitle>
          <DialogDescription>
            Para começar, qual é o nome da sua empresa?
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input id="companyName" name="companyName" placeholder="Minha Agência" required />
            </div>
            <DialogFooter>
                <Button type="submit">Começar</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
