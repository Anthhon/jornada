/**
 * O request vem de uma sessão de professor? Duas fontes:
 * - **demo mockada** (`jornada-mock-tokens`): tokens emitidos pelo MSW;
 * - **sessão real** (`jornada-session` com `role: "professor"`): modo híbrido
 *   (`catalog`) — o professor logou no Django e o MSW só serve o catálogo.
 */
export function isMockTeacher(request: Request): boolean {
  try {
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token) return false;
    const registry: unknown = JSON.parse(sessionStorage.getItem("jornada-mock-tokens") ?? "{}");
    if (
      typeof registry === "object" &&
      registry !== null &&
      "access" in registry &&
      Array.isArray(registry.access) &&
      registry.access.includes(token)
    ) {
      return true;
    }
    const session: unknown = JSON.parse(sessionStorage.getItem("jornada-session") ?? "null");
    return (
      typeof session === "object" &&
      session !== null &&
      (session as { role?: unknown }).role === "professor"
    );
  } catch {
    return false;
  }
}
