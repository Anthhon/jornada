"use client";

import { TeamForm } from "./team-form";
import { removeTeam, upsertTeam } from "@/lib/catalog-mutations";


import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Confirm, EmptyState, PageHeader, PageState, Scroll, selectClass } from "@/features/journey/components/ui";
import { useCatalogLoad } from "@/hooks/use-catalog-load";
import { useJornada } from "@/stores/journey-store";
import type { Team } from "@/features/groups";
import { Pencil, Plus, Trash2 } from "@/components/icons/rpg-icons";
import { useState } from "react";
import { toast } from "sonner";



function Grupos() {
  const { status, retry } = useCatalogLoad();
  const { teams, students } = useJornada();
  const unassigned = students.filter((student) => !teams.some((team) => team.memberIds.includes(student.id)));
  const [editing, setEditing] = useState<Team | "new" | null>(null);
  const [del, setDel] = useState<Team | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState("");
  const assigningStudent = students.find((student) => student.id === assigning);

  return (
    <PageState status={status} retry={retry}>
      <PageHeader title="Grupos" description="Organize grupos e seus aventureiros." action={<Button onClick={() => setEditing("new")}><Plus /> Novo grupo</Button>} />
      {teams.length === 0 ? (
        <EmptyState title="Nenhum grupo formado" hint="Reúna aventureiros em grupos para partir em missões." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            return (
              <Scroll key={t.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.memberIds.length} membros</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Letra</p>
                    <p className="font-display text-base font-semibold">{t.letter || "Não informada"}</p>
                  </div>
                </div>
                <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
                  {t.memberIds.map((m) => {
                    const s = students.find((x) => x["id"] === m);
                    return (
                      <li key={m} className="break-words">
                        <span>{s?.name ?? "Aventureiro indisponível"}</span>{s && <span className="text-muted-foreground"> · Matrícula {s.registration}</span>}
                      </li>
                    );
                  })}
                  {t.memberIds.length === 0 && <li className="font-reading text-muted-foreground">Sem membros.</li>}
                </ul>
                <div className="mt-auto flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditing(t)}><Pencil /> Editar</Button>
                  <Button variant="ghost" size="icon" aria-label="Excluir" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDel(t)}><Trash2 /></Button>
                </div>
              </Scroll>
            );
          })}
        </div>
      )}
      <section aria-labelledby="unassigned-title" className="mt-8">
        <h2 id="unassigned-title" className="text-xl">Aventureiros sem grupo</h2>
        {unassigned.length === 0 ? (
          <p className="mt-3 font-reading text-sm text-muted-foreground">Nenhum aventureiro sem grupo.</p>
        ) : (
          <Scroll className="mt-3 p-0">
            <ul className="divide-y divide-border">
              {unassigned.map((student) => (
                <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0 break-words"><span className="font-medium">{student.name}</span><span className="text-sm text-muted-foreground"> · Matrícula {student.registration}</span></span>
                  <Button type="button" variant="outline" disabled={teams.length === 0} onClick={() => { setSelectedTeam(""); setAssigning(student.id); }} aria-label={`Adicionar ${student.name} a um grupo`}>Adicionar ao grupo</Button>
                </li>
              ))}
            </ul>
          </Scroll>
        )}
        {unassigned.length > 0 && teams.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Crie um grupo para adicionar aventureiros.</p>}
      </section>
      <Sheet open={!!assigning} onOpenChange={(open) => { if (!open) { setAssigning(null); setSelectedTeam(""); } }}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">Adicionar ao grupo</SheetTitle>
            <SheetDescription className="font-reading">Escolha um grupo para {assigningStudent?.name}.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <label htmlFor="assign-team" className="block text-sm font-medium">Grupo</label>
            <select id="assign-team" className={selectClass} value={selectedTeam} onChange={(event) => setSelectedTeam(event.target.value)}>
              <option value="">Selecione um grupo…</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.letter ? ` (${team.letter})` : ""}</option>)}
            </select>
            <Button type="button" disabled={!selectedTeam || !assigningStudent} onClick={async () => {
              const team = teams.find((item) => item.id === selectedTeam);
              if (!team || !assigningStudent || !unassigned.some((student) => student.id === assigningStudent.id)) return;
              if (!await upsertTeam({ ...team, memberIds: [...team.memberIds, assigningStudent.id] })) return;
              toast.success("Aventureiro adicionado ao grupo.");
              setAssigning(null);
              setSelectedTeam("");
            }}>Adicionar</Button>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">{editing === "new" ? "Novo grupo" : "Editar grupo"}</SheetTitle>
            <SheetDescription className="font-reading">Membros e pontos extras individuais.</SheetDescription>
          </SheetHeader>
          {editing && <TeamForm key={editing === "new" ? "n" : editing.id} initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir grupo?" description={`O grupo ${del?.name} será desfeito. Os aventureiros continuam na guilda.`} confirmLabel="Excluir" destructive
        onConfirm={async () => { if (del && await removeTeam(del.id)) { toast.success("Grupo desfeito."); setDel(null); } }} />
    </PageState>
  );
}



export { Grupos as GroupsPage };
