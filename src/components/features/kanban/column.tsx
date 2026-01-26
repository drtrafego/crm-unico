"use client";

import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import { LeadCard } from "./lead-card";
import { cn } from "@/lib/utils";
import { Column as ColumnType, Lead } from "@/server/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, MoreHorizontal, Pencil, Trash2, GripVertical } from "lucide-react";
import { updateColumn, deleteColumn } from "@/server/actions/leads";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { CRMActionOverrides } from "@/types/crm-actions";

interface ColumnProps {
  column: ColumnType;
  leads: Lead[];
  orgId: string;
  overrides?: CRMActionOverrides;
}

export function Column({ column, leads, orgId, overrides }: ColumnProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: "Column", column },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const leadsIds = useMemo(() => leads.map((l) => l.id), [leads]);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const isDefault = column.title === "Novos Leads";
  const [isDeleting, setIsDeleting] = useState(false);

  // Actions
  const updateColumnAction = overrides?.updateColumn || updateColumn;
  const deleteColumnAction = overrides?.deleteColumn || deleteColumn;

  async function handleSave() {
    if (!editTitle.trim() || editTitle === column.title) {
      setIsEditing(false);
      return;
    }
    await updateColumnAction(column.id, editTitle, orgId);
    setIsEditing(false);
  }

  async function handleDelete() {
    if (isDefault) return;
    setIsDeleting(true);
    try {
      await deleteColumnAction(column.id, orgId);
    } catch (error) {
      setIsDeleting(false);
    }
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="w-[300px] min-w-[300px] h-[500px] bg-slate-100/50 border-2 border-dashed border-slate-300 rounded-xl opacity-50"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-[300px] min-w-[300px] flex flex-col h-fit max-h-none bg-slate-100/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50",
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >
      {/* Header */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "p-3 pb-2 flex items-center justify-between group cursor-grab active:cursor-grabbing sticky top-0 z-10 bg-inherit rounded-t-xl backdrop-blur-sm",
          isEditing && "cursor-default"
        )}
      >
        {isEditing ? (
          <div className="flex items-center gap-2 w-full">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 text-sm">
              <GripVertical className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              {column.title}
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium">
                {leads.length}
              </span>
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 transition-opacity"
                  onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on menu click
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white dark:bg-slate-950 shadow-xl border border-slate-200 dark:border-slate-800 z-50">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Renomear
                </DropdownMenuItem>
                {!isDefault && (
                  <DropdownMenuItem className="text-red-600" onClick={handleDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Cards Area */}
      <div className="flex-1 p-2">
        <div className="min-h-[50px]">
          <SortableContext items={leadsIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3 pb-2">
              {leads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>
          </SortableContext>
        </div>
      </div>
    </div>
  );
}
