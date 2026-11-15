import { createAuthenticationHandlers } from "./authentication";
import { agendaHandlers } from "./agenda";
import { catalogHandlers } from "./catalog";
export const handlers = [...createAuthenticationHandlers(), ...agendaHandlers, ...catalogHandlers];
