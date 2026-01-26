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
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
                <span className={cn("flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider", color)}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", color.replace('text-', 'bg-'))} />
                    {label}
                </span>
                <Icon className={cn("h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity", color)} />
            </div>
            <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
            <div className="text-[10px] text-slate-500">{sublabel}</div>
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
        <div className="p-3 bg-indigo-950/20 rounded-lg border border-indigo-500/10 flex flex-col items-center text-center">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{title}</span>
            <div className={cn("text-xl font-bold", color)}>{leads}</div>
            <div className="text-[10px] text-slate-500">leads / {sales} vendas</div>
        </div>
    );
}
