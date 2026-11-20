import { z } from "zod";
import type { User } from "../types/user";

export const userSchema: z.ZodType<User> = z.object({
  id: z.number().int(),
  username: z.string(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  date_joined: z.string(),
});
export const usersSchema = z.array(userSchema);
