/** Gatilhos (espelham `BossAbility.Trigger` do back-end, ADR-017). */
export type BossTrigger =
  | "TEMPO"
  | "CONCEITO"
  | "FUNDAMENTOS"
  | "DEMONSTRACAO"
  | "SUPORTE"
  | "GERAL"
  | "PERGUNTAS";

/** Efeitos executáveis pela raid (espelham `BossAbility.Effect`). */
export type BossEffect = "PENALTY" | "HEAL" | "DRAIN" | "CUT" | "DISADV" | "PR_COST";

/** Modo da condição: algum critério / média / variação (ADR-017). */
export type BossMode = "ANY" | "AVERAGE" | "SPREAD";

/** Escopo: só a equipe registrada / a aliança inteira. */
export type BossScope = "TEAM" | "ALLIANCE";

export interface BossSkill {
  name: string;
  trigger: BossTrigger;
  effect: BossEffect;
  /** Valor do efeito: pontos de Dano Base, PV ou % de corte. */
  value: number;
  /** `PERGUNTAS`: dispara a cada `every` erros. */
  every: number;
  /** Nota de corte do gatilho (3 = nota máxima; SPREAD = variação mínima). */
  threshold: number;
  mode: BossMode;
  scope: BossScope;
  /** `ALLIANCE`: mínimo de equipes afetadas para disparar. */
  min_count: number;
  description: string;
}

export interface Boss {
  image?: string;
  id: string;
  name: string;
  hp: number;
  specialty: string;
  description: string;
  skills: BossSkill[];
  active: boolean;
}
