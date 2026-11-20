import { api } from "@/lib/api";
import { skillSchema } from "../schemas/skill";
import type { Skill } from "@/features/skills";

// Provisional MSW contract: adapt this feature's calls to the Django DTO later.
export async function getSkills(signal?: AbortSignal): Promise<Skill[]> {
  const { data } = await api.get("/mock-catalog/skills/", { signal });
  return skillSchema.array().parse(data);
}

// The current mock uses PUT as upsert; this is not Django's create contract.
export async function saveSkill(item: Skill): Promise<Skill> {
  const payload = skillSchema.parse(item);
  const { data } = await api.put(`/mock-catalog/skills/${encodeURIComponent(payload.id)}/`, payload);
  return skillSchema.parse(data);
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(`/mock-catalog/skills/${encodeURIComponent(id)}/`);
}

// Preserve existing consumers while keeping HTTP operations explicit above.
export const skillService = { list: getSkills, save: saveSkill, remove: deleteSkill };
