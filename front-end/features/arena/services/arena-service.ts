import { api } from "@/lib/api";
import {
  arenaBossOptionSchema,
  arenaRoundSchema,
  arenaStateSchema,
  type ArenaRound,
  type ArenaState,
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

export async function createRound(payload: {
  name: string;
  boss: number;
  max_hp?: number;
  level?: number;
  multiplier?: number;
  retaliation_ratio?: number;
  reward_factor?: number;
}): Promise<ArenaRound> {
  const { data } = await api.post(`${base}/`, payload);
  return arenaRoundSchema.parse(data);
}

async function post(id: number, action: string, payload: unknown = {}) {
  const { data } = await api.post(`${base}/${id}/${action}/`, payload);
  return data;
}

export const arenaService = {
  list: listRounds,
  getState,
  listBosses,
  create: createRound,
  start: (id: number) => post(id, "start"),
  pause: (id: number) => post(id, "pause"),
  resume: (id: number) => post(id, "resume"),
  end: (id: number) => post(id, "end"),
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
};
