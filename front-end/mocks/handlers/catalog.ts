import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api-config";
import { catalogSchemas, readCatalog, writeCatalog, type CatalogResource } from "../catalog-db";
import { isMockTeacher } from "../mock-teacher";

const error = (detail: string, status = 400) => HttpResponse.json({ detail }, { status });
export const catalogHandlers = (Object.keys(catalogSchemas) as CatalogResource[]).flatMap((resource) => {
  const url = `${API_BASE_URL}/mock-catalog/${resource}/`;
  return [
    http.get(url, ({ request }) => {
      if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
      try { return HttpResponse.json(readCatalog()[resource]); }
      catch { return error("Não foi possível carregar os cadastros.", 503); }
    }),
    http.put(`${url}:id/`, async ({ request, params }) => {
      if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
      let body: unknown;
      try { body = await request.json(); } catch { return error("JSON inválido."); }
      const parsed = catalogSchemas[resource].safeParse(body);
      if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      if (parsed.data.id !== params.id) return error("Identificador incompatível.");
      try {
        const db = readCatalog();
        const item = parsed.data;
        const list = db[resource];
        if ("name" in item && list.some((other) => "name" in other && other.id !== item.id && other.name.toLocaleLowerCase("pt-BR") === item.name.toLocaleLowerCase("pt-BR"))) return error("Já existe um cadastro com este nome.");
        if (resource === "students") {
          const student = catalogSchemas.students.parse(item);
          if (db.students.some((other) => other.id !== student.id && other.registration === student.registration)) return error("Matrícula já cadastrada.");
          db.students = [...db.students.filter((other) => other.id !== student.id), student];
        } else if (resource === "groups") {
          const group = catalogSchemas.groups.parse(item);
          if (group.memberIds.some((id) => !db.students.some((student) => student.id === id))) return error("Aventureiro não encontrado.");
          if (group.letter && db.groups.some((other) => other.id !== group.id && other.letter === group.letter)) return error("Letra de equipe já utilizada.");
          db.groups = db.groups.filter((other) => other.id !== group.id).map((other) => ({ ...other, memberIds: other.memberIds.filter((id) => !group.memberIds.includes(id)), extraPoints: Object.fromEntries(Object.entries(other.extraPoints).filter(([id]) => !group.memberIds.includes(id))) }));
          db.groups.push({ ...group, extraPoints: Object.fromEntries(Object.entries(group.extraPoints).filter(([id]) => group.memberIds.includes(id))) });
        } else if (resource === "heroes") {
          const hero = catalogSchemas.heroes.parse(item);
          if (hero.skillIds.some((id) => !db.skills.some((skill) => skill.id === id))) return error("Habilidade não encontrada.");
          db.heroes = [...db.heroes.filter((other) => other.id !== hero.id), hero];
        } else if (resource === "skills") { const skill = catalogSchemas.skills.parse(item); db.skills = [...db.skills.filter((other) => other.id !== skill.id), skill]; }
        else if (resource === "bosses") { const boss = catalogSchemas.bosses.parse(item); db.bosses = [...db.bosses.filter((other) => other.id !== boss.id), boss]; }
        else { const question = catalogSchemas.questions.parse(item); db.questions = [...db.questions.filter((other) => other.id !== question.id), question]; }
        writeCatalog(db);
        return HttpResponse.json(item);
      } catch { return error("Não foi possível salvar. Verifique o armazenamento do navegador.", 503); }
    }),
    http.delete(`${url}:id/`, ({ request, params }) => {
      if (!isMockTeacher(request)) return error("Acesso não autorizado.", 403);
      try {
        const db = readCatalog(); const id = String(params.id);
        if (!db[resource].some((item) => item.id === id)) return error("Cadastro não encontrado.", 404);
        if (resource === "students") { db.students = db.students.filter((item) => item.id !== id); db.groups = db.groups.map((group) => ({ ...group, memberIds: group.memberIds.filter((member) => member !== id), extraPoints: Object.fromEntries(Object.entries(group.extraPoints).filter(([member]) => member !== id)) })); }
        else if (resource === "groups") db.groups = db.groups.filter((item) => item.id !== id);
        else if (resource === "skills") { db.skills = db.skills.filter((item) => item.id !== id); db.heroes = db.heroes.map((hero) => ({ ...hero, skillIds: hero.skillIds.filter((skill) => skill !== id) })); }
        else if (resource === "heroes") db.heroes = db.heroes.filter((item) => item.id !== id);
        else if (resource === "bosses") db.bosses = db.bosses.filter((item) => item.id !== id);
        else db.questions = db.questions.filter((item) => item.id !== id);
        writeCatalog(db); return new HttpResponse(null, { status: 204 });
      } catch { return error("Não foi possível excluir o cadastro.", 503); }
    }),
  ];
});
