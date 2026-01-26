import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

// --- KPI Card ---
// Updated props definition
export function KPI({
    value,
    label,
    icon: Icon,
    color,
    iconBg
}: {
    value: string | number,
    label: string,
    icon: any,
    color: string,
    iconBg?: string
}) {
    return (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden relative group hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <CardContent className="p-4 flex items-start justify-between">
                <div>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                    <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{value}</div>
                </div>
                <div className={cn("p-2 rounded-lg transition-colors", iconBg || "bg-slate-100 dark:bg-slate-800/50")}>
                    <Icon className={cn("h-4 w-4", color)} />
                </div>
            </CardContent>
            {/* Decoration line bottom */}
            <div className={cn("absolute bottom-0 left-0 w-full h-0.5 opacity-0 group-hover:opacity-100 transition-opacity", color.replace('text-', 'bg-'))} />
        </Card>
    );
}

// --- Insight Stats Box ---
export function InsightStat({
    label,
    value,
    sublabel,
    color,
    icon: Icon
}: {
    label: string,
    value: number,
    sublabel: string,
    color: string,
    icon: LucideIcon
}) {
    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-300 shadow-lg">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-[40px] -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start mb-3">
                <div className={cn("p-1.5 rounded-lg", color.replace('text-', 'bg-').replace('400', '500/10'))}>
                    <Icon className={cn("h-4 w-4", color)} />
                </div>
                <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
            </div>
            <div>
                <p className={cn("text-[10px] font-black uppercase tracking-widest mb-0.5", color)}>{label}</p>
                <p className="text-[10px] text-slate-500 leading-tight font-medium">{sublabel}</p>
            </div>
        </div>
    );
}

// --- Action Mention Tag ---
export function ActionTag({
    label,
    count,
    color,
    icon: Icon,
    selected,
    onClick
}: {
    label: string,
    count: number,
    color: string,
    icon: LucideIcon,
    selected?: boolean,
    onClick?: () => void
}) {
    if (count === 0) return null;
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border shadow-sm transition-all cursor-pointer hover:border-slate-700",
                selected
                    ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50"
                    : "border-slate-800",

            )}
        >
            <Icon className={cn("h-3.5 w-3.5", color)} />
            <span className="text-xs font-medium text-slate-300">
                {label}: <span className="text-white font-bold">{count}</span>
            </span>
        </div>
    );
}

// --- Period Summary Card (Mini) ---
export function PeriodSummary({ title, leads, sales, color }: { title: string, leads: number, sales: number, color: string }) {
    return (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center text-center group hover:border-slate-700 transition-all shadow-md">
            <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2">{title}</span>
            <div className={cn("text-3xl font-black tracking-tighter mb-1", color)}>{leads}</div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-bold border border-slate-700/50">
                {sales} <span className="text-slate-500 ml-0.5">Vendas</span>
            </div>
        </div>
    );
}
