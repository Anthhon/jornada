import { z } from "zod";
const attribute = z.number().int().min(0).max(5);
export const heroSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(100), heroClass: z.string().trim().min(1), role: z.enum(["Ataque", "Suporte"]), description: z.string().trim().min(1), passive: z.string(), passiveReview: z.boolean().optional(), attributes: z.object({ forca: attribute, sabedoria: attribute, carisma: attribute }), skillIds: z.array(z.string().min(1)) });
