"use client";

import * as React from "react";
import { addDays, format, subDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRangePickerProps {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePickerWithPresets({ date, setDate, className }: DateRangePickerProps) {
  const [preset, setPreset] = React.useState<string>("30");

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const today = new Date();

    if (value === "today") {
      setDate({ from: today, to: today });
    } else if (value === "yesterday") {
      const yesterday = subDays(today, 1);
      setDate({ from: yesterday, to: yesterday });
    } else {
      const days = parseInt(value);
      setDate({ from: subDays(today, days - 1), to: today });
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[120px] sm:w-[180px] text-xs h-8 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-50">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="yesterday">Ontem</SelectItem>
          <SelectItem value="7">Últimos 7 dias</SelectItem>
          <SelectItem value="14">Últimos 14 dias</SelectItem>
          <SelectItem value="30">Últimos 30 dias</SelectItem>
          <SelectItem value="60">Últimos 60 dias</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-auto flex-1 sm:w-[260px] justify-start text-left font-normal h-8 text-xs",
              "flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-950 px-3 py-2 text-start text-slate-900 dark:text-slate-50 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-slate-500 dark:data-[placeholder]:text-slate-400 [&>span]:min-w-0 dark:border-slate-800",
              !date && "text-slate-500 dark:text-slate-400"
            )}
          >
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "dd/MM/y", { locale: ptBR })} -{" "}
                    {format(date.to, "dd/MM/y", { locale: ptBR })}
                  </>
                ) : (
                  format(date.from, "dd/MM/y", { locale: ptBR })
                )
              ) : (
                <span>Selecione uma data</span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-950 shadow-xl border border-slate-200 dark:border-slate-800 z-50" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
            locale={ptBR}
            classNames={{
              day_selected: "bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white focus:bg-indigo-600 focus:text-white",
              day_today: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100",
              day_range_middle: "aria-selected:bg-indigo-50 dark:aria-selected:bg-indigo-900/20 aria-selected:text-indigo-900 dark:aria-selected:text-indigo-100",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
