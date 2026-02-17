
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("=== ERRO DE PÁGINA CAPTURADO ===");
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        console.error("Error object:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <h2 className="text-xl font-bold mb-4 text-red-500">Algo deu errado nesta página!</h2>

            <div className="w-full max-w-4xl space-y-4">
                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded">
                    <h3 className="font-semibold mb-2">Mensagem:</h3>
                    <pre className="text-sm font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">
                        {error.message}
                    </pre>
                </div>

                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded">
                    <h3 className="font-semibold mb-2">Stack Trace:</h3>
                    <pre className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap overflow-auto max-h-96">
                        {error.stack || "Stack trace não disponível"}
                    </pre>
                </div>
            </div>

            <Button onClick={() => reset()} variant="outline" className="mt-4">
                Tentar novamente
            </Button>
        </div>
    );
}
