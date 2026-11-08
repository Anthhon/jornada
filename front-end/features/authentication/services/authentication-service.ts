import { api, authClient } from "@/lib/api";
import { tokenStorage, type TokenPair } from "@/lib/token-storage";
import type { LoginValues } from "../types/login";
import { tokensSchema } from "../schemas/tokens";
import { currentUserSchema } from "../schemas/current-user";

export async function login(credentials: LoginValues) {
  const { data } = await authClient.post<TokenPair>("/token/", { ...credentials, username: credentials.username.trim() });
  tokenStorage.write(tokensSchema.parse(data));
}
export function logout() { tokenStorage.clear(); }

export async function getCurrentUser(signal?: AbortSignal) {
  const { data } = await api.get("/me/", { signal });
  return currentUserSchema.parse(data);
}

export async function requestPasswordReset(email: string) {
  await authClient.post("/password-reset/", { email });
}

export async function confirmPasswordReset(uid: string, token: string, newPassword: string) {
  await authClient.post("/password-reset/confirm/", { uid, token, new_password: newPassword });
}
