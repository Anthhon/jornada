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
