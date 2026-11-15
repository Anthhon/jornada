import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api-config";
import { agendaSchema } from "@/features/public-agenda/schemas/agenda";
import { groups, missions } from "../landing-agenda";
import { readCatalog } from "../catalog-db";
import { isMockTeacher } from "../mock-teacher";
import type { PublicAgenda } from "@/features/public-agenda/types/agenda";

const storageKey = "jornada-mock-agenda-v1";
let memory = JSON.stringify({ groups, missions });

function read() {
  try { return localStorage.getItem(storageKey) ?? memory; } catch { return memory; }
}
function write(value: string) {
  try { localStorage.setItem(storageKey, value); } catch { throw new Error("Armazenamento indisponível"); }
  memory = value;
}
function resolveAgenda(agenda: PublicAgenda): PublicAgenda {
  const catalog = readCatalog();
  return { ...agenda, groups: agenda.groups.flatMap((group) => {
    const team = catalog.groups.find((item) => item.id === group.id);
    if (!team) return [];
    return [{ ...group, name: team.name, letter: team.letter, members: catalog.students.filter((student) => team.memberIds.includes(student.id)) }];
  }) };
}
export const agendaHandlers = [
  http.get(`${API_BASE_URL}/mock-agenda/`, () => {
    try { return HttpResponse.json(resolveAgenda(agendaSchema.parse(JSON.parse(read())))); }
    catch { return HttpResponse.json({ detail: "Não foi possível ler a agenda." }, { status: 500 }); }
  }),
  http.put(`${API_BASE_URL}/mock-agenda/`, async ({ request }) => {
    if (!isMockTeacher(request)) return HttpResponse.json({ detail: "Acesso não autorizado." }, { status: 403 });
    try {
      const result = agendaSchema.safeParse(await request.json());
      if (!result.success) return HttpResponse.json({ detail: "Dados da agenda inválidos." }, { status: 400 });
      const resolved = resolveAgenda(result.data);
      if (resolved.groups.length !== result.data.groups.length) return HttpResponse.json({ detail: "Uma equipe foi removida. Recarregue a agenda." }, { status: 409 });
      write(JSON.stringify(resolved));
      return HttpResponse.json(resolved);
    } catch { return HttpResponse.json({ detail: "Não foi possível salvar a agenda." }, { status: 500 }); }
  }),
];
