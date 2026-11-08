import { z } from "zod";

export const currentUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: z.enum(["teacher", "student"]),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;
