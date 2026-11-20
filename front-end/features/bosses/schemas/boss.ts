import { z } from "zod";

export const imageUrlSchema = z.string().refine((value) => !value || /^\/(?!\/)/.test(value) || /^https:\/\//i.test(value), "Use caminho local ou URL HTTPS.");

/** Habilidade estruturada (espelha `BossAbility` do back-end, ADR-017). */
export const bossSkillSchema = z.object({
  name: z.string().trim().min(1),
  trigger: z.enum(["TEMPO", "CONCEITO", "FUNDAMENTOS", "DEMONSTRACAO", "SUPORTE", "GERAL", "PERGUNTAS"]),
  effect: z.enum(["PENALTY", "HEAL", "DRAIN", "CUT", "DISADV", "PR_COST"]),
  value: z.number().int(),
  every: z.number().int().min(1),
  threshold: z.number().int().min(-1).max(4),
  mode: z.enum(["ANY", "AVERAGE", "SPREAD"]),
  scope: z.enum(["TEAM", "ALLIANCE"]),
  min_count: z.number().int().min(1),
  description: z.string(),
});

export const bossSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  hp: z.number().int().positive(),
  specialty: z.string(),
  description: z.string(),
  active: z.boolean(),
  image: imageUrlSchema.optional(),
  skills: z.array(bossSkillSchema).min(1),
});
