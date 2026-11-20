"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Skull } from "@/components/icons/rpg-icons";
import { cn } from "@/lib/utils";
import { EFFECT_SHORT_LABELS, TRIGGER_LABELS } from "@/features/bosses/constants/bosses-page";
import type { BossEffect, BossTrigger } from "@/features/bosses";
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

/**
 * Cartão do chefe da rodada — visual forte no card da imagem
 * `Batalha contra o Vigia das Ruínas` (fundo escuro, emblema, PV vermelho,
 * arte) + as **habilidades executáveis** do chefe (ADR-017).
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

  return (
    <article className="overflow-hidden rounded-xl border border-border-strong/50 bg-guild-stone text-guild-ink shadow-[var(--guild-shadow)]">
      {/* Identidade: emblema + nome + status/nível */}
      <div className="flex items-start gap-3 px-4 pt-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-destructive/60 bg-destructive/15">
          <Skull className="h-6 w-6 text-destructive" strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] uppercase tracking-widest text-guild-ink/60">Chefe da rodada</p>
          <h2 className="truncate font-display text-xl text-white">{state.boss.name}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={state.status} />
          <span className="rounded bg-black/50 px-2 py-0.5 font-display text-[0.7rem] font-semibold text-white/90">
            Nível {state.level}
          </span>
        </div>
      </div>

      {/* Barra de PV vermelha (padrão da imagem) */}
      <div className={cn("mt-3 flex items-center gap-2 px-4", shake && "hp-shake")}>
        <span className="rounded bg-black/50 px-2 py-0.5 font-display text-[0.7rem] font-semibold uppercase tracking-wider text-white/90">
          PV
        </span>
        <div
          className="h-4 flex-1 overflow-hidden rounded-full border border-black/40 bg-black/50"
          role="meter" aria-valuenow={state.hp} aria-valuemax={state.max_hp} aria-valuemin={0}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-destructive/75 via-destructive to-destructive/90 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-display text-xs font-semibold text-white/90">
          {state.hp} / {state.max_hp}
        </span>
      </div>

      {/* Arte do chefe */}
      <div className="relative mt-3 h-44 w-full bg-black/30">
        {art && !artFailed ? (
          <Image
            src={art} alt={state.boss.name} fill unoptimized
            className="object-cover" onError={() => setArtFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center" aria-hidden>
            <Skull className="h-14 w-14 text-white/20" strokeWidth={1} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        <p className="text-xs text-guild-ink/60">
          {state.name} · turno {state.turn} · {dealt} de dano causado · {pct}% de PV restante
        </p>

        {/* Habilidades executáveis do chefe (ADR-017) */}
        {state.boss.abilities.length > 0 && (
          <ul className="space-y-1.5 border-t border-white/10 pt-3">
            <li className="text-[0.65rem] uppercase tracking-widest text-guild-ink/60">Habilidades</li>
            {state.boss.abilities.map((ability) => (
              <li key={ability.id} className="rounded-md border border-white/10 bg-black/25 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-white">{ability.name}</p>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.65rem] text-guild-ink/80">
                    {TRIGGER_LABELS[ability.trigger as BossTrigger] ?? ability.trigger}
                  </span>
                  <span className="rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[0.65rem] text-destructive">
                    {EFFECT_SHORT_LABELS[ability.effect as BossEffect] ?? ability.effect}
                  </span>
                </div>
                {ability.description && (
                  <p className="mt-1 font-reading text-xs leading-relaxed text-guild-ink/70">
                    {ability.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
