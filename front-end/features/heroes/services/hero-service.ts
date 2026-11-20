import { api } from "@/lib/api";
import { heroSchema } from "../schemas/hero";
import type { Hero } from "@/features/heroes";

// Provisional MSW contract: adapt this feature's calls to the Django DTO later.
export async function getHeroes(signal?: AbortSignal): Promise<Hero[]> {
  const { data } = await api.get("/mock-catalog/heroes/", { signal });
  return heroSchema.array().parse(data);
}

// The current mock uses PUT as upsert; this is not Django's create contract.
export async function saveHero(item: Hero): Promise<Hero> {
  const payload = heroSchema.parse(item);
  const { data } = await api.put(`/mock-catalog/heroes/${encodeURIComponent(payload.id)}/`, payload);
  return heroSchema.parse(data);
}

export async function deleteHero(id: string): Promise<void> {
  await api.delete(`/mock-catalog/heroes/${encodeURIComponent(id)}/`);
}

// Preserve existing consumers while keeping HTTP operations explicit above.
export const heroService = { list: getHeroes, save: saveHero, remove: deleteHero };
