"use client";

import { StudentForm } from "./student-form";
import { removeStudent } from "@/lib/catalog-mutations";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Confirm, EmptyState, PageState, Scroll } from "@/features/journey/components/ui";
import { useCatalogLoad } from "@/hooks/use-catalog-load";
import { useJornada } from "@/stores/journey-store";
import type { Student } from "@/features/students";
import { Pencil, Plus, Search, Trash2 } from "@/components/icons/rpg-icons";
import { useMemo, useState } from "react";
import { toast } from "sonner";



function Aventureiros() {
  const { status, retry } = useCatalogLoad();
  const { students, teams } = useJornada();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [del, setDel] = useState<Student | null>(null);
  const filtered = useMemo(() => students.filter((s) => `${s.name} ${s.registration}`.toLowerCase().includes(q.toLowerCase())), [students, q]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStudents = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const teamOf = (id: string) => teams.find((t) => t.memberIds.includes(id))?.name;

  return (
    <PageState status={status} retry={retry}>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[1.85rem] leading-tight text-foreground">Aventureiros</h1>
          <p className="mt-1.5 max-w-xl font-reading text-muted-foreground">Quem integra a guilda. Nome e matrícula de cada aventureiro.</p>
        </div>
        <div className="flex w-full flex-col items-start gap-3 lg:w-auto lg:flex-row lg:items-center">
          <Button onClick={() => setEditing("new")}><Plus /> Novo</Button>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" aria-label="Buscar aventureiros" placeholder="Buscar por nome ou matrícula" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title={q ? "Nenhum aventureiro encontrado" : "A guilda está vazia"} hint={q ? "Tente outra busca." : "Cadastre o primeiro aventureiro."} />
      ) : (
        <>
        <Scroll className="p-0">
          <ul className="divide-y divide-border">
            {pageStudents.map((s) => (
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
        {totalPages > 1 && (
          <nav aria-label="Paginação de aventureiros" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">Página {currentPage} de {totalPages} · {filtered.length} aventureiros</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
              <Button type="button" variant="outline" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
            </div>
          </nav>
        )}
        </>
      )}
      <StudentSheet value={editing} onClose={() => setEditing(null)} />
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir aventureiro?" description={`${del?.name} será removido da guilda e do seu grupo.`} confirmLabel="Excluir" destructive
        onConfirm={async () => { if (del && await removeStudent(del.id)) { toast.success("Aventureiro removido."); setDel(null); } }} />
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
