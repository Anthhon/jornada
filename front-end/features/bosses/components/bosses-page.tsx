"use client";

import { BossForm } from "./boss-form";
import { upsertBoss, removeBoss } from "@/lib/catalog-mutations";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Confirm, EmptyState, PageHeader, PageState, Scroll } from "@/features/journey/components/ui";
import { useCatalogLoad } from "@/hooks/use-catalog-load";
import { cn } from "@/lib/utils";
import { useJornada } from "@/stores/journey-store";
import type { Boss, BossSkill } from "@/features/bosses";
import { EFFECT_SHORT_LABELS, TRIGGER_LABELS } from "../constants/bosses-page";
import { Pencil, Plus, Skull, Trash2 } from "@/components/icons/rpg-icons";
import { useState } from "react";
import { toast } from "sonner";

/** Resumo executável da habilidade (valor + condição), como no card da raid. */
function skillParams(s: BossSkill): string {
  const parts: string[] = [];
  switch (s.effect) {
    case "PENALTY": parts.push(`−${s.value} Dano Base`); break;
    case "HEAL": parts.push(`+${s.value} PV`); break;
    case "DRAIN": parts.push(`${s.value} Dano Base → PV`); break;
    case "CUT": parts.push(`dano de ataque −${s.value}%`); break;
    case "DISADV": parts.push(`desvantagem −${s.value}%`); break;
    case "PR_COST": parts.push(`+${s.value} PR`); break;
  }
  if (s.trigger === "PERGUNTAS") {
    parts.push(`a cada ${s.every} erro${s.every === 1 ? "" : "s"}`);
  } else if (s.trigger !== "SUPORTE") {
    if (s.mode === "AVERAGE") parts.push(`média dos critérios < nota ${s.threshold}`);
    else if (s.mode === "SPREAD") parts.push(`variação das notas ≥ ${s.threshold}`);
    else if (s.threshold < 3) parts.push(`nota abaixo de ${s.threshold}`);
  }
  if (s.scope === "ALLIANCE") parts.push(`mín. ${s.min_count} equipe${s.min_count === 1 ? "" : "s"} afetada${s.min_count === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Cartão do chefe — composição do card de raid da imagem (PV vermelho,
 * emblema, arte) no tema claro/parchment do site. */
function BossCard({
  boss,
  onEdit,
  onDelete,
  onToggle,
}: {
  boss: Boss;
  onEdit: (boss: Boss) => void;
  onDelete: (boss: Boss) => void;
  onToggle: (boss: Boss, active: boolean) => void;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <Scroll className={cn("flex flex-col", !boss.active && "opacity-70")}>
      {/* Identidade (emblema + nome + selo), como no card da raid */}
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-destructive/50 bg-destructive/10">
          <Skull className="h-6 w-6 text-destructive" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            {boss.active ? "Chefe da jornada" : "Chefe fora do sorteio"}
          </p>
          <h3 className="truncate font-display text-xl text-foreground">{boss.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{boss.specialty}</p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button
            variant="ghost" size="icon"
            aria-label={`Editar ${boss.name}`} onClick={() => onEdit(boss)}
          ><Pencil /></Button>
          <Button
            variant="ghost" size="icon"
            aria-label={`Excluir ${boss.name}`} onClick={() => onDelete(boss)}
          ><Trash2 /></Button>
        </div>
      </div>

      {/* Barra de PV vermelha + chip (padrão da imagem) */}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded bg-foreground px-2 py-0.5 font-display text-[0.7rem] font-semibold uppercase tracking-wider text-background">
          PV
        </span>
        <div
          className="h-4 flex-1 overflow-hidden rounded-full border border-border bg-muted"
          role="meter" aria-valuenow={boss.hp} aria-valuemax={boss.hp} aria-valuemin={0}
        >
          <div className="h-full w-full rounded-full bg-gradient-to-r from-destructive/75 via-destructive to-destructive/90" />
        </div>
        <span className="font-display text-xs font-semibold text-foreground">
          {boss.hp} / {boss.hp}
        </span>
      </div>

      {/* Arte do chefe */}
      <div className="relative mt-3 h-44 w-full overflow-hidden rounded-md border border-border bg-muted">
        {boss.image && !failed ? (
          <Image
            src={boss.image} alt={boss.name} fill unoptimized
            className="object-cover" onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center" aria-hidden>
            <Skull className="h-14 w-14 text-muted-foreground/40" strokeWidth={1} />
          </div>
        )}
      </div>

      {/* Descrição + habilidades + sorteio */}
      <div className="mt-3 flex flex-1 flex-col gap-3">
        <p className="font-reading text-sm text-foreground">{boss.description}</p>

        <ul className="space-y-2 border-t border-border pt-3">
          {boss.skills.map((s, i) => (
            <li key={i} className="rounded-md border border-border/60 bg-background px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">{s.name}</p>
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                  {TRIGGER_LABELS[s.trigger]}
                </span>
                <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.65rem] text-destructive">
                  {EFFECT_SHORT_LABELS[s.effect]}
                </span>
              </div>
              <p className="mt-1 font-reading text-xs leading-relaxed text-muted-foreground">{s.description}</p>
              <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-muted-foreground/70">{skillParams(s)}</p>
            </li>
          ))}
        </ul>

        <label className="mt-auto flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground">
          <span>{boss.active ? "Ativo no sorteio" : "Fora do sorteio"}</span>
          <Switch checked={boss.active} onCheckedChange={(c) => onToggle(boss, c)} />
        </label>
      </div>
    </Scroll>
  );
}

function Chefes() {
  const { status, retry } = useCatalogLoad();
  const { bosses } = useJornada();
  const [editing, setEditing] = useState<Boss | "new" | null>(null);
  const [deleting, setDeleting] = useState<Boss | null>(null);

  return (
    <PageState status={status} retry={retry}>
      <PageHeader
        title="Chefes"
        description="O chefe não ataca: pune os pontos fracos da apresentação. Só os ativos entram no sorteio."
        action={<Button onClick={() => setEditing("new")}><Plus /> Novo chefe</Button>}
      />
      {bosses.length === 0 && <EmptyState title="Nenhum chefe cadastrado" hint="Cadastre o primeiro chefe." />}
      <div className="grid gap-6 md:grid-cols-2">
        {bosses.map((b) => (
          <BossCard
            key={b.id}
            boss={b}
            onEdit={setEditing}
            onDelete={setDeleting}
            onToggle={async (boss, active) => {
              if (await upsertBoss({ ...boss, active })) {
                toast.success(active ? `${boss.name} entra no sorteio.` : `${boss.name} sai do sorteio.`);
              }
            }}
          />
        ))}
      </div>
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">{editing === "new" ? "Novo chefe" : "Editar chefe"}</SheetTitle>
            <SheetDescription className="font-reading">Vida e habilidades punitivas com gatilhos executáveis.</SheetDescription>
          </SheetHeader>
          {editing && <BossForm key={editing === "new" ? "n" : editing.id} initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
      <Confirm
        open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir chefe?" description={deleting?.name ?? ""}
        confirmLabel="Excluir" destructive
        onConfirm={async () => {
          if (deleting && await removeBoss(deleting.id)) {
            toast.success("Chefe removido.");
            setDeleting(null);
          }
        }}
      />
    </PageState>
  );
}

export { Chefes as BossesPage };
