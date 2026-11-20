import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { API_BASE_URL } from "../lib/api-config";
import { createApiClient } from "../lib/api";
import type { TokenPair, TokenStorage } from "../lib/token-storage";
import { createAuthenticationHandlers } from "../mocks/handlers/authentication";
import { mockCredentials, mockUser } from "../mocks/fixtures/authentication";
import { getUsers } from "../features/users/services/users-service";
import { login } from "../features/authentication/services/authentication-service";
import { currentUserSchema } from "../features/authentication/schemas/current-user";

const server = setupServer();
before(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => server.resetHandlers(...createAuthenticationHandlers()));
afterEach(() => server.resetHandlers());
after(() => server.close());

function context() {
  let tokens: TokenPair | null = null;
  let expired = 0;
  const storage: TokenStorage = {
    read: () => tokens,
    write: (value) => { tokens = value; },
    clear: () => { tokens = null; },
  };
  const clients = createApiClient(storage, () => { expired++; });
  return { ...clients, storage, expired: () => expired };
}

test("login, profile and protected users use the Django HTTP contract", async () => {
  const { authClient, client, storage } = context();
  const { data } = await authClient.post<TokenPair>("/token/", mockCredentials);
  storage.write(data);
  const profile = currentUserSchema.parse((await client.get("/me/")).data);
  assert.equal(`${profile.first_name} ${profile.last_name}`, "Helena Duarte");
  assert.equal(profile.role, "teacher");
  assert.deepEqual((await client.get("/users/")).data, [mockUser]);
});

test("wrong credentials and missing authentication return 401", async () => {
  const { authClient, client, storage } = context();
  await assert.rejects(authClient.post("/token/", { username: "professor", password: "wrong" }), { status: 401 });
  await assert.rejects(client.get("/users/"), { status: 401 });
  assert.equal(storage.read(), null);
});

test("login normalizes username whitespace without changing the password", async () => {
  await login({ username: "  professor  ", password: mockCredentials.password });
  await assert.rejects(login({ username: mockCredentials.username, password: `${mockCredentials.password} ` }), { status: 401 });
});

test("mock sessions survive reloading handlers and still reject unknown tokens", async () => {
  const values = new Map<string, string>();
  const registry = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  server.resetHandlers(...createAuthenticationHandlers(registry));
  const { authClient, client, storage } = context();
  const { data } = await authClient.post<TokenPair>("/token/", mockCredentials);
  storage.write(data);

  // Recriar os handlers reproduz uma recarga da página ou do módulo pelo HMR.
  server.resetHandlers(...createAuthenticationHandlers(registry));
  assert.equal((await client.get("/me/")).data.role, "teacher");
  assert.equal((await client.get("/users/")).status, 200);
  assert.equal((await authClient.post("/token/refresh/", { refresh: data.refresh })).status, 200);
  await assert.rejects(authClient.get("/me/", { headers: { Authorization: "Bearer msw-access-unknown" } }), { status: 401 });
});

test("concurrent 401 responses share one refresh and retry successfully", async () => {
  const { authClient, client, storage } = context();
  storage.write((await authClient.post<TokenPair>("/token/", mockCredentials)).data);
  storage.write({ ...storage.read()!, access: "expired" });
  let refreshes = 0;
  server.use(
    http.post(`${API_BASE_URL}/token/refresh/`, async () => {
      refreshes++; await delay(60);
      return HttpResponse.json({ access: "renewed" });
    }),
    http.get(`${API_BASE_URL}/users/`, ({ request }) => request.headers.get("authorization") === "Bearer renewed"
      ? HttpResponse.json([mockUser]) : HttpResponse.json({}, { status: 401 })),
  );
  const responses = await Promise.all([client.get("/users/"), client.get("/users/")]);
  assert.equal(refreshes, 1);
  assert.equal(responses.length, 2);
  assert.equal(storage.read()?.access, "renewed");
});

test("an invalid refresh clears credentials and notifies the UI", async () => {
  const { client, storage, expired } = context();
  storage.write({ access: "expired", refresh: "invalid" });
  await assert.rejects(client.get("/users/"), { status: 401 });
  assert.equal(storage.read(), null);
  assert.equal(expired(), 1);
});

test("a repeated 401 stops after one retry", async () => {
  const { client, storage } = context();
  storage.write({ access: "expired", refresh: "valid" });
  let refreshes = 0;
  server.use(http.post(`${API_BASE_URL}/token/refresh/`, () => {
    refreshes++;
    return HttpResponse.json({ access: "still-rejected" });
  }));
  await assert.rejects(client.get("/users/"), { status: 401 });
  assert.equal(refreshes, 1);
  assert.equal(storage.read(), null);
});

test("500 responses do not refresh or discard a valid session", async () => {
  const { client, storage, expired } = context();
  storage.write({ access: "valid", refresh: "valid" });
  server.use(http.get(`${API_BASE_URL}/users/`, () => HttpResponse.json({}, { status: 500 })));
  await assert.rejects(client.get("/users/"), { status: 500 });
  assert.equal(expired(), 0);
  assert.ok(storage.read());
});

test("feature services reject responses that do not match Django DTOs", async () => {
  server.use(
    http.get(`${API_BASE_URL}/users/`, () => HttpResponse.json([{ id: "wrong-id-type" }])),
    http.post(`${API_BASE_URL}/token/`, () => HttpResponse.json({ access: "missing-refresh" })),
  );
  await assert.rejects(getUsers(), { name: "ZodError" });
  await assert.rejects(login(mockCredentials), { name: "ZodError" });
});

test("a pending refresh cannot overwrite a newly logged-in session", async () => {
  const { client, storage, expired } = context();
  storage.write({ access: "old", refresh: "old-refresh" });
  server.use(http.post(`${API_BASE_URL}/token/refresh/`, async () => {
    storage.write({ access: "new-session", refresh: "new-refresh" });
    return HttpResponse.json({ access: "old-session-renewed" });
  }));
  await assert.rejects(client.get("/users/"), /Session changed/);
  assert.deepEqual(storage.read(), { access: "new-session", refresh: "new-refresh" });
  assert.equal(expired(), 0);
});
