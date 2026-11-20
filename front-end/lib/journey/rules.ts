import type { DiceRoll } from "@/features/journey";
import type { Evaluation, Incursion, Turn } from "@/features/missions";

/** Nota da apresentação: ignora Tempo; 18 pontos = 10, limitada entre 0 e 10. */
export function presentationGrade(ev: Evaluation | null): number | null {
  if (!ev) return null;
  const sum = Object.entries(ev.criteria)
    .filter(([criterion]) => criterion !== "tempo")
    .reduce((total, [, score]) => total + score, 0);
  const grade = (sum * 10) / 18;
  return Math.round(Math.min(10, Math.max(0, grade)) * 100) / 100;
}

/** Pontos de recurso: 1 por acerto, de 0 a 5. */
export function resourcePoints(correct: number): number {
  return Math.min(5, Math.max(0, Math.floor(correct)));
}

/** Bônus por vitórias: 3 → +0,5; 2 → +0,5; 1 → +0,2. */
export function victoryBonus(victories: number): number {
  if (victories >= 2) return 0.5;
  if (victories === 1) return 0.2;
  return 0;
}

/** Nota da equipe (AP1): média das notas das incursões + bônus de vitórias, limitada a 10. */
export function teamGrade(teamId: string, incursions: Incursion[]): number | null {
  const grades: number[] = [];
  let victories = 0;
  for (const inc of incursions) {
    const it = inc.teams.find((t) => t.teamId === teamId);
    if (!it) continue;
    const g = presentationGrade(it.evaluation);
    if (g !== null) grades.push(g);
    if (inc.result === "vitoria") victories++;
  }
  if (grades.length === 0) return null;
  const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
  return Math.round(Math.min(10, avg + victoryBonus(victories)) * 100) / 100;
}

/** HP restante: dano reduz, cura do chefe aumenta. */
export function remainingHp(maxHp: number, turns: Turn[]): number {
  let hp = maxHp;
  for (const t of turns) {
    if (t.effect === "dano" && t.actor !== "chefe") hp -= t.value;
    if (t.effect === "cura" && t.actor === "chefe") hp += t.value;
  }
  return Math.max(0, hp);
}

/** Rola uma expressão no formato XdY(+Z). */
export function rollDice(expr: string, rng: () => number = Math.random): DiceRoll | null {
  const m = expr.trim().match(/^(\d+)d(\d+)\s*([+-]\s*\d+)?$/i);
  if (!m) return null;
  const count = Number(m[1]);
  const faces = Number(m[2]);
  const modifier = m[3] ? Number(m[3].replace(/\s/g, "")) : 0;
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(rng() * faces));
  return { expression: expr, rolls, modifier, total: rolls.reduce((a, b) => a + b, 0) + modifier };
}

export function isValidDice(expr: string): boolean {
  return /^(\d+)d(\d+)\s*([+-]\s*\d+)?$/i.test(expr.trim());
}
