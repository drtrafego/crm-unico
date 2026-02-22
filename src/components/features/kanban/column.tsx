"use client";

import { useState } from "react";
import { Droppable, Draggable, DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from "@hello-pangea/dnd";
import { LeadCard } from "./lead-card";
import { cn } from "@/lib/utils";
import { Column as ColumnType, Lead } from "@/server/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { updateColumn, deleteColumn } from "@/server/actions/leads";
import { useRouter } from "next/navigation";

interface ColumnProps {
  column: ColumnType;
  leads: Lead[];
  index: number;
  orgId: string;
  overrides?: {
    updateColumn?: typeof updateColumn;
    deleteColumn?: typeof deleteColumn;
  };
}

export function Column({ column, leads, index, orgId, overrides }: ColumnProps) {
  const router = useRouter();
  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(column.title);
  const isDefault = column.title === "Novos Leads";
  const [isDeleting, setIsDeleting] = useState(false);

  // Actions
  const updateColumnAction = overrides?.updateColumn || updateColumn;
  const deleteColumnAction = overrides?.deleteColumn || deleteColumn;

  const handleUpdateTitle = async () => {
    if (newTitle === column.title) {
      setIsEditing(false);
      return;
    }
    try {
      await updateColumnAction(column.id, newTitle, orgId);
      setIsEditing(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to update column title:", err);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir esta coluna e mover todos os leads para a primeira coluna disponível?")) return;
    setIsDeleting(true);
    try {
      await deleteColumnAction(column.id, orgId);
      router.refresh();
    } catch (err) {
      console.error("Failed to delete column:", err);
      setIsDeleting(false);
    }
  };

  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "w-[340px] min-w-[340px] flex flex-col rounded-3xl transition-all duration-500 shrink-0 h-fit",
            "bg-slate-950/20 backdrop-blur-xl border border-white/5 shadow-2xl",
            isDeleting && "opacity-50 pointer-events-none",
            snapshot.isDragging && "opacity-90 rotate-2 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] ring-2 ring-indigo-500/20 bg-slate-900/40"
          )}
        >
          {/* Header */}
          <div
            {...provided.dragHandleProps}
            className={cn(
              "p-5 cursor-grab active:cursor-grabbing sticky top-0 z-20 bg-slate-900/40 backdrop-blur-md border-b border-white/5 rounded-t-3xl",
              isEditing && "cursor-default"
            )}
          >
            {isEditing ? (
              <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in duration-300">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-9 text-xs font-bold bg-slate-900/50 border-white/10 text-white rounded-xl focus:ring-indigo-500/50"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateTitle();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-9 w-9 text-emerald-400 hover:bg-emerald-500/20" onClick={handleUpdateTitle}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-rose-400 hover:bg-rose-500/20" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-widest text-white/90">{column.title}</span>
                  <span className="bg-white/10 text-white/60 px-2.5 py-0.5 rounded-full text-[10px] font-black border border-white/5 shadow-inner">
                    {leads.length}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/30 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                      onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on menu click
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-3xl z-50 rounded-2xl p-1.5">
                    <DropdownMenuItem
                      onClick={() => setIsEditing(true)}
                      className="rounded-xl font-bold text-xs uppercase tracking-widest focus:bg-white/10 focus:text-white py-2"
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Renomear
                    </DropdownMenuItem>
                    {!isDefault && (
                      <DropdownMenuItem
                        className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/20 rounded-xl font-bold text-xs uppercase tracking-widest py-2"
                        onClick={handleDelete}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Excluir
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Cards Area */}
          <Droppable droppableId={column.id} type="LEAD">
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "p-3 flex-1 transition-all duration-300",
                  snapshot.isDraggingOver && "bg-white/5 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)]"
                )}
              >
                <div className="flex flex-col gap-1 pb-4">
                  {leads.map((lead, index) => (
                    <LeadCard key={lead.id} lead={lead} index={index} />
                  ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
}
