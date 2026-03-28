"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

export function IntegrationsCard({ webhookUrl, webhookPayload, metaWebhookUrl }: { webhookUrl: string, webhookPayload: any, metaWebhookUrl?: string }) {
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedJson, setCopiedJson] = useState(false);
    const [copiedMeta, setCopiedMeta] = useState(false);

    const handleCopy = (text: string, type: 'url' | 'json' | 'meta') => {
        navigator.clipboard.writeText(text);
        if (type === 'url') {
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
        } else if (type === 'json') {
            setCopiedJson(true);
            setTimeout(() => setCopiedJson(false), 2000);
        } else {
            setCopiedMeta(true);
            setTimeout(() => setCopiedMeta(false), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {/* Webhook Genérico */}
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="text-slate-900 dark:text-white">Integrações</CardTitle>
                    <CardDescription className="text-slate-500 dark:text-slate-400">Conecte seu CRM a outras ferramentas (Zapier, n8n, Typeform, etc).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-base font-semibold text-slate-900 dark:text-white">Webhook URL (Captura de Leads)</Label>
                        <div className="flex gap-2 items-center">
                            <div className="relative flex-1">
                                <Input
                                    readOnly
                                    value={webhookUrl}
                                    className="font-mono text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 pr-10"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                title="Copiar URL"
                                className="shrink-0 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                onClick={() => handleCopy(webhookUrl, 'url')}
                            >
                                {copiedUrl ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                            Use este URL para enviar leads automaticamente para o seu CRM.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-base font-semibold text-slate-900 dark:text-white">Formato do Payload (JSON)</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Envie uma requisição <strong>POST</strong> com o formato abaixo. Header: <code>Content-Type: application/json</code>.
                        </p>
                        <div className="bg-slate-950 text-slate-50 p-4 rounded-lg font-mono text-xs overflow-x-auto relative group border border-slate-800">
                            <pre className="text-emerald-400">{JSON.stringify(webhookPayload, null, 2)}</pre>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 text-slate-400 hover:text-white hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleCopy(JSON.stringify(webhookPayload, null, 2), 'json')}
                                title="Copiar JSON"
                            >
                                {copiedJson ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Meta Messaging Webhook */}
            {metaWebhookUrl && (
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                <MessageCircle className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-slate-900 dark:text-white">Meta Messaging</CardTitle>
                                <CardDescription className="text-slate-500 dark:text-slate-400">
                                    Capture leads automaticamente do WhatsApp e Instagram Direct
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-base font-semibold text-slate-900 dark:text-white">Webhook URL (Meta Developer Console)</Label>
                            <div className="flex gap-2 items-center">
                                <div className="relative flex-1">
                                    <Input
                                        readOnly
                                        value={metaWebhookUrl}
                                        className="font-mono text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 pr-10"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    title="Copiar URL"
                                    className="shrink-0 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => handleCopy(metaWebhookUrl, 'meta')}
                                >
                                    {copiedMeta ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label className="text-base font-semibold text-slate-900 dark:text-white">Como configurar</Label>
                            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                                <div className="flex gap-3 items-start">
                                    <span className="shrink-0 h-6 w-6 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center text-xs font-black">1</span>
                                    <p>No <strong>Meta Developer Console</strong>, vá em seu App &gt; WhatsApp &gt; Configuration</p>
                                </div>
                                <div className="flex gap-3 items-start">
                                    <span className="shrink-0 h-6 w-6 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center text-xs font-black">2</span>
                                    <p>Em <strong>Callback URL</strong>, cole o Webhook URL acima</p>
                                </div>
                                <div className="flex gap-3 items-start">
                                    <span className="shrink-0 h-6 w-6 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center text-xs font-black">3</span>
                                    <p>Em <strong>Verify Token</strong>, use: <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs font-mono">crm_meta_verify_2024</code></p>
                                </div>
                                <div className="flex gap-3 items-start">
                                    <span className="shrink-0 h-6 w-6 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center text-xs font-black">4</span>
                                    <p>Assine os campos: <strong>messages</strong> (WhatsApp) e/ou <strong>messages</strong> (Instagram)</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700">
                            <div className="flex items-start gap-3">
                                <div className="shrink-0 mt-0.5">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-green-500">
                                        <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.274-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.065-.301-.15-1.265-.462-2.406-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.095-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.197 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.21 2.095 3.2 5.077 4.485.709.305 1.262.485 1.694.62.713.225 1.362.195 1.874.115.576-.09 1.767-.721 2.016-1.426.248-.705.248-1.305.174-1.425-.074-.121-.274-.196-.574-.346z"/>
                                        <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.932-1.41A9.953 9.953 0 0012.001 22C17.523 22 22 17.522 22 12S17.523 2 12.001 2z"/>
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">WhatsApp</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Leads de campanhas Click-to-WhatsApp aparecem com origem <strong className="text-green-600 dark:text-green-400">WhatsApp</strong></p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="shrink-0 mt-0.5">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-fuchsia-500">
                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Instagram Direct</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Leads de campanhas Click-to-DM aparecem com origem <strong className="text-fuchsia-600 dark:text-fuchsia-400">Direct</strong></p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
