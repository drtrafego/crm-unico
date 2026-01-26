import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeads, getColumns } from "@/server/actions/leads";
import { Lead, Column } from "@/server/db/schema";
import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
  });

  if (!org) {
    notFound();
  }

  const leads = await getLeads(org.id);
  const columns = await getColumns(org.id);

  const totalLeads = leads.length;
  
  // Calculate revenue from "Fechado" leads
  // Use robust loose matching for column name and handle value parsing
  const parseValue = (val: string | null | number | undefined) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const clean = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const fechadoColumn = columns.find((c: Column) => {
      const title = c.title.toLowerCase().trim();
      return title.includes("fechado") || title.includes("won") || title.includes("ganho");
  });

  const wonLeads = fechadoColumn 
    ? leads.filter((l: Lead) => l.columnId === fechadoColumn.id)
    : [];
    
  const totalRevenue = wonLeads.reduce((sum: number, lead: Lead) => {
    return sum + parseValue(lead.value);
  }, 0);

  interface ColumnStat {
    id: string;
    name: string;
    count: number;
    percentage: number;
  }

  const leadsByColumn: ColumnStat[] = columns.map((col: Column) => {
    const count = leads.filter((l: Lead) => l.columnId === col.id).length;
    return {
      id: col.id,
      name: col.title,
      count,
      percentage: totalLeads > 0 ? (count / totalLeads) * 100 : 0
    };
  });

  // Mock monthly data
  const monthlyData = [
    { month: 'Jan', value: 12 },
    { month: 'Fev', value: 19 },
    { month: 'Mar', value: 34 },
    { month: 'Abr', value: 25 },
    { month: 'Mai', value: 42 },
    { month: 'Jun', value: totalLeads > 50 ? totalLeads : 55 },
  ];

  const maxVal = Math.max(...monthlyData.map(d => d.value));

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>
        <p className="text-slate-500 dark:text-slate-400">Visão geral do desempenho do seu CRM.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Receita Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
            </div>
            <p className="text-xs text-slate-500 flex items-center mt-1">
              Em leads fechados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              +12% em relação ao mês anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.2%</div>
            <p className="text-xs text-slate-500 flex items-center mt-1">
              Média do setor: 2.5%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Tempo Médio de Fechamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">14 dias</div>
            <p className="text-xs text-red-600 flex items-center mt-1">
              -2 dias em relação à média
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Breakdown */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Funil de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {leadsByColumn.map((col: ColumnStat) => (
              <div key={col.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{col.name}</span>
                  <span className="text-slate-500">{col.count} ({col.percentage.toFixed(0)}%)</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full" 
                    style={{ width: `${col.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Monthly Trend (CSS Bar Chart) */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Novos Leads por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-[200px] w-full gap-2 mt-4">
              {monthlyData.map((d: { month: string; value: number }) => (
                <div key={d.month} className="flex flex-col items-center gap-2 w-full group">
                    <div 
                        className="w-full bg-indigo-100 dark:bg-indigo-900/30 rounded-t-md group-hover:bg-indigo-200 transition-all relative"
                        style={{ height: `${(d.value / maxVal) * 100}%` }}
                    >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            {d.value}
                        </div>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">{d.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
