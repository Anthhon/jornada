import { authClient } from "@/lib/api";
import { tokenStorage, type TokenPair } from "@/lib/token-storage";
import type { LoginValues } from "../types/login";
import { tokensSchema } from "../schemas/tokens";

export async function login(credentials: LoginValues) {
  const { data } = await authClient.post<TokenPair>("/token/", { ...credentials, username: credentials.username.trim() });
  tokenStorage.write(tokensSchema.parse(data));
}
export function logout() { tokenStorage.clear(); }

export async function requestPasswordReset(email: string) {
  await authClient.post("/password-reset/", { email });
}

export async function confirmPasswordReset(uid: string, token: string, newPassword: string) {
  await authClient.post("/password-reset/confirm/", { uid, token, new_password: newPassword });
}
