import { z } from "zod";
import { studentSchema } from "@/features/students/schemas/student";
import { groupSchema } from "@/features/groups/schemas/group";
import { skillSchema } from "@/features/skills/schemas/skill";
import { heroSchema } from "@/features/heroes/schemas/hero";
import { bossSchema } from "@/features/bosses/schemas/boss";
import { questionSchema } from "@/features/questions/schemas/question";
import { seedStudents, seedTeams, seedSkills, seedHeroes, seedBosses, seedQuestions } from "./journey";

export const catalogSchemas = { students: studentSchema, groups: groupSchema, skills: skillSchema, heroes: heroSchema, bosses: bossSchema, questions: questionSchema };
export const catalogSchema = z.object({ students: z.array(studentSchema), groups: z.array(groupSchema), skills: z.array(skillSchema), heroes: z.array(heroSchema), bosses: z.array(bossSchema), questions: z.array(questionSchema) });
export type Catalog = z.infer<typeof catalogSchema>;
export type CatalogResource = keyof Catalog;
const key = "jornada-mock-catalog-v1";
const initial = { students: seedStudents, groups: seedTeams, skills: seedSkills, heroes: seedHeroes, bosses: seedBosses, questions: seedQuestions };
let memory: Catalog = catalogSchema.parse(structuredClone(initial));
export function readCatalog(): Catalog {
  const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return catalogSchema.parse(stored ? JSON.parse(stored) : structuredClone(memory));
}
export function writeCatalog(data: Catalog) {
  const parsed = catalogSchema.parse(data);
  if (typeof localStorage !== "undefined") localStorage.setItem(key, JSON.stringify(parsed));
  memory = structuredClone(parsed);
}
