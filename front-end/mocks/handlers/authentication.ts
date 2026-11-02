import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api-config";
import { mockCredentials, mockUser } from "../fixtures/authentication";

export function createAuthenticationHandlers() {
  const accessTokens = new Set<string>();
  const refreshTokens = new Set<string>();
  function issueAccess() {
    const token = `msw-access-${crypto.randomUUID()}`;
    accessTokens.add(token);
    return token;
  }
  return [
    http.post(`${API_BASE_URL}/token/`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      if (body.username !== mockCredentials.username || body.password !== mockCredentials.password) {
        return HttpResponse.json({ detail: "No active account found with the given credentials" }, { status: 401 });
      }
      const refresh = `msw-refresh-${crypto.randomUUID()}`;
      refreshTokens.add(refresh);
      return HttpResponse.json({ access: issueAccess(), refresh });
    }),
    http.post(`${API_BASE_URL}/token/refresh/`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      if (typeof body.refresh !== "string" || !refreshTokens.has(body.refresh)) {
        return HttpResponse.json({ detail: "Token is invalid or expired", code: "token_not_valid" }, { status: 401 });
      }
      return HttpResponse.json({ access: issueAccess() });
    }),
    http.get(`${API_BASE_URL}/users/`, ({ request }) => {
      const access = request.headers.get("authorization")?.replace(/^Bearer /, "");
      if (!access || !accessTokens.has(access)) {
        return HttpResponse.json({ detail: "Authentication credentials were not provided or are invalid." }, { status: 401 });
      }
      return HttpResponse.json([mockUser]);
    }),
  ];
}
