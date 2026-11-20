export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api").replace(/\/+$/, "");

/**
 * Modo de mocking (dev):
 * - `enabled`  → demo completa: MSW cuida de tudo (auth, catálogo, agenda, arena).
 * - `catalog`  → modo híbrido: catálogo e agenda mockados; **auth e arena
 *   reais** (Django). É o modo do `.env` por padrão — a tela de Chefes
 *   funciona com o backend de verdade.
 * - `disabled` → sem MSW: tudo real.
 * Produção nunca mocka (`NODE_ENV === "development"`).
 */
export type MockingMode = "enabled" | "catalog" | "disabled";

const rawMode = process.env.NEXT_PUBLIC_API_MOCKING;

export const MOCKING_MODE: MockingMode =
  rawMode === "enabled" ? "enabled" : rawMode === "catalog" ? "catalog" : "disabled";

/** Demo completa (tudo mockado). */
export const MOCKING_ENABLED = process.env.NODE_ENV === "development" && MOCKING_MODE === "enabled";

/** MSW ativo em qualquer modo de mock (híbrido inclusive). */
export const MSW_ACTIVE = process.env.NODE_ENV === "development" && MOCKING_MODE !== "disabled";
