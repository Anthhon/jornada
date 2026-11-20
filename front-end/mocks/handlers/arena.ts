import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api-config";
import { isMockTeacher } from "../mock-teacher";

/**
 * Mock da Arena (raid) — espelha o motor de `back-end/apps/arena/engine.py`
 * (transições, dano, retaliação, recompensa única) para a UI funcionar sem o
 * backend. Persiste em `localStorage` (fallback em memória), como a agenda.
 */

const storageKey = "jornada-mock-arena-v1";

type Status = "CONFIG" | "RUNNING" | "PAUSED" | "ENDED";

interface TeamData {
  group_id: number;
  group_name: string;
  base_damage: number;
  battle_damage: number;
  retaliation_loss: number;
  manual_adjustment: number;
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
  boss: { id: number; name: string; max_hp: number };
  teams: Record<string, TeamData>;
  events: MockEvent[];
  rewards_credited: boolean;
}

interface MockArena {
  nextRoundId: number;
  nextEventId: number;
  rounds: MockRound[];
}

const BOSSES = [
  { id: 1, name: "Vigia das Ruínas", max_hp: 15000 },
  { id: 2, name: "Colosso de Pedra", max_hp: 22000 },
  { id: 3, name: "Espectro do Abismo", max_hp: 12000 },
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
        hp: boss.max_hp,
        max_hp: boss.max_hp,
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
        return null;
      }
      team.battle_damage += points;
      round.hp = Math.max(0, round.hp - points);
      logEvent(arena, round, "DAMAGE", "TEAM", groupId, points, `A equipe causou ${points} de dano!`);
      const retaliation = Math.round(points * round.retaliation_ratio);
      if (retaliation > 0) {
        team.retaliation_loss += retaliation;
        logEvent(arena, round, "RETALIATION", "BOS", groupId, retaliation, `O chefe retaliou! A equipe perdeu ${retaliation} pontos!`);
      }
      checkVictory(arena, round);
      return null;
    }
    case "apply-performance": {
      if (notRunning) return notRunning;
      const only =
        body.group_id != null && body.group_id !== ""
          ? [Number(body.group_id)]
          : Object.values(round.teams).map((team) => team.group_id);
      for (const groupId of only) {
        const team = round.teams[String(groupId)];
        if (!team) return "Equipe não registrada nesta batalha.";
        const performance = Number(body.performance) || defaultPerformance(groupId);
        const damage = Math.round(performance * round.multiplier);
        if (damage <= 0) continue;
        team.base_damage += damage;
        round.hp = Math.max(0, round.hp - damage);
        round.turn += 1;
        logEvent(arena, round, "DAMAGE", "TEAM", groupId, damage, `A equipe causou ${damage} de dano (desempenho).`);
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
        boss: { id: boss.id, name: boss.name, max_hp: boss.max_hp },
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
