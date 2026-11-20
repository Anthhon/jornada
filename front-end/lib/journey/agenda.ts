import type { Incursion } from "@/features/missions";
import type { Student } from "@/features/students";
import type { Team } from "@/features/groups";

export function publicAgenda(students: Student[], teams: Team[], incursions: Incursion[]) {
  const missions = [...incursions].sort((a, b) => a.number - b.number);
  const groups = teams.map((team) => ({
    id: team.id,
    name: team.name,
    members: students.filter((student) => team.memberIds.includes(student.id)).map(({ id, name, registration }) => ({ id, name, registration })),
    schedule: missions.map((mission) => {
      const participation = mission.teams.find((entry) => entry.teamId === team.id);
      return participation ? { language: participation.language, date: mission.date } : null;
    }),
  }));
  const unassigned = students.filter((student) => !teams.some((team) => team.memberIds.includes(student.id)));
  if (unassigned.length) groups.push({ id: "unassigned", name: "Sem grupo", members: unassigned.map(({ id, name, registration }) => ({ id, name, registration })), schedule: missions.map(() => null) });
  return { missions: missions.map(({ id, number, title }) => ({ id, number, title })), groups };
}
