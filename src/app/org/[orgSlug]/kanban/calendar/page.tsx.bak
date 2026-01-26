import { getLeads } from "@/server/actions/leads";
import { Lead } from "@/server/db/schema";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isSameDay, addDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
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

  const leads: Lead[] = await getLeads(org.id);
  
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Calendário</h1>
            <p className="text-slate-500 dark:text-slate-400">
                {format(today, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
            </p>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
          {weekDays.map((day) => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
          {days.map((day: Date, dayIdx: number) => {
              const dayLeads = leads.filter((l: Lead) => isSameDay(new Date(l.createdAt), day));
              const isCurrentMonth = isSameMonth(day, monthStart);

              return (
                <div 
                    key={day.toString()} 
                    className={cn(
                        "min-h-[100px] border-b border-r border-slate-200 dark:border-slate-800 p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                        !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/50 text-slate-400",
                        (dayIdx + 1) % 7 === 0 && "border-r-0" // Remove right border for last column
                    )}
                >
                    <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                            "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                            isSameDay(day, today) && "bg-indigo-600 text-white"
                        )}>
                            {format(day, "d")}
                        </span>
                        {dayLeads.length > 0 && (
                            <span className="text-xs text-slate-400 font-medium">
                                {dayLeads.length} leads
                            </span>
                        )}
                    </div>
                    
                    <div className="space-y-1">
                        {dayLeads.map((lead: Lead) => (
                            <div key={lead.id} className="text-xs p-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 truncate">
                                {lead.name}
                            </div>
                        ))}
                    </div>
                </div>
              );
          })}
        </div>
      </div>
    </div>
  );
}
