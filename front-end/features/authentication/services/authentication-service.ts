import { authClient } from "@/lib/api";
import { tokenStorage, type TokenPair } from "@/lib/token-storage";
import type { LoginValues } from "../types/login";
import { tokensSchema } from "../schemas/tokens";

export async function login(credentials: LoginValues) {
  const { data } = await authClient.post<TokenPair>("/token/", credentials);
  tokenStorage.write(tokensSchema.parse(data));
}
export function logout() { tokenStorage.clear(); }
