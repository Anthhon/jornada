"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Skull, Sparkles } from "@/components/icons/rpg-icons";
import { cn } from "@/lib/utils";
import { Scroll } from "@/features/journey/components/ui";
import { EFFECT_SHORT_LABELS, TRIGGER_LABELS } from "@/features/bosses/constants/bosses-page";
import type { BossEffect, BossTrigger } from "@/features/bosses";
import { FloatingNumbers, useDeltaFloats } from "./float-number";
import { StatusBadge } from "./status-badge";
import type { ArenaState } from "../schemas/arena";

/** Arte dos chefes semeados (`seed_chefes`) — placeholders locais. */
const BOSS_ART: Record<string, string> = {
  "Mothman, o Sábio": "/personagens/mothman.jpg",
  "Rei Rato": "/personagens/rei-rato.jpg",
  Leshy: "/personagens/leshy.jpg",
  "A Sombra Espreitadora": "/personagens/sombra-espreitadora.jpg",
  "O Colecionador de Ossos": "/personagens/colecionador-de-ossos.jpg",
  "O Colecionador de Faces": "/personagens/colecionador-de-faces.jpg",
  "O Mago Corrompido": "/personagens/mago-corrompido.jpg",
};

/** Faixa horizontal dos números de PV no cartão do chefe (constante estável). */
const HP_SPREAD: readonly [number, number] = [18, 78];

/**
 * Cartão do chefe da rodada — composição do card da imagem
 * `Batalha contra o Vigia das Ruínas` (emblema, PV vermelho, arte) no tema
 * claro/parchment do site + as **habilidades executáveis** do chefe (ADR-017).
 */
export function BossCard({ state }: { state: ArenaState }) {
  const dealt = Math.max(0, state.max_hp - state.hp);
  const pct = state.max_hp > 0 ? Math.round((state.hp / state.max_hp) * 100) : 0;
  const art = BOSS_ART[state.boss.name];
  const [artFailed, setArtFailed] = useState(false);

  // Sacode a barra quando o chefe perde PV (mesmo efeito do HpBar da jornada).
  const prevHp = useRef(state.hp);
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (state.hp < prevHp.current) {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 340);
      prevHp.current = state.hp;
      return () => clearTimeout(timer);
    }
    prevHp.current = state.hp;
    return undefined;
  }, [state.hp]);

  // Números flutuantes: −PV vermelho ao levar dano, +PV verde ao curar (ADR-022).
  const hpFloats = useDeltaFloats(state.hp, HP_SPREAD);

  // Contagem de usos por habilidade do chefe nesta rodada (eventos estruturados).
  const usage = useMemo(() => {
    const counts = new Map<number, number>();
    for (const event of state.events) {
      if (event.kind === "ABILITY" && event.actor === "BOS" && event.ability_id != null) {
        counts.set(event.ability_id, (counts.get(event.ability_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [state.events]);
  const totalUsed = [...usage.values()].reduce((sum, n) => sum + n, 0);

  return (
    <Scroll className="flex flex-col">
      {/* Identidade: emblema + nome + status/nível */}
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-destructive/50 bg-destructive/10">
          <Skull className="h-6 w-6 text-destructive" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Chefe da rodada</p>
          <h2 className="truncate font-display text-xl text-foreground">{state.boss.name}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={state.status} />
          <span className="rounded bg-foreground px-2 py-0.5 font-display text-[0.7rem] font-semibold text-background">
            Nível {state.level}
          </span>
        </div>
      </div>

      {/* Barra de PV vermelha (padrão da imagem) */}
      <div className={cn("mt-3 flex items-center gap-2", shake && "hp-shake")}>
        <span className="rounded bg-foreground px-2 py-0.5 font-display text-[0.7rem] font-semibold uppercase tracking-wider text-background">
          PV
        </span>
        <div
          className="h-4 flex-1 overflow-hidden rounded-full border border-border bg-muted"
          role="meter" aria-valuenow={state.hp} aria-valuemax={state.max_hp} aria-valuemin={0}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-destructive/75 via-destructive to-destructive/90 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-display text-xs font-semibold text-foreground">
          {state.hp} / {state.max_hp}
        </span>
      </div>

      {/* Arte do chefe */}
      <div className="relative mt-3 h-44 w-full overflow-hidden rounded-md border border-border bg-muted">
        {art && !artFailed ? (
          <Image
            src={art} alt={state.boss.name} fill unoptimized
            className="object-cover" onError={() => setArtFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center" aria-hidden>
            <Skull className="h-14 w-14 text-muted-foreground/40" strokeWidth={1} />
          </div>
        )}
        {/* −dano / +cura subindo na tela (ADR-022) */}
        <FloatingNumbers items={hpFloats} />
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          {state.name} · turno {state.turn} · {dealt} de dano causado · {pct}% de PV restante
          {state.treasure > 0 && <> · saque {state.treasure} pts</>}
        </p>

        {/* Desfecho da raid (ADR-018): vitória rateia o saque, fuga escapa com ele */}
        {state.outcome === "VICTORY" && (
          <p className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 font-display text-sm text-success">
            Chefe derrotado! O saque foi conquistado.
          </p>
        )}
        {state.outcome === "RETREAT" && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 font-display text-sm text-destructive">
            O chefe escapou ferido com o saque! (chefe em fuga)
          </p>
        )}

        {/* Habilidades executáveis do chefe (ADR-017) + usos nesta rodada (ADR-022) */}
        {state.boss.abilities.length > 0 && (
          <ul className="space-y-1.5 border-t border-border pt-3">
            <li className="flex items-baseline justify-between gap-2 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              <span>Habilidades</span>
              {totalUsed > 0 && (
                <span className="flex items-center gap-1 normal-case tracking-normal text-accent-foreground">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {totalUsed} {totalUsed === 1 ? "usada" : "usadas"} nesta rodada
                </span>
              )}
            </li>
            {state.boss.abilities.map((ability) => {
              const count = usage.get(ability.id) ?? 0;
              return (
                <li
                  key={ability.id}
                  className={cn(
                    "rounded-md border bg-background px-3 py-2 transition-colors",
                    count > 0 ? "border-accent/50 bg-accent/5" : "border-border/60",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">{ability.name}</p>
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                      {TRIGGER_LABELS[ability.trigger as BossTrigger] ?? ability.trigger}
                    </span>
                    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[0.65rem] text-destructive">
                      {EFFECT_SHORT_LABELS[ability.effect as BossEffect] ?? ability.effect}
                    </span>
                    {count > 0 && (
                      <span className="ml-auto rounded-full border border-accent/50 bg-accent/15 px-2 py-0.5 font-display text-[0.65rem] font-semibold text-accent-foreground">
                        usadas ×{count}
                      </span>
                    )}
                  </div>
                  {ability.description && (
                    <p className="mt-1 font-reading text-xs leading-relaxed text-muted-foreground">
                      {ability.description}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Scroll>
  );
}
