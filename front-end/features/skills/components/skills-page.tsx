"use client";

import { SkillForm } from "./skill-form";


import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SkillCard } from "@/features/journey/components/skill-card";
import { Confirm, EmptyState, PageHeader, PageState } from "@/features/journey/components/ui";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { useJornada } from "@/stores/journey-store";
import type { Skill } from "@/features/skills";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";



function Habilidades() {
  const { status, retry } = useSimulatedLoad();
  const { skills, heroes, removeSkill } = useJornada();
  const [editing, setEditing] = useState<Skill | "new" | null>(null);
  const [del, setDel] = useState<Skill | null>(null);
  const owner = (id: string) => heroes.filter((h) => h.skillIds.includes(id)).map((h) => h.name).join(", ");

  return (
    <PageState status={status} retry={retry}>
      <PageHeader title="Habilidades" description="Cada carta custa 2, 3 ou 5 pontos de recurso, ganhos nas perguntas." action={<Button onClick={() => setEditing("new")}><Plus /> Nova habilidade</Button>} />
      {skills.length === 0 ? (
        <EmptyState title="O grimório está vazio" hint="Crie habilidades e atribua-as aos heróis." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((s) => (
            <SkillCard key={s.id} skill={s}>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
                <span className="text-xs text-muted-foreground">{owner(s.id) || "Sem herói"}</span>
                <div className="flex">
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Editar" onClick={() => setEditing(s)}><Pencil /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir" onClick={() => setDel(s)}><Trash2 /></Button>
                </div>
              </div>
            </SkillCard>
          ))}
        </div>
      )}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">{editing === "new" ? "Nova habilidade" : "Editar habilidade"}</SheetTitle>
            <SheetDescription className="font-reading">Dados no formato XdY, por exemplo 2d10 ou 1d12+5.</SheetDescription>
          </SheetHeader>
          {editing && <SkillForm key={editing === "new" ? "n" : editing.id} initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Excluir habilidade?" description={`${del?.name} será removida do grimório e dos heróis.`} confirmLabel="Excluir" destructive
        onConfirm={() => { if (del) { removeSkill(del.id); toast.success("Habilidade removida."); } setDel(null); }} />
    </PageState>
  );
}



export { Habilidades as SkillsPage };
