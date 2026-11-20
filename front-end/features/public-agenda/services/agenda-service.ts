import { api } from "@/lib/api";
import { agendaSchema } from "../schemas/agenda";
import type { PublicAgenda } from "../types/agenda";

// Contrato provisório: substituir ao integrar a API real.
const endpoint = "/mock-agenda/";
export async function getAgenda(): Promise<PublicAgenda> {
  const response = await api.get(endpoint);
  return agendaSchema.parse(response.data);
}
export async function saveAgenda(agenda: PublicAgenda): Promise<PublicAgenda> {
  const response = await api.put(endpoint, agendaSchema.parse(agenda));
  return agendaSchema.parse(response.data);
}
