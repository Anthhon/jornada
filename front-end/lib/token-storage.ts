export interface TokenPair { access: string; refresh: string }
export interface TokenStorage {
  read(): TokenPair | null;
  write(tokens: TokenPair): void;
  clear(): void;
}
const KEY = "jornada-tokens";
// Browser sessions only. Server requests must supply their own credentials.
export const tokenStorage: TokenStorage = {
  read() {
    if (typeof window === "undefined") return null;
    try {
      const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
      if (typeof value?.access === "string" && typeof value?.refresh === "string") return value;
    } catch { /* Invalid storage is treated as an expired session. */ }
    return null;
  },
  write(tokens) {
    if (typeof window !== "undefined") window.sessionStorage.setItem(KEY, JSON.stringify(tokens));
  },
  clear() {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(KEY);
  },
};
