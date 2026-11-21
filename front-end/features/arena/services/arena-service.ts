import { api } from "@/lib/api";
import {
  arenaBossOptionSchema,
  arenaGroupOptionSchema,
  arenaRoundSchema,
  arenaStateSchema,
  teamAbilityTemplateSchema,
  type ArenaGroupOption,
  type ArenaRound,
  type ArenaState,
  type TeamAbilityTemplate,
} from "../schemas/arena";

const base = "/arena/rounds";

export async function listRounds(signal?: AbortSignal): Promise<ArenaRound[]> {
  const { data } = await api.get(`${base}/`, { signal });
  return arenaRoundSchema.array().parse(data);
}

export async function getState(id: number, signal?: AbortSignal): Promise<ArenaState> {
  const { data } = await api.get(`${base}/${id}/state/`, { signal });
  return arenaStateSchema.parse(data);
}

export async function listBosses(signal?: AbortSignal) {
  const { data } = await api.get("/bosses/", { signal });
  return arenaBossOptionSchema.array().parse(data);
}

/** Catálogo de modelos de habilidade (o professor monta o 3+1, ADR-021). */
export async function listTeamAbilities(
  signal?: AbortSignal,
): Promise<TeamAbilityTemplate[]> {
  const { data } = await api.get("/team-abilities/", { signal });
  return teamAbilityTemplateSchema.array().parse(data);
}

/** Atribui o 3+1 escolhido ao grupo (`PATCH /groups/{id}/`, ADR-021). */
export async function assignAbilities(
  groupId: number,
  templateIds: number[],
): Promise<void> {
  await api.patch(`/groups/${groupId}/`, { abilities: templateIds });
}

/**
 * Edita a configuração da rodada (`PATCH /arena/rounds/{id}/`, M-49):
 * datas em qualquer status; parâmetros da fórmula só em CONFIG (a tela
 * trava a UI — a API aceita, quem escreve é o professor).
 */
export async function updateRound(
  id: number,
  payload: Record<string, string | number | null>,
): Promise<void> {
  await api.patch(`${base}/${id}/`, payload);
}

/** Grupos da tabela de placares (`GET /groups/`, leitura pública, M-49). */
export async function listGroups(
  signal?: AbortSignal,
): Promise<ArenaGroupOption[]> {
  const { data } = await api.get("/groups/", { signal });
  return arenaGroupOptionSchema.array().parse(data);
}

export async function createRound(payload: {
  name: string;
  boss: number;
  max_hp?: number;
  level?: number;
  multiplier?: number;
  retaliation_ratio?: number;
  reward_factor?: number;
  /** Escala do bando (0 = desligada, ADR-020). */
  balance_ref_teams?: number;
  /** Saque do chefe em pontos (ADR-018). */
  treasure?: number;
  /** PV inicial: continuar um chefe em fuga (ADR-018). */
  initial_hp?: number;
}): Promise<ArenaRound> {
  const { data } = await api.post(`${base}/`, payload);
  return arenaRoundSchema.parse(data);
}

async function post(id: number, action: string, payload: unknown = {}) {
  const { data } = await api.post(`${base}/${id}/${action}/`, payload);
  return data;
}

/** Exclui a rodada e todo o registro dela (`DELETE /arena/rounds/{id}/`). */
async function removeRound(id: number): Promise<void> {
  await api.delete(`${base}/${id}/`);
}

/** Duplica a rodada: devolve a cópia em CONFIG, sem histórico (M-50). */
async function duplicateRound(id: number): Promise<ArenaRound> {
  const data = await post(id, "duplicate");
  return arenaRoundSchema.parse(data);
}

export const arenaService = {
  list: listRounds,
  getState,
  listBosses,
  listTeamAbilities,
  assignAbilities,
  listGroups,
  updateRound,
  create: createRound,
  remove: removeRound,
  duplicate: duplicateRound,
  start: (id: number) => post(id, "start"),
  pause: (id: number) => post(id, "pause"),
  resume: (id: number) => post(id, "resume"),
  end: (id: number) => post(id, "end"),
  /** Reabre uma disputa encerrada (estorna recompensa e saque — M-50). */
  reopen: (id: number) => post(id, "reopen"),
  /** Ajuste do PV do chefe — restaurar manda o PV máximo (M-50). */
  setHp: (id: number, hp: number) => post(id, "set-hp", { hp }),
  /** Desfaz a última ação registrada (M-50). */
  undo: (id: number) => post(id, "undo"),
  /** Zera uma equipe na rodada e devolve o dano ao chefe (M-51). */
  resetTeam: (id: number, payload: { group_id: number }) =>
    post(id, "reset-team", payload),
  attack: (id: number, payload: { group_id: number; correct: boolean; points: number }) =>
    post(id, "attack", payload),
  applyPerformance: (
    id: number,
    payload: { group_id?: number; performance?: number; criteria?: Record<string, number> },
  ) => post(id, "apply-performance", payload),
  damage: (id: number, payload: { group_id: number; damage: number }) =>
    post(id, "damage", payload),
  override: (id: number, payload: { group_id: number; amount: number }) =>
    post(id, "override", payload),
  /** Habilidade de equipe — o d20 é rolado no servidor (ADR-019). */
  useAbility: (id: number, payload: { group_id: number; ability_id: number }) =>
    post(id, "use-ability", payload),
  /** Professor repõe as cargas das habilidades da equipe (ADR-021). */
  renewAbilities: (id: number, payload: { group_id: number }) =>
    post(id, "renew-abilities", payload),
};
