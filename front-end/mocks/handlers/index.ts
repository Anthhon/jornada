import { createAuthenticationHandlers } from "./authentication";
import { agendaHandlers } from "./agenda";
import { catalogHandlers } from "./catalog";
import { arenaHandlers } from "./arena";
export const handlers = [...createAuthenticationHandlers(), ...agendaHandlers, ...catalogHandlers, ...arenaHandlers];
