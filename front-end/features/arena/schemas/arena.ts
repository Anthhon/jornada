import { z } from "zod";

/** Estados da raid (espelham `ArenaRound.Status` do back-end). */
export const arenaStatusSchema = z.enum(["CONFIG", "RUNNING", "PAUSED", "ENDED"]);
export type ArenaStatus = z.infer<typeof arenaStatusSchema>;

/** Rótulo + estilo de cada status (badge próprio, o `Seal` do kit é de missão). */
export const ARENA_STATUS_META: Record<ArenaStatus, { label: string; className: string }> = {
  CONFIG: { label: "Em configuração", className: "bg-parchment text-parchment-foreground border-parchment-foreground/30" },
  RUNNING: { label: "Em andamento", className: "bg-info/15 text-info border-info/40" },
  PAUSED: { label: "Pausada", className: "bg-accent text-accent-foreground border-border" },
  ENDED: { label: "Encerrada", className: "bg-destructive/10 text-destructive border-destructive/40" },
};

export const arenaTeamAbilitySchema = z.object({
  /** `GroupAbility` atribuída à equipe (3+1, ADR-021). */
  id: z.number(),
  template_id: z.number(),
  name: z.string(),
  /** BASIC | ULTIMATE */
  kind: z.string(),
  /** STRIKE | HEAL | SHIELD | BUFF */
  effect: z.string(),
  value: z.number(),
  max_charges: z.number(),
  charges_left: z.number(),
});

/** Modelo do catálogo de habilidades (`/team-abilities/`, ADR-021). */
export const teamAbilityTemplateSchema = z.object({
  id: z.number(),
  theme: z.string(),
  name: z.string(),
  /** BASIC | ULTIMATE */
  kind: z.string(),
  /** STRIKE | HEAL | SHIELD | BUFF */
  effect: z.string(),
  value: z.number(),
  max_charges: z.number(),
  description: z.string(),
});

export type TeamAbilityTemplate = z.infer<typeof teamAbilityTemplateSchema>;

export const arenaTeamSchema = z.object({
  group_id: z.number(),
  group_name: z.string(),
  base_damage: z.number(),
  battle_damage: z.number(),
  total_damage: z.number(),
  retaliation_loss: z.number(),
  manual_adjustment: z.number(),
  points: z.number(),
  position: z.number(),
  /** Notas da rubric da apresentação (7 critérios) — `null` = não registrado. */
  criteria: z.record(z.string(), z.number()).nullable(),
  /** Erros de pergunta da equipe (gatilho "Perguntas"). */
  wrong_answers: z.number(),
  /** Corte de habilidade sobre o dano de ataque (0.5 = metade). */
  damage_factor: z.number(),
  /** Escudo da equipe: absorve retaliações/penalidades (ADR-021). */
  shield: z.number(),
  /** Bônus acumulado no próximo ataque (0.3 = +30%, ADR-021). */
  damage_buff: z.number(),
  /** Habilidades escolhidas pelo professor (3+1, ADR-021). */
  abilities: z.array(arenaTeamAbilitySchema),
});

export const arenaEventSchema = z.object({
  id: z.number(),
  kind: z.string(),
  actor: z.string(),
  group: z.number().nullable(),
  group_name: z.string().nullable(),
  value: z.number(),
  message: z.string(),
  /** Rolagem do d20 no uso de habilidade (ADR-019). */
  roll: z.number().nullable(),
  ability_id: z.number().nullable(),
  ability_name: z.string().nullable(),
  created_at: z.string().nullable(),
});

/** Habilidade executável do chefe (espela `BossAbility`, ADR-017). */
export const arenaAbilitySchema = z.object({
  id: z.number(),
  name: z.string(),
  trigger: z.string(),
  effect: z.string(),
  value: z.number(),
  every: z.number(),
  threshold: z.number(),
  mode: z.string(),
  scope: z.string(),
  min_count: z.number(),
  description: z.string(),
});

export const arenaBossSchema = z.object({
  id: z.number(),
  name: z.string(),
  max_hp: z.number(),
  abilities: z.array(arenaAbilitySchema),
});

/** Payload do `GET /arena/rounds/{id}/state/` (público, polling). */
export const arenaStateSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: arenaStatusSchema,
  hp: z.number(),
  max_hp: z.number(),
  turn: z.number(),
  level: z.number(),
  multiplier: z.number(),
  retaliation_ratio: z.number(),
  reward_factor: z.number(),
  /** Escala do bando ligada na rodada (0 = desligada, ADR-020). */
  balance_ref_teams: z.number(),
  /** Saque do chefe em pontos, rateado só na vitória (ADR-018). */
  treasure: z.number(),
  /** Desfecho: "" (em aberto) | VICTORY | RETREAT (ADR-018). */
  outcome: z.string(),
  /** Fator de escala vigente (1.0 = desligada, ADR-020). */
  balance: z.number(),
  boss: arenaBossSchema,
  teams: z.array(arenaTeamSchema),
  events: z.array(arenaEventSchema),
  rewards_credited: z.boolean(),
});

/** Entrada do `GET /arena/rounds/` (lista de rodadas). */
export const arenaRoundSchema = z.object({
  id: z.number(),
  name: z.string(),
  boss: z.number(),
  status: arenaStatusSchema,
  level: z.number(),
  max_hp: z.number(),
  hp: z.number(),
});

/** Resumo de chefe p/ o seletor de "nova rodada" (`GET /bosses/`). */
export const arenaBossOptionSchema = z.object({
  id: z.number(),
  name: z.string(),
  max_hp: z.number(),
});

export type ArenaTeam = z.infer<typeof arenaTeamSchema>;
export type ArenaTeamAbility = z.infer<typeof arenaTeamAbilitySchema>;
export type ArenaEvent = z.infer<typeof arenaEventSchema>;
export type ArenaAbility = z.infer<typeof arenaAbilitySchema>;
export type ArenaBoss = z.infer<typeof arenaBossSchema>;
export type ArenaState = z.infer<typeof arenaStateSchema>;
export type ArenaRound = z.infer<typeof arenaRoundSchema>;
export type ArenaBossOption = z.infer<typeof arenaBossOptionSchema>;
