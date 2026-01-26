import { getLeads } from "@/server/actions/leads";
import { Lead } from "@/server/db/schema";
import { db } from "@/lib/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, format, isSameMonth } from "date-fns";
import { CalendarHeader } from "@/components/features/crm/calendar-header";
import { FollowUpList } from "@/components/features/crm/follow-up-list";
import { cn } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { orgSlug } = await params;
  const searchParams = await searchParamsPromise;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
  });

  if (!org) {
    notFound();
  }

  const leads = await getLeads(org.id);

  // Data selecionada via URL ou Hoje
  const dateParam = typeof searchParams.date === 'string' ? searchParams.date : undefined;
  const currentViewDate = dateParam ? new Date(dateParam) : new Date();

  // Gera a grade do calendário
  const monthStart = startOfMonth(currentViewDate);
  const monthEnd = endOfMonth(currentViewDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Leads com agendamento (Follow-up)
  const leadsWithFollowUp = leads.filter((l: any) => l.followUpDate);

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto gap-8 bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Calendário</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie seus follow-ups e agendamentos.</p>
        </div>
        <CalendarHeader currentDate={currentViewDate} />
      </div>

      {/* Grid do Calendário */}
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm flex flex-col min-h-[600px] overflow-hidden">
        {/* Cabeçalho dos Dias */}
        <div className="grid grid-cols-7 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
          {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-sm font-semibold uppercase tracking-wider">{day}</div>
          ))}
        </div>

        {/* Dias */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
          {days.map((day, idx) => {
            const dayLeads = leads.filter((l: any) => l.createdAt && isSameDay(new Date(l.createdAt), day));
            const dayFollowUps = leadsWithFollowUp.filter((l: any) => l.followUpDate && isSameDay(new Date(l.followUpDate), day));
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isSameDay(day, new Date());

            return (
              <div key={day.toString()} className={cn(
                "min-h-[120px] border-b border-r dark:border-slate-800 p-2 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50",
                !isCurrentMonth && "bg-slate-50/30 dark:bg-slate-900/50 text-slate-300 dark:text-slate-600",
                (idx + 1) % 7 === 0 && "border-r-0"
              )}>
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                    isTodayDate ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none" : "text-slate-700 dark:text-slate-300"
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="flex flex-col gap-1 items-end">
                    {dayLeads.length > 0 && (
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                        {dayLeads.length}L
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">
                  {dayFollowUps.map(lead => (
                    <div key={lead.id} className="text-[10px] p-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800 truncate flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      {lead.name}
                    </div>
                  ))}
                  {dayLeads.slice(0, 2).map(lead => (
                    <div key={lead.id} className="text-[10px] p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 truncate flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      {lead.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FollowUpList leads={leadsWithFollowUp as Lead[]} />
    </div>
  );
}
