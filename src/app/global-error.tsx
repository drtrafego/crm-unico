
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log completo no console
        console.error("=== ERRO GLOBAL CAPTURADO ===");
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        console.error("Digest:", error.digest);
        console.error("Error object:", error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white p-4">
                    <h2 className="text-2xl font-bold mb-4 text-red-500">Algo deu errado!</h2>

                    <div className="w-full max-w-4xl space-y-4">
                        {/* Mensagem do erro */}
                        <div className="bg-black/50 p-4 rounded">
                            <h3 className="text-lg font-semibold mb-2 text-red-400">Mensagem:</h3>
                            <pre className="text-sm font-mono text-red-300 whitespace-pre-wrap">
                                {error.message || "Erro desconhecido"}
                            </pre>
                        </div>

                        {/* Stack trace completo */}
                        <div className="bg-black/50 p-4 rounded">
                            <h3 className="text-lg font-semibold mb-2 text-yellow-400">Stack Trace:</h3>
                            <pre className="text-xs font-mono text-yellow-300 whitespace-pre-wrap overflow-auto max-h-96">
                                {error.stack || "Stack trace não disponível"}
                            </pre>
                        </div>

                        {/* Digest se disponível */}
                        {error.digest && (
                            <div className="bg-black/50 p-4 rounded">
                                <h3 className="text-lg font-semibold mb-2 text-blue-400">Digest:</h3>
                                <pre className="text-sm font-mono text-blue-300">
                                    {error.digest}
                                </pre>
                            </div>
                        )}

                        {/* Informações adicionais */}
                        <div className="bg-black/50 p-4 rounded">
                            <h3 className="text-lg font-semibold mb-2 text-green-400">Objeto completo:</h3>
                            <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap overflow-auto max-h-96">
                                {JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}
                            </pre>
                        </div>
                    </div>

                    <Button onClick={() => reset()} variant="outline" className="mt-6">
                        Tentar novamente
                    </Button>
                </div>
            </body>
        </html>
    );
}
