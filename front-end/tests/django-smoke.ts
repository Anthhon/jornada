import assert from "node:assert/strict";
import { createApiClient } from "../lib/api";
import type { TokenPair, TokenStorage } from "../lib/token-storage";

async function main() {
  let tokens: TokenPair | null = null;
  const storage: TokenStorage = {
    read: () => tokens,
    write: (value) => { tokens = value; },
    clear: () => { tokens = null; },
  };
  const { client, authClient } = createApiClient(storage);
  await assert.rejects(client.get("/users/"), { status: 401 });
  const { data } = await authClient.post<TokenPair>("/token/", {
    username: "integration-test", password: "integration-test-only",
  });
  storage.write(data);
  const users = (await client.get("/users/")).data;
  assert.ok(users.some((user: { username: string }) => user.username === "integration-test"));
  storage.write({ ...data, access: "expired" });
  assert.equal((await client.get("/users/")).status, 200);
  assert.notEqual(storage.read()?.access, "expired");
  console.log("Axios → Django: login, protected users and JWT renewal passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
