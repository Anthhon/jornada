"use client";

import { useEffect, useMemo, useState } from "react";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ApiResponse = {
  status: number;
  statusText: string;
  duration: number;
  data: unknown;
};

const endpoints = [
  { group: "Autenticação", label: "Login", method: "POST", path: "/api/token/", body: { username: "admin", password: "" } },
  { group: "Autenticação", label: "Meu usuário", method: "GET", path: "/api/me/" },
  { group: "Documentação", label: "OpenAPI schema", method: "GET", path: "/api/schema/" },
  { group: "Usuários e alunos", label: "Usuários", method: "GET", path: "/api/users/" },
  { group: "Usuários e alunos", label: "Alunos", method: "GET", path: "/api/students/" },
  { group: "Usuários e alunos", label: "Criar alunos em lote", method: "POST", path: "/api/students/bulk/", body: { names: ["Aluno de teste"] } },
  { group: "Equipes", label: "Equipes", method: "GET", path: "/api/groups/" },
  { group: "Equipes", label: "Placar", method: "GET", path: "/api/leaderboard/" },
  { group: "Feitiços", label: "Feitiços", method: "GET", path: "/api/spells/" },
  { group: "Heróis", label: "Heróis", method: "GET", path: "/api/heroes/" },
  { group: "Chefes e perguntas", label: "Chefes", method: "GET", path: "/api/bosses/" },
  { group: "Chefes e perguntas", label: "Feitiços dos chefes", method: "GET", path: "/api/boss-spells/" },
  { group: "Chefes e perguntas", label: "Perguntas", method: "GET", path: "/api/questions/" },
  { group: "Chefes e perguntas", label: "Alternativas", method: "GET", path: "/api/choices/" },
  { group: "Jornadas", label: "Jornadas", method: "GET", path: "/api/journeys/" },
  { group: "Jornadas", label: "Etapas", method: "GET", path: "/api/stages/" },
  { group: "Jornadas", label: "Jornadas das equipes", method: "GET", path: "/api/group-journeys/" },
  { group: "Jornadas", label: "Progresso das etapas", method: "GET", path: "/api/stage-progress/" },
  { group: "Jornadas", label: "Eventos de batalha", method: "GET", path: "/api/battle-events/" },
  { group: "Batalha", label: "Iniciar batalha", method: "POST", path: "/api/battle/start/", body: { group_journey: 1 } },
  { group: "Batalha", label: "Consultar batalha", method: "GET", path: "/api/battle/1/" },
  { group: "Batalha", label: "Responder pergunta", method: "POST", path: "/api/battle/1/answer/", body: { choice: 1 } },
] as const;

function pretty(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? String(value);
}

function getRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  if (value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)) {
    return ((value as { results: unknown[] }).results).filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  }
  return [];
}

export default function Home() {
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8000");
  const [path, setPath] = useState("/api/leaderboard/");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem("access_token");
    const savedBase = localStorage.getItem("api_base_url");
    if (savedToken) setToken(savedToken);
    if (savedBase) setBaseUrl(savedBase);
  }, []);

  const rows = useMemo(() => response ? getRows(response.data) : [], [response]);
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.slice(0, 10).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
    return Array.from(keys);
  }, [rows]);

  function chooseEndpoint(endpoint: (typeof endpoints)[number]) {
    setPath(endpoint.path);
    setMethod(endpoint.method);
    setBody("body" in endpoint ? JSON.stringify(endpoint.body, null, 2) : "");
    setResponse(null);
    setError("");
  }

  async function executeRequest(override?: { method: HttpMethod; path: string; body?: string }) {
    const requestMethod = override?.method ?? method;
    const requestPath = override?.path ?? path;
    const requestBody = override?.body ?? body;

    let parsedBody: unknown;
    if (requestMethod !== "GET" && requestMethod !== "DELETE" && requestBody.trim()) {
      try {
        parsedBody = JSON.parse(requestBody);
      } catch {
        setError("O corpo da requisição não contém JSON válido.");
        return;
      }
    }

    const normalizedBase = baseUrl.trim().replace(/\/+$/, "");
    if (!normalizedBase) {
      setError("Informe a URL base do backend.");
      return;
    }

    const url = normalizedBase + (requestPath.startsWith("/") ? requestPath : "/" + requestPath);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (parsedBody !== undefined) headers["Content-Type"] = "application/json";

    setLoading(true);
    setError("");
    setResponse(null);
    const started = performance.now();

    try {
      const result = await fetch(url, {
        method: requestMethod,
        headers,
        body: parsedBody === undefined ? undefined : JSON.stringify(parsedBody),
      });
      const raw = await result.text();
      let data: unknown = raw;
      if (raw) {
        try { data = JSON.parse(raw); } catch { /* response may be plain text or YAML */ }
      }
      setResponse({
        status: result.status,
        statusText: result.statusText,
        duration: Math.round(performance.now() - started),
        data,
      });

      if (requestPath === "/api/token/" && result.ok && data && typeof data === "object") {
        const tokens = data as { access?: string; refresh?: string };
        if (tokens.access) {
          setToken(tokens.access);
          localStorage.setItem("access_token", tokens.access);
          if (tokens.refresh) localStorage.setItem("refresh_token", tokens.refresh);
          setLoginMessage("Token de acesso salvo neste navegador.");
        }
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao conectar com o backend.");
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    if (!username.trim() || !password) {
      setLoginMessage("Informe usuário e senha.");
      return;
    }
    setPath("/api/token/");
    setMethod("POST");
    setBody(JSON.stringify({ username: username.trim(), password }, null, 2));
    await executeRequest({
      method: "POST",
      path: "/api/token/",
      body: JSON.stringify({ username: username.trim(), password }),
    });
    setPassword("");
  }

  function logout() {
    setToken("");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setLoginMessage("Token removido do navegador.");
  }

  function saveBaseUrl(value: string) {
    setBaseUrl(value);
    localStorage.setItem("api_base_url", value);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-2xl font-bold">Jornada · API Console</h1>
            <p className="text-sm text-slate-500">Painel temporário para testar e visualizar os endpoints do backend.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={"h-2.5 w-2.5 rounded-full " + (token ? "bg-green-500" : "bg-amber-500")} />
            <span>{token ? "Autenticado" : "Sem autenticação"}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="panel">
            <h2 className="panel-title">Conexão</h2>
            <label className="field-label" htmlFor="base-url">URL base do backend</label>
            <input id="base-url" className="field" value={baseUrl} onChange={(event) => saveBaseUrl(event.target.value)} />
            <p className="mt-2 text-xs text-slate-500">Exemplo: http://127.0.0.1:8000</p>
          </section>

          <section className="panel">
            <h2 className="panel-title">Autenticação JWT</h2>
            <label className="field-label" htmlFor="username">Usuário</label>
            <input id="username" className="field" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
            <label className="field-label mt-3" htmlFor="password">Senha</label>
            <input id="password" className="field" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void login(); }} />
            <button className="button-primary mt-3 w-full" onClick={() => void login()} disabled={loading}>Obter token</button>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-slate-500">{token ? "Access token salvo" : "Nenhum token salvo"}</span>
              <button className="text-xs font-semibold text-red-700 hover:underline" onClick={logout}>Limpar token</button>
            </div>
            {loginMessage && <p className="mt-2 text-xs text-slate-600">{loginMessage}</p>}
          </section>

          <section className="panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="panel-title mb-0">Endpoints</h2>
              <span className="text-xs text-slate-500">{endpoints.length} atalhos</span>
            </div>
            <div className="space-y-4">
              {Array.from(new Set(endpoints.map((endpoint) => endpoint.group))).map((group) => (
                <div key={group}>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{group}</h3>
                  <div className="space-y-1">
                    {endpoints.filter((endpoint) => endpoint.group === group).map((endpoint) => (
                      <button key={endpoint.label} onClick={() => chooseEndpoint(endpoint)} className={"endpoint-link " + (path === endpoint.path ? "endpoint-link-active" : "")}>
                        <span>{endpoint.label}</span>
                        <span className="text-[10px] font-mono text-slate-400">{endpoint.method}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-5">
          <section className="panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="panel-title mb-1">Executar requisição</h2>
                <p className="text-sm text-slate-500">Escolha um atalho ou informe qualquer rota da API.</p>
              </div>
              <button className="button-secondary" onClick={() => { setPath("/api/schema/"); setMethod("GET"); setBody(""); }}>Abrir schema OpenAPI</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
              <select className="field" value={method} onChange={(event) => setMethod(event.target.value as HttpMethod)}>
                {(["GET", "POST", "PUT", "PATCH", "DELETE"] as HttpMethod[]).map((item) => <option key={item}>{item}</option>)}
              </select>
              <input className="field font-mono" value={path} onChange={(event) => setPath(event.target.value)} placeholder="/api/groups/" />
              <button className="button-primary" onClick={() => void executeRequest()} disabled={loading || !path.trim()}>{loading ? "Enviando..." : "Enviar"}</button>
            </div>

            {method !== "GET" && method !== "DELETE" && (
              <div className="mt-4">
                <label className="field-label" htmlFor="request-body">Corpo JSON</label>
                <textarea id="request-body" className="field min-h-40 font-mono text-sm" value={body} onChange={(event) => setBody(event.target.value)} spellCheck={false} placeholder={'{\n  "name": "Equipe de teste"\n}'} />
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">O token JWT salvo é enviado automaticamente no cabeçalho Authorization. GET e DELETE não enviam corpo.</p>
          </section>

          {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Falha na requisição:</strong> {error}</div>}

          {response && (
            <section className="panel">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="panel-title mb-1">Resposta</h2>
                  <p className="break-all font-mono text-xs text-slate-500">{method} {path}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={"rounded px-2 py-1 font-semibold " + (response.status >= 200 && response.status < 300 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>{response.status} {response.statusText}</span>
                  <span className="text-slate-500">{response.duration} ms</span>
                </div>
              </div>

              {rows.length > 0 && columns.length > 0 && (
                <div className="mb-5 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-semibold">Visualização em tabela ({rows.length} registros)</h3>
                  <table className="data-table">
                    <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
                    <tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map((column) => <td key={column}>{typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column] ?? "—")}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">JSON / conteúdo bruto</h3>
                <button className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => void navigator.clipboard.writeText(pretty(response.data))}>Copiar resposta</button>
              </div>
              <pre className="mt-2 max-h-[560px] overflow-auto rounded bg-slate-950 p-4 text-xs leading-5 text-slate-100">{pretty(response.data)}</pre>
            </section>
          )}

          {!response && !error && (
            <section className="panel">
              <h2 className="panel-title">Como começar</h2>
              <ol className="list-inside list-decimal space-y-2 text-sm text-slate-600">
                <li>Confirme se o Django está rodando em <code>127.0.0.1:8000</code>.</li>
                <li>Use o formulário de autenticação para obter um token de professor.</li>
                <li>Selecione um endpoint na lista ou digite uma rota manualmente.</li>
                <li>Para criar ou alterar registros, escolha POST, PUT ou PATCH e informe o JSON.</li>
                <li>Confira o status HTTP, a tabela (quando a resposta for uma lista) e o JSON completo.</li>
              </ol>
              <p className="mt-4 rounded bg-amber-50 p-3 text-xs text-amber-900">Atenção: operações POST, PUT, PATCH e DELETE alteram o banco de dados. Use registros de teste.</p>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
