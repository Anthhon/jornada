import { z } from "zod";

export const tokensSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1),
});
