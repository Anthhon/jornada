import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_BASICS,
  MAX_ULTIMATES,
  countKinds,
  isCompleteSelection,
  toggleSelection,
} from "../features/arena/lib/ability-selection";

const TEMPLATES = [
  { id: 1, kind: "BASIC" },
  { id: 2, kind: "BASIC" },
  { id: 3, kind: "BASIC" },
  { id: 4, kind: "ULTIMATE" },
  { id: 5, kind: "BASIC" },
  { id: 6, kind: "ULTIMATE" },
];

test("conta básicas e ultimates válidas (ignora id fora do catálogo)", () => {
  assert.deepEqual(countKinds([1, 2, 4, 999], TEMPLATES), { basics: 2, ultimates: 1 });
  assert.deepEqual(countKinds([], TEMPLATES), { basics: 0, ultimates: 0 });
});

test("alterna: adiciona ausente e remove presente", () => {
  assert.deepEqual(toggleSelection([], TEMPLATES[0], TEMPLATES), [1]);
  assert.deepEqual(toggleSelection([1], TEMPLATES[0], TEMPLATES), []);
});

test("não passa do limite de 3 básicas", () => {
  let selected = [1, 2, 3];
  selected = toggleSelection(selected, TEMPLATES[4], TEMPLATES); // 4ª básica (id 5)
  assert.equal(selected.length, MAX_BASICS);
  assert.equal(selected.includes(5), false);
});

test("não passa do limite de 1 ultimate", () => {
  let selected = [4];
  selected = toggleSelection(selected, TEMPLATES[5], TEMPLATES); // 2ª ultimate (id 6)
  assert.equal(selected.length, MAX_ULTIMATES);
  assert.equal(selected.includes(6), false);
  // mas a escolhida continua removível
  assert.deepEqual(toggleSelection(selected, TEMPLATES[3], TEMPLATES), []);
});

test("completo = exatamente 3 + 1, sem repetição nem id desconhecido", () => {
  assert.equal(isCompleteSelection([1, 2, 3, 4], TEMPLATES), true);
  assert.equal(isCompleteSelection([1, 2, 3, 5], TEMPLATES), false); // sem ultimate
  assert.equal(isCompleteSelection([1, 2, 4, 6], TEMPLATES), false); // só 2 básicas
  assert.equal(isCompleteSelection([1, 2, 3, 4, 5], TEMPLATES), false); // demais
  assert.equal(isCompleteSelection([1, 2, 3, 999], TEMPLATES), false); // fora do catálogo
  assert.equal(isCompleteSelection([], TEMPLATES), false);
});
