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
