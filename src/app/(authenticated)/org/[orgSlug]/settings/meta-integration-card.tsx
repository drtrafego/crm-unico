"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Check, Copy, Loader2, Trash2, AlertCircle, CheckCircle2, Phone, Cloud, Save } from "lucide-react";
import { saveAdAccount, saveWhatsApp, saveInstagram, removeMetaIntegration } from "@/server/actions/meta-integrations";
import { useRouter } from "next/navigation";
import type { MetaIntegration } from "@/server/db/schema";
import { cn } from "@/lib/utils";

interface MetaIntegrationCardProps {
  orgId: string;
  orgSlug: string;
  metaWebhookUrl: string;
  existing: MetaIntegration | null;
}

function SectionStatus({ connected, label }: { connected: boolean; label?: string }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="h-3 w-3" /> {label || "Conectado"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">
      Não configurado
    </span>
  );
}

export function MetaIntegrationCard({ orgId, orgSlug, metaWebhookUrl, existing }: MetaIntegrationCardProps) {
  const router = useRouter();
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Ad Account state
  const [adAccountId, setAdAccountId] = useState(existing?.adAccountId?.replace("act_", "") || "");
  const [adLoading, setAdLoading] = useState(false);
  const [adSuccess, setAdSuccess] = useState(false);

  // WhatsApp state
  const [whatsappType, setWhatsappType] = useState<'waba' | 'business_number'>(
    (existing?.whatsappType as 'waba' | 'business_number') || 'waba'
  );
  const [wabaId, setWabaId] = useState(existing?.wabaId || "");
  const [phoneNumberId, setPhoneNumberId] = useState(existing?.phoneNumberId || "");
  const [whatsappNumber, setWhatsappNumber] = useState(existing?.whatsappNumber || "");
  const [waLoading, setWaLoading] = useState(false);
  const [waSuccess, setWaSuccess] = useState(false);

  // Instagram state
  const [igUsername, setIgUsername] = useState(existing?.igUsername || "");
  const [igLoading, setIgLoading] = useState(false);
  const [igSuccess, setIgSuccess] = useState(false);

  // Disconnect
  const [disconnecting, setDisconnecting] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(metaWebhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSaveAd = async () => {
    setAdLoading(true);
    setAdSuccess(false);
    try {
      await saveAdAccount(orgId, orgSlug, adAccountId.trim());
      setAdSuccess(true);
      setTimeout(() => setAdSuccess(false), 3000);
      router.refresh();
    } catch { /* toast or ignore */ }
    finally { setAdLoading(false); }
  };

  const handleSaveWhatsApp = async () => {
    setWaLoading(true);
    setWaSuccess(false);
    try {
      if (whatsappType === 'waba') {
        await saveWhatsApp(orgId, orgSlug, 'waba', {
          wabaId: wabaId.trim() || undefined,
          phoneNumberId: phoneNumberId.trim() || undefined,
        });
      } else {
        await saveWhatsApp(orgId, orgSlug, 'business_number', {
          whatsappNumber: whatsappNumber.trim() || undefined,
        });
      }
      setWaSuccess(true);
      setTimeout(() => setWaSuccess(false), 3000);
      router.refresh();
    } catch { /* toast or ignore */ }
    finally { setWaLoading(false); }
  };

  const handleSaveInstagram = async () => {
    setIgLoading(true);
    setIgSuccess(false);
    try {
      await saveInstagram(orgId, orgSlug, {
        igUsername: igUsername.trim() || undefined,
      });
      setIgSuccess(true);
      setTimeout(() => setIgSuccess(false), 3000);
      router.refresh();
    } catch { /* toast or ignore */ }
    finally { setIgLoading(false); }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await removeMetaIntegration(orgId, orgSlug);
      setAdAccountId("");
      setWabaId("");
      setPhoneNumberId("");
      setWhatsappNumber("");
      setIgUsername("");
      router.refresh();
    } finally { setDisconnecting(false); }
  };

  const hasAnyConnection = !!(existing?.adAccountId || existing?.wabaId || existing?.phoneNumberId || existing?.whatsappNumber || existing?.igAccountId || existing?.igUsername);

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5">
              <path d="M6.915 4.03c-1.968 0-3.286 1.17-4.286 3.066C1.515 8.586.8 10.57.8 12.07c0 2.026 1.128 3.97 3.205 3.97 1.208 0 2.134-.678 3.028-1.873.654-.873 1.263-1.965 1.783-2.947l.367-.694c.862-1.63 1.857-3.46 3.206-4.742C13.502 4.7 14.74 4.03 16.18 4.03c2.084 0 3.628 1.08 4.636 2.746C21.78 8.36 22.2 10.26 22.2 12.07c0 1.89-.46 3.74-1.444 5.18-.97 1.42-2.492 2.52-4.576 2.52-1.428 0-2.574-.507-3.544-1.294l-1.2 1.984c1.28.95 2.83 1.51 4.744 1.51 2.834 0 4.98-1.47 6.227-3.3 1.228-1.81 1.793-4.1 1.793-6.6 0-2.23-.507-4.53-1.683-6.41C21.345 3.87 19.264 2.03 16.18 2.03c-2.01 0-3.57.84-4.803 2.07-1.076 1.074-1.925 2.47-2.678 3.88l-.366.694c-.56 1.06-1.1 2.04-1.678 2.8-.664.87-1.194 1.266-1.75 1.266-.87 0-1.404-.764-1.404-1.97 0-1.14.503-2.79 1.28-4.32.698-1.38 1.262-2 2.134-2l.038-.002c.7.008 1.267.345 1.903.96l1.322-1.94C8.95 4.54 8.003 4.03 6.915 4.03z"/>
            </svg>
          </div>
          <div className="flex-1">
            <CardTitle className="text-slate-900 dark:text-white">Meta Messaging</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Capture leads do WhatsApp e Instagram Direct automaticamente
            </CardDescription>
          </div>
          {hasAnyConnection && (
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              variant="outline"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
            >
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Desconectar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook URL */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-900 dark:text-white">Webhook URL (Meta Developer Console)</Label>
          <div className="flex gap-2 items-center">
            <Input readOnly value={metaWebhookUrl} className="font-mono text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300" />
            <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopyUrl}>
              {copiedUrl ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Verify Token: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">crm_meta_verify_2024</code>
          </p>
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        {/* ─── SECTION 1: AD ACCOUNT ─── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-blue-500">
                  <path d="M6.915 4.03c-1.968 0-3.286 1.17-4.286 3.066C1.515 8.586.8 10.57.8 12.07c0 2.026 1.128 3.97 3.205 3.97 1.208 0 2.134-.678 3.028-1.873.654-.873 1.263-1.965 1.783-2.947l.367-.694c.862-1.63 1.857-3.46 3.206-4.742C13.502 4.7 14.74 4.03 16.18 4.03c2.084 0 3.628 1.08 4.636 2.746C21.78 8.36 22.2 10.26 22.2 12.07c0 1.89-.46 3.74-1.444 5.18-.97 1.42-2.492 2.52-4.576 2.52-1.428 0-2.574-.507-3.544-1.294l-1.2 1.984c1.28.95 2.83 1.51 4.744 1.51 2.834 0 4.98-1.47 6.227-3.3 1.228-1.81 1.793-4.1 1.793-6.6 0-2.23-.507-4.53-1.683-6.41C21.345 3.87 19.264 2.03 16.18 2.03c-2.01 0-3.57.84-4.803 2.07-1.076 1.074-1.925 2.47-2.678 3.88l-.366.694c-.56 1.06-1.1 2.04-1.678 2.8-.664.87-1.194 1.266-1.75 1.266-.87 0-1.404-.764-1.404-1.97 0-1.14.503-2.79 1.28-4.32.698-1.38 1.262-2 2.134-2l.038-.002c.7.008 1.267.345 1.903.96l1.322-1.94C8.95 4.54 8.003 4.03 6.915 4.03z"/>
                </svg>
              </div>
              <Label className="text-sm font-semibold text-slate-900 dark:text-white">Conta de Anúncio</Label>
            </div>
            <SectionStatus connected={!!existing?.adAccountId} label={existing?.accountName || undefined} />
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-0 flex-1">
              <span className="inline-flex items-center px-3 h-9 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-md text-sm text-slate-500 font-mono">
                act_
              </span>
              <Input
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value.replace(/\D/g, ""))}
                placeholder="123456789"
                className="rounded-l-none font-mono h-9"
                disabled={adLoading}
              />
            </div>
            <Button onClick={handleSaveAd} disabled={adLoading || !adAccountId.trim()} size="sm" variant={adSuccess ? "outline" : "default"} className={cn(adSuccess && "border-green-500 text-green-600")}>
              {adLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : adSuccess ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        {/* ─── SECTION 2: WHATSAPP ─── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-green-500">
                  <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.274-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.065-.301-.15-1.265-.462-2.406-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.095-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.197 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.21 2.095 3.2 5.077 4.485.709.305 1.262.485 1.694.62.713.225 1.362.195 1.874.115.576-.09 1.767-.721 2.016-1.426.248-.705.248-1.305.174-1.425-.074-.121-.274-.196-.574-.346z"/>
                  <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.932-1.41A9.953 9.953 0 0012.001 22C17.523 22 22 17.522 22 12S17.523 2 12.001 2z"/>
                </svg>
              </div>
              <Label className="text-sm font-semibold text-slate-900 dark:text-white">WhatsApp</Label>
            </div>
            <SectionStatus connected={!!(existing?.wabaId || existing?.phoneNumberId || existing?.whatsappNumber)} label={existing?.displayPhone || undefined} />
          </div>

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWhatsappType('waba')}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                whatsappType === 'waba'
                  ? "border-blue-500 bg-blue-500/5 dark:bg-blue-500/10"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
              )}
            >
              <Cloud className={cn("h-4 w-4 shrink-0", whatsappType === 'waba' ? "text-blue-500" : "text-slate-400")} />
              <div>
                <p className={cn("text-xs font-bold", whatsappType === 'waba' ? "text-blue-600 dark:text-blue-400" : "text-slate-600 dark:text-slate-400")}>
                  WABA (Cloud API)
                </p>
                <p className="text-[10px] text-slate-500">API oficial Meta</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setWhatsappType('business_number')}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                whatsappType === 'business_number'
                  ? "border-green-500 bg-green-500/5 dark:bg-green-500/10"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
              )}
            >
              <Phone className={cn("h-4 w-4 shrink-0", whatsappType === 'business_number' ? "text-green-500" : "text-slate-400")} />
              <div>
                <p className={cn("text-xs font-bold", whatsappType === 'business_number' ? "text-green-600 dark:text-green-400" : "text-slate-600 dark:text-slate-400")}>
                  Número Direto
                </p>
                <p className="text-[10px] text-slate-500">API não oficial</p>
              </div>
            </button>
          </div>

          {/* WABA fields */}
          {whatsappType === 'waba' ? (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">WABA ID</Label>
                <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="123456789" className="font-mono text-xs h-9" disabled={waLoading} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Phone Number ID</Label>
                <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="115216611574100" className="font-mono text-xs h-9" disabled={waLoading} />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">Número do WhatsApp Business</Label>
              <Input
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="5511999999999"
                className="font-mono text-xs h-9"
                disabled={waLoading}
              />
              <p className="text-[10px] text-slate-500">DDI + DDD + número. Ex: 5511999999999</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSaveWhatsApp}
              disabled={waLoading || (whatsappType === 'waba' ? (!wabaId.trim() && !phoneNumberId.trim()) : !whatsappNumber.trim())}
              size="sm"
              variant={waSuccess ? "outline" : "default"}
              className={cn(waSuccess && "border-green-500 text-green-600")}
            >
              {waLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : waSuccess ? <Check className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {waSuccess ? "Salvo" : "Salvar WhatsApp"}
            </Button>
          </div>
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-800" />

        {/* ─── SECTION 3: INSTAGRAM ─── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-fuchsia-500">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </div>
              <Label className="text-sm font-semibold text-slate-900 dark:text-white">Instagram</Label>
            </div>
            <SectionStatus connected={!!(existing?.igAccountId || existing?.igUsername)} label={existing?.igUsername ? `@${existing.igUsername}` : undefined} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">@ do Instagram</Label>
            <div className="flex items-center gap-0 flex-1">
              <span className="inline-flex items-center px-3 h-9 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-md text-sm text-slate-500">
                @
              </span>
              <Input
                value={igUsername}
                onChange={(e) => setIgUsername(e.target.value.replace(/^@/, "").replace(/\s/g, ""))}
                placeholder="seuinstagram"
                className="rounded-l-none text-xs h-9"
                disabled={igLoading}
              />
            </div>
            {existing?.igAccountId && (
              <p className="text-[10px] text-slate-500">ID: {existing.igAccountId} (resolvido automaticamente)</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveInstagram}
              disabled={igLoading || !igUsername.trim()}
              size="sm"
              variant={igSuccess ? "outline" : "default"}
              className={cn(igSuccess && "border-green-500 text-green-600")}
            >
              {igLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : igSuccess ? <Check className="h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {igSuccess ? "Salvo" : "Salvar Instagram"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
