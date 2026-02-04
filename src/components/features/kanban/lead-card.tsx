'use client';

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lead } from "@/server/db/schema";
import { cn } from "@/lib/utils";
import { Calendar, MessageCircle, Paperclip, Pencil } from "lucide-react";
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
}

const ORIGIN_OPTIONS = [
  { value: 'Google', className: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-300' },
  { value: 'Meta', className: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/30 dark:text-sky-300' },
  { value: 'Captação Ativa', className: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'Orgânicos', className: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300' },
];

export function LeadCard({ lead }: LeadCardProps) {
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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: "Lead",
      lead,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "opacity-50 ring-2 ring-indigo-500/20 rounded-lg rotate-2",
        )}
      >
        <Card className="bg-slate-50 border-dashed border-2 border-slate-300 h-[150px]" />
      </div>
    );
  }

  const source = getLeadSource(lead); // 2. Replace direct campaignSource usage with getLeadSource(lead)

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="mb-3"
      >
        <Card
          className="group hover:shadow-md transition-all duration-200 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-grab active:cursor-grabbing"
          onClick={(e) => {
            // Prevent triggering edit if we are just finishing a drag
            if (!isDragging) {
              setShowEditDialog(true);
            }
          }}
        >
          <CardContent className="p-4 space-y-2">
            {/* Header with Tags */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <Popover open={originPopoverOpen} onOpenChange={setOriginPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div onClick={(e) => { e.stopPropagation(); setOriginPopoverOpen(true); }}>
                      {source ? ( // Use 'source' here
                        <Badge
                          variant="secondary"
                          className={cn(
                            "px-1.5 py-0 text-[10px] font-medium border cursor-pointer hover:ring-2 hover:ring-indigo-200 dark:hover:ring-indigo-800 transition-all",
                            // 3. Add styling for source badge
                            source === "Google" && "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
                            source === "Meta" && "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
                            source === "Captação Ativa" && "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
                            source === "Orgânicos" && "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
                            !["Google", "Meta", "Captação Ativa", "Orgânicos"].includes(source) && "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                          )}
                        >
                          {source}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[10px] font-medium border-dashed border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500 cursor-pointer hover:border-indigo-400 hover:text-indigo-500"
                        >
                          + Origem
                        </Badge>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-40 p-2 bg-white dark:bg-slate-950 shadow-xl border border-slate-200 dark:border-slate-800 z-50"
                    align="start"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Selecionar Origem</p>
                      {ORIGIN_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleOriginChange(opt.value)}
                          disabled={isUpdatingOrigin}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-xs font-medium border transition-all hover:ring-2 hover:ring-indigo-200",
                            opt.className,
                            lead.campaignSource === opt.value && "ring-2 ring-indigo-400"
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
                  followUp.setHours(0, 0, 0, 0);
                  const isOverdue = followUp < today;
                  const isToday = followUp.getTime() === today.getTime();

                  return (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "px-1.5 py-0 text-[10px] font-medium border flex items-center gap-1",
                        isOverdue && "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
                        isToday && "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
                        !isOverdue && !isToday && "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                      )}
                    >
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isOverdue && "bg-red-500",
                        isToday && "bg-amber-500",
                        !isOverdue && !isToday && "bg-blue-500"
                      )} />
                      {followUp.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Badge>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={!lead.whatsapp}
                        className={cn(
                          "h-6 w-6 -mt-1 transition-colors",
                          lead.whatsapp
                            ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                            : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                        )}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent opening edit dialog
                          if (lead.whatsapp) {
                            window.open(getWhatsAppLink(lead.whatsapp), '_blank');
                          }
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {lead.whatsapp ? "Conversar no WhatsApp" : "Sem WhatsApp cadastrado"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {lead.value && (
                  <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                    R$ {lead.value}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-slate-400 hover:text-indigo-600 -mt-1 -mr-1 transition-opacity"
                  title="Editar Lead"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">
                {lead.name}
              </h4>
              {lead.company && (
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lead.company}
                </p>
              )}
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[1.5em]">
                {lead.notes || "Sem observações"}
              </p>
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
              {/* Assignee */}
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 border-2 border-white dark:border-slate-800">
                  <AvatarImage src={`https://avatar.vercel.sh/${lead?.email || 'unknown'}`} />
                  <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                    {lead?.name ? lead.name.substring(0, 2).toUpperCase() : "??"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lead?.name ? lead.name.split(' ')[0] : "Sem Nome"}
                </span>
              </div>

              {/* Meta Stats */}
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1 text-[10px]">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {(() => {
                      try {
                        return lead?.createdAt
                          ? new Date(lead.createdAt).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
                          : "-";
                      } catch (e) {
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
      <EditLeadDialog lead={lead} open={showEditDialog} onOpenChange={setShowEditDialog} orgId={lead.organizationId} />
    </>
  );
}
