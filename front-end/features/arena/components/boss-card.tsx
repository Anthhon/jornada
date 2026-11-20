import { HpBar, Scroll } from "@/features/journey/components/ui";
import { Skull } from "@/components/icons/rpg-icons";
import { StatusBadge } from "./status-badge";
import type { ArenaState } from "../schemas/arena";

/** Cartão do chefe: identidade, nível, PV compartilhado e status da rodada. */
export function BossCard({ state }: { state: ArenaState }) {
  const dealt = Math.max(0, state.max_hp - state.hp);
  const pct = state.max_hp > 0 ? Math.round((state.hp / state.max_hp) * 100) : 0;

  return (
    <Scroll className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
            <Skull className="h-6 w-6 text-destructive" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Chefe da rodada</p>
            <h2 className="truncate font-display text-xl leading-tight">{state.boss.name}</h2>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={state.status} />
          <span className="font-display text-xs text-muted-foreground">Nível {state.level}</span>
        </div>
      </div>

      <HpBar hp={state.hp} max={state.max_hp} />

      <p className="text-xs text-muted-foreground">
        {state.name} · turno {state.turn} · {dealt} de dano causado · {pct}% de PV restante
      </p>
    </Scroll>
  );
}
