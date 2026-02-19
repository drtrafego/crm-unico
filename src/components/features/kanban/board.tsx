"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { Column } from "./column";
import { Lead as LeadType, Column as ColumnType } from "@/server/db/schema";
import { updateLeadStatus, updateColumnOrder, createColumn } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CRMActionOverrides } from "@/types/crm-actions";

interface BoardProps {
  columns: ColumnType[];
  initialLeads: LeadType[];
  orgId: string;
  overrides?: CRMActionOverrides;
}

export function Board({ columns: initialColumns, initialLeads, orgId, overrides }: BoardProps) {
  const router = useRouter();
  const [columns, setColumns] = useState<ColumnType[]>(initialColumns);
  const [leads, setLeads] = useState<LeadType[]>(initialLeads);

  // Add Column State
  const [isCreateColumnOpen, setIsCreateColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);

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

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Move Columns
    if (type === "COLUMN") {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);

      setColumns(newColumns);

      ignoreExternalUpdatesRef.current = true;

      updateColumnOrderAction(newColumns.map(c => c.id), orgId)
        .then((response) => {
          if (response.columns) {
            setColumns(response.columns);
            router.refresh();
          }
        })
        .catch(err => {
          console.error("Failed to update column order:", err);
          setLastError(`Erro ao salvar ordem das colunas: ${err.message}`);
          ignoreExternalUpdatesRef.current = false;
        });
      return;
    }

    // Move Leads
    if (type === "LEAD") {
      const finishColumnId = destination.droppableId;

      // Note: We need to handle the lead movement locally first
      const movedLead = leads.find(l => l.id === draggableId);
      if (!movedLead) return;

      // Let's update the specific lead's column immediately for UI responsiveness
      const updatedLeads = leads.map(l =>
        l.id === draggableId ? { ...l, columnId: finishColumnId } : l
      );

      setLeads(updatedLeads);
      ignoreExternalUpdatesRef.current = true;

      // Allow the UI to settle, then call server
      // We need the NEW POSITION index in the destination column.
      // The `destination.index` gives us exactly that!
      updateLeadStatusAction(draggableId, finishColumnId, destination.index, orgId)
        .catch(err => {
          console.error("Failed to update lead status:", err);
          setLastError(`Erro ao salvar status do lead: ${err.message}`);
          ignoreExternalUpdatesRef.current = false;
        });
    }
  };

  const getLeadsByColumn = (columnId: string) => {
    // Sort by position to ensure correct order
    return leads
      .filter((lead) => lead.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  };

  async function handleCreateColumn() {
    if (!newColumnName.trim()) return;
    await createColumnAction(newColumnName, orgId);
    setNewColumnName("");
    setIsCreateColumnOpen(false);
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
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

        <Droppable droppableId="board" type="COLUMN" direction="horizontal">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex-1 flex gap-4 overflow-x-auto overflow-y-hidden px-4 pt-4 pb-4 items-start custom-scrollbar h-full"
            >
              {columns.map((col, index) => (
                <Column
                  key={col.id}
                  column={col}
                  leads={getLeadsByColumn(col.id)}
                  index={index}
                  orgId={orgId}
                  overrides={overrides}
                />
              ))}
              {provided.placeholder}

              <Dialog open={isCreateColumnOpen} onOpenChange={setIsCreateColumnOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-[50px] min-w-[300px] border-dashed border-2 hover:border-solid hover:bg-slate-50 dark:hover:bg-slate-900 shrink-0">
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
          )}
        </Droppable>
      </div>
    </DragDropContext>
  );
}
