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
    icon: LucideIcon,
    color: string,
    iconBg?: string
}) {
    return (
        <Card className="bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border-slate-200/50 dark:border-white/10 overflow-hidden relative group hover:border-slate-300 dark:hover:border-white/20 transition-all duration-300 shadow-sm hover:shadow-indigo-500/10 hover:shadow-2xl">
            <CardContent className="p-4 flex items-start justify-between relative z-10">
                <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.1em] opacity-80">{label}</p>
                    <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</div>
                </div>
                <div className={cn(
                    "p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner",
                    iconBg || "bg-slate-100 dark:bg-white/5"
                )}>
                    <Icon className={cn("h-4 w-4", color)} />
                </div>
            </CardContent>
            {/* Glossy overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            {/* Bottom Accent line with glow */}
            <div className={cn(
                "absolute bottom-0 left-0 w-full h-[3px] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left blur-[1px]",
                color.replace('text-', 'bg-')
            )} />
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
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 relative overflow-hidden group hover:border-white/10 transition-all duration-500 shadow-2xl">
            {/* Interactive Background Glow */}
            <div className={cn(
                "absolute -top-10 -right-10 w-32 h-32 blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity duration-1000",
                color.replace('text-', 'bg-')
            )} />

            <div className="flex justify-between items-start mb-4">
                <div className={cn(
                    "p-2.5 rounded-xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 shadow-lg",
                    color.replace('text-', 'bg-').replace('400', '500/10').replace('500', '500/10')
                )}>
                    <Icon className={cn("h-4.5 w-4.5", color)} />
                </div>
                <div className="text-4xl font-black text-white tracking-tighter drop-shadow-sm">{value}</div>
            </div>
            <div className="space-y-1">
                <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-0.5", color)}>{label}</p>
                <p className="text-[11px] text-slate-500 leading-tight font-medium group-hover:text-slate-400 transition-colors uppercase">{sublabel}</p>
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
                "flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/80 backdrop-blur-sm border shadow-md transition-all duration-300 cursor-pointer hover:shadow-lg active:scale-95",
                selected
                    ? "border-indigo-500/50 bg-indigo-500/10 ring-2 ring-indigo-500/20"
                    : "border-white/5 hover:border-white/10",
            )}
        >
            <div className={cn("p-1 rounded-md", color.replace('text-', 'bg-').replace('400', '500/10'))}>
                <Icon className={cn("h-3.5 w-3.5", color)} />
            </div>
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                {label} <span className="text-white ml-1 px-1.5 py-0.5 rounded bg-white/5">{count}</span>
            </span>
        </div>
    );
}

// --- Period Summary Card (Mini) ---
export function PeriodSummary({ title, leads, sales, color }: { title: string, leads: number, sales: number, color: string }) {
    return (
        <div className="p-5 bg-slate-950/40 backdrop-blur-md border border-white/5 rounded-2xl flex flex-col items-center text-center group hover:border-white/20 transition-all duration-300 shadow-xl">
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-3 opacity-60">{title}</span>
            <div className={cn("text-4xl font-black tracking-tighter mb-2 drop-shadow-sm", color)}>{leads}</div>
            <div className="px-3 py-1 rounded-lg bg-white/5 text-[10px] text-slate-300 font-black border border-white/10 uppercase tracking-widest shadow-inner">
                {sales} <span className="text-slate-500 ml-1">vendas</span>
            </div>
        </div>
    );
}
