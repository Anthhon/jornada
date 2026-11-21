import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { API_BASE_URL } from "../lib/api-config";
import { arenaService } from "../features/arena/services/arena-service";

const CATALOG = [
  {
    id: 1, theme: "Floresta", name: "Golpe de Raiz", kind: "BASIC",
    effect: "STRIKE", value: 150, max_charges: 2, description: "150 de dano.",
  },
  {
    id: 4, theme: "Floresta", name: "Tempestade", kind: "ULTIMATE",
    effect: "STRIKE", value: 500, max_charges: 1, description: "500 de dano.",
  },
];

let patched: { path: string; body: unknown } | null = null;

const server = setupServer(
  http.get(`${API_BASE_URL}/team-abilities/`, () => HttpResponse.json(CATALOG)),
  http.patch(`${API_BASE_URL}/groups/:id/`, async ({ request, params }) => {
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

test("listTeamAbilities lê o catálogo e passa pelo contrato (zod)", async () => {
  const data = await arenaService.listTeamAbilities();
  assert.equal(data.length, CATALOG.length);
  assert.equal(data[0]?.theme, "Floresta");
  assert.equal(data[1]?.kind, "ULTIMATE");
});

test("assignAbilities faz PATCH /groups/{id}/ com {abilities}", async () => {
  await arenaService.assignAbilities(7, [1, 2, 3, 4]);
  assert.deepEqual(patched, { path: "7", body: { abilities: [1, 2, 3, 4] } });
});

test("listTeamAbilities rejeita resposta fora do contrato", async () => {
  server.use(
    http.get(`${API_BASE_URL}/team-abilities/`, () => HttpResponse.json([{ id: 1 }])),
  );
  await assert.rejects(() => arenaService.listTeamAbilities());
});
