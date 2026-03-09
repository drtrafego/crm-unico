import { PageHeader } from "@/components/page-header";

export default function VendasHotmartPage() {
    return (
        <div className="flex-col md:flex">
            <div className="flex-1 space-y-4 p-8 pt-6">
                <PageHeader
                    title="Vendas Hotmart"
                    description="Esta página exibirá os dados das vendas da Hotmart integradas via Webhook."
                />
                <div className="rounded-md border p-4 bg-background">
                    <p className="text-muted-foreground">O conteúdo será implementado posteriormente.</p>
                </div>
            </div>
        </div>
    );
}
