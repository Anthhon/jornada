import axios from "axios";
import { z } from "zod";
import { toast } from "sonner";
import { refreshCatalog } from "./catalog-cache";
import { studentService } from "@/features/students/services/student-service";
import { groupService } from "@/features/groups/services/group-service";
import { skillService } from "@/features/skills/services/skill-service";
import { heroService } from "@/features/heroes/services/hero-service";
import { bossService } from "@/features/bosses/services/boss-service";
import { questionService } from "@/features/questions/services/question-service";

async function mutate(operation: () => Promise<unknown>): Promise<boolean> {
  try { await operation(); await refreshCatalog(); return true; }
  catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : axios.isAxiosError(error) && typeof error.response?.data?.detail === "string" ? error.response.data.detail : "Não foi possível concluir a operação. Tente novamente.";
    toast.error(message); return false;
  }
}
export const upsertStudent = (value: Parameters<typeof studentService.save>[0]) => mutate(() => studentService.save(value));
export const removeStudent = (id: string) => mutate(() => studentService.remove(id));
export const upsertTeam = (value: Parameters<typeof groupService.save>[0]) => mutate(() => groupService.save(value));
export const removeTeam = (id: string) => mutate(() => groupService.remove(id));
export const upsertSkill = (value: Parameters<typeof skillService.save>[0]) => mutate(() => skillService.save(value));
export const removeSkill = (id: string) => mutate(() => skillService.remove(id));
export const upsertHero = (value: Parameters<typeof heroService.save>[0]) => mutate(() => heroService.save(value));
export const removeHero = (id: string) => mutate(() => heroService.remove(id));
export const upsertBoss = (value: Parameters<typeof bossService.save>[0]) => mutate(() => bossService.save(value));
export const removeBoss = (id: string) => mutate(() => bossService.remove(id));
export const upsertQuestion = (value: Parameters<typeof questionService.save>[0]) => mutate(() => questionService.save(value));
export const removeQuestion = (id: string) => mutate(() => questionService.remove(id));
