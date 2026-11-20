import { api } from "@/lib/api";
import type { User } from "../types/user";
import { usersSchema } from "../schemas/user";

export async function getUsers(signal?: AbortSignal): Promise<User[]> {
  const { data } = await api.get<User[]>("/users/", { signal });
  return usersSchema.parse(data);
}
