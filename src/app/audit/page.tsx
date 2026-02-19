"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";

export default function SetupAuditPage() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState("");

    const runSetup = async () => {
        setStatus('loading');
        try {
            const res = await fetch('/api/debug/setup-audit');
            const data = await res.json();

            if (res.ok && data.success) {
                setStatus('success');
                setMessage(data.message);
            } else {
                throw new Error(data.error || "Erro desconhecido ao configurar.");
            }
        } catch (error: any) {
            console.error(error);
            setStatus('error');
            setMessage(error.message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-8 h-8 text-indigo-500" />
                        <CardTitle className="text-xl">Auditoria de Leads</CardTitle>
                    </div>
                    <CardDescription className="text-slate-400">
                        Instalação do Trigger de Histórico Seguro
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 text-sm text-slate-300">
                        <p className="mb-2"><strong>O que isso faz?</strong></p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Cria um <code>TRIGGER</code> no banco de dados.</li>
                            <li>Grava automaticamente histórico para <strong>TODAS</strong> as criações e edições de leads.</li>
                            <li>Funciona mesmo para integrações externas (Webhooks, n8n, etc).</li>
                        </ul>
                    </div>

                    {status === 'idle' && (
                        <Button
                            onClick={runSetup}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6"
                        >
                            Instalar Proteção Agora
                        </Button>
                    )}

                    {status === 'loading' && (
                        <Button disabled className="w-full bg-slate-700 text-slate-400 py-6 cursor-not-allowed">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Configurando banco de dados...
                        </Button>
                    )}

                    {status === 'success' && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <h3 className="font-bold text-emerald-400">Sucesso!</h3>
                            <p className="text-emerald-200/80 text-sm mt-1">{message}</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-3">
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 text-center">
                                <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                                <h3 className="font-bold text-rose-400">Erro na Instalação</h3>
                                <p className="text-rose-200/80 text-sm mt-1">{message}</p>
                            </div>
                            <Button onClick={runSetup} variant="outline" className="w-full border-slate-700 hover:bg-slate-800">
                                Tentar Novamente
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
