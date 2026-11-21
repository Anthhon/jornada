import type { ArenaGroupOption, ArenaRound } from "../schemas/arena";

/**
 * Rascunho da tela de Configuração da Rodada (M-49). Tudo string — os
 * inputs são controlados; a conversão/validação acontece aqui, puro e
 * testável. Campo numérico vazio ou inválido é tratado como "sem troca".
 */
export interface RoundConfigDraft {
  date: string;
  deadline: string;
  multiplier: string;
  retaliation_ratio: string;
  reward_factor: string;
  treasure: string;
  balance_ref_teams: string;
  level: string;
  max_hp: string;
  /** group_id -> placar da rodada (string). */
  scores: Record<string, string>;
}

export interface ScoreOverride {
  group_id: number;
  amount: number;
}

export interface SaveScope {
  /** Parâmetros da fórmula só mudam em CONFIG (a UI trava fora disso). */
  includeRules: boolean;
}

/** Parâmetros numéricos da rodada (espelham `ArenaRound`). */
export const RULE_NUMERIC_FIELDS = [
  "multiplier",
  "retaliation_ratio",
  "reward_factor",
  "treasure",
  "balance_ref_teams",
  "level",
  "max_hp",
] as const;

function toNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Rascunho de partida: datas/parâmetros da rodada + placar por equipe. */
export function baseDraft(
  round: ArenaRound,
  groups: ArenaGroupOption[],
): RoundConfigDraft {
  const scores: Record<string, string> = {};
  for (const group of groups) {
    const contribution = round.contributions?.find(
      (item) => item.group === group.id,
    );
    scores[String(group.id)] = String(contribution?.points ?? 0);
  }
  return {
    date: round.date ?? "",
    deadline: round.deadline ?? "",
    multiplier: String(round.multiplier ?? 1.5),
    retaliation_ratio: String(round.retaliation_ratio ?? 0.25),
    reward_factor: String(round.reward_factor ?? 1),
    treasure: String(round.treasure ?? 0),
    balance_ref_teams: String(round.balance_ref_teams ?? 4),
    level: String(round.level ?? 1),
    max_hp: String(round.max_hp),
    scores,
  };
}

/**
 * Datas + parâmetros que mudaram de verdade (payload do PATCH).
 * Datas vazias viram `null`; números só entram se forem válidos e
 * diferentes do valor do servidor.
 */
export function changedRoundFields(
  base: RoundConfigDraft,
  draft: RoundConfigDraft,
  scope: SaveScope,
): Record<string, string | number | null> {
  const payload: Record<string, string | number | null> = {};
  if (draft.date !== base.date) payload.date = draft.date || null;
  if (draft.deadline !== base.deadline) payload.deadline = draft.deadline || null;
  if (scope.includeRules) {
    for (const field of RULE_NUMERIC_FIELDS) {
      const next = toNumber(draft[field]);
      const current = toNumber(base[field]);
      if (next !== null && next !== current) payload[field] = next;
    }
  }
  return payload;
}

/**
 * Placares alterados como **delta** (o backend soma no ajuste manual):
 * amount = valor novo − valor do servidor. Inalterados/inválidos saem.
 */
export function scoreOverrides(
  base: RoundConfigDraft,
  draft: RoundConfigDraft,
): ScoreOverride[] {
  const out: ScoreOverride[] = [];
  for (const [key, value] of Object.entries(draft.scores)) {
    // Só o que a base conhece: grupo que saiu da lista (ficou inativo
    // entre recargas) não pode virar override — o backend recusaria.
    if (!Object.prototype.hasOwnProperty.call(base.scores, key)) continue;
    const next = toNumber(value);
    const current = toNumber(base.scores[key]);
    if (next === null || current === null || next === current) continue;
    out.push({ group_id: Number(key), amount: Math.round(next - current) });
  }
  return out;
}

/** `true` quando há qualquer alteração pendente no escopo informado. */
export function isDraftDirty(
  base: RoundConfigDraft,
  draft: RoundConfigDraft,
  scope: SaveScope,
): boolean {
  return (
    Object.keys(changedRoundFields(base, draft, scope)).length > 0 ||
    scoreOverrides(base, draft).length > 0
  );
}

/** Data de hoje em `AAAA-MM-DD` (fuso local — comparação lexicográfica). */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Prazo vencido (M-50): a entrega passou e a disputa ainda não terminou —
 * a UI avisa o professor para remarcar ou cobrar as equipes.
 */
export function isOverdue(
  deadline: string,
  status: string,
  today: string = todayIso(),
): boolean {
  return Boolean(deadline) && status !== "ENDED" && deadline < today;
}

/**
 * Aviso do reset de uma equipe (M-51): o professor confirma sabendo que
 * os ataques são zerados, o PV do chefe recebe o dano de volta, o
 * registro sai do log — e que a equipe segue na batalha (dá para
 * desfazer pelo botão Desfazer).
 */
export function resetTeamWarning(name: string): string {
  return (
    `Os ataques, notas e o placar de ${name} serão zerados nesta rodada. ` +
    "O PV do chefe será restaurado com o dano exato que a equipe causou e " +
    "o registro dela sai do log da batalha. A equipe continua na partida e " +
    "poderá atacar (e ser notada) de novo — dá para desfazer pelo botão " +
    "Desfazer."
  );
}
