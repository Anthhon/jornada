import { z } from "zod";
export const skillSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(100), cost: z.union([z.literal(2), z.literal(3), z.literal(5)]), type: z.enum(["dano", "cura", "escudo", "suporte"]), dice: z.string().regex(/^(?:—|[1-9]\d*d[1-9]\d*(?:[+-]\d+)?)$/), effect: z.string().trim().min(1), review: z.boolean().optional() });
