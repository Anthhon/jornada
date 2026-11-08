import type { Stage } from "@/features/missions";

const STAGE_NAMES = ["Trilha da Névoa", "Ponte Quebrada", "Ruínas Antigas", "Covil do Monólito"];

export function makeStages(teamIds: string[]): Stage[] {
  return STAGE_NAMES.map((name, i) => ({
    level: i + 1,
    name,
    responsibleTeamId: i < 3 ? (teamIds[i] ?? null) : null,
    status: "aguardando",
    startedAt: null,
    endedAt: null,
  }));
}
