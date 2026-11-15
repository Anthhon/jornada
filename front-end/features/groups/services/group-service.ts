import { api } from "@/lib/api";
import { groupSchema } from "../schemas/group";
import type { Team } from "@/features/groups";

// Provisional MSW contract: adapt this feature's calls to the Django DTO later.
export async function getGroups(signal?: AbortSignal): Promise<Team[]> {
  const { data } = await api.get("/mock-catalog/groups/", { signal });
  return groupSchema.array().parse(data);
}

// The current mock uses PUT as upsert; this is not Django's create contract.
export async function saveGroup(item: Team): Promise<Team> {
  const payload = groupSchema.parse(item);
  const { data } = await api.put(`/mock-catalog/groups/${encodeURIComponent(payload.id)}/`, payload);
  return groupSchema.parse(data);
}

export async function deleteGroup(id: string): Promise<void> {
  await api.delete(`/mock-catalog/groups/${encodeURIComponent(id)}/`);
}

export const groupService = { list: getGroups, save: saveGroup, remove: deleteGroup };
