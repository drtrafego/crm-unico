"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Check, Copy, Loader2, Trash2, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { saveMetaIntegration, removeMetaIntegration, updateMetaIds } from "@/server/actions/meta-integrations";
import { useRouter } from "next/navigation";
import type { MetaIntegration } from "@/server/db/schema";

interface MetaIntegrationCardProps {
  orgId: string;
  orgSlug: string;
  metaWebhookUrl: string;
  existing: MetaIntegration | null;
}

export function MetaIntegrationCard({ orgId, orgSlug, metaWebhookUrl, existing }: MetaIntegrationCardProps) {
  const router = useRouter();
  const [adAccountId, setAdAccountId] = useState(existing?.adAccountId?.replace("act_", "") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Campos manuais (caso auto-discovery não funcione)
  const [showManual, setShowManual] = useState(false);
  const [manualWabaId, setManualWabaId] = useState(existing?.wabaId || "");
  const [manualPhoneNumberId, setManualPhoneNumberId] = useState(existing?.phoneNumberId || "");
  const [manualIgAccountId, setManualIgAccountId] = useState(existing?.igAccountId || "");

  const handleConnect = async () => {
    if (!adAccountId.trim()) return;
    setIsLoading(true);
    setErrors([]);
    setResult(null);

    try {
      const res = await saveMetaIntegration(orgId, orgSlug, adAccountId.trim());
      setResult(res.discovered);
      setErrors(res.errors);
      if (res.discovered.wabaId) setManualWabaId(res.discovered.wabaId);
      if (res.discovered.phoneNumberId) setManualPhoneNumberId(res.discovered.phoneNumberId);
      if (res.discovered.igAccountId) setManualIgAccountId(res.discovered.igAccountId);
      router.refresh();
    } catch (err) {
      setErrors(["Erro ao conectar. Verifique o ID da conta."]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await removeMetaIntegration(orgId, orgSlug);
      setAdAccountId("");
      setResult(null);
      setManualWabaId("");
      setManualPhoneNumberId("");
      setManualIgAccountId("");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveManual = async () => {
    setIsLoading(true);
    try {
      await updateMetaIds(orgId, orgSlug, {
        wabaId: manualWabaId || undefined,
        phoneNumberId: manualPhoneNumberId || undefined,
        igAccountId: manualIgAccountId || undefined,
      });
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(metaWebhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const isConnected = !!existing?.adAccountId;

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
            <CardTitle className="text-slate-900 dark:text-white flex items-center gap-2">
              Meta Messaging
              {isConnected && (
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Capture leads do WhatsApp e Instagram Direct automaticamente
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook URL */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-900 dark:text-white">Webhook URL (use no Meta Developer Console)</Label>
          <div className="flex gap-2 items-center">
            <Input
              readOnly
              value={metaWebhookUrl}
              className="font-mono text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
            />
            <Button variant="outline" size="icon" className="shrink-0" onClick={handleCopyUrl}>
              {copiedUrl ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Verify Token: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">crm_meta_verify_2024</code>
          </p>
        </div>

        {/* Ad Account ID */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-900 dark:text-white">ID da Conta de Anúncio</Label>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-0 flex-1">
              <span className="inline-flex items-center px-3 h-10 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-md text-sm text-slate-500 font-mono">
                act_
              </span>
              <Input
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value.replace(/\D/g, ""))}
                placeholder="123456789"
                className="rounded-l-none font-mono"
                disabled={isLoading}
              />
            </div>
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                disabled={isLoading || !adAccountId.trim()}
                className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                <span className="ml-2">Conectar</span>
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
                </Button>
                <Button
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  variant="outline"
                  size="icon"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Discovery Results */}
        {(result || existing) && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Contas Detectadas</p>

            <div className="grid gap-3">
              {/* Account Name */}
              {(result?.accountName || existing?.accountName) && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-blue-500">
                      <path d="M6.915 4.03c-1.968 0-3.286 1.17-4.286 3.066C1.515 8.586.8 10.57.8 12.07c0 2.026 1.128 3.97 3.205 3.97 1.208 0 2.134-.678 3.028-1.873.654-.873 1.263-1.965 1.783-2.947l.367-.694c.862-1.63 1.857-3.46 3.206-4.742C13.502 4.7 14.74 4.03 16.18 4.03c2.084 0 3.628 1.08 4.636 2.746C21.78 8.36 22.2 10.26 22.2 12.07c0 1.89-.46 3.74-1.444 5.18-.97 1.42-2.492 2.52-4.576 2.52-1.428 0-2.574-.507-3.544-1.294l-1.2 1.984c1.28.95 2.83 1.51 4.744 1.51 2.834 0 4.98-1.47 6.227-3.3 1.228-1.81 1.793-4.1 1.793-6.6 0-2.23-.507-4.53-1.683-6.41C21.345 3.87 19.264 2.03 16.18 2.03c-2.01 0-3.57.84-4.803 2.07-1.076 1.074-1.925 2.47-2.678 3.88l-.366.694c-.56 1.06-1.1 2.04-1.678 2.8-.664.87-1.194 1.266-1.75 1.266-.87 0-1.404-.764-1.404-1.97 0-1.14.503-2.79 1.28-4.32.698-1.38 1.262-2 2.134-2l.038-.002c.7.008 1.267.345 1.903.96l1.322-1.94C8.95 4.54 8.003 4.03 6.915 4.03z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{result?.accountName || existing?.accountName}</p>
                    <p className="text-xs text-slate-500">Conta de Anúncio</p>
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-green-500">
                    <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.274-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.065-.301-.15-1.265-.462-2.406-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.095-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.197 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.21 2.095 3.2 5.077 4.485.709.305 1.262.485 1.694.62.713.225 1.362.195 1.874.115.576-.09 1.767-.721 2.016-1.426.248-.705.248-1.305.174-1.425-.074-.121-.274-.196-.574-.346z"/>
                    <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.932-1.41A9.953 9.953 0 0012.001 22C17.523 22 22 17.522 22 12S17.523 2 12.001 2z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {(result?.displayPhone || existing?.displayPhone) || (result?.phoneNumberId || existing?.phoneNumberId ? `ID: ${result?.phoneNumberId || existing?.phoneNumberId}` : "Não detectado")}
                  </p>
                  <p className="text-xs text-slate-500">WhatsApp Business</p>
                </div>
                {(result?.phoneNumberId || existing?.phoneNumberId) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 ml-auto" />
                )}
              </div>

              {/* Instagram */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-fuchsia-500">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {(result?.igAccountId || existing?.igAccountId) ? `ID: ${result?.igAccountId || existing?.igAccountId}` : "Não detectado"}
                  </p>
                  <p className="text-xs text-slate-500">Instagram Direct</p>
                </div>
                {(result?.igAccountId || existing?.igAccountId) ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500 ml-auto" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 p-4 border border-amber-200 dark:border-amber-700/30 space-y-1">
            {errors.map((err, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {err}
              </p>
            ))}
          </div>
        )}

        {/* Manual Override */}
        {isConnected && (
          <div className="space-y-3">
            <button
              onClick={() => setShowManual(!showManual)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-widest"
            >
              {showManual ? "Fechar" : "Configurar manualmente"} {showManual ? "▲" : "▼"}
            </button>

            {showManual && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">WABA ID (WhatsApp Business Account)</Label>
                  <Input
                    value={manualWabaId}
                    onChange={(e) => setManualWabaId(e.target.value)}
                    placeholder="Ex: 123456789"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Phone Number ID</Label>
                  <Input
                    value={manualPhoneNumberId}
                    onChange={(e) => setManualPhoneNumberId(e.target.value)}
                    placeholder="Ex: 115216611574100"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Instagram Account ID</Label>
                  <Input
                    value={manualIgAccountId}
                    onChange={(e) => setManualIgAccountId(e.target.value)}
                    placeholder="Ex: 17841400000000"
                    className="font-mono text-xs"
                  />
                </div>
                <Button
                  onClick={handleSaveManual}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar IDs Manuais
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
