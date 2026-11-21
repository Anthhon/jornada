import assert from "node:assert/strict";
import { test } from "node:test";

import {
  baseDraft,
  changedRoundFields,
  isDraftDirty,
  scoreOverrides,
} from "../features/arena/lib/round-config";
import type { ArenaGroupOption, ArenaRound } from "../features/arena/schemas/arena";

const GROUPS: ArenaGroupOption[] = [
  { id: 1, name: "Equipe Alfa", points: 400, extra_points: 20, total_points: 420, member_count: 4, is_active: true },
  { id: 2, name: "Equipe Beta", points: 300, extra_points: 0, total_points: 300, member_count: 3, is_active: true },
];

function round(partial: Partial<ArenaRound> = {}): ArenaRound {
  return {
    id: 5,
    name: "Rodada 5",
    boss: 1,
    status: "CONFIG",
    level: 2,
    max_hp: 15000,
    hp: 15000,
    date: "2026-05-10",
    deadline: null,
    multiplier: 1.5,
    retaliation_ratio: 0.25,
    reward_factor: 1,
    balance_ref_teams: 4,
    treasure: 500,
    contributions: [
      { group: 1, group_name: "Equipe Alfa", points: 420, manual_adjustment: 0 },
    ],
    ...partial,
  } as ArenaRound;
}

test("baseDraft: datas/parâmetros da rodada e placar por contribuição", () => {
  const draft = baseDraft(round(), GROUPS);
  assert.equal(draft.date, "2026-05-10");
  assert.equal(draft.deadline, "");
  assert.equal(draft.multiplier, "1.5");
  assert.equal(draft.max_hp, "15000");
  assert.deepEqual(draft.scores, { "1": "420", "2": "0" });
});

test("baseDraft: campo ausente (store velho) vira padrão", () => {
  const draft = baseDraft(round({ date: undefined, multiplier: undefined } as Partial<ArenaRound>), GROUPS);
  assert.equal(draft.date, "");
  assert.equal(draft.multiplier, "1.5");
});

test("changedRoundFields: só o que mudou, datas vazias viram null", () => {
  const base = baseDraft(round(), GROUPS);
  const draft = { ...base, deadline: "2026-05-20", multiplier: "2" };
  assert.deepEqual(changedRoundFields(base, draft, { includeRules: true }), {
    deadline: "2026-05-20",
    multiplier: 2,
  });
  const cleared = { ...base, date: "" };
  assert.deepEqual(changedRoundFields(base, cleared, { includeRules: false }), { date: null });
});

test("changedRoundFields: includeRules=false ignora parâmetros e números iguais", () => {
  const base = baseDraft(round(), GROUPS);
  const draft = { ...base, multiplier: "9", treasure: "500" }; // 500 == 500
  assert.deepEqual(changedRoundFields(base, draft, { includeRules: false }), {});
  // Formato diferente do mesmo número não conta como troca.
  assert.deepEqual(
    changedRoundFields(base, { ...base, multiplier: "1.50" }, { includeRules: true }),
    {},
  );
});

test("changedRoundFields: número inválido/ vazio é tratado como sem troca", () => {
  const base = baseDraft(round(), GROUPS);
  assert.deepEqual(
    changedRoundFields(base, { ...base, level: "", max_hp: "abc" }, { includeRules: true }),
    {},
  );
});

test("scoreOverrides: delta = novo − servidor; sem troca, inválidos e fora da base saem", () => {
  const base = baseDraft(round(), GROUPS);
  const draft = {
    ...base,
    scores: { "1": "500", "2": "300", "3": "120" }, // 3 não está na base
  };
  assert.deepEqual(scoreOverrides(base, draft), [
    { group_id: 1, amount: 80 },
    { group_id: 2, amount: 300 },
  ]);
  assert.deepEqual(scoreOverrides(base, { ...base, scores: { "1": "420" } }), []);
  assert.deepEqual(scoreOverrides(base, { ...base, scores: { "1": "abc" } }), []);
  // Arredonda para inteiro (o backend soma inteiro no ajuste).
  assert.deepEqual(scoreOverrides(base, { ...base, scores: { "1": "420.6" } }), [
    { group_id: 1, amount: 1 },
  ]);
});

test("isDraftDirty: limpo contra a base, sujo com qualquer troca", () => {
  const base = baseDraft(round(), GROUPS);
  const scope = { includeRules: true };
  assert.equal(isDraftDirty(base, { ...base }, scope), false);
  assert.equal(isDraftDirty(base, { ...base, scores: { ...base.scores, "1": "421" } }, scope), true);
  assert.equal(isDraftDirty(base, { ...base, deadline: "2026-06-01" }, scope), true);
  // Regra mudada fora do escopo não conta.
  assert.equal(
    isDraftDirty(base, { ...base, multiplier: "3" }, { includeRules: false }),
    false,
  );
});
