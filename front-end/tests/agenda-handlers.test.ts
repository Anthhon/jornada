import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { setupServer } from "msw/node";
import { agendaHandlers } from "../mocks/handlers/agenda";
import { API_BASE_URL } from "../lib/api-config";

function storage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}

const server = setupServer(...agendaHandlers);
before(() => { Object.defineProperty(globalThis, "localStorage", { value: storage(), configurable: true }); Object.defineProperty(globalThis, "sessionStorage", { value: storage(), configurable: true }); server.listen({ onUnhandledFrame: "error" }); });
after(() => { server.close(); Reflect.deleteProperty(globalThis, "localStorage"); Reflect.deleteProperty(globalThis, "sessionStorage"); });

test("leitura pública e gravação simulada exigem sessão de professor", async () => {
  const url = `${API_BASE_URL}/mock-agenda/`;
  const initial = await (await fetch(url)).json();
  const forbidden = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(initial) });
  assert.equal(forbidden.status, 403);
  sessionStorage.setItem("jornada-mock-tokens", JSON.stringify({ access: ["teacher-token"] }));
  initial.groups[0].schedule[0] = { language: "Java", date: "2026-09-04" };
  const saved = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer teacher-token" }, body: JSON.stringify(initial) });
  assert.equal(saved.status, 200);
  const read = await (await fetch(url)).json();
  assert.deepEqual(read.groups[0].schedule[0], { language: "Java", date: "2026-09-04" });
});
