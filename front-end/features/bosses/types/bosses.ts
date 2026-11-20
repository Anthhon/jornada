export type BossTrigger = "Tempo" | "Conceito" | "Demonstração" | "Suporte" | "Geral" | "Perguntas";

export interface BossSkill {
  name: string;
  trigger: BossTrigger;
  effect: string;
}

export interface Boss {
  id: string;
  name: string;
  hp: number;
  specialty: string;
  description: string;
  skills: BossSkill[];
  active: boolean;
}
