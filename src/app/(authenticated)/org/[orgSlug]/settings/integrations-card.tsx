"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
// import { toast } from "sonner"; // Removed as not installed

export function IntegrationsCard({ webhookUrl, webhookPayload }: { webhookUrl: string, webhookPayload: any }) {
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedJson, setCopiedJson] = useState(false);

    const handleCopy = (text: string, type: 'url' | 'json') => {
        navigator.clipboard.writeText(text);
        if (type === 'url') {
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
        } else {
            setCopiedJson(true);
            setTimeout(() => setCopiedJson(false), 2000);
        }
    };

    return (
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
    );
}
