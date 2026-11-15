import { api } from "@/lib/api";
import { bossSchema } from "../schemas/boss";
import type { Boss } from "@/features/bosses";

// Provisional MSW contract: adapt this feature's calls to the Django DTO later.
export async function getBosses(signal?: AbortSignal): Promise<Boss[]> {
  const { data } = await api.get("/mock-catalog/bosses/", { signal });
  return bossSchema.array().parse(data);
}

// The current mock uses PUT as upsert; this is not Django's create contract.
export async function saveBoss(item: Boss): Promise<Boss> {
  const payload = bossSchema.parse(item);
  const { data } = await api.put(`/mock-catalog/bosses/${encodeURIComponent(payload.id)}/`, payload);
  return bossSchema.parse(data);
}

export async function deleteBoss(id: string): Promise<void> {
  await api.delete(`/mock-catalog/bosses/${encodeURIComponent(id)}/`);
}

// Preserve existing consumers while keeping HTTP operations explicit above.
export const bossService = { list: getBosses, save: saveBoss, remove: deleteBoss };
