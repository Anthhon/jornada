import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { setupServer } from "msw/node";
import { catalogHandlers } from "../mocks/handlers/catalog";
import { agendaHandlers } from "../mocks/handlers/agenda";
import { catalogSchema, readCatalog, writeCatalog, type CatalogResource } from "../mocks/catalog-db";
import { API_BASE_URL } from "../lib/api-config";
import { api } from "../lib/api";
import { studentService } from "../features/students/services/student-service";
import { groupService } from "../features/groups/services/group-service";
import { skillService } from "../features/skills/services/skill-service";
import { heroService } from "../features/heroes/services/hero-service";
import { bossService } from "../features/bosses/services/boss-service";
import { questionService } from "../features/questions/services/question-service";

function storage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, clear: () => values.clear(), key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key); } };
}
const initial = readCatalog();
const server = setupServer(...catalogHandlers, ...agendaHandlers);
const headers = { Authorization: "Bearer test-teacher", "Content-Type": "application/json" };
const url = (resource: string) => `${API_BASE_URL}/mock-catalog/${resource}/`;
before(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage() });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage() });
  server.listen({ onUnhandledFrame: "error" });
  api.defaults.headers.common.Authorization = "Bearer test-teacher";
});
beforeEach(() => { localStorage.clear(); sessionStorage.setItem("jornada-mock-tokens", JSON.stringify({ access: ["test-teacher"] })); writeCatalog(initial); });
after(() => { server.close(); delete api.defaults.headers.common.Authorization; Reflect.deleteProperty(globalThis, "localStorage"); Reflect.deleteProperty(globalThis, "sessionStorage"); });

test("todos os seeds atendem aos contratos Zod", () => { assert.equal(catalogSchema.safeParse(initial).success, true); });
for (const resource of Object.keys(initial) as CatalogResource[]) {
  test(`${resource}: CRUD, persistência e acesso negado`, async () => {
    assert.equal((await fetch(url(resource))).status, 403);
    const record = { ...initial[resource][0], id: `new-${resource}`, name: `Novo ${resource}`, ...(resource === "students" ? { registration: "999999" } : {}) };
    const saved = await fetch(`${url(resource)}${record.id}/`, { method: "PUT", headers, body: JSON.stringify(record) });
    assert.equal(saved.status, 200, await saved.text());
    assert.ok(readCatalog()[resource].some((item) => item.id === record.id));
    assert.equal((await fetch(`${url(resource)}${record.id}/`, { method: "PUT", headers, body: JSON.stringify({ ...record, name: "", statement: "" }) })).status, 400);
    const list = await (await fetch(url(resource), { headers })).json();
    assert.ok(list.some((item: { id: string }) => item.id === record.id));
    assert.equal((await fetch(`${url(resource)}${record.id}/`, { method: "DELETE", headers })).status, 204);
    assert.equal((await fetch(`${url(resource)}${record.id}/`, { method: "DELETE", headers })).status, 404);
  });
}
test("os serviços validam a leitura e salvam pelos mesmos endpoints", async () => {
  assert.equal((await studentService.list()).length, initial.students.length);
  assert.equal((await groupService.list()).length, initial.groups.length);
  assert.equal((await skillService.list()).length, initial.skills.length);
  assert.equal((await heroService.list()).length, initial.heroes.length);
  assert.equal((await bossService.list()).length, initial.bosses.length);
  assert.equal((await questionService.list()).length, initial.questions.length);
  const student = await studentService.save({ id: "service-student", name: "Aluno teste", registration: "999998" });
  assert.equal(student.name, "Aluno teste");
  await studentService.remove(student.id);
  assert.ok(!(await studentService.list()).some((item) => item.id === student.id));
});
test("transferência, exclusão e vínculos atualizam a agenda pública", async () => {
  const from = initial.groups[0]; const to = initial.groups[1]; const studentId = from.memberIds[0];
  await groupService.save({ ...to, memberIds: [...to.memberIds, studentId], letter: "B" });
  const db = readCatalog();
  assert.ok(!db.groups[0].memberIds.includes(studentId));
  assert.equal(db.groups[0].extraPoints[studentId], undefined);
  const agenda = await (await fetch(`${API_BASE_URL}/mock-agenda/`)).json();
  assert.ok(agenda.groups.find((group: { id: string }) => group.id === to.id).members.some((member: { id: string }) => member.id === studentId));
  assert.equal(agenda.groups.find((group: { id: string }) => group.id === to.id).letter, "B");
  await studentService.remove(studentId);
  assert.ok(!readCatalog().groups.some((group) => group.memberIds.includes(studentId)));
  const skillId = initial.skills[0].id;
  await skillService.remove(skillId);
  assert.ok(!readCatalog().heroes.some((hero) => hero.skillIds.includes(skillId)));
});
test("dados duplicados, referências inválidas e respostas sem gabarito são rejeitados", async () => {
  await assert.rejects(studentService.save({ ...initial.students[0], id: "duplicate" }));
  await assert.rejects(groupService.save({ ...initial.groups[0], memberIds: ["missing"] }));
  await assert.rejects(heroService.save({ ...initial.heroes[0], skillIds: ["missing"] }));
  await assert.rejects(questionService.save({ ...initial.questions[0], options: [{ text: "A", correct: false }, { text: "B", correct: false }] }));
});
test("falha de armazenamento não retorna sucesso de salvamento", async () => {
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error("quota"); };
  try { await assert.rejects(studentService.save({ id: "quota", name: "Teste", registration: "999997" })); }
  finally { localStorage.setItem = original; }
});
