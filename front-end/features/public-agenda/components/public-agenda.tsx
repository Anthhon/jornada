"use client";

import { Input } from "@/components/ui/input";
import { PageHeader } from "@/features/journey/components/ui";
import { formatDate } from "@/lib/date-format";
import { publicAgenda } from "@/lib/journey/agenda";
import { useJornada } from "@/stores/journey-store";
import { CalendarDays, Search } from "@/components/icons/rpg-icons";
import { useState } from "react";

const groupTones = ["bg-accent/60", "bg-info/10", "bg-parchment/50", "bg-secondary/60"];

export function PublicAgenda({ embedded = false }: { embedded?: boolean }) {
  const { students, teams, incursions } = useJornada();
  const [query, setQuery] = useState("");
  const agenda = publicAgenda(students, teams, incursions);
  const search = query.trim().toLocaleLowerCase("pt-BR");
  const groups = agenda.groups.map((group, index) => ({ ...group, index, members: group.name.toLocaleLowerCase("pt-BR").includes(search) ? group.members : group.members.filter((member) => `${member.name} ${member.registration}`.toLocaleLowerCase("pt-BR").includes(search)) })).filter((group) => !search || group.members.length > 0);

  return (
    <section id="agenda" className={embedded ? "w-full" : "mx-auto w-full max-w-7xl px-5 py-10 md:px-10 md:py-12"}>
      <PageHeader title="Agenda de incursões" description="Aventureiros, grupos e datas de cada missão." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar na agenda" className="pl-9" placeholder="Nome, matrícula ou grupo" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <span className="flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" /> {agenda.missions.length} missões · {teams.length} grupos</span>
      </div>
      <div className="overflow-x-auto rounded-sm border border-border-strong" role="region" aria-label="Calendário de incursões por grupo" tabIndex={0}>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">Matrículas, aventureiros, grupos, linguagens e datas de participação nas incursões</caption>
          <thead className="bg-sidebar">
            <tr>
              <th scope="col" className="border-b border-r border-border px-4 py-3 text-left font-medium">Matrícula</th>
              <th scope="col" className="min-w-52 border-b border-r border-border px-4 py-3 text-left font-medium">Aventureiro</th>
              <th scope="col" className="border-b border-r border-border px-4 py-3 text-left font-medium">Grupo</th>
              {agenda.missions.map((mission) => <th key={mission.id} scope="col" className="min-w-36 border-b border-r border-border px-4 py-3 text-center font-medium"><span className="block">Incursão {mission.number}</span><span className="mt-1 block max-w-48 font-reading text-xs font-normal text-muted-foreground">{mission.title}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const members = group.members.length ? group.members : [{ id: `${group.id}-empty`, name: "Sem aventureiros", registration: "—" }];
              return members.map((member, index) => (
                <tr key={member.id} className={groupTones[group.index % groupTones.length]}>
                  <td className="border-b border-r border-border px-4 py-3 font-mono text-xs">{member.registration}</td>
                  <td className="border-b border-r border-border px-4 py-3">{member.name}</td>
                  {index === 0 && <th scope="rowgroup" rowSpan={members.length} className="min-w-40 border-b border-r border-border px-4 py-4 text-center font-display font-semibold">{group.name}</th>}
                  {index === 0 && group.schedule.map((slot, column) => <td key={agenda.missions[column]?.id ?? column} rowSpan={members.length} className="border-b border-r border-border px-4 py-4 text-center">{slot ? <><span className="block font-medium">{slot.language}</span><time dateTime={slot.date} className="mt-1 block whitespace-nowrap font-reading text-muted-foreground">{formatDate(slot.date)}</time></> : <span className="text-muted-foreground" aria-label="Sem participação">—</span>}</td>)}
                </tr>
              ));
            })}
            {groups.length === 0 && <tr><td colSpan={3 + agenda.missions.length} className="px-5 py-10 text-center font-reading text-muted-foreground">{search ? "Nenhum aventureiro ou grupo encontrado." : "Nenhum grupo cadastrado."}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
