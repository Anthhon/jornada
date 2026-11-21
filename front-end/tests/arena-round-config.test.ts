import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { API_BASE_URL } from "../lib/api-config";
import { arenaService } from "../features/arena/services/arena-service";

const GROUPS = [
  { id: 1, name: "Equipe Alfa", points: 400, extra_points: 20, total_points: 420, member_count: 4, is_active: true },
  { id: 2, name: "Equipe Beta", points: 300, extra_points: 0, total_points: 300, member_count: 3, is_active: true },
];

let patched: { path: string; body: unknown } | null = null;

const server = setupServer(
  http.get(`${API_BASE_URL}/groups/`, () => HttpResponse.json(GROUPS)),
  http.patch(`${API_BASE_URL}/arena/rounds/:id/`, async ({ request, params }) => {
    patched = { path: String(params.id), body: await request.json() };
    return HttpResponse.json({ id: Number(params.id) });
  }),
);

before(() => server.listen({ onUnhandledFrame: "error" }));
after(() => server.close());
afterEach(() => {
  patched = null;
  server.restoreHandlers();
});

test("listGroups lê os grupos e passa pelo contrato (zod)", async () => {
  const data = await arenaService.listGroups();
  assert.equal(data.length, 2);
  assert.equal(data[0]?.name, "Equipe Alfa");
  assert.equal(data[0]?.total_points, 420);
  assert.equal(data[1]?.is_active, true);
});

test("updateRound faz PATCH /arena/rounds/{id}/ com o payload", async () => {
  await arenaService.updateRound(5, { date: "2026-05-10", multiplier: 2 });
  assert.deepEqual(patched, {
    path: "5",
    body: { date: "2026-05-10", multiplier: 2 },
  });
});

test("listGroups rejeita resposta fora do contrato", async () => {
  server.use(http.get(`${API_BASE_URL}/groups/`, () => HttpResponse.json([{ id: 1 }])));
  await assert.rejects(() => arenaService.listGroups());
});

let action: { path: string; body: unknown } | null = null;
let deleted: string | null = null;

test("setHp faz POST set-hp com o valor (M-50)", async () => {
  server.use(
    http.post(`${API_BASE_URL}/arena/rounds/:id/set-hp/`, async ({ request, params }) => {
      action = { path: String(params.id), body: await request.json() };
      return HttpResponse.json({ id: Number(params.id) });
    }),
  );
  await arenaService.setHp(7, 1200);
  assert.deepEqual(action, { path: "7", body: { hp: 1200 } });
});

test("reopen e undo fazem POST sem corpo", async () => {
  const calls: string[] = [];
  server.use(
    http.post(`${API_BASE_URL}/arena/rounds/:id/reopen/`, ({ params }) => {
      calls.push(`reopen:${params.id}`);
      return HttpResponse.json({ id: Number(params.id) });
    }),
    http.post(`${API_BASE_URL}/arena/rounds/:id/undo/`, ({ params }) => {
      calls.push(`undo:${params.id}`);
      return HttpResponse.json({ id: Number(params.id) });
    }),
  );
  await arenaService.reopen(4);
  await arenaService.undo(4);
  assert.deepEqual(calls, ["reopen:4", "undo:4"]);
});

test("duplicate devolve a cópia validada pelo zod", async () => {
  server.use(
    http.post(`${API_BASE_URL}/arena/rounds/:id/duplicate/`, () =>
      HttpResponse.json(
        {
          id: 9, name: "X (cópia)", boss: 1, status: "CONFIG",
          level: 1, max_hp: 100, hp: 100, date: null, deadline: null,
        },
        { status: 201 },
      )),
  );
  const copy = await arenaService.duplicate(4);
  assert.equal(copy.id, 9);
  assert.equal(copy.status, "CONFIG");
  assert.equal(copy.hp, 100);
});

test("remove faz DELETE /arena/rounds/{id}/", async () => {
  server.use(
    http.delete(`${API_BASE_URL}/arena/rounds/:id/`, ({ params }) => {
      deleted = String(params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  await arenaService.remove(3);
  assert.equal(deleted, "3");
});
