
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
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <h2 className="text-xl font-bold mb-4 text-red-500">Algo deu errado nesta página!</h2>
            <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded mb-4 overflow-auto max-w-full text-sm font-mono text-red-600 dark:text-red-400">
                {error.message}
            </pre>
            <Button onClick={() => reset()} variant="outline">
                Tentar novamente
            </Button>
        </div>
    );
}
