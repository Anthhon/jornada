"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAgenda, saveAgenda } from "../services/agenda-service";
import type { PublicAgenda } from "../types/agenda";
import { useJornada } from "@/stores/journey-store";
import { useCatalogLoad } from "@/hooks/use-catalog-load";

type Draft = Record<string, { language: string; date: string }[]>;

export function TeacherAgenda() {
  const catalog = useCatalogLoad();
  const [agenda, setAgenda] = useState<PublicAgenda | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [teamId, setTeamId] = useState("");
  const teams = useJornada((state) => state.teams);
  const students = useJornada((state) => state.students);

  useEffect(() => {
    let active = true;
    getAgenda().then((data) => {
      if (!active) return;
      setAgenda(data);
      setDraft(Object.fromEntries(data.groups.map((group) => [group.id, group.schedule.map((slot) => slot ?? { language: "", date: "" })])));
    }).catch(() => { if (active) setError("Não foi possível carregar a agenda. Confira se o MSW está ativo."); });
    return () => { active = false; };
  }, []);

  function update(groupId: string, index: number, field: "language" | "date", value: string) {
    setMessage("");
    setDraft((previous) => ({ ...previous, [groupId]: previous[groupId].map((cell, i) => i === index ? { ...cell, [field]: value } : cell) }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agenda) return;
    const incomplete = Object.values(draft).some((cells) => cells.some((cell) => Boolean(cell.language.trim()) !== Boolean(cell.date)));
    if (incomplete) { setError("Informe linguagem e data juntas, ou deixe ambas em branco."); return; }
    setError(""); setSaving(true); setMessage("");
    try {
      const next: PublicAgenda = { ...agenda, groups: agenda.groups.map((group) => ({ ...group, schedule: draft[group.id].map((cell) => cell.language.trim() ? { language: cell.language.trim(), date: cell.date } : null) as PublicAgenda["groups"][number]["schedule"] })) };
      setAgenda(await saveAgenda(next));
      setMessage("Agenda salva neste navegador.");
    } catch { setError("Não foi possível salvar. Verifique a sessão e o armazenamento do navegador."); }
    finally { setSaving(false); }
  }

  return <section aria-labelledby="teacher-agenda-title">
    <h1 id="teacher-agenda-title" className="text-[1.85rem] leading-tight">Agenda de incursões</h1>
    <p className="mt-2 font-reading text-muted-foreground">Edite a linguagem e a data de cada equipe. Nesta demonstração, os dados ficam neste navegador.</p>
    {catalog.status === "error" && <div role="alert">Não foi possível carregar as equipes. <Button type="button" variant="outline" onClick={catalog.retry}>Tentar novamente</Button></div>}
    {error && <p role="alert" className="mt-4 text-destructive">{error}</p>}
    {!agenda && !error && <p role="status" className="mt-4">Carregando agenda…</p>}
    {agenda && <form onSubmit={submit} className="mt-6 space-y-4">
      <fieldset disabled={saving} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">Adicionar equipe cadastrada
          <select disabled={catalog.status !== "ready" || saving} className="h-10 min-w-56 rounded-md border border-input bg-background px-3" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            <option value="">Selecione uma equipe…</option>
            {teams.filter((team) => !agenda.groups.some((group) => group.id === team.id)).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" disabled={!teamId || saving || catalog.status !== "ready"} onClick={() => {
          const team = teams.find((item) => item.id === teamId);
          if (!team || agenda.groups.some((group) => group.id === team.id)) return;
          const members = students.filter((student) => team.memberIds.includes(student.id)).map(({ id, name, registration }) => ({ id, name, registration }));
          setAgenda({ ...agenda, groups: [...agenda.groups, { id: team.id, name: team.name, letter: team.letter, members, schedule: [null, null, null] }] });
          setDraft((previous) => ({ ...previous, [team.id]: Array.from({ length: 3 }, () => ({ language: "", date: "" })) }));
          setTeamId(""); setMessage("Equipe adicionada à edição. Salve para atualizar a agenda.");
        }}>Adicionar equipe</Button>
      </div>
      {agenda.groups.length === 0 ? <p>Nenhuma equipe disponível na agenda.</p> : <div className="overflow-x-auto rounded-md border border-border" role="region" aria-label="Matriz editável da agenda" tabIndex={0}>
        <table className="w-full min-w-[850px] text-sm"><thead><tr><th className="p-3 text-left">Equipe e aventureiros</th>{agenda.missions.map((mission) => <th key={mission.id} className="p-3 text-left">Incursão {mission.number}</th>)}</tr></thead>
          <tbody>{agenda.groups.map((group) => <tr key={group.id} className="border-t border-border align-top"><th scope="row" className="p-3 text-left"><span className="block">{group.name}</span><span className="mt-2 block font-normal text-muted-foreground">{group.members.map((member) => `${member.name} (${member.registration})`).join(", ") || "Sem integrantes"}</span></th>{draft[group.id]?.map((cell, index) => <td key={agenda.missions[index].id} className="min-w-48 p-3"><div className="space-y-2"><Input aria-label={`Linguagem da incursão ${index + 1}, ${group.name}`} placeholder="Linguagem" maxLength={100} value={cell.language} onChange={(event) => update(group.id, index, "language", event.target.value)} /><Input aria-label={`Data da incursão ${index + 1}, ${group.name}`} type="date" value={cell.date} onChange={(event) => update(group.id, index, "date", event.target.value)} /></div></td>)}</tr>)}</tbody>
        </table></div>}
      {agenda.groups.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Retirar equipes da agenda">
        {agenda.groups.map((group) => <Button key={group.id} type="button" variant="outline" onClick={() => {
          setAgenda({ ...agenda, groups: agenda.groups.filter((item) => item.id !== group.id) });
          setDraft((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => id !== group.id)));
          setMessage("Equipe retirada apenas desta edição da agenda. Salve para confirmar.");
        }}>Retirar {group.name} da agenda</Button>)}
      </div>}
      <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar agenda"}</Button>
      {message && <p role="status" className="text-sm">{message}</p>}
      </fieldset>
    </form>}
  </section>;
}
