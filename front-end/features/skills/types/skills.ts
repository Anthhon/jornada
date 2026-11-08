export type SkillType = "dano" | "cura" | "escudo" | "suporte";

export interface Skill {
  id: string;
  name: string;
  cost: number;
  type: SkillType;
  dice: string;
  effect: string;
  review?: boolean;
}
