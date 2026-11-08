"use client";

import { TeamForm } from "./team-form";


import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Confirm, EmptyState, PageHeader, PageState, Scroll } from "@/features/journey/components/ui";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { teamGrade } from "@/lib/journey/rules";
import { useJornada } from "@/stores/journey-store";
import type { Team } from "@/features/groups";
import { Pencil, Plus, Trash2 } from "@/components/icons/rpg-icons";
import { useState } from "react";
import { toast } from "sonner";



function Grupos() {
  const { status, retry } = useSimulatedLoad();
  const { teams, students, incursions, removeTeam } = useJornada();
  const [editing, setEditing] = useState<Team | "new" | null>(null);
  const [del, setDel] = useState<Team | null>(null);

  return (
    <PageState status={status} retry={retry}>
      <PageHeader title="Grupos" description="A nota do grupo (AP1) é a média das missões com bônus por vitórias." action={<Button onClick={() => setEditing("new")}><Plus /> Novo grupo</Button>} />
      {teams.length === 0 ? (
        <EmptyState title="Nenhum grupo formado" hint="Reúna aventureiros em grupos para partir em missões." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const g = teamGrade(t.id, incursions);
            return (
              <Scroll key={t.id} className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.memberIds.length} membros</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">AP1</p>
                    <p className="font-display text-2xl font-semibold">{g === null ? "—" : g.toFixed(1)}</p>
                  </div>
                </div>
                <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
                  {t.memberIds.map((m) => {
                    const s = students.find((x) => x["id"] === m);
                    const extra = t.extraPoints[m] ?? 0;
                    const ind = g === null ? null : Math.min(10, g + extra);
                    return (
                      <li key={m} className="flex justify-between">
                        <span>{s?.name}</span>
                        <span className="text-muted-foreground">{ind === null ? "—" : ind.toFixed(1)}{extra ? <span className="ml-1 text-xs text-accent-foreground">(+{extra})</span> : null}</span>
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
        onConfirm={() => { if (del) { removeTeam(del.id); toast.success("Grupo desfeito."); } setDel(null); }} />
    </PageState>
  );
}



export { Grupos as GroupsPage };
