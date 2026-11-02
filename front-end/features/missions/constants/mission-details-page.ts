import type { CriterionScore } from "@/features/missions";
import type { TurnEffect } from "@/features/missions";
export const EFFECT_LABEL: Record<TurnEffect, string> = { dano: "Dano", cura: "Cura", escudo: "Escudo", penalidade: "Penalidade" };
export const SCORE_OPTS: { v: CriterionScore; label: string }[] = [
  { v: 3, label: "Bom (3)" },
  { v: 1, label: "Parcial (1)" },
  { v: -1, label: "Ausente (−1)" },
];
