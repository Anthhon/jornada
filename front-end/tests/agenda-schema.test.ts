import assert from "node:assert/strict";
import test from "node:test";
import { agendaSchema } from "../features/public-agenda/schemas/agenda";
import { groups, missions } from "../mocks/landing-agenda";

test("a agenda inicial atende ao contrato", () => {
  assert.equal(agendaSchema.safeParse({ groups, missions }).success, true);
});

test("células incompletas e datas inválidas são rejeitadas", () => {
  const changed = structuredClone(groups);
  changed[0].schedule[0] = { language: "", date: "2026-09-14" };
  assert.equal(agendaSchema.safeParse({ groups: changed, missions }).success, false);
  changed[0].schedule[0] = { language: "Java", date: "2026-99-99" };
  assert.equal(agendaSchema.safeParse({ groups: changed, missions }).success, false);
});
