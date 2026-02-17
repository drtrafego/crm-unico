
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
        console.error(error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white p-4">
                    <h2 className="text-2xl font-bold mb-4 text-red-500">Algo deu errado!</h2>
                    <pre className="bg-black/50 p-4 rounded mb-4 overflow-auto max-w-full text-sm font-mono text-red-300">
                        {error.message || "Erro desconhecido"}
                        {error.digest && `\nDigest: ${error.digest}`}
                    </pre>
                    <Button onClick={() => reset()} variant="outline">
                        Tentar novamente
                    </Button>
                </div>
            </body>
        </html>
    );
}
