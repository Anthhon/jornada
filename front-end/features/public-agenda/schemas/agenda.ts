import { z } from "zod";

const slot = z.object({ language: z.string().trim().min(1).max(100), date: z.iso.date() }).nullable();
const mission = z.object({ id: z.string().min(1), number: z.union([z.literal(1), z.literal(2), z.literal(3)]), title: z.string().min(1) });
export const agendaSchema = z.object({
  missions: z.tuple([mission, mission, mission]),
  groups: z.array(z.object({
    id: z.string().min(1), name: z.string().trim().min(1), letter: z.string().optional(),
    members: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), registration: z.string().min(1) })),
    schedule: z.tuple([slot, slot, slot]),
  })),
}).refine((agenda) => new Set(agenda.groups.map((group) => group.id)).size === agenda.groups.length, "Equipe repetida na agenda.");
