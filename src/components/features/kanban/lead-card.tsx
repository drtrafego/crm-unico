"use client";

import { Draggable, DraggableProvided, DraggableStateSnapshot } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lead } from "@/server/db/schema";
import { cn } from "@/lib/utils";
import { Calendar, Pencil } from "lucide-react";
import { useState } from "react";
import { EditLeadDialog } from "./edit-lead-dialog";
import { Button } from "@/components/ui/button";
import { getWhatsAppLink } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updateLeadContent } from "@/server/actions/leads";
import { useRouter } from "next/navigation";
import { getLeadSource } from "@/lib/leads-helper";
import { createPortal } from "react-dom";

interface LeadCardProps {
  lead: Lead;
  index: number;
}

const ORIGIN_OPTIONS = [
  { value: 'Google', className: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-300' },
  { value: 'Meta', className: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/30 dark:text-sky-300' },
  { value: 'Captação Ativa', className: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'Orgânicos', className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300' },
];

export function LeadCard({ lead, index }: LeadCardProps) {
  const router = useRouter();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [originPopoverOpen, setOriginPopoverOpen] = useState(false);
  const [isUpdatingOrigin, setIsUpdatingOrigin] = useState(false);

  const handleOriginChange = async (newOrigin: string) => {
    setIsUpdatingOrigin(true);
    try {
      await updateLeadContent(lead.id, { campaignSource: newOrigin }, lead.organizationId);
      router.refresh();
    } finally {
      setIsUpdatingOrigin(false);
      setOriginPopoverOpen(false);
    }
  };

  const source = getLeadSource(lead);

  const cardContent = (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={provided.draggableProps.style}
      className={cn(
        "mb-3 outline-none",
        snapshot.isDragging && "z-[99999]"
      )}
    >
      {/* Inner wrapper for visual drag effects to avoid conflict with DnD transform positioning */}
      <div className={cn(
        "w-full h-full transition-transform duration-300",
        snapshot.isDragging && "rotate-2 scale-[1.05] drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      )}>
        <Card
          className={cn(
            "relative overflow-hidden transition-all duration-300",
            "relative overflow-hidden transition-all duration-300",
            "glass-card hover:glass-panel hover:shadow-2xl hover:-translate-y-1.5",
            "cursor-grab active:cursor-grabbing",
            snapshot.isDragging && "shadow-2xl ring-2 ring-indigo-500/50 bg-white dark:bg-slate-900 !opacity-100 border-indigo-400/50 shadow-indigo-500/40 !transition-none"
          )}
          onClick={() => {
            if (!snapshot.isDragging) {
              setShowEditDialog(true);
            }
          }}
        >
          {/* Subtle inner glow for dark mode, subtle shadow for light mode */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 dark:from-white/5 to-transparent pointer-events-none opacity-50" />

          <CardContent className="p-4 space-y-3 relative z-10">
            {/* Header with Tags */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Popover open={originPopoverOpen} onOpenChange={setOriginPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div onClick={(e) => { e.stopPropagation(); setOriginPopoverOpen(true); }}>
                      {source ? (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "px-2 py-0.5 text-[11px] font-black uppercase tracking-widest border transition-all duration-300",
                            source === "Google" && "bg-rose-500/20 text-rose-300 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]",
                            source === "Meta" && "bg-sky-500/20 text-sky-300 border-sky-500/30 shadow-[0_0_10px_rgba(14,165,233,0.2)]",
                            source === "Captação Ativa" && "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
                            source === "Orgânicos" && "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
                            !["Google", "Meta", "Captação Ativa", "Orgânicos"].includes(source) && "bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                          )}
                        >
                          {source}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="px-2 py-0.5 text-[11px] font-bold border-dashed border-white/20 text-white/40 cursor-pointer hover:border-indigo-400/50 hover:text-indigo-300 transition-colors"
                        >
                          + Origem
                        </Badge>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-44 p-2 bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-3xl z-[100000] rounded-2xl"
                    align="start"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-1.5">
                      <p className="text-xs font-black uppercase tracking-widest text-white/40 mb-2 px-1">Origem do Lead</p>
                      {ORIGIN_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOriginChange(opt.value)}
                          disabled={isUpdatingOrigin}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300",
                            "hover:bg-white/10 border border-transparent",
                            lead.campaignSource === opt.value ? "bg-white/15 border-white/20 text-white shadow-lg" : "text-white/60 hover:text-white"
                          )}
                        >
                          {opt.value}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {lead.followUpDate && (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const followUp = new Date(lead.followUpDate);
                  const followUpDateLocal = new Date(followUp.getUTCFullYear(), followUp.getUTCMonth(), followUp.getUTCDate(), 0, 0, 0, 0);
                  const isOverdue = followUpDateLocal < today;
                  const isToday = followUpDateLocal.getTime() === today.getTime();

                  return (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "px-2 py-0.5 text-[11px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all",
                        isOverdue && "bg-red-500/10 text-red-500 border-red-500/20",
                        isToday && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                        !isOverdue && !isToday && "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}
                    >
                      <span className={cn(
                        "h-1 w-1 rounded-full",
                        isOverdue && "bg-red-500 animate-pulse",
                        isToday && "bg-amber-500 animate-pulse",
                        !isOverdue && !isToday && "bg-blue-500"
                      )} />
                      {followUpDateLocal.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Badge>
                  );
                })()}
              </div>

              <div className="flex items-center gap-1 transition-opacity duration-300">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!lead.whatsapp}
                        className={cn(
                          "h-7 w-7 rounded-xl transition-all duration-300",
                          lead.whatsapp
                            ? "text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-emerald-500/20 hover:scale-110"
                            : "text-slate-200 dark:text-white/10 cursor-not-allowed"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (lead.whatsapp) {
                            window.open(getWhatsAppLink(lead.whatsapp), '_blank');
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                          <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.274-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.065-.301-.15-1.265-.462-2.406-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.095-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.197 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.21 2.095 3.2 5.077 4.485.709.305 1.262.485 1.694.62.713.225 1.362.195 1.874.115.576-.09 1.767-.721 2.016-1.426.248-.705.248-1.305.174-1.425-.074-.121-.274-.196-.574-.346z" />
                          <path d="M12.001 22.45h-.006c-1.844 0-3.654-.489-5.24-1.414l-.375-.224-3.899 1.021 1.04-3.799-.247-.393a10.428 10.428 0 01-1.597-5.592c0-5.766 4.704-10.457 10.485-10.457 2.793 0 5.419 1.088 7.391 3.065A10.422 10.422 0 0122.484 12c0 5.766-4.704 10.456-10.483 10.45l-.001.002zM6.92 18.23l.317.189c1.45.861 3.128 1.317 4.881 1.319 4.269 0 7.747-3.473 7.747-7.739a7.712 7.712 0 00-2.268-5.464 7.72 7.72 0 00-5.474-2.274C7.854 4.261 4.376 7.734 4.376 12A7.72 7.72 0 005.8 16.518l.206.328-.616 2.251 2.306-.604-.776-.263z" />
                        </svg>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 font-bold text-xs uppercase tracking-widest px-3 py-2 text-slate-900 dark:text-white">
                      {lead.whatsapp ? "WhatsApp" : "Sem WhatsApp"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-xl text-slate-400 dark:text-white/30 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/20 transition-all duration-300 hover:scale-110"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditDialog(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-start gap-2">
                <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors duration-300">
                  {lead.name}
                </h4>
                {lead.value && (
                  <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 shadow-sm shrink-0">
                    R$ {lead.value}
                  </div>
                )}
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                {lead.company}
              </p>
              <p className="text-xs text-slate-600 dark:text-white/50 line-clamp-2 min-h-[2.5em] leading-relaxed group-hover:text-slate-800 dark:group-hover:text-white/70 transition-colors duration-300">
                {lead.notes || "Sem observações adicionais..."}
              </p>
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/5">
              {/* Lead Initials Avatar (Placeholder for Assignee) */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Avatar className="h-6 w-6 border border-white/20 shadow-sm">
                    <AvatarFallback className="text-[10px] bg-indigo-500 text-white font-black">
                      {lead.name?.substring(0, 2).toUpperCase() || "UN"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500 shadow-sm" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5">
                  Lead
                </span>
              </div>

              {/* Meta Stats */}
              <div className="flex items-center gap-3 text-slate-400 dark:text-white/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {(() => {
                      try {
                        return lead?.createdAt
                          ? new Date(lead.createdAt).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
                          : "-";
                      } catch {
                        return "-";
                      }
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <>
      <Draggable draggableId={lead.id} index={index}>
        {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
          const content = cardContent(provided, snapshot);
          if (snapshot.isDragging) {
            return createPortal(content, document.body);
          }
          return content;
        }}
      </Draggable>
      <EditLeadDialog lead={lead} open={showEditDialog} onOpenChange={setShowEditDialog} orgId={lead.organizationId} />
    </>
  );
}
