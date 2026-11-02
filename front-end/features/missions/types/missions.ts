import type { CRITERIA } from "@/constants/evaluation";
export type CriterionKey = (typeof CRITERIA)[number]["key"];

export type CriterionScore = 3 | 1 | -1;

export interface Evaluation {
  criteria: Record<CriterionKey, CriterionScore>;
  correct: number;
}

export interface IncursionTeam {
  teamId: string;
  language: string;
  heroId: string | null;
  evaluation: Evaluation | null;
}

export type StageStatus = "aguardando" | "andamento" | "concluida";

export interface Stage {
  level: number;
  name: string;
  responsibleTeamId: string | null;
  status: StageStatus;
  startedAt: string | null;
  endedAt: string | null;
}

export type TurnEffect = "dano" | "cura" | "escudo" | "penalidade";

export interface Turn {
  id: string;
  actor: string; // teamId ou "chefe"
  skillName: string;
  roll: string;
  value: number;
  effect: TurnEffect;
}

export type IncursionStatus = "planejada" | "andamento" | "concluida";

export interface Incursion {
  id: string;
  number: number;
  title: string;
  date: string;
  paradigm: string;
  questionsPerStage: number;
  status: IncursionStatus;
  result: "vitoria" | "derrota" | null;
  teams: IncursionTeam[];
  stages: Stage[];
  bossId: string | null;
  turns: Turn[];
}
