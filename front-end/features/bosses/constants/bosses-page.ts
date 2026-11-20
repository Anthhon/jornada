import type { BossEffect, BossMode, BossScope, BossTrigger } from "@/features/bosses";

export const TRIGGERS: BossTrigger[] = [
  "TEMPO",
  "CONCEITO",
  "FUNDAMENTOS",
  "DEMONSTRACAO",
  "SUPORTE",
  "GERAL",
  "PERGUNTAS",
];

export const TRIGGER_LABELS: Record<BossTrigger, string> = {
  TEMPO: "Tempo",
  CONCEITO: "Conceito",
  FUNDAMENTOS: "Fundamentos",
  DEMONSTRACAO: "Demonstração",
  SUPORTE: "Suporte",
  GERAL: "Geral",
  PERGUNTAS: "Perguntas",
};

export const EFFECTS: BossEffect[] = ["PENALTY", "HEAL", "DRAIN", "CUT", "DISADV", "PR_COST"];

export const EFFECT_LABELS: Record<BossEffect, string> = {
  PENALTY: "Penalidade (Dano Base)",
  HEAL: "Cura do chefe (PV)",
  DRAIN: "Drenagem (Dano Base → PV)",
  CUT: "Corte de dano (%)",
  DISADV: "Desvantagem no dano (%)",
  PR_COST: "Custo de PR (informativo)",
};

/** Rótulo curto (chips do card). */
export const EFFECT_SHORT_LABELS: Record<BossEffect, string> = {
  PENALTY: "Penalidade",
  HEAL: "Cura",
  DRAIN: "Drenagem",
  CUT: "Corte",
  DISADV: "Desvantagem",
  PR_COST: "PR",
};

export const MODES: BossMode[] = ["ANY", "AVERAGE", "SPREAD"];

export const MODE_LABELS: Record<BossMode, string> = {
  ANY: "Algum critério abaixo",
  AVERAGE: "Média abaixo",
  SPREAD: "Notas variadas",
};

export const SCOPES: BossScope[] = ["TEAM", "ALLIANCE"];

export const SCOPES_LABELS: Record<BossScope, string> = {
  TEAM: "Equipe afetada",
  ALLIANCE: "Aliança (mín. de equipes)",
};
