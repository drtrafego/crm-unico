"use client";

import { Draggable, DraggableProvided, DraggableStateSnapshot } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Lead } from "@/server/db/schema";
import { cn } from "@/lib/utils";
import { Calendar, MessageCircle, Pencil } from "lucide-react";
import { useState } from "react";
import { EditLeadDialog } from "./edit-lead-dialog";
import { Button } from "@/components/ui/button";
import { getWhatsAppLink } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updateLeadContent } from "@/server/actions/leads";
import { useRouter } from "next/navigation";
import { getLeadSource } from "@/lib/leads-helper";

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

  return (
    <>
      <Draggable draggableId={lead.id} index={index}>
        {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            style={provided.draggableProps.style}
            className={cn(
              "mb-3 outline-none",
              snapshot.isDragging && "z-[9999]"
            )}
          >
            {/* Inner wrapper for visual drag effects to avoid conflict with DnD transform positioning */}
            <div className={cn(
              "w-full h-full transition-transform duration-300",
              snapshot.isDragging && "rotate-2 scale-[1.02]"
            )}>
              <Card
                className={cn(
                  "relative overflow-hidden transition-all duration-300",
                  "bg-white/90 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg",
                  "hover:shadow-xl dark:hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] hover:-translate-y-1.5 hover:bg-white dark:hover:bg-slate-900/60 hover:border-slate-300 dark:hover:border-white/20",
                  "cursor-grab active:cursor-grabbing",
                  snapshot.isDragging && "shadow-2xl ring-2 ring-indigo-500/50 bg-white dark:bg-slate-900 !opacity-100 border-indigo-400/50 shadow-indigo-500/40"
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
                                  "px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border transition-all duration-300",
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
                                className="px-2 py-0.5 text-[10px] font-bold border-dashed border-white/20 text-white/40 cursor-pointer hover:border-indigo-400/50 hover:text-indigo-300 transition-colors"
                              >
                                + Origem
                              </Badge>
                            )}
                          </div>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-44 p-2 bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-3xl z-50 rounded-2xl"
                          align="start"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 px-1">Origem do Lead</p>
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
                              "px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 transition-all",
                              isOverdue && "bg-red-500/20 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
                              isToday && "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
                              !isOverdue && !isToday && "bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                            )}
                          >
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full animate-pulse",
                              isOverdue && "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]",
                              isToday && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]",
                              !isOverdue && !isToday && "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                            )} />
                            {followUpDateLocal.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </Badge>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
                                  ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 hover:scale-110"
                                  : "text-white/10 cursor-not-allowed"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (lead.whatsapp) {
                                  window.open(getWhatsAppLink(lead.whatsapp), '_blank');
                                }
                              }}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 border-white/10 font-bold text-xs uppercase tracking-widest px-3 py-2">
                            {lead.whatsapp ? "WhatsApp" : "Sem WhatsApp"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-xl text-white/30 hover:text-indigo-400 hover:bg-indigo-500/20 transition-all duration-300 hover:scale-110"
                        onClick={() => {
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
                        <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] shrink-0">
                          R$ {lead.value}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40">
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
                          <AvatarFallback className="text-[8px] bg-indigo-500 text-white font-black">
                            {lead.name?.substring(0, 2).toUpperCase() || "UN"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-white bg-emerald-500 shadow-sm" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40 px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full">
                        Lead
                      </span>
                    </div>

                    {/* Meta Stats */}
                    <div className="flex items-center gap-3 text-slate-400 dark:text-white/30">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
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
        )}
      </Draggable>
      <EditLeadDialog lead={lead} open={showEditDialog} onOpenChange={setShowEditDialog} orgId={lead.organizationId} />
    </>
  );
}
