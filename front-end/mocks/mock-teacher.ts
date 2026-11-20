export function isMockTeacher(request: Request): boolean {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    const registry: unknown = JSON.parse(sessionStorage.getItem("jornada-mock-tokens") ?? "{}");
    return !!token && typeof registry === "object" && registry !== null && "access" in registry && Array.isArray(registry.access) && registry.access.includes(token);
  } catch { return false; }
}
