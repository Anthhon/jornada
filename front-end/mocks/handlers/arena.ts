import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api-config";
import { isMockTeacher } from "../mock-teacher";

/**
 * Mock da Arena (raid) — espelha o motor de `back-end/apps/arena/engine.py`
 * (transições, dano, retaliação, recompensa única, **habilidades do chefe**
 * com notas por critério — ADR-017) para a UI funcionar sem o backend.
 * Persiste em `localStorage` (fallback em memória), como a agenda.
 */

/** v2: notas por critério, habilidades e corte de dano (ADR-017). */
const storageKey = "jornada-mock-arena-v2";

type Status = "CONFIG" | "RUNNING" | "PAUSED" | "ENDED";

/** Notas da rubric (mesmas chaves do back). */
const CRITERIA_KEYS = ["tempo", "historico", "paradigma", "caracteristicas", "usos", "codigo", "criatividade"] as const;

/** Habilidade executável (espela `BossAbility`). */
interface MockAbility {
  id: number;
  name: string;
  trigger: string;
  effect: string;
  value: number;
  every: number;
  threshold: number;
  mode: string;
  scope: string;
  min_count: number;
  description: string;
}

interface MockBoss {
  id: number;
  name: string;
  max_hp: number;
  abilities: MockAbility[];
}

interface TeamData {
  group_id: number;
  group_name: string;
  base_damage: number;
  battle_damage: number;
  retaliation_loss: number;
  manual_adjustment: number;
  criteria: Record<string, number> | null;
  wrong_answers: number;
  damage_factor: number;
}

interface MockEvent {
  id: number;
  kind: string;
  actor: string;
  group: number | null;
  group_name: string | null;
  value: number;
  message: string;
  created_at: string | null;
}

interface MockRound {
  id: number;
  name: string;
  status: Status;
  hp: number;
  max_hp: number;
  turn: number;
  level: number;
  multiplier: number;
  retaliation_ratio: number;
  reward_factor: number;
  boss: MockBoss;
  teams: Record<string, TeamData>;
  events: MockEvent[];
  rewards_credited: boolean;
}

interface MockArena {
  nextRoundId: number;
  nextEventId: number;
  rounds: MockRound[];
}

/** Os 7 chefes da landing com as habilidades executáveis (`seed_chefes`). */
function ability(
  id: number,
  name: string,
  trigger: string,
  effect: string,
  value: number,
  description: string,
  extra: Partial<Pick<MockAbility, "every" | "threshold" | "mode" | "scope" | "min_count">> = {},
): MockAbility {
  return { id, name, trigger, effect, value, every: 1, threshold: 3, mode: "ANY", scope: "TEAM", min_count: 1, description, ...extra };
}

const BOSSES: MockBoss[] = [
  {
    id: 1, name: "Mothman, o Sábio", max_hp: 150, abilities: [
      ability(1, "Olhar Hipnótico", "TEMPO", "PENALTY", 10, "Se a equipe não atingir a nota máxima em Tempo, a Aliança perde 10 pontos de Dano Base."),
      ability(2, "Asas de Sombras", "CONCEITO", "CUT", 50, "Se mais de uma equipe tirar Parcial ou Ausente em Paradigma ou Características, o dano extra dela é cortado pela metade.", { threshold: 2, scope: "ALLIANCE", min_count: 2 }),
      ability(3, "Enxame Noturno", "PERGUNTAS", "PENALTY", 10, "A cada duas perguntas erradas, a Aliança perde 10 pontos de Dano Base.", { every: 2 }),
    ],
  },
  {
    id: 2, name: "Rei Rato", max_hp: 150, abilities: [
      ability(4, "Olhar Hipnótico", "TEMPO", "PENALTY", 10, "Se a equipe não atingir a nota máxima em Tempo, a Aliança perde 10 pontos de Dano Base."),
      ability(5, "Asas de Sombras", "CONCEITO", "CUT", 50, "Se ao menos uma equipe tirar Parcial ou Ausente em Paradigma ou Características, o dano extra dela é cortado pela metade.", { threshold: 2, scope: "ALLIANCE", min_count: 1 }),
      ability(6, "Enxame Noturno", "PERGUNTAS", "PENALTY", 7, "A cada pergunta errada, a Aliança perde 7 pontos de Dano Base."),
    ],
  },
  {
    id: 3, name: "Leshy", max_hp: 130, abilities: [
      ability(7, "Raízes do Passado", "FUNDAMENTOS", "HEAL", 5, "Se a equipe tirar menos que a nota máxima em Histórico ou Paradigma, Leshy ganha imediatamente +5 PV."),
      ability(8, "Esporos Confusos", "DEMONSTRACAO", "DISADV", 50, "Sem a nota máxima em Principais Usos ou código, o dano extra dessa equipe é reduzido em 50% (desvantagem)."),
      ability(9, "Fungo do Dreno", "PERGUNTAS", "HEAL", 5, "A cada pergunta errada na Fase 2, Leshy recupera 5 PV."),
    ],
  },
  {
    id: 4, name: "A Sombra Espreitadora", max_hp: 130, abilities: [
      ability(10, "Dreno de Vitalidade", "FUNDAMENTOS", "HEAL", 5, "Se a equipe tirar menos que a nota máxima em Histórico ou Paradigma, a Sombra recupera +5 PV."),
      ability(11, "Emboscada nas Sombras", "DEMONSTRACAO", "CUT", 50, "Sem a nota máxima em Principais Usos ou código, o dano extra dessa equipe é cortado pela metade."),
      ability(12, "Ataque do Saqueador", "PERGUNTAS", "DRAIN", 5, "A cada pergunta errada, drena 5 de Dano Base da Aliança e soma ao próprio HP."),
    ],
  },
  {
    id: 5, name: "O Colecionador de Ossos", max_hp: 130, abilities: [
      ability(13, "Sopro de Ácido", "GERAL", "PENALTY", 5, "Se a média dos critérios ficar abaixo de Satisfatório, a Aliança perde 5 pontos de Dano Base.", { mode: "AVERAGE", threshold: 1 }),
      ability(14, "Rajada de Vento", "TEMPO", "DISADV", 50, "Se a equipe não atingir a nota máxima em Tempo, seus dados extras de dano são reduzidos em 50% (desvantagem)."),
      ability(15, "Rugido do Medo", "PERGUNTAS", "PENALTY", 10, "A cada pergunta errada, a Aliança perde 10 pontos de Dano Base."),
    ],
  },
  {
    id: 6, name: "O Colecionador de Faces", max_hp: 130, abilities: [
      ability(16, "Máscara da Confusão", "GERAL", "PENALTY", 5, "Com notas muito variadas (2 níveis ou mais de diferença), a Aliança perde 5 pontos de Dano Base.", { mode: "SPREAD", threshold: 2 }),
      ability(17, "Máscara da Discórdia", "SUPORTE", "PR_COST", 2, "Habilidades de suporte custam 2 PR a mais (informativo: a raid ainda não usa o sistema de PR)."),
      ability(18, "Máscara do Silêncio", "PERGUNTAS", "PENALTY", 5, "A cada pergunta errada, a Aliança perde 5 pontos de Dano Base."),
    ],
  },
  {
    id: 7, name: "O Mago Corrompido", max_hp: 200, abilities: [
      ability(19, "Distorção Temporal", "TEMPO", "DISADV", 50, "Se a média de Tempo das equipes ficar abaixo da nota máxima, todas afetadas sofrem desvantagem no dano extra.", { scope: "ALLIANCE", min_count: 1 }),
      ability(20, "Cegueira das Sombras", "CONCEITO", "DISADV", 50, "Sem a nota máxima em Paradigma ou Características, o dano extra da equipe é reduzido em 50%."),
      ability(21, "Aniquilação da Alma", "PERGUNTAS", "DRAIN", 5, "A cada pergunta errada, drena 5 de Dano Base e soma ao próprio HP."),
    ],
  },
];

/** Equipes que o `start` registra (o back-end registra todos os grupos ativos). */
const SEED_TEAMS = [
  { group_id: 1, group_name: "Equipe Alfa" },
  { group_id: 2, group_name: "Equipe Beta" },
  { group_id: 3, group_name: "Equipe Gama" },
];

function seed(): MockArena {
  const boss = BOSSES[0];
  return {
    nextRoundId: 2,
    nextEventId: 1,
    rounds: [
      {
        id: 1,
        name: "Rodada 1",
        status: "CONFIG",
        // PV da raid (escala de arena); o PV do chefe no catálogo é identidade.
        hp: 15000,
        max_hp: 15000,
        turn: 0,
        level: 1,
        multiplier: 1.5,
        retaliation_ratio: 0.25,
        reward_factor: 1,
        boss: { ...boss },
        teams: {},
        events: [],
        rewards_credited: false,
      },
    ],
  };
}

let memory = JSON.stringify(seed());

function read(): MockArena {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? memory) as MockArena;
  } catch {
    return JSON.parse(memory) as MockArena;
  }
}

function write(value: MockArena): void {
  memory = JSON.stringify(value);
  try {
    localStorage.setItem(storageKey, memory);
  } catch {
    /* sem armazenamento: segue em memória */
  }
}

const error = (detail: string, status = 400) => HttpResponse.json({ detail }, { status });

function teamPoints(round: MockRound, team: TeamData): number {
  const total = team.base_damage + team.battle_damage;
  return Math.max(0, Math.round(total * round.reward_factor) - team.retaliation_loss + team.manual_adjustment);
}

function toState(round: MockRound) {
  const teams = Object.values(round.teams)
    .map((team) => ({
      ...team,
      total_damage: team.base_damage + team.battle_damage,
      points: teamPoints(round, team),
    }))
    .sort((a, b) => b.points - a.points || b.total_damage - a.total_damage || a.group_id - b.group_id)
    .map((team, index) => ({ ...team, position: index + 1 }));
  return {
    id: round.id,
    name: round.name,
    status: round.status,
    hp: round.hp,
    max_hp: round.max_hp,
    turn: round.turn,
    level: round.level,
    multiplier: round.multiplier,
    retaliation_ratio: round.retaliation_ratio,
    reward_factor: round.reward_factor,
    boss: round.boss,
    events: round.events,
    rewards_credited: round.rewards_credited,
    teams,
  };
}

function toSummary(round: MockRound) {
  return {
    id: round.id,
    name: round.name,
    boss: round.boss.id,
    status: round.status,
    level: round.level,
    max_hp: round.max_hp,
    hp: round.hp,
  };
}

function logEvent(
  arena: MockArena,
  round: MockRound,
  kind: string,
  actor: string,
  group: number | null,
  value: number,
  message: string,
): void {
  round.events.push({
    id: arena.nextEventId++,
    kind,
    actor,
    group,
    group_name: group != null ? (round.teams[String(group)]?.group_name ?? null) : null,
    value,
    message,
    created_at: new Date().toISOString(),
  });
}

function creditRewards(arena: MockArena, round: MockRound): void {
  if (round.status !== "ENDED" || round.rewards_credited) return;
  for (const team of Object.values(round.teams)) {
    const pts = teamPoints(round, team);
    if (pts > 0) {
      logEvent(arena, round, "REWARD", "SYSTEM", team.group_id, pts, `Recompensa: ${pts} pontos para a equipe.`);
    }
  }
  round.rewards_credited = true;
}

function checkVictory(arena: MockArena, round: MockRound): void {
  if (round.hp <= 0 && round.status !== "ENDED") {
    round.status = "ENDED";
    logEvent(arena, round, "END", "SYSTEM", null, 0, "Chefe derrotado!");
    creditRewards(arena, round);
  }
}

/** Desempenho padrão da equipe (escala definida pela camada de serviço). */
function defaultPerformance(groupId: number): number {
  return 40 + ((groupId * 17) % 45);
}

/** Desempenho derivado das notas (fórmula do front, ignora Tempo — ADR-017). */
function derivedPerformance(criteria: Record<string, number>): number {
  const total = CRITERIA_KEYS.filter((key) => key !== "tempo")
    .reduce((sum, key) => sum + criteria[key], 0);
  const grade = (total * 10) / 18;
  return Math.max(0, Math.min(10, grade)) * 100;
}

/** Qual gatilho observa quais critérios (espelha `TRIGGER_CRITERIA`). */
const TRIGGER_CRITERIA: Record<string, string[]> = {
  TEMPO: ["tempo"],
  CONCEITO: ["paradigma", "caracteristicas"],
  FUNDAMENTOS: ["historico", "paradigma"],
  DEMONSTRACAO: ["usos", "codigo"],
  GERAL: [...CRITERIA_KEYS],
  SUPORTE: [],
  PERGUNTAS: [],
};

/** A condição da habilidade vale para essas notas? (espelha `affected`). */
function affected(ability: MockAbility, criteria: Record<string, number> | null): boolean {
  if (!criteria) return false;
  const keys = TRIGGER_CRITERIA[ability.trigger] ?? [];
  if (keys.length === 0) return false;
  const scores = keys.map((key) => criteria[key]).filter((score) => typeof score === "number");
  if (scores.length === 0) return false;
  if (ability.mode === "AVERAGE") {
    return scores.reduce((sum, score) => sum + score, 0) / scores.length < ability.threshold;
  }
  if (ability.mode === "SPREAD") {
    return Math.max(...scores) - Math.min(...scores) >= ability.threshold;
  }
  return scores.some((score) => score < ability.threshold);
}

const EXECUTABLE = new Set(["PENALTY", "HEAL", "DRAIN", "CUT", "DISADV"]);

/** Aplica o efeito no estado; devolve a mensagem do log (ou `null`). */
function applyAbility(round: MockRound, team: TeamData, ability: MockAbility): string | null {
  if (!EXECUTABLE.has(ability.effect)) return null; // ex.: PR_COST (informativo)
  const value = ability.value;
  if (value <= 0) return null;
  switch (ability.effect) {
    case "PENALTY": {
      const applied = Math.min(team.base_damage, value);
      team.base_damage -= applied;
      return `${ability.name}: a equipe perdeu ${applied} de Dano Base!`;
    }
    case "HEAL": {
      const before = round.hp;
      round.hp = Math.min(round.max_hp, round.hp + value);
      return `${ability.name}: o chefe recuperou ${round.hp - before} PV!`;
    }
    case "DRAIN": {
      const applied = Math.min(team.base_damage, value);
      team.base_damage -= applied;
      const before = round.hp;
      round.hp = Math.min(round.max_hp, round.hp + applied);
      return `${ability.name}: drenou ${applied} de Dano Base e o chefe recuperou ${round.hp - before} PV!`;
    }
    case "CUT":
    case "DISADV": {
      const cut = Math.min(1, value / 100);
      // O corte mais forte vence (não multiplica entre si).
      team.damage_factor = Math.min(team.damage_factor, 1 - cut);
      return `${ability.name}: dano de ataque da equipe cortado em ${value}%!`;
    }
    default:
      return null;
  }
}

/** Avalia os gatilhos por critério no registro do desempenho (com notas). */
function evaluateCriteriaAbilities(arena: MockArena, round: MockRound, team: TeamData): void {
  if (!team.criteria) return;
  for (const ability of round.boss.abilities) {
    if (!(TRIGGER_CRITERIA[ability.trigger]?.length)) continue; // PERGUNTAS/SUPORTE
    let fires: boolean;
    if (ability.scope === "ALLIANCE") {
      const count = Object.values(round.teams).filter(
        (other) => other.criteria && affected(ability, other.criteria),
      ).length;
      fires = affected(ability, team.criteria) && count >= Math.max(1, ability.min_count);
    } else {
      fires = affected(ability, team.criteria);
    }
    if (!fires) continue;
    const message = applyAbility(round, team, ability);
    if (message !== null) logEvent(arena, round, "ABILITY", "BOS", team.group_id, ability.value, message);
  }
}

/** Avalia os gatilhos "Perguntas" a cada `every` erros da equipe. */
function evaluateQuestionAbilities(arena: MockArena, round: MockRound, team: TeamData): void {
  for (const ability of round.boss.abilities) {
    if (ability.trigger !== "PERGUNTAS" || team.wrong_answers <= 0) continue;
    if (team.wrong_answers % Math.max(1, ability.every) !== 0) continue;
    const message = applyAbility(round, team, ability);
    if (message !== null) logEvent(arena, round, "ABILITY", "BOS", team.group_id, ability.value, message);
  }
}

/** Valida as 7 notas da rubric; devolve o erro (string) ou o mapa de notas. */
function validateCriteria(raw: unknown): string | Record<string, number> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "Notas inválidas.";
  const obj = raw as Record<string, unknown>;
  const missing = CRITERIA_KEYS.filter((key) => !(key in obj));
  if (missing.length) return `Notas incompletas: faltam ${missing.join(", ")}.`;
  const extra = Object.keys(obj).filter((key) => !CRITERIA_KEYS.includes(key as (typeof CRITERIA_KEYS)[number]));
  if (extra.length) return `Critérios desconhecidos: ${extra.join(", ")}.`;
  const out: Record<string, number> = {};
  for (const key of CRITERIA_KEYS) {
    const score = Number(obj[key]);
    if (!Number.isInteger(score) || ![-1, 1, 3].includes(score)) {
      return `Nota inválida em '${key}': use 3 (Bom), 1 (Parcial) ou -1.`;
    }
    out[key] = score;
  }
  return out;
}

/** Aplica a ação; devolve a mensagem de erro (400) ou `null` em sucesso. */
function applyAction(arena: MockArena, round: MockRound, action: string, body: Record<string, unknown>): string | null {
  const notRunning = round.status === "RUNNING" ? null : "A batalha não está em andamento.";

  switch (action) {
    case "start": {
      if (round.status !== "CONFIG") return "A batalha já foi iniciada.";
      for (const team of SEED_TEAMS) {
        round.teams[String(team.group_id)] ??= {
          ...team,
          base_damage: 0,
          battle_damage: 0,
          retaliation_loss: 0,
          manual_adjustment: 0,
          criteria: null,
          wrong_answers: 0,
          damage_factor: 1,
        };
      }
      round.status = "RUNNING";
      logEvent(arena, round, "START", "SYSTEM", null, 0, "Batalha iniciada.");
      return null;
    }
    case "pause": {
      if (round.status !== "RUNNING") return "Só é possível pausar uma batalha em andamento.";
      round.status = "PAUSED";
      logEvent(arena, round, "PAUSE", "SYSTEM", null, 0, "Batalha pausada.");
      return null;
    }
    case "resume": {
      if (round.status !== "PAUSED") return "Só é possível retomar uma batalha pausada.";
      round.status = "RUNNING";
      logEvent(arena, round, "RESUME", "SYSTEM", null, 0, "Batalha retomada.");
      return null;
    }
    case "end": {
      if (round.status !== "RUNNING" && round.status !== "PAUSED") return "A batalha não está em andamento.";
      round.status = "ENDED";
      logEvent(arena, round, "END", "SYSTEM", null, 0, "Batalha encerrada.");
      creditRewards(arena, round);
      return null;
    }
    case "attack": {
      if (notRunning) return notRunning;
      const groupId = Number(body.group_id);
      const team = round.teams[String(groupId)];
      if (!team) return "Equipe não registrada nesta batalha.";
      const correct = Boolean(body.correct);
      const points = Math.max(0, Math.trunc(Number(body.points) || 0));
      round.turn += 1;
      if (!correct) {
        logEvent(arena, round, "DAMAGE", "TEAM", groupId, 0, "A equipe errou o ataque.");
        team.wrong_answers += 1;
        evaluateQuestionAbilities(arena, round, team);
        checkVictory(arena, round);
        return null;
      }
      // Acerto: dano com o corte das habilidades (damage_factor).
      const damage = team.damage_factor < 1
        ? Math.max(0, Math.round(points * team.damage_factor))
        : points;
      team.battle_damage += damage;
      round.hp = Math.max(0, round.hp - damage);
      logEvent(arena, round, "DAMAGE", "TEAM", groupId, damage, `A equipe causou ${damage} de dano!`);
      const retaliation = Math.round(damage * round.retaliation_ratio);
      if (retaliation > 0) {
        team.retaliation_loss += retaliation;
        logEvent(arena, round, "RETALIATION", "BOS", groupId, retaliation, `O chefe retaliou! A equipe perdeu ${retaliation} pontos!`);
      }
      checkVictory(arena, round);
      return null;
    }
    case "apply-performance": {
      if (notRunning) return notRunning;
      const groupProvided = body.group_id != null && body.group_id !== "";
      let criteria: Record<string, number> | null = null;
      if (body.criteria != null) {
        if (!groupProvided) return "Notas por critério exigem group_id (registro por equipe).";
        const validated = validateCriteria(body.criteria);
        if (typeof validated === "string") return validated;
        criteria = validated;
      }
      const targets = groupProvided
        ? [Number(body.group_id)]
        : Object.values(round.teams).map((team) => team.group_id);
      for (const groupId of targets) {
        const team = round.teams[String(groupId)];
        if (!team) return "Equipe não registrada nesta batalha.";
        if (criteria) {
          if (team.criteria) return "Desempenho já registrado para esta equipe.";
          team.criteria = { ...criteria };
        }
        const performance = criteria != null && body.performance == null
          ? derivedPerformance(criteria)
          : Number(body.performance) || defaultPerformance(groupId);
        const damage = Math.round(performance * round.multiplier);
        if (damage > 0) {
          team.base_damage += damage;
          round.hp = Math.max(0, round.hp - damage);
          logEvent(arena, round, "DAMAGE", "TEAM", groupId, damage, `A equipe causou ${damage} de dano (desempenho).`);
        } else if (criteria == null) {
          continue;
        }
        round.turn += 1;
        if (criteria != null) evaluateCriteriaAbilities(arena, round, team);
        checkVictory(arena, round);
        if (round.status === "ENDED") break;
      }
      return null;
    }
    case "damage": {
      if (notRunning) return notRunning;
      const groupId = Number(body.group_id);
      const team = round.teams[String(groupId)];
      if (!team) return "Equipe não registrada nesta batalha.";
      const damage = Math.trunc(Number(body.damage) || 0);
      if (damage <= 0) return null;
      team.battle_damage += damage;
      round.hp = Math.max(0, round.hp - damage);
      round.turn += 1;
      logEvent(arena, round, "DAMAGE", "SYSTEM", groupId, damage, `Dano manual de ${damage}.`);
      checkVictory(arena, round);
      return null;
    }
    case "override": {
      const groupId = Number(body.group_id);
      const team = round.teams[String(groupId)];
      if (!team) return "Equipe não registrada nesta batalha.";
      const amount = Math.trunc(Number(body.amount) || 0);
      if (!amount) return null;
      team.manual_adjustment += amount;
      logEvent(arena, round, "REWARD", "SYSTEM", groupId, amount, `Ajuste manual de ${amount} pontos na equipe.`);
      return null;
    }
    default:
      return "Ação desconhecida.";
  }
}

const ACTIONS = ["start", "pause", "resume", "end", "attack", "apply-performance", "damage", "override"];

export const arenaHandlers = [
  // Chefes para o formulário de nova rodada (o catálogo mock usa /mock-catalog/).
  http.get(`${API_BASE_URL}/bosses/`, () => HttpResponse.json(BOSSES)),

  http.get(`${API_BASE_URL}/arena/rounds/`, () => {
    try {
      return HttpResponse.json(read().rounds.map(toSummary));
    } catch {
      return error("Não foi possível carregar as rodadas.", 500);
    }
  }),

  http.get(`${API_BASE_URL}/arena/rounds/:id/state/`, ({ params }) => {
    try {
      const round = read().rounds.find((item) => item.id === Number(params.id));
      if (!round) return error("Rodada não encontrada.", 404);
      return HttpResponse.json(toState(round));
    } catch {
      return error("Não foi possível carregar a batalha.", 500);
    }
  }),

  http.post(`${API_BASE_URL}/arena/rounds/`, async ({ request }) => {
    if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
    let body: {
      name?: string;
      boss?: number;
      max_hp?: number;
      level?: number;
      multiplier?: number;
      retaliation_ratio?: number;
      reward_factor?: number;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return error("JSON inválido.");
    }
    const name = body.name?.trim();
    const boss = BOSSES.find((item) => item.id === Number(body.boss));
    if (!name || !boss) return error("Informe o nome e o chefe da rodada.");
    try {
      const arena = read();
      const maxHp = Math.max(1, Number(body.max_hp) || boss.max_hp);
      const round: MockRound = {
        id: arena.nextRoundId++,
        name,
        status: "CONFIG",
        hp: maxHp,
        max_hp: maxHp,
        turn: 0,
        level: Math.max(1, Number(body.level) || 1),
        multiplier: Number(body.multiplier) || 1.5,
        retaliation_ratio: Number(body.retaliation_ratio ?? 0.25),
        reward_factor: Number(body.reward_factor ?? 1),
        boss: { ...boss },
        teams: {},
        events: [],
        rewards_credited: false,
      };
      arena.rounds.unshift(round);
      write(arena);
      return HttpResponse.json(toSummary(round), { status: 201 });
    } catch {
      return error("Não foi possível criar a rodada.", 500);
    }
  }),

  ...ACTIONS.map((action) =>
    http.post(`${API_BASE_URL}/arena/rounds/:id/${action}/`, async ({ request, params }) => {
      if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
      let body: Record<string, unknown> = {};
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }
      try {
        const arena = read();
        const round = arena.rounds.find((item) => item.id === Number(params.id));
        if (!round) return error("Rodada não encontrada.", 404);
        const failure = applyAction(arena, round, action, body);
        if (failure) return error(failure);
        write(arena);
        return HttpResponse.json(toState(round));
      } catch {
        return error("Não foi possível executar a ação.", 500);
      }
    }),
  ),
];
