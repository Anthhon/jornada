import { seedBosses, seedHeroes, seedIncursions, seedQuestions, seedSkills, seedStudents, seedTeams } from "@/mocks/journey";
import { makeStages } from "@/lib/journey/stages";
import type { Incursion } from "@/features/missions";
import type { State } from "@/stores/journey-store.types";
import { create } from "zustand";
import { tokenStorage } from "@/lib/token-storage";

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString().slice(0, 16);

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

const patchInc = (list: Incursion[], id: string, fn: (i: Incursion) => Incursion) => list.map((i) => (i.id === id ? fn(i) : i));

export const newId = uid;

export const useJornada = create<State>((set, get) => ({
  session: null,
  students: seedStudents,
  teams: seedTeams,
  skills: seedSkills,
  heroes: seedHeroes,
  bosses: seedBosses,
  questions: seedQuestions,
  incursions: seedIncursions,
  setSession: (session) => {
    if (!session) tokenStorage.clear();
    if (typeof window !== "undefined") {
      if (session) sessionStorage.setItem("jornada-session", JSON.stringify(session));
      else sessionStorage.removeItem("jornada-session");
    }
    set({ session });
  },
  upsertStudent: (s) => set({ students: upsert(get().students, s) }),
  removeStudent: (id) =>
    set({
      students: get().students.filter((s) => s.id !== id),
      teams: get().teams.map((t) => ({ ...t, memberIds: t.memberIds.filter((m) => m !== id) })),
    }),
  upsertTeam: (t) => {
    // um aluno pertence a apenas um grupo
    const others = get().teams.map((x) => (x.id === t.id ? x : { ...x, memberIds: x.memberIds.filter((m) => !t.memberIds.includes(m)) }));
    set({ teams: upsert(others, t) });
  },
  removeTeam: (id) => set({ teams: get().teams.filter((t) => t.id !== id) }),
  upsertSkill: (s) => set({ skills: upsert(get().skills, s) }),
  removeSkill: (id) =>
    set({ skills: get().skills.filter((s) => s.id !== id), heroes: get().heroes.map((h) => ({ ...h, skillIds: h.skillIds.filter((k) => k !== id) })) }),
  upsertHero: (h) => set({ heroes: upsert(get().heroes, h) }),
  upsertBoss: (b) => set({ bosses: upsert(get().bosses, b) }),
  upsertQuestion: (q) => set({ questions: upsert(get().questions, q) }),
  removeQuestion: (id) => set({ questions: get().questions.filter((q) => q.id !== id) }),
  createIncursion: (d) => {
    const id = uid("i");
    const inc: Incursion = {
      id, number: d.number, title: d.title, date: d.date, paradigm: d.paradigm, questionsPerStage: d.questionsPerStage,
      status: "planejada", result: null, bossId: null, turns: [],
      teams: d.teams.map((t) => ({ ...t, heroId: null, evaluation: null })),
      stages: makeStages(d.teams.map((t) => t.teamId)),
    };
    set({ incursions: [...get().incursions, inc] });
    return id;
  },
  setHero: (incId, teamId, heroId) =>
    set({ incursions: patchInc(get().incursions, incId, (i) => ({ ...i, teams: i.teams.map((t) => (t.teamId === teamId ? { ...t, heroId } : t)) })) }),
  setEvaluation: (incId, teamId, ev) =>
    set({ incursions: patchInc(get().incursions, incId, (i) => ({ ...i, teams: i.teams.map((t) => (t.teamId === teamId ? { ...t, evaluation: ev } : t)) })) }),
  startStage: (incId, level) => {
    let bossId: string | null = null;
    set({
      incursions: patchInc(get().incursions, incId, (i) => {
        if (level === 4) {
          const active = get().bosses.filter((b) => b.active);
          bossId = active[Math.floor(Math.random() * active.length)]?.id ?? null;
        }
        return {
          ...i,
          status: "andamento",
          bossId: level === 4 ? bossId : i.bossId,
          stages: i.stages.map((s) => (s.level === level ? { ...s, status: "andamento", startedAt: now() } : s)),
        };
      }),
    });
    return bossId;
  },
  finishStage: (incId, level) =>
    set({
      incursions: patchInc(get().incursions, incId, (i) => ({
        ...i,
        stages: i.stages.map((s) => (s.level === level ? { ...s, status: "concluida", endedAt: now() } : s)),
      })),
    }),
  addTurn: (incId, t) => set({ incursions: patchInc(get().incursions, incId, (i) => ({ ...i, turns: [...i.turns, { ...t, id: uid("u") }] })) }),
  setResult: (incId, r) => set({ incursions: patchInc(get().incursions, incId, (i) => ({ ...i, result: r, status: "concluida" })) }),
}));

export function restoreSession() {
  if (typeof window === "undefined") return;
  if (!tokenStorage.read()) {
    useJornada.getState().setSession(null);
    return;
  }
  const raw = sessionStorage.getItem("jornada-session");
  if (raw) {
    try {
      const session = JSON.parse(raw);
      if (session?.role !== "professor" || typeof session.username !== "string" || typeof session.name !== "string") throw new Error("Invalid session");
      useJornada.setState({ session });
    } catch {
      useJornada.getState().setSession(null);
    }
  }
}
