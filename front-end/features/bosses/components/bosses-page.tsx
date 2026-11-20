"use client";

import { BossForm } from "./boss-form";


import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { HpBar, PageHeader, PageState, Scroll } from "@/features/journey/components/ui";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { cn } from "@/lib/utils";
import { useJornada } from "@/stores/journey-store";
import type { Boss } from "@/features/bosses";
import { Pencil, Plus, Skull } from "@/components/icons/rpg-icons";
import { useState } from "react";
import { toast } from "sonner";




function Chefes() {
  const { status, retry } = useSimulatedLoad();
  const { bosses, upsertBoss } = useJornada();
  const [editing, setEditing] = useState<Boss | "new" | null>(null);

  return (
    <PageState status={status} retry={retry}>
      <PageHeader title="Chefes" description="O chefe não ataca: pune os pontos fracos da apresentação. Só os ativos entram no sorteio." action={<Button onClick={() => setEditing("new")}><Plus /> Novo chefe</Button>} />
      <div className="grid gap-6 md:grid-cols-2">
        {bosses.map((b) => (
          <Scroll key={b.id} className={cn("flex flex-col gap-4 p-6 transition-opacity", !b.active && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-destructive/50 bg-destructive/10"><Skull className="h-5 w-5 text-destructive" strokeWidth={1.5} /></div>
                <div>
                  <h3 className="text-xl leading-tight">{b.name}</h3>
                  <p className="text-xs text-muted-foreground">{b.specialty}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Editar ${b.name}`} onClick={() => setEditing(b)}><Pencil /></Button>
            </div>
            <p className="font-reading text-sm">{b.description}</p>
            <HpBar hp={b.hp} max={b.hp} />
            <ul className="space-y-2.5 border-t border-border pt-3">
              {b.skills.map((s, i) => (
                <li key={i}>
                  <p className="text-sm"><span className="font-display font-semibold">{s.name}</span> <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-[0.7rem] text-muted-foreground">{s.trigger}</span></p>
                  <p className="font-reading text-xs leading-relaxed text-muted-foreground">{s.effect}</p>
                </li>
              ))}
            </ul>
            <label className="mt-auto flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
              <span>{b.active ? "Ativo no sorteio" : "Fora do sorteio"}</span>
              <Switch checked={b.active} onCheckedChange={(c) => { upsertBoss({ ...b, active: c }); toast.success(c ? `${b.name} entra no sorteio.` : `${b.name} sai do sorteio.`); }} />
            </label>
          </Scroll>
        ))}
      </div>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">{editing === "new" ? "Novo chefe" : "Editar chefe"}</SheetTitle>
            <SheetDescription className="font-reading">Vida e habilidades punitivas.</SheetDescription>
          </SheetHeader>
          {editing && <BossForm key={editing === "new" ? "n" : editing.id} initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
    </PageState>
  );
}



export { Chefes as BossesPage };
