import { MOCKING_MODE } from "@/lib/api-config";
import { createAuthenticationHandlers } from "./authentication";
import { agendaHandlers } from "./agenda";
import { catalogHandlers } from "./catalog";
import { arenaHandlers } from "./arena";

/**
 * Handlers ativos por modo:
 * - `enabled`  → demo completa (tudo mockado).
 * - `catalog`  → modo híbrido: catálogo + agenda mockados; **auth e arena
 *   reais** (Django em :8000) — `login`, `token` e `/arena/*` passam direto.
 */
export const handlers =
  MOCKING_MODE === "catalog"
    ? [...agendaHandlers, ...catalogHandlers]
    : [...createAuthenticationHandlers(), ...agendaHandlers, ...catalogHandlers, ...arenaHandlers];
