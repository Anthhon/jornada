"use client";

import { StudentForm } from "./student-form";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Confirm, EmptyState, PageHeader, PageState, Scroll } from "@/features/journey/components/ui";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { useJornada } from "@/stores/journey-store";
import type { Student } from "@/features/students";
import { Pencil, Plus, Search, Trash2 } from "@/components/icons/rpg-icons";
import { useMemo, useState } from "react";
import { toast } from "sonner";



function Aventureiros() {
  const { status, retry } = useSimulatedLoad();
  const { students, teams, removeStudent } = useJornada();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [del, setDel] = useState<Student | null>(null);
  const filtered = useMemo(() => students.filter((s) => `${s.name} ${s.registration}`.toLowerCase().includes(q.toLowerCase())), [students, q]);
  const teamOf = (id: string) => teams.find((t) => t.memberIds.includes(id))?.name;

  return (
    <PageState status={status} retry={retry}>
      <PageHeader
        title="Aventureiros"
        description="Quem integra a guilda. Nome e matrícula de cada aventureiro."
        action={<Button onClick={() => setEditing("new")}><Plus /> Novo</Button>}
      />
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" aria-label="Buscar aventureiros" placeholder="Buscar por nome ou matrícula" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={q ? "Nenhum aventureiro encontrado" : "A guilda está vazia"} hint={q ? "Tente outra busca." : "Cadastre o primeiro aventureiro."} />
      ) : (
        <Scroll className="p-0">
          <ul className="divide-y divide-border">
            {filtered.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="break-words text-xs text-muted-foreground">Matrícula {s.registration} · {teamOf(s.id) ?? "sem grupo"}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(s)}><Pencil /></Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDel(s)}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        </Scroll>
      )}
      <StudentSheet value={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir aventureiro?" description={`${del?.name} será removido da guilda e do seu grupo.`} confirmLabel="Excluir" destructive
        onConfirm={() => { if (del) { removeStudent(del.id); toast.success("Aventureiro removido."); } setDel(null); }} />
    </PageState>
  );
}

function StudentSheet({ value, onClose }: { value: Student | "new" | null; onClose: () => void }) {
  return (
    <Sheet open={!!value} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">{value === "new" ? "Novo aventureiro" : "Editar aventureiro"}</SheetTitle>
          <SheetDescription className="font-reading">Identificação do aventureiro.</SheetDescription>
        </SheetHeader>
        {value && <StudentForm key={value === "new" ? "new" : value.id} initial={value === "new" ? null : value} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}




export { Aventureiros as StudentsPage };
