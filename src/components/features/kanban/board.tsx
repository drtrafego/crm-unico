"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  closestCorners,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { Column } from "./column";
import { LeadCard } from "./lead-card";
import { Lead, Column as ColumnType } from "@/server/db/schema";
import { updateLeadStatus, updateColumnOrder, createColumn } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const SENSORS_CONFIG = {
  activationConstraint: {
    distance: 5,
  },
};

import { CRMActionOverrides } from "@/types/crm-actions";

interface BoardProps {
  columns: ColumnType[];
  initialLeads: Lead[];
  onLeadsChange?: (leads: Lead[]) => void;
  orgId: string;
  overrides?: CRMActionOverrides;
}

export function Board({ columns: initialColumns, initialLeads, onLeadsChange, orgId, overrides }: BoardProps) {
  const router = useRouter();
  const [columns, setColumns] = useState<ColumnType[]>(initialColumns);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);

  const [activeColumn, setActiveColumn] = useState<ColumnType | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  // Add Column State
  const [isCreateColumnOpen, setIsCreateColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  // Actions
  const updateLeadStatusAction = overrides?.updateLeadStatus || updateLeadStatus;
  const updateColumnOrderAction = overrides?.updateColumnOrder || updateColumnOrder;
  const createColumnAction = overrides?.createColumn || createColumn;

  // Ref to track local updates and prevent race conditions from server revalidation
  const ignoreExternalUpdatesRef = useRef(false);

  useEffect(() => {
    if (ignoreExternalUpdatesRef.current) {
      const timer = setTimeout(() => {
        ignoreExternalUpdatesRef.current = false;
      }, 2000); // Ignore server updates for 2s after a local move
      return () => clearTimeout(timer);
    }
    setColumns(initialColumns);
  }, [initialColumns]);

  useEffect(() => {
    if (ignoreExternalUpdatesRef.current) return;
    setLeads(initialLeads);
  }, [initialLeads]);

  // Note: We don't use useEffect to notify parent of leads changes
  // because it would cause an infinite loop. Instead, we call onLeadsChange
  // directly in event handlers when needed.

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor)
  );

  const columnsId = useMemo(() => columns.map((col) => col.id), [columns]);

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Column") {
      setActiveColumn(event.active.data.current.column);
      return;
    }
    if (event.active.data.current?.type === "Lead") {
      setActiveLead(event.active.data.current.lead);
      return;
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const isActiveALead = active.data.current?.type === "Lead";
    const isOverALead = over.data.current?.type === "Lead";
    const isOverAColumn = over.data.current?.type === "Column";

    if (!isActiveALead) return;

    // Scenario 1: Dragging Lead over Lead
    if (isActiveALead && isOverALead) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        const overIndex = leads.findIndex((l) => l.id === overId);

        if (leads[activeIndex].columnId !== leads[overIndex].columnId) {
          const newLeads = [...leads];
          newLeads[activeIndex].columnId = leads[overIndex].columnId;
          return arrayMove(newLeads, activeIndex, overIndex - 1);
        }
        return leads;
      });
    }

    // Scenario 2: Dragging Lead over Column (empty or header)
    if (isActiveALead && isOverAColumn) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        const activeLead = leads[activeIndex];

        if (activeLead.columnId === overId) return leads;

        const newLeads = [...leads];
        newLeads[activeIndex].columnId = overId as string;
        return arrayMove(newLeads, activeIndex, activeIndex);
      });
    }
  }

  const [lastError, setLastError] = useState<string | null>(null);

  function onDragEnd(event: DragEndEvent) {
    setActiveColumn(null);
    setActiveLead(null);
    setLastError(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Moving Columns
    if (active.data.current?.type === "Column") {
      if (activeId !== overId) {
        setColumns((columns) => {
          const oldIndex = columns.findIndex((col) => col.id === activeId);
          const newIndex = columns.findIndex((col) => col.id === overId);
          const newOrder = arrayMove(columns, oldIndex, newIndex);

          // Set ignore flag BEFORE calling server action to prevent race condition
          ignoreExternalUpdatesRef.current = true;
          console.log("[Board] Sending new column order:", newOrder.map(c => c.id));

          // Call server action and handle potential errors
          updateColumnOrderAction(newOrder.map(c => c.id), orgId)
            .then((response) => {
              console.log("[Board] Column order saved successfully");
              if (response.columns) {
                // Authoritatively update local state with server-verified order
                setColumns(response.columns);
                // Force router refresh to clear Next.js client router cache
                router.refresh();
              }
            })
            .catch(err => {
              console.error("Failed to update column order:", err);
              setLastError(`Erro ao salvar ordem das colunas: ${err.message}`);
              ignoreExternalUpdatesRef.current = false;
            });

          return newOrder;
        });
      }
      return;
    }

    // Moving Leads
    if (active.data.current?.type === "Lead") {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        const overIndex = leads.findIndex((l) => l.id === overId);

        const newOrderedLeads = arrayMove(leads, activeIndex, overIndex);
        const movedLead = newOrderedLeads[overIndex];

        const columnLeads = newOrderedLeads.filter(l => l.columnId === movedLead.columnId);
        const newPosition = columnLeads.findIndex(l => l.id === movedLead.id);

        // Set ignore flag BEFORE calling server action
        ignoreExternalUpdatesRef.current = true;

        // Note: Parent is notified via useEffect watching 'leads' state

        updateLeadStatusAction(movedLead.id, movedLead.columnId!, newPosition, orgId)
          .catch(err => {
            console.error("Failed to update lead status:", err);
            setLastError(`Erro ao salvar status do lead: ${err.message}`);
            ignoreExternalUpdatesRef.current = false;
          });

        return newOrderedLeads;
      });
    }
  }

  const getLeadsByColumn = (columnId: string) => {
    return leads.filter((lead) => lead.columnId === columnId);
  };

  async function handleCreateColumn() {
    if (!newColumnName.trim()) return;
    await createColumnAction(newColumnName, orgId);
    setNewColumnName("");
    setIsCreateColumnOpen(false);
  }

  return (
    <DndContext
      id="kanban-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex flex-col h-full">
        {lastError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded relative mb-2 mx-4" role="alert">
            <strong className="font-bold">Erro! </strong>
            <span className="block sm:inline">{lastError}</span>
            <span className="absolute top-0 bottom-0 right-0 px-4 py-2" onClick={() => setLastError(null)}>
              <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z" /></svg>
            </span>
          </div>
        )}
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 pt-4 pb-4 items-start custom-scrollbar">
          <SortableContext items={columnsId} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => (
              <Column
                key={col.id}
                column={col}
                leads={getLeadsByColumn(col.id)}
                orgId={orgId}
                overrides={overrides}
              />
            ))}
          </SortableContext>

          <Dialog open={isCreateColumnOpen} onOpenChange={setIsCreateColumnOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-[50px] min-w-[300px] border-dashed border-2 hover:border-solid hover:bg-slate-50 dark:hover:bg-slate-900">
                <PlusIcon className="mr-2 h-4 w-4" />
                Adicionar Coluna
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Coluna</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome da Coluna</Label>
                  <Input id="name" value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="Ex: Aguardando Resposta" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateColumn}>Criar Coluna</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <DragOverlay>
          {activeColumn && (
            <div className="opacity-80 rotate-2 cursor-grabbing">
              <Column column={activeColumn} leads={getLeadsByColumn(activeColumn.id)} orgId={orgId} overrides={overrides} />
            </div>
          )}
          {activeLead && (
            <div className="opacity-80 rotate-2 cursor-grabbing">
              <LeadCard lead={activeLead} />
            </div>
          )}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
