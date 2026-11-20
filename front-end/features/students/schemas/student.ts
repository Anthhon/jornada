import { z } from "zod";
export const studentSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(100), registration: z.string().trim().min(1).max(100) });
