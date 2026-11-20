import { z } from "zod";
export const groupSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(100), letter: z.string().trim().regex(/^[A-Z]$/).optional(), memberIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, "Integrantes repetidos."), extraPoints: z.record(z.string(), z.number().min(0).max(2)) });
