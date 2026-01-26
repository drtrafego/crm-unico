'use client';

import { useState, useMemo } from "react";
import { Lead } from "@/server/db/schema";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday, isBefore, startOfDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Clock, AlertCircle, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";

interface CalendarViewProps {
    leads: Lead[];
}

export function CalendarView({ leads }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const today = new Date();
    const todayStart = startOfDay(today);
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days = eachDayOfInterval({
        start: calendarStart,
        end: calendarEnd,
    });

    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    // Filter leads with follow-up dates
    const leadsWithFollowUp = leads.filter(l => l.followUpDate);

    // Separate overdue, today, and upcoming
    const overdueLeads = useMemo(() => leadsWithFollowUp.filter(l => {
        const fDate = startOfDay(new Date(l.followUpDate!));
        return isBefore(fDate, todayStart);
    }), [leadsWithFollowUp, todayStart]);

    const todayLeads = useMemo(() => leadsWithFollowUp.filter(l => {
        return isSameDay(new Date(l.followUpDate!), today);
    }), [leadsWithFollowUp, today]);

    const upcomingLeads = useMemo(() => leadsWithFollowUp.filter(l => {
        const fDate = startOfDay(new Date(l.followUpDate!));
        return !isBefore(fDate, todayStart) && !isSameDay(fDate, todayStart);
    }).slice(0, 5), [leadsWithFollowUp, todayStart]);

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    return (
        <div className="p-4 sm:p-6 h-full flex flex-col gap-6 overflow-auto bg-slate-50 dark:bg-slate-950">
            {/* Header with Navigation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Calendário</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Gerencie seus follow-ups e retornos
                    </p>
                </div>

                {/* Navigation Controls */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToday}
                        className="border-slate-200 dark:border-slate-700"
                    >
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        Hoje
                    </Button>
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevMonth}
                            className="h-8 w-8"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-3 font-medium text-slate-900 dark:text-white min-w-[140px] text-center">
                            {format(currentDate, "MMMM yyyy", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextMonth}
                            className="h-8 w-8"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Follow-up Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Overdue */}
                <Card className="border-red-200 dark:border-red-800 bg-white dark:bg-slate-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" /> Atrasados ({overdueLeads.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                        {overdueLeads.length === 0 ? (
                            <p className="text-sm text-slate-400">Nenhum atrasado</p>
                        ) : overdueLeads.slice(0, 5).map(lead => (
                            <div key={lead.id} className="text-sm p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                                <div className="font-medium text-red-700 dark:text-red-300">{lead.name}</div>
                                <div className="text-xs text-red-500">{lead.followUpNote || format(new Date(lead.followUpDate!), "dd/MM")}</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Today */}
                <Card className="border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2">
                            <Clock className="h-4 w-4" /> Hoje ({todayLeads.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                        {todayLeads.length === 0 ? (
                            <p className="text-sm text-slate-400">Nenhum para hoje</p>
                        ) : todayLeads.map(lead => (
                            <div key={lead.id} className="text-sm p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                                <div className="font-medium text-amber-700 dark:text-amber-300">{lead.name}</div>
                                <div className="text-xs text-amber-500">{lead.followUpNote || "Retorno agendado"}</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Upcoming */}
                <Card className="border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <Phone className="h-4 w-4" /> Próximos ({upcomingLeads.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[200px] overflow-y-auto">
                        {upcomingLeads.length === 0 ? (
                            <p className="text-sm text-slate-400">Nenhum agendado</p>
                        ) : upcomingLeads.map(lead => (
                            <div key={lead.id} className="text-sm p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                                <div className="font-medium text-blue-700 dark:text-blue-300">{lead.name}</div>
                                <div className="text-xs text-blue-500">{format(new Date(lead.followUpDate!), "dd/MM")} - {lead.followUpNote || "Retorno"}</div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden flex flex-col relative">
                <div className="flex-1 overflow-auto">
                    <div className="min-w-[800px] h-full flex flex-col">
                        {/* Header */}
                        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 shrink-0">
                            {weekDays.map((day) => (
                                <div key={day} className="py-3 text-center text-sm font-semibold text-slate-600 dark:text-slate-400">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                            {days.map((day: Date, dayIdx: number) => {
                                const dayFollowUps = leadsWithFollowUp.filter((l: Lead) => isSameDay(new Date(l.followUpDate!), day));
                                const dayCreated = leads.filter((l: Lead) => isSameDay(new Date(l.createdAt), day));
                                const isCurrentMonth = isSameMonth(day, monthStart);
                                const dayStart = startOfDay(day);
                                const isOverdue = isBefore(dayStart, todayStart) && !isSameDay(day, today);

                                return (
                                    <div
                                        key={day.toString()}
                                        className={cn(
                                            "min-h-[100px] border-b border-r border-slate-200 dark:border-slate-800 p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                                            !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/50 text-slate-400",
                                            (dayIdx + 1) % 7 === 0 && "border-r-0"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={cn(
                                                "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                                                isToday(day) && "bg-indigo-600 text-white"
                                            )}>
                                                {format(day, "d")}
                                            </span>
                                            <div className="flex gap-1">
                                                {dayFollowUps.length > 0 && (
                                                    <span className={cn(
                                                        "text-xs font-medium px-1.5 py-0.5 rounded-full",
                                                        isOverdue ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                                                            isToday(day) ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                                                                "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                                    )}>
                                                        {dayFollowUps.length}
                                                    </span>
                                                )}
                                                {dayCreated.length > 0 && (
                                                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                                                        +{dayCreated.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            {dayFollowUps.slice(0, 2).map((lead: Lead) => (
                                                <div
                                                    key={lead.id}
                                                    className={cn(
                                                        "text-xs p-1 rounded truncate border",
                                                        isOverdue
                                                            ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800"
                                                            : isToday(day)
                                                                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800"
                                                                : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800"
                                                    )}
                                                >
                                                    📞 {lead.name}
                                                </div>
                                            ))}
                                            {dayCreated.slice(0, 1).map((lead: Lead) => (
                                                <div
                                                    key={lead.id}
                                                    className="text-xs p-1 rounded truncate bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800"
                                                >
                                                    ✨ {lead.name}
                                                </div>
                                            ))}
                                            {(dayFollowUps.length + dayCreated.length) > 3 && (
                                                <div className="text-xs text-slate-400">+{(dayFollowUps.length + dayCreated.length) - 3} mais</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
