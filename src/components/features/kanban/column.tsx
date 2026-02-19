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
            "w-[300px] min-w-[300px] flex flex-col bg-slate-100/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50 transition-colors",
            isDeleting && "opacity-50 pointer-events-none",
            snapshot.isDragging && "opacity-80 rotate-2 shadow-xl ring-2 ring-indigo-500/20"
          )}
        >
          {/* Header */}
          <div
            {...provided.dragHandleProps}
            className={cn(
              "p-3 font-semibold cursor-grab active:cursor-grabbing sticky top-0 z-10 bg-inherit rounded-t-xl backdrop-blur-sm",
              isEditing && "cursor-default"
            )}
          >
            {isEditing ? (
              <div className="flex items-center gap-2 w-full">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateTitle();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={handleUpdateTitle}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{column.title}</span>
                  <span className="bg-slate-200 text-slate-600 px-2 rounded-full text-xs font-medium">
                    {leads.length}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
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
                  "p-2 flex-1 min-h-[100px] transition-colors",
                  snapshot.isDraggingOver && "bg-slate-200/50 dark:bg-slate-700/50 rounded-b-xl"
                )}
              >
                <div className="flex flex-col gap-3 pb-2">
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
