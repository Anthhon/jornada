import type { Boss } from "@/features/bosses";
import type { Evaluation, Incursion, Turn } from "@/features/missions";
import type { Hero } from "@/features/heroes";
import type { Question } from "@/features/questions";
import type { Skill } from "@/features/skills";
import type { Student } from "@/features/students";
import type { Team } from "@/features/groups";
export interface Session { role: "professor"; name: string; username: string }
export interface State {
  session: Session | null;
  students: Student[];
  teams: Team[];
  skills: Skill[];
  heroes: Hero[];
  bosses: Boss[];
  questions: Question[];
  incursions: Incursion[];
  setSession: (s: Session | null) => void;
  upsertStudent: (s: Student) => void;
  removeStudent: (id: string) => void;
  upsertTeam: (t: Team) => void;
  removeTeam: (id: string) => void;
  upsertSkill: (s: Skill) => void;
  removeSkill: (id: string) => void;
  upsertHero: (h: Hero) => void;
  upsertBoss: (b: Boss) => void;
  upsertQuestion: (q: Question) => void;
  removeQuestion: (id: string) => void;
  createIncursion: (d: Pick<Incursion, "number" | "title" | "date" | "paradigm" | "questionsPerStage"> & { teams: { teamId: string; language: string }[] }) => string;
  setHero: (incId: string, teamId: string, heroId: string) => void;
  setEvaluation: (incId: string, teamId: string, ev: Evaluation) => void;
  startStage: (incId: string, level: number) => string | null;
  finishStage: (incId: string, level: number) => void;
  addTurn: (incId: string, t: Omit<Turn, "id">) => void;
  setResult: (incId: string, r: "vitoria" | "derrota") => void;
}
