import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api-config";
import { isMockTeacher } from "../mock-teacher";

/**
 * Mock da Arena (raid) — espelha o motor de `back-end/apps/arena/engine.py`
 * (transições, dano, retaliação, recompensa única, **habilidades do chefe**
 * com notas por critério — ADR-017; **saque/desfecho** — ADR-018; **d20 nas
 * habilidades de equipe** — ADR-019; **escala do bando** — ADR-020;
 * **habilidades 3+1 da equipe** — ADR-021) para a UI funcionar sem o backend.
 * Persiste em `localStorage` (fallback em memória), como a agenda.
 */

/** v4: gerência de rodadas — reabrir/estorno, PV editável, desfazer (M-50).
 *  v5: reset completo de equipe — vazamento de log + devolução de PV (M-51). */
const storageKey = "jornada-mock-arena-v5";

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

/** Habilidade de equipe atribuída (espela `GroupAbility` — ADR-021). */
interface MockTeamAbility {
  id: number;
  template_id: number;
  name: string;
  kind: string; // BASIC | ULTIMATE
  effect: string; // STRIKE | HEAL | SHIELD | BUFF
  value: number;
  max_charges: number;
  charges_left: number;
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
  shield: number;
  damage_buff: number;
  abilities: MockTeamAbility[];
}

interface MockEvent {
  id: number;
  kind: string;
  actor: string;
  group: number | null;
  group_name: string | null;
  value: number;
  message: string;
  roll: number | null;
  ability_id: number | null;
  ability_name: string | null;
  created_at: string | null;
  /** Checkpoint antes da ação reversível (desfazer, M-50) — não vira estado. */
  snapshot?: unknown;
  /** Oculto do log — equipe resetada (M-51); o desfazer desazê. */
  voided?: boolean;
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
  balance_ref_teams: number;
  treasure: number;
  /** Datas da tela de configuração (M-49); `null` = não definida. */
  date: string | null;
  deadline: string | null;
  outcome: "" | "VICTORY" | "RETREAT";
  killing_team: number | null;
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

/** Catálogo 3+1 do mock (espelha `seed_habilidades_equipe`, tema Floresta). */
const TEAM_TEMPLATES: Omit<MockTeamAbility, "id" | "charges_left">[] = [
  { template_id: 101, name: "Golpe de Raiz", kind: "BASIC", effect: "STRIKE", value: 150, max_charges: 2 },
  { template_id: 102, name: "Seiva Restauradora", kind: "BASIC", effect: "HEAL", value: 40, max_charges: 2 },
  { template_id: 103, name: "Fúria Verde", kind: "BASIC", effect: "BUFF", value: 30, max_charges: 2 },
  { template_id: 104, name: "Tempestade de Espinhos", kind: "ULTIMATE", effect: "STRIKE", value: 500, max_charges: 1 },
];

/** Modelo do catálogo de habilidades (`GET /team-abilities/`, ADR-021). */
interface TeamAbilityCatalogItem {
  id: number;
  theme: string;
  name: string;
  kind: string;
  effect: string;
  value: number;
  max_charges: number;
  description: string;
}

const FLORESTA_DESCRIPTIONS: Record<number, string> = {
  101: "Raízes irrompem sob o chefe: 150 de dano direto (antes do d20).",
  102: "Recupera até 40 pontos perdidos em retaliações do chefe.",
  103: "O próximo ataque da equipe vale +30%.",
  104: "Chuva de espinhos: 500 de dano direto ao chefe (antes do d20).",
};

/** 2 temas × (3 + 1) — espelha o seed real (Floresta atribuída no start). */
const TEAM_ABILITY_CATALOG: TeamAbilityCatalogItem[] = [
  ...TEAM_TEMPLATES.map((item) => ({
    id: item.template_id,
    theme: "Floresta",
    name: item.name,
    kind: item.kind,
    effect: item.effect,
    value: item.value,
    max_charges: item.max_charges,
    description: FLORESTA_DESCRIPTIONS[item.template_id] ?? "",
  })),
  { id: 105, theme: "Vulcão", name: "Lança de Magma", kind: "BASIC", effect: "STRIKE", value: 150, max_charges: 2, description: "Uma lança de rocha derretida: 150 de dano direto (antes do d20)." },
  { id: 106, theme: "Vulcão", name: "Escudo de Basalto", kind: "BASIC", effect: "SHIELD", value: 60, max_charges: 2, description: "Escudo de 60 pontos: absorve retaliações e penalidades." },
  { id: 107, theme: "Vulcão", name: "Ebulição", kind: "BASIC", effect: "BUFF", value: 30, max_charges: 2, description: "O próximo ataque da equipe vale +30%." },
  { id: 108, theme: "Vulcão", name: "Erupção", kind: "ULTIMATE", effect: "STRIKE", value: 500, max_charges: 1, description: "O caldeirão explode: 500 de dano direto ao chefe (antes do d20)." },
];

/** Fatia do saque para quem desferiu o golpe final (ADR-018). */
const FINAL_BLOW_SHARE = 0.1;

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
        balance_ref_teams: 4,
        treasure: 500,
        date: null,
        deadline: null,
        outcome: "",
        killing_team: null,
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

/** Escala do bando (ADR-020): `clamp(ref / n, 0.5, 2)`; ref 0 = desligada. */
function balanceFactor(round: MockRound): number {
  const n = Object.keys(round.teams).length;
  if (round.balance_ref_teams <= 0 || n <= 0) return 1;
  return Math.max(0.5, Math.min(2, round.balance_ref_teams / n));
}

/** Cargas de habilidade com a escala do bando (ADR-020). */
function scaledCharges(base: number, ref: number, n: number): number {
  if (ref <= 0 || n <= 0) return base;
  return Math.max(1, Math.floor((base * ref) / n + 0.5));
}

/** d20 (ADR-019): 19–20 crítico ×2, 1–2 falha ×0.5. */
function d20Multiplier(roll: number): number {
  if (roll >= 19) return 2;
  if (roll <= 2) return 0.5;
  return 1;
}

/** Reduz o PV do chefe e anota o golpe final (ADR-018). */
function dealBossDamage(round: MockRound, damage: number, groupId?: number): void {
  if (damage <= 0) return;
  const before = round.hp;
  round.hp = Math.max(0, round.hp - damage);
  if (before > 0 && round.hp <= 0 && groupId != null && round.killing_team == null) {
    round.killing_team = groupId;
  }
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
    balance_ref_teams: round.balance_ref_teams,
    treasure: round.treasure,
    outcome: round.outcome,
    balance: balanceFactor(round),
    boss: round.boss,
    // O checkpoint (M-50) é interno: some do estado público, como no back.
    // Vazados (reset de equipe, M-51) também ficam fora do log exibido.
    events: round.events
      .filter((ev) => !ev.voided)
      .map((ev) => ({ ...ev, snapshot: undefined })),
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
    // Configuração da rodada (M-49) — o store persistido pode não ter
    // estes campos; a chave some do JSON e o zod aceita (`nullish`).
    date: round.date ?? null,
    deadline: round.deadline ?? null,
    multiplier: round.multiplier,
    retaliation_ratio: round.retaliation_ratio,
    reward_factor: round.reward_factor,
    balance_ref_teams: round.balance_ref_teams,
    treasure: round.treasure,
    contributions: Object.values(round.teams).map((team) => ({
      group: team.group_id,
      group_name: team.group_name,
      points: teamPoints(round, team),
      manual_adjustment: team.manual_adjustment,
    })),
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
  extra: { roll?: number; ability_id?: number; ability_name?: string } = {},
): void {
  round.events.push({
    id: arena.nextEventId++,
    kind,
    actor,
    group,
    group_name: group != null ? (round.teams[String(group)]?.group_name ?? null) : null,
    value,
    message,
    roll: extra.roll ?? null,
    ability_id: extra.ability_id ?? null,
    ability_name: extra.ability_name ?? null,
    created_at: new Date().toISOString(),
  });
}

/** Estado de batalha antes da ação — checkpoint do desfazer (M-50). */
function snapshotRound(round: MockRound): Record<string, unknown> {
  return {
    hp: round.hp,
    turn: round.turn,
    status: round.status,
    outcome: round.outcome,
    killing_team: round.killing_team,
    rewards_credited: round.rewards_credited,
    teams: structuredClone(round.teams),
  };
}

function restoreRound(round: MockRound, snapshot: Record<string, unknown>): void {
  round.hp = snapshot.hp as number;
  round.turn = snapshot.turn as number;
  round.status = snapshot.status as Status;
  round.outcome = snapshot.outcome as MockRound["outcome"];
  round.killing_team = snapshot.killing_team as number | null;
  round.rewards_credited = snapshot.rewards_credited as boolean;
  // Equipes registradas depois do checkpoint (ex.: start) somem de volta.
  round.teams = structuredClone(snapshot.teams as MockRound["teams"]);
  // Registros vazados pelo reset (M-51) voltam ao log junto com o estado.
  const voidedIds = (snapshot.voided_event_ids as number[] | undefined) ?? [];
  if (voidedIds.length > 0) {
    for (const ev of round.events) {
      if (voidedIds.includes(ev.id)) ev.voided = false;
    }
  }
}

function creditRewards(arena: MockArena, round: MockRound): void {
  if (round.status !== "ENDED" || round.rewards_credited) return;
  for (const team of Object.values(round.teams)) {
    const pts = teamPoints(round, team);
    if (pts > 0) {
      logEvent(arena, round, "REWARD", "SYSTEM", team.group_id, pts, `Recompensa: ${pts} pontos para a equipe.`);
    }
  }
  // Saque do chefe: só na vitória (ADR-018) — golpe final + rateio do dano.
  if (round.outcome === "VICTORY" && round.treasure > 0) {
    const teams = Object.values(round.teams);
    const total = teams.reduce((sum, team) => sum + team.base_damage + team.battle_damage, 0);
    if (total > 0) {
      const blow = Math.trunc(round.treasure * FINAL_BLOW_SHARE);
      const rest = round.treasure - blow;
      const shares: Record<number, number> = {};
      for (const team of teams) {
        const damage = team.base_damage + team.battle_damage;
        if (damage > 0) shares[team.group_id] = Math.trunc((rest * damage) / total);
      }
      const ids = Object.keys(shares).map(Number);
      if (ids.length > 0) {
        const remainder = rest - ids.reduce((sum, id) => sum + shares[id], 0);
        const killer =
          round.killing_team != null && shares[round.killing_team] != null
            ? round.killing_team
            : ids.reduce((best, id) => (shares[id] > shares[best] ? id : best), ids[0]);
        shares[killer] += blow + remainder;
        for (const [gid, pts] of Object.entries(shares)) {
          if (pts > 0) {
            logEvent(
              arena, round, "REWARD", "SYSTEM", Number(gid), pts,
              `Saque do Chefe: ${pts} pontos para a equipe${Number(gid) === killer ? " (golpe final!)" : ""}.`,
            );
          }
        }
      }
    }
  }
  round.rewards_credited = true;
}

function checkVictory(arena: MockArena, round: MockRound): void {
  if (round.hp <= 0 && round.status !== "ENDED") {
    round.status = "ENDED";
    round.outcome = "VICTORY";
    logEvent(arena, round, "END", "SYSTEM", null, 0, "Chefe derrotado! O saque está ao alcance.");
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
  /** Quanto do escudo da equipe cobre dessa perda (ADR-021). */
  const absorb = (amount: number): number => {
    const covered = Math.min(team.shield, amount);
    team.shield -= covered;
    return covered;
  };
  switch (ability.effect) {
    case "PENALTY": {
      const applied = Math.min(team.base_damage, value);
      const absorbed = absorb(applied);
      const lost = applied - absorbed;
      team.base_damage -= lost;
      return `${ability.name}: a equipe perdeu ${lost} de Dano Base!${absorbed ? ` Escudo absorveu ${absorbed}!` : ""}`;
    }
    case "HEAL": {
      const before = round.hp;
      round.hp = Math.min(round.max_hp, round.hp + value);
      return `${ability.name}: o chefe recuperou ${round.hp - before} PV!`;
    }
    case "DRAIN": {
      const applied = Math.min(team.base_damage, value);
      const absorbed = absorb(applied);
      const drained = applied - absorbed;
      team.base_damage -= drained;
      const before = round.hp;
      round.hp = Math.min(round.max_hp, round.hp + drained);
      return `${ability.name}: drenou ${drained} de Dano Base e o chefe recuperou ${round.hp - before} PV!${absorbed ? ` Escudo absorveu ${absorbed}!` : ""}`;
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
    if (message !== null) {
      logEvent(arena, round, "ABILITY", "BOS", team.group_id, ability.value, message,
        { ability_id: ability.id, ability_name: ability.name });
    }
  }
}

/** Avalia os gatilhos "Perguntas" a cada `every` erros da equipe. */
function evaluateQuestionAbilities(arena: MockArena, round: MockRound, team: TeamData): void {
  for (const ability of round.boss.abilities) {
    if (ability.trigger !== "PERGUNTAS" || team.wrong_answers <= 0) continue;
    if (team.wrong_answers % Math.max(1, ability.every) !== 0) continue;
    const message = applyAbility(round, team, ability);
    if (message !== null) {
      logEvent(arena, round, "ABILITY", "BOS", team.group_id, ability.value, message,
        { ability_id: ability.id, ability_name: ability.name });
    }
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
          shield: 0,
          damage_buff: 0,
          abilities: TEAM_TEMPLATES.map((template) => ({ ...template, id: template.template_id, charges_left: 0 })),
        };
      }
      // Cargas repostas com a escala do bando no start (ADR-020/021).
      {
        const n = Object.keys(round.teams).length;
        for (const team of Object.values(round.teams)) {
          for (const ability of team.abilities) {
            ability.charges_left = scaledCharges(ability.max_charges, round.balance_ref_teams, n);
          }
        }
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
      if (round.hp <= 0) {
        round.outcome = "VICTORY";
        logEvent(arena, round, "END", "SYSTEM", null, 0, "Chefe derrotado! O saque está ao alcance.");
      } else {
        round.outcome = "RETREAT";
        logEvent(arena, round, "END", "SYSTEM", null, 0,
          "A batalha acabou: o chefe escapa ferido com o saque! (chefe em fuga — dá para continuar na próxima rodada)");
      }
      creditRewards(arena, round);
      return null;
    }
    case "reopen": {
      if (round.status !== "ENDED") return "Só é possível reabrir uma disputa encerrada.";
      // Estorno: o mock não grava pontos de grupo — zera a bandeira e o
      // desfecho, como o `reopen_round` do back faz com Group.points.
      round.status = "RUNNING";
      round.outcome = "";
      round.killing_team = null;
      round.rewards_credited = false;
      logEvent(arena, round, "RESUME", "SYSTEM", null, 0, "Disputa reaberta pelo professor.");
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
      // Acerto padrão (sem d20): corte do chefe → buff da equipe → escala (ADR-020).
      let damage = points;
      if (team.damage_factor < 1) damage = Math.max(0, Math.round(damage * team.damage_factor));
      if (damage > 0 && team.damage_buff) {
        damage = Math.max(0, Math.round(damage * (1 + team.damage_buff)));
        team.damage_buff = 0;
      }
      damage = Math.max(0, Math.round(damage * balanceFactor(round)));
      team.battle_damage += damage;
      dealBossDamage(round, damage, groupId);
      logEvent(arena, round, "DAMAGE", "TEAM", groupId, damage, `A equipe causou ${damage} de dano!`);
      const retaliation = Math.round(damage * round.retaliation_ratio);
      const absorbed = Math.min(team.shield, retaliation);
      team.shield -= absorbed;
      const lost = retaliation - absorbed;
      if (lost > 0) {
        team.retaliation_loss += lost;
        logEvent(arena, round, "RETALIATION", "BOS", groupId, lost,
          `O chefe retaliou! A equipe perdeu ${lost} pontos!${absorbed ? ` Escudo absorveu ${absorbed}!` : ""}`);
      } else if (absorbed > 0) {
        logEvent(arena, round, "RETALIATION", "BOS", groupId, 0,
          `O chefe retaliou! O escudo da equipe absorveu ${absorbed} pontos!`);
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
        const damage = Math.round(performance * round.multiplier * balanceFactor(round));
        if (damage > 0) {
          team.base_damage += damage;
          dealBossDamage(round, damage, groupId);
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
      dealBossDamage(round, damage); // ajuste do professor: não conta como golpe final
      round.turn += 1;
      logEvent(arena, round, "DAMAGE", "SYSTEM", groupId, damage, `Dano manual de ${damage}.`);
      checkVictory(arena, round);
      return null;
    }
    case "override": {
      if (round.status === "ENDED") {
        return "A disputa está encerrada — reabra para ajustar o placar.";
      }
      const groupId = Number(body.group_id);
      let team = round.teams[String(groupId)];
      if (!team) {
        // Em CONFIG a equipe ativa é registrada em bloco (M-49): o placar
        // da rodada pode ser lançado antes de a batalha começar — igual ao
        // `adjust_points` do back. Fora do CONFIG, só quem está na batalha.
        const registered = SEED_TEAMS.find((item) => item.group_id === groupId);
        if (round.status !== "CONFIG" || !registered) {
          return "Equipe não registrada nesta batalha.";
        }
        team = {
          ...registered,
          base_damage: 0,
          battle_damage: 0,
          retaliation_loss: 0,
          manual_adjustment: 0,
          criteria: null,
          wrong_answers: 0,
          damage_factor: 1,
          shield: 0,
          damage_buff: 0,
          abilities: TEAM_TEMPLATES.map((template) => ({
            ...template,
            id: template.template_id,
            charges_left: 0,
          })),
        };
        round.teams[String(groupId)] = team;
      }
      const amount = Math.trunc(Number(body.amount) || 0);
      // Igual ao `adjust_points` do back: sempre registra (mesmo 0) —
      // assim a ação tem evento e vira checkpoint do desfazer.
      team.manual_adjustment += amount;
      logEvent(arena, round, "REWARD", "SYSTEM", groupId, amount, `Ajuste manual de ${amount} pontos na equipe.`);
      return null;
    }
    case "use-ability": {
      if (notRunning) return notRunning;
      const groupId = Number(body.group_id);
      const team = round.teams[String(groupId)];
      if (!team) return "Equipe não registrada nesta batalha.";
      const abilityId = Number(body.ability_id);
      const ability = team.abilities.find((item) => item.id === abilityId);
      if (!ability) return "A equipe não tem essa habilidade.";
      if (!["STRIKE", "HEAL", "SHIELD", "BUFF"].includes(ability.effect)) return "Efeito inválido.";
      if (ability.charges_left <= 0) {
        return `${ability.name} ficou sem cargas — renove as habilidades da equipe.`;
      }
      // d20 rola aqui no mock também (no real é o servidor — ADR-019).
      const roll = 1 + Math.floor(Math.random() * 20);
      const multiplier = d20Multiplier(roll);
      const effective = Math.floor(ability.value * multiplier + 0.5);
      ability.charges_left -= 1;
      const verdict = multiplier > 1 ? " (crítico!)" : multiplier < 1 ? " (falha!)" : "";
      let value = effective;
      let message: string;
      switch (ability.effect) {
        case "STRIKE": {
          const damage = Math.floor(effective * balanceFactor(round) + 0.5);
          team.battle_damage += damage;
          dealBossDamage(round, damage, groupId);
          value = damage;
          message = `${ability.name} (d20: ${roll})${verdict}: ${damage} de dano direto ao chefe!`;
          break;
        }
        case "HEAL": {
          const healed = Math.min(team.retaliation_loss, effective);
          team.retaliation_loss -= healed;
          value = healed;
          message = healed > 0
            ? `${ability.name} (d20: ${roll})${verdict}: recuperou ${healed} pontos perdidos!`
            : `${ability.name} (d20: ${roll})${verdict}: não havia pontos a curar.`;
          break;
        }
        case "SHIELD":
          team.shield += effective;
          value = effective;
          message = `${ability.name} (d20: ${roll})${verdict}: escudo de ${effective} pontos!`;
          break;
        default: // BUFF
          team.damage_buff += effective / 100;
          value = effective;
          message = `${ability.name} (d20: ${roll})${verdict}: próximo ataque +${effective}%!`;
      }
      logEvent(arena, round, "ABILITY", "TEAM", groupId, value, message,
        { roll, ability_id: ability.id, ability_name: ability.name });
      checkVictory(arena, round);
      return null;
    }
    case "renew-abilities": {
      if (round.status !== "RUNNING" && round.status !== "PAUSED") return "A batalha não está em andamento.";
      const groupId = Number(body.group_id);
      const team = round.teams[String(groupId)];
      if (!team) return "Equipe não registrada nesta batalha.";
      if (team.abilities.length === 0) return "A equipe não tem habilidades para renovar.";
      const n = Object.keys(round.teams).length;
      for (const ability of team.abilities) {
        ability.charges_left = scaledCharges(ability.max_charges, round.balance_ref_teams, n);
      }
      logEvent(arena, round, "ABILITY", "SYSTEM", groupId, 0, "Habilidades da equipe renovadas.");
      return null;
    }
    case "set-hp": {
      const value = Math.trunc(Number(body.hp));
      if (!Number.isFinite(value) || value < 0) return "PV inválido.";
      const next = Math.min(round.max_hp, value);
      if (next === round.hp) return null;
      const before = round.hp;
      round.hp = next;
      if (next > 0) round.killing_team = null; // chefe revivido: golpe final vale de novo
      logEvent(arena, round, "EDIT", "SYSTEM", null, next - before,
        `PV do chefe ajustado: ${before} → ${next}.`);
      return null;
    }
    case "reset-team": {
      if (round.status === "ENDED") {
        return "A disputa está encerrada — reabra para ajustar as equipes.";
      }
      const groupId = Number(body.group_id);
      const team = round.teams[String(groupId)];
      if (!team) return null; // sem registro: no-op, como no back (M-51)
      const damage = team.base_damage + team.battle_damage;
      // Reset completo: placar, notas, dano, retaliação, erros e cargas.
      team.base_damage = 0;
      team.battle_damage = 0;
      team.retaliation_loss = 0;
      team.manual_adjustment = 0;
      team.criteria = null;
      team.wrong_answers = 0;
      team.damage_factor = 1;
      team.shield = 0;
      team.damage_buff = 0;
      {
        const n = Object.keys(round.teams).length;
        for (const ability of team.abilities) {
          ability.charges_left = scaledCharges(ability.max_charges, round.balance_ref_teams, n);
        }
      }
      // PV do chefe: devolve o dano exato dela, aparado no máximo.
      round.hp = Math.min(round.max_hp, round.hp + damage);
      if (round.hp > 0) round.killing_team = null;
      for (const ev of round.events) {
        if (ev.group === groupId) ev.voided = true;
      }
      logEvent(arena, round, "EDIT", "SYSTEM", groupId, damage,
        `Equipe ${team.group_name} resetada: ataques e notas zerados. ` +
        (damage > 0 ? `PV do chefe devolvido +${damage}.` : "Sem dano a devolver."));
      return null;
    }
    case "undo": {
      let index = -1;
      for (let i = round.events.length - 1; i >= 0; i--) {
        if (round.events[i].snapshot !== undefined) {
          index = i;
          break;
        }
      }
      if (index < 0) return "Nada para desfazer.";
      const crossesEnd = round.events
        .slice(index + 1)
        .some((ev) => ev.kind === "END");
      if (crossesEnd && round.rewards_credited) {
        return "Não dá para desfazer: a disputa foi encerrada com recompensas creditadas. Reabra a disputa para voltar atrás.";
      }
      restoreRound(round, round.events[index].snapshot as Record<string, unknown>);
      round.events = round.events.slice(0, index);
      logEvent(arena, round, "EDIT", "SYSTEM", null, 0, "Última ação desfeita.");
      return null;
    }
    default:
      return "Ação desconhecida.";
  }
}

const ACTIONS = [
  "start", "pause", "resume", "end", "attack", "apply-performance", "damage", "override",
  "use-ability", "renew-abilities", "reopen", "set-hp", "undo", "reset-team",
];

/** Ações que geram checkpoint no primeiro evento (desfazer, M-50). */
const REVERSIBLE_ACTIONS = ACTIONS.filter(
  (action) => !["end", "reopen", "undo"].includes(action),
);

export const arenaHandlers = [
  // Chefes para o formulário de nova rodada (o catálogo mock usa /mock-catalog/).
  http.get(`${API_BASE_URL}/bosses/`, () => HttpResponse.json(BOSSES)),

  // Catálogo do picker 3+1 e gravação da escolha (ADR-021).
  http.get(`${API_BASE_URL}/team-abilities/`, () => HttpResponse.json(TEAM_ABILITY_CATALOG)),

  http.patch(`${API_BASE_URL}/groups/:id/`, async ({ request, params }) => {
    if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
    let body: { abilities?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return error("JSON inválido.");
    }
    const ids = Array.isArray(body.abilities) ? body.abilities.map(Number) : [];
    if (ids.length !== 4 || new Set(ids).size !== 4) {
      return error("Escolha exatamente 4 habilidades (3 básicas + 1 ultimate).");
    }
    const chosen = ids.map((id) => TEAM_ABILITY_CATALOG.find((item) => item.id === id));
    if (chosen.some((item) => !item)) return error("Modelo de habilidade inexistente.");
    const picks = chosen as TeamAbilityCatalogItem[];
    if (picks.filter((item) => item.kind === "BASIC").length !== 3) {
      return error("A escolha precisa ser 3 básicas + 1 ultimate.");
    }
    if (new Set(picks.map((item) => item.theme)).size !== 1) {
      return error("As 4 habilidades precisam ser de um só tema (ADR-021).");
    }
    try {
      const arena = read();
      const key = String(Number(params.id));
      const round = arena.rounds.find((item) =>
        Object.prototype.hasOwnProperty.call(item.teams, key),
      );
      const team = round?.teams[key];
      if (!round || !team) return error("Equipe não encontrada em nenhuma rodada.", 404);
      // Mantém as cargas do que ficou; o que é novo nasce com a base
      // (o renovar do painel reajusta pela escala da rodada).
      const kept = new Map(team.abilities.map((item) => [item.template_id, item.charges_left]));
      team.abilities = picks.map((item) => ({
        id: item.id,
        template_id: item.id,
        name: item.name,
        kind: item.kind,
        effect: item.effect,
        value: item.value,
        max_charges: item.max_charges,
        charges_left: kept.get(item.id) ?? item.max_charges,
      }));
      write(arena);
      return HttpResponse.json({ id: Number(params.id), abilities: ids });
    } catch {
      return error("Não foi possível salvar as habilidades.", 500);
    }
  }),

  // Grupos para a tabela de placares (GET /groups/, leitura pública, M-49).
  http.get(`${API_BASE_URL}/groups/`, () => {
    const totals: Record<number, number> = { 1: 1280, 2: 980, 3: 1050 };
    return HttpResponse.json(
      SEED_TEAMS.map((team) => ({
        id: team.group_id,
        name: team.group_name,
        points: totals[team.group_id] ?? 0,
        extra_points: 0,
        total_points: totals[team.group_id] ?? 0,
        member_count: 3,
        is_active: true,
        created_at: "2026-01-05T00:00:00Z",
      })),
    );
  }),

  http.get(`${API_BASE_URL}/arena/rounds/`, () => {
    try {
      return HttpResponse.json(read().rounds.map(toSummary));
    } catch {
      return error("Não foi possível carregar as rodadas.", 500);
    }
  }),

  // PATCH da tela de configuração (M-49): datas em qualquer status;
  // parâmetros inteiros espelham `PositiveIntegerField` do modelo. A UI
  // trava os parâmetros fora de CONFIG — aqui o espelho é a API, que é
  // permissiva (quem escreve é o professor).
  http.patch(`${API_BASE_URL}/arena/rounds/:id/`, async ({ request, params }) => {
    if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return error("JSON inválido.");
    }
    try {
      const arena = read();
      const round = arena.rounds.find((item) => item.id === Number(params.id));
      if (!round) return error("Rodada não encontrada.", 404);

      for (const key of ["date", "deadline"] as const) {
        if (!(key in body)) continue;
        const value = body[key];
        if (value != null && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))) {
          return error("Data inválida (use AAAA-MM-DD).");
        }
        round[key] = (value as string | null) ?? null;
      }

      const positiveInts = {
        level: "Nível",
        max_hp: "PV máximo",
        treasure: "Saque do chefe",
        balance_ref_teams: "Escala do bando",
      } as const;
      for (const key of Object.keys(positiveInts) as (keyof typeof positiveInts)[]) {
        if (!(key in body)) continue;
        const value = Number(body[key]);
        if (!Number.isInteger(value) || value < 0) {
          return error(`${positiveInts[key]} precisa ser um inteiro ≥ 0.`);
        }
        round[key] = value;
      }

      for (const key of ["multiplier", "retaliation_ratio", "reward_factor"] as const) {
        if (!(key in body)) continue;
        const value = Number(body[key]);
        if (!Number.isFinite(value)) return error("Valor numérico inválido.");
        round[key] = value;
      }

      write(arena);
      return HttpResponse.json(toSummary(round));
    } catch {
      return error("Não foi possível salvar a configuração.", 500);
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
      treasure?: number;
      balance_ref_teams?: number;
      initial_hp?: number;
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
      const initialHp = Number(body.initial_hp) > 0
        ? Math.min(Math.trunc(Number(body.initial_hp)), maxHp)
        : maxHp;
      const round: MockRound = {
        id: arena.nextRoundId++,
        name,
        status: "CONFIG",
        hp: initialHp,
        max_hp: maxHp,
        turn: 0,
        level: Math.max(1, Number(body.level) || 1),
        multiplier: Number(body.multiplier) || 1.5,
        retaliation_ratio: Number(body.retaliation_ratio ?? 0.25),
        reward_factor: Number(body.reward_factor ?? 1),
        balance_ref_teams: Number(body.balance_ref_teams ?? 4),
        treasure: Math.max(0, Math.trunc(Number(body.treasure) || 0)),
        date: null,
        deadline: null,
        outcome: "",
        killing_team: null,
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

  // Duplicar (M-50): cópia em CONFIG, sem histórico — devolve a nova.
  http.post(`${API_BASE_URL}/arena/rounds/:id/duplicate/`, async ({ request, params }) => {
    if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
    try {
      const arena = read();
      const round = arena.rounds.find((item) => item.id === Number(params.id));
      if (!round) return error("Rodada não encontrada.", 404);
      const copy: MockRound = structuredClone(round);
      copy.id = arena.nextRoundId++;
      copy.name = `${round.name} (cópia)`;
      copy.status = "CONFIG";
      copy.hp = copy.max_hp;
      copy.turn = 0;
      copy.outcome = "";
      copy.killing_team = null;
      copy.teams = {};
      copy.events = [];
      copy.rewards_credited = false;
      arena.rounds.unshift(copy);
      write(arena);
      return HttpResponse.json(toSummary(copy), { status: 201 });
    } catch {
      return error("Não foi possível duplicar a rodada.", 500);
    }
  }),

  // Excluir a disputa e todo o registro (M-50).
  http.delete(`${API_BASE_URL}/arena/rounds/:id/`, async ({ request, params }) => {
    if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
    try {
      const arena = read();
      const index = arena.rounds.findIndex((item) => item.id === Number(params.id));
      if (index < 0) return error("Rodada não encontrada.", 404);
      arena.rounds.splice(index, 1);
      write(arena);
      return new HttpResponse(null, { status: 204 });
    } catch {
      return error("Não foi possível excluir a rodada.", 500);
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
        const checkpoint =
          REVERSIBLE_ACTIONS.includes(action) ? snapshotRound(round) : null;
        if (checkpoint !== null && action === "reset-team") {
          // Ids que o reset vai vazar: o desfazer usa para trazê-los de volta.
          const gid = Number(body.group_id);
          checkpoint.voided_event_ids = round.events
            .filter((ev) => ev.group === gid && !ev.voided)
            .map((ev) => ev.id);
        }
        const eventsBefore = round.events.length;
        const failure = applyAction(arena, round, action, body);
        if (failure) return error(failure);
        if (checkpoint !== null && round.events.length > eventsBefore) {
          round.events[eventsBefore].snapshot = checkpoint;
        }
        write(arena);
        return HttpResponse.json(toState(round));
      } catch {
        return error("Não foi possível executar a ação.", 500);
      }
    }),
  ),
];
