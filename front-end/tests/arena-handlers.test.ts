import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { setupServer } from "msw/node";
import { arenaHandlers } from "../mocks/handlers/arena";
import { API_BASE_URL } from "../lib/api-config";

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

const server = setupServer(...arenaHandlers);
const HEADERS = {
  "Content-Type": "application/json",
  Authorization: "Bearer demo-token",
};

before(() => {
  Object.defineProperty(globalThis, "localStorage", { value: storage(), configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: storage(), configurable: true });
  sessionStorage.setItem("jornada-session", JSON.stringify({ role: "professor" }));
  server.listen({ onUnhandledFrame: "error" });
});
after(() => {
  server.close();
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "sessionStorage");
});

const get = (path: string) => fetch(`${API_BASE_URL}${path}`);
const patch = (path: string, body: unknown, headers: Record<string, string> = HEADERS) =>
  fetch(`${API_BASE_URL}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
const post = (path: string, body: unknown) =>
  fetch(`${API_BASE_URL}${path}`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });

// Ordem é história: a rodada 1 (seed, CONFIG) avança até RUNNING no fim.

test("GET /groups/ devolve os grupos da tabela de placares", async () => {
  const rows = (await (await get("/groups/")).json()) as Record<string, unknown>[];
  assert.equal(rows.length, 3);
  assert.deepEqual(
    { id: rows[0]?.id, name: rows[0]?.name, total_points: rows[0]?.total_points, is_active: rows[0]?.is_active },
    { id: 1, name: "Equipe Alfa", total_points: 1280, is_active: true },
  );
});

test("resumo da rodada espelha datas, parâmetros e contribuições", async () => {
  const rows = (await (await get("/arena/rounds/")).json()) as Record<string, unknown>[];
  const round = rows.find((item) => item.id === 1);
  assert.equal(round?.status, "CONFIG");
  assert.equal(round?.date, null);
  assert.equal(round?.deadline, null);
  assert.equal(round?.multiplier, 1.5);
  assert.deepEqual(round?.contributions, []);
});

test("PATCH exige sessão de professor e aplica datas/parâmetros", async () => {
  const anon = await patch("/arena/rounds/1/", { date: "2026-12-01" }, { "Content-Type": "application/json" });
  assert.equal(anon.status, 403);

  const resp = await patch("/arena/rounds/1/", {
    date: "2026-12-01",
    deadline: "2026-12-10",
    multiplier: 2,
    treasure: 300,
  });
  assert.equal(resp.status, 200);
  const saved = (await resp.json()) as Record<string, unknown>;
  assert.equal(saved.date, "2026-12-01");
  assert.equal(saved.deadline, "2026-12-10");
  assert.equal(saved.multiplier, 2);
  assert.equal(saved.treasure, 300);
});

test("PATCH recusa data fora do formato e inteiro fracionado", async () => {
  const badDate = await patch("/arena/rounds/1/", { date: "01/12/2026" });
  assert.equal(badDate.status, 400);
  const badMaxHp = await patch("/arena/rounds/1/", { max_hp: 1.5 });
  assert.equal(badMaxHp.status, 400);
  // Datas em branco voltam a null (limpa o campo na tela).
  const cleared = await patch("/arena/rounds/1/", { deadline: null });
  assert.equal(cleared.status, 200);
  assert.equal(((await cleared.json()) as Record<string, unknown>).deadline, null);
});

test("override em CONFIG registra a equipe e o resumo passa a mostrá-la", async () => {
  const resp = await post("/arena/rounds/1/override/", { group_id: 1, amount: 420 });
  assert.equal(resp.status, 200);

  const state = (await (await get("/arena/rounds/1/state/")).json()) as {
    teams: { group_id: number; points: number }[];
  };
  const team = state.teams.find((item) => item.group_id === 1);
  assert.equal(team?.points, 420);

  const rows = (await (await get("/arena/rounds/")).json()) as Record<string, unknown>[];
  const contributions = rows.find((item) => item.id === 1)?.contributions as {
    group: number; points: number;
  }[];
  assert.ok(contributions.some((item) => item.group === 1 && item.points === 420));
});

test("override de equipe fora do registro continua recusado", async () => {
  const resp = await post("/arena/rounds/1/override/", { group_id: 9999, amount: 10 });
  assert.equal(resp.status, 400);
  assert.ok((await resp.text()).includes("Equipe não registrada nesta batalha."));
});

test("start registra as equipes e o placar pré-lançado sobrevive", async () => {
  const resp = await post("/arena/rounds/1/start/", {});
  assert.equal(resp.status, 200);

  const state = (await (await get("/arena/rounds/1/state/")).json()) as {
    status: string;
    teams: { group_id: number; points: number }[];
  };
  assert.equal(state.status, "RUNNING");
  assert.equal(state.teams.length, 3); // SEED_TEAMS registradas no start
  const team = state.teams.find((item) => item.group_id === 1);
  assert.equal(team?.points, 420); // ajuste prévio intacto (??= do mock)
});

// ——— M-50: gerência de rodadas (duplicar/excluir/PV/reabrir/desfazer) ———

async function createRound(name: string, maxHp = 10000): Promise<number> {
  const resp = await post("/arena/rounds/", { name, boss: 1, max_hp: maxHp });
  assert.equal(resp.status, 201);
  const body = (await resp.json()) as { id: number };
  return body.id;
}

const stateOf = async (id: number) =>
  (await (await get(`/arena/rounds/${id}/state/`)).json()) as {
    status: string;
    hp: number;
    max_hp: number;
    outcome: string;
    events: { kind: string; message: string; group: number | null }[];
    teams: {
      group_id: number;
      base_damage: number;
      battle_damage: number;
      manual_adjustment: number;
      criteria: Record<string, number> | null;
    }[];
  };

test("duplicate cria cópia em CONFIG sem histórico e o DELETE remove", async () => {
  const originalId = await createRound("Rodada Clone");
  await post(`/arena/rounds/${originalId}/start/`, {});
  await post(`/arena/rounds/${originalId}/damage/`, { group_id: 1, damage: 300 });

  const dup = await post(`/arena/rounds/${originalId}/duplicate/`, {});
  assert.equal(dup.status, 201);
  const copy = (await dup.json()) as Record<string, unknown>;
  assert.equal(copy.status, "CONFIG");
  assert.equal(copy.hp, copy.max_hp);
  assert.equal(copy.name, "Rodada Clone (cópia)");
  assert.deepEqual(copy.contributions, []);
  assert.notEqual(copy.id, originalId);

  const del = await fetch(`${API_BASE_URL}/arena/rounds/${copy.id}/`, {
    method: "DELETE",
    headers: HEADERS,
  });
  assert.equal(del.status, 204);
  const rows = (await (await get("/arena/rounds/")).json()) as Record<string, unknown>[];
  assert.ok(!rows.some((item) => item.id === copy.id));
  // A original fica intacta (RUNNING, com o dano).
  const original = rows.find((item) => item.id === originalId);
  assert.equal(original?.status, "RUNNING");
  assert.equal(
    Number(original?.hp),
    Number(original?.max_hp) - 300,
  );
});

test("set-hp edita o PV (clamp no máximo) e o undo desfazer em cadeia", async () => {
  const id = await createRound("Rodada PV");

  let resp = await post(`/arena/rounds/${id}/set-hp/`, { hp: 4321 });
  assert.equal(resp.status, 200);
  let state = await stateOf(id);
  assert.equal(state.hp, 4321);

  // Teto do PV máximo.
  resp = await post(`/arena/rounds/${id}/set-hp/`, { hp: 999999 });
  assert.equal(resp.status, 200);
  state = await stateOf(id);
  assert.equal(state.hp, state.max_hp);

  // Desfazer o ajuste: volta ao PV anterior e anota no registro.
  resp = await post(`/arena/rounds/${id}/undo/`, {});
  assert.equal(resp.status, 200);
  state = await stateOf(id);
  assert.equal(state.hp, 4321);
  const last = state.events[state.events.length - 1];
  assert.equal(last?.kind, "EDIT");
  assert.equal(last?.message, "Última ação desfeita.");

  // Desfazer de novo: regrava o estado anterior e some com o lote.
  resp = await post(`/arena/rounds/${id}/undo/`, {});
  assert.equal(resp.status, 200);
  state = await stateOf(id);
  assert.equal(state.hp, state.max_hp);

  // Sem checkpoint sobrando, recusa.
  resp = await post(`/arena/rounds/${id}/undo/`, {});
  assert.equal(resp.status, 400);
  assert.ok((await resp.text()).includes("Nada para desfazer."));
});

test("end bloqueia o override, reopen reabre e o ciclo recusa reabrir 2x", async () => {
  const id = await createRound("Rodada Fim");
  assert.equal((await post(`/arena/rounds/${id}/start/`, {})).status, 200);
  assert.equal(
    (await post(`/arena/rounds/${id}/damage/`, { group_id: 1, damage: 300 })).status,
    200,
  );
  assert.equal((await post(`/arena/rounds/${id}/end/`, {})).status, 200);
  let state = await stateOf(id);
  assert.equal(state.status, "ENDED");

  // Placar travado em ENDED — a saída é reabrir (M-50).
  const blocked = await post(`/arena/rounds/${id}/override/`, {
    group_id: 1,
    amount: 50,
  });
  assert.equal(blocked.status, 400);
  assert.ok((await blocked.text()).includes("reabra"));

  assert.equal((await post(`/arena/rounds/${id}/reopen/`, {})).status, 200);
  state = await stateOf(id);
  assert.equal(state.status, "RUNNING");
  assert.equal(state.outcome, "");

  // Reabrir de novo: só funciona em ENDED.
  const twice = await post(`/arena/rounds/${id}/reopen/`, {});
  assert.equal(twice.status, 400);
  assert.ok((await twice.text()).includes("encerrada"));

  // Com a disputa em pé, o desfazer volta o dano (o fim foi apagado junto).
  assert.equal((await post(`/arena/rounds/${id}/undo/`, {})).status, 200);
  state = await stateOf(id);
  assert.equal(state.hp, state.max_hp);
  assert.ok(!state.events.some((ev) => ev.kind === "END"));
});

// ——— M-51: reset completo de equipe (configuração da rodada) ———

test("reset-team zera a equipe, devolve o PV e tira os eventos do log", async () => {
  const id = await createRound("Rodada Reset");
  assert.equal((await post(`/arena/rounds/${id}/start/`, {})).status, 200);
  await post(`/arena/rounds/${id}/damage/`, { group_id: 1, damage: 300 });
  await post(`/arena/rounds/${id}/damage/`, { group_id: 2, damage: 100 });
  await post(`/arena/rounds/${id}/override/`, { group_id: 1, amount: 420 });

  let state = await stateOf(id);
  assert.equal(state.hp, state.max_hp - 400);

  const resp = await post(`/arena/rounds/${id}/reset-team/`, { group_id: 1 });
  assert.equal(resp.status, 200);
  state = await stateOf(id);
  // Só o dano da equipe 1 volta ao chefe; a equipe 2 fica intacta.
  assert.equal(state.hp, state.max_hp - 100);
  const alfa = state.teams.find((item) => item.group_id === 1);
  assert.equal(alfa?.base_damage, 0);
  assert.equal(alfa?.battle_damage, 0);
  assert.equal(alfa?.manual_adjustment, 0);
  assert.equal(alfa?.criteria, null);
  const beta = state.teams.find((item) => item.group_id === 2);
  assert.equal(beta?.battle_damage, 100);
  // Log: os eventos da equipe 1 somem; a nota do reset fica.
  assert.ok(!state.events.some((ev) => ev.group === 1 && ev.kind === "DAMAGE"));
  assert.ok(!state.events.some((ev) => ev.group === 1 && ev.kind === "REWARD"));
  assert.ok(state.events.some((ev) => ev.group === 2 && ev.kind === "DAMAGE"));
  assert.ok(state.events.some((ev) => ev.kind === "EDIT" && ev.message.includes("resetada")));

  // A equipe zerada pode bater de novo.
  assert.equal(
    (await post(`/arena/rounds/${id}/damage/`, { group_id: 1, damage: 50 })).status,
    200,
  );
  state = await stateOf(id);
  assert.equal(state.hp, state.max_hp - 150);
  assert.ok(state.events.some((ev) => ev.group === 1 && ev.kind === "DAMAGE"));
});

test("undo devolve o reset: PV, dano e log de volta", async () => {
  const id = await createRound("Rodada Reset Undo");
  assert.equal((await post(`/arena/rounds/${id}/start/`, {})).status, 200);
  await post(`/arena/rounds/${id}/damage/`, { group_id: 1, damage: 300 });
  assert.equal(
    (await post(`/arena/rounds/${id}/reset-team/`, { group_id: 1 })).status,
    200,
  );
  let state = await stateOf(id);
  assert.equal(state.hp, state.max_hp);

  const resp = await post(`/arena/rounds/${id}/undo/`, {});
  assert.equal(resp.status, 200);
  state = await stateOf(id);
  assert.equal(state.hp, state.max_hp - 300);
  const alfa = state.teams.find((item) => item.group_id === 1);
  assert.equal(alfa?.battle_damage, 300);
  // O registro da equipe volta ao log e a nota do reset some.
  assert.ok(state.events.some((ev) => ev.group === 1 && ev.kind === "DAMAGE"));
  assert.ok(!state.events.some((ev) => ev.message.includes("resetada")));
});

test("reset libera nova avaliação de desempenho da equipe", async () => {
  const id = await createRound("Rodada Notas");
  assert.equal((await post(`/arena/rounds/${id}/start/`, {})).status, 200);
  const criteria = {
    tempo: 3, historico: 3, paradigma: 3,
    caracteristicas: 3, usos: 3, codigo: 3, criatividade: 3,
  };

  const first = await post(`/arena/rounds/${id}/apply-performance/`, {
    group_id: 1, criteria,
  });
  assert.equal(first.status, 200);
  const again = await post(`/arena/rounds/${id}/apply-performance/`, {
    group_id: 1, criteria,
  });
  assert.equal(again.status, 400);
  assert.ok((await again.text()).includes("Desempenho já registrado"));

  assert.equal(
    (await post(`/arena/rounds/${id}/reset-team/`, { group_id: 1 })).status,
    200,
  );
  const after = await post(`/arena/rounds/${id}/apply-performance/`, {
    group_id: 1, criteria,
  });
  assert.equal(after.status, 200);
  const state = await stateOf(id);
  const alfa = state.teams.find((item) => item.group_id === 1);
  assert.deepEqual(alfa?.criteria, criteria);
  assert.ok((alfa?.base_damage ?? 0) > 0);
});

test("reset em disputa encerrada recusa e manda reabrir", async () => {
  const id = await createRound("Rodada Reset Fim");
  assert.equal((await post(`/arena/rounds/${id}/start/`, {})).status, 200);
  assert.equal((await post(`/arena/rounds/${id}/end/`, {})).status, 200);

  const resp = await post(`/arena/rounds/${id}/reset-team/`, { group_id: 1 });
  assert.equal(resp.status, 400);
  assert.ok((await resp.text()).includes("reabra"));
});
