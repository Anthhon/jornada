import { z } from "zod";
export const questionSchema = z.object({ id: z.string().min(1), statement: z.string().trim().min(1), language: z.string().trim().max(100).optional(), options: z.array(z.object({ text: z.string().trim().min(1).max(255), correct: z.boolean() })).min(2).refine((options) => options.some((option) => option.correct), "Marque uma alternativa correta.") });
