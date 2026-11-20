import { studentService } from "@/features/students/services/student-service";
import { groupService } from "@/features/groups/services/group-service";
import { skillService } from "@/features/skills/services/skill-service";
import { heroService } from "@/features/heroes/services/hero-service";
import { bossService } from "@/features/bosses/services/boss-service";
import { questionService } from "@/features/questions/services/question-service";
import { useJornada } from "@/stores/journey-store";

let pending: Promise<void> | undefined;
export function loadCatalog(): Promise<void> {
  pending ??= Promise.all([studentService.list(), groupService.list(), skillService.list(), heroService.list(), bossService.list(), questionService.list()])
    .then(([students, teams, skills, heroes, bosses, questions]) => { useJornada.setState({ students, teams, skills, heroes, bosses, questions }); })
    .finally(() => { pending = undefined; });
  return pending;
}
export async function refreshCatalog(): Promise<void> {
  // An earlier read may have started before a mutation finished.
  if (pending) await pending.catch(() => undefined);
  await loadCatalog();
}
