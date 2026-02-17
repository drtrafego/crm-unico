"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/debug-auth')
            .then(res => res.json())
            .then(data => {
                setData(data);
                setLoading(false);
            })
            .catch(err => {
                setData({ error: err.message });
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
                <div className="text-2xl">Carregando debug...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8">
            <h1 className="text-3xl font-bold mb-6 text-cyan-400">🔍 Debug CRM Auth</h1>

            <div className="space-y-6">
                {/* Status */}
                <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                    <h2 className="text-xl font-semibold mb-3 text-yellow-400">Status:</h2>
                    <div className={`text-lg font-mono ${data?.success ? 'text-green-400' : 'text-red-400'}`}>
                        {data?.success ? '✅ SUCESSO' : '❌ ERRO'}
                    </div>
                </div>

                {/* User Info */}
                {data?.user && (
                    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                        <h2 className="text-xl font-semibold mb-3 text-green-400">Usuário:</h2>
                        <pre className="text-sm font-mono text-green-300 whitespace-pre-wrap">
                            {JSON.stringify(data.user, null, 2)}
                        </pre>
                    </div>
                )}

                {/* Error */}
                {data?.error && (
                    <div className="bg-slate-900 p-6 rounded-lg border border-red-800">
                        <h2 className="text-xl font-semibold mb-3 text-red-400">Erro:</h2>

                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-red-300 mb-2">Mensagem:</h3>
                                <pre className="text-sm font-mono text-red-200 whitespace-pre-wrap bg-black/30 p-3 rounded">
                                    {data.error.message}
                                </pre>
                            </div>

                            {data.error.stack && (
                                <div>
                                    <h3 className="font-semibold text-yellow-300 mb-2">Stack Trace:</h3>
                                    <pre className="text-xs font-mono text-yellow-200 whitespace-pre-wrap bg-black/30 p-3 rounded max-h-96 overflow-auto">
                                        {data.error.stack}
                                    </pre>
                                </div>
                            )}

                            <div>
                                <h3 className="font-semibold text-blue-300 mb-2">Tipo:</h3>
                                <pre className="text-sm font-mono text-blue-200">
                                    {data.error.type}
                                </pre>
                            </div>

                            {data.error.properties && data.error.properties.length > 0 && (
                                <div>
                                    <h3 className="font-semibold text-purple-300 mb-2">Propriedades:</h3>
                                    <pre className="text-sm font-mono text-purple-200">
                                        {data.error.properties.join(', ')}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Logs */}
                {data?.logs && (
                    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                        <h2 className="text-xl font-semibold mb-3 text-cyan-400">Logs:</h2>
                        <pre className="text-xs font-mono text-cyan-200 whitespace-pre-wrap bg-black/30 p-3 rounded max-h-96 overflow-auto">
                            {data.logs.join('\n')}
                        </pre>
                    </div>
                )}

                {/* Raw Data */}
                <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">
                    <h2 className="text-xl font-semibold mb-3 text-gray-400">Dados Completos:</h2>
                    <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap bg-black/30 p-3 rounded max-h-96 overflow-auto">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            </div>
        </div>
    );
}
