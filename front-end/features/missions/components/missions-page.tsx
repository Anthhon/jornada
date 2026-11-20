"use client";

import { NewMission } from "./new-mission";


import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, PageState, Scroll, Seal } from "@/features/journey/components/ui";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { formatDate } from "@/lib/date-format";
import { Link } from "@/lib/router-compat";
import { useJornada } from "@/stores/journey-store";
import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";



function Missoes() {
  const { status, retry } = useSimulatedLoad();
  const { incursions, teams } = useJornada();
  const [open, setOpen] = useState(false);
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";
  const sorted = [...incursions].sort((a, b) => a.number - b.number);

  return (
    <PageState status={status} retry={retry}>
      <PageHeader
        title="Missões"
        description="Cada missão reúne três grupos, quatro fases e um chefe no Covil do Monólito."
        action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/agenda"><CalendarDays /> Agenda pública</Link></Button><Button onClick={() => setOpen(true)}><Plus /> Nova missão</Button></div>}
      />
      {sorted.length === 0 ? (
        <EmptyState title="Nenhuma missão no mapa" hint="Crie a primeira missão para reunir os grupos." action={<Button onClick={() => setOpen(true)}><Plus /> Nova missão</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((i) => (
            <Link key={i.id} to="/missoes/$id" params={{ id: i.id }} className="block">
              <Scroll hover className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Missão {i.number} · {formatDate(i.date)}</span>
                  <Seal kind={i.result === "derrota" ? "derrota" : i.status} />
                </div>
                <div>
                  <h3 className="text-lg leading-snug">{i.title}</h3>
                  <p className="font-reading text-sm text-muted-foreground">Paradigma {i.paradigm}</p>
                </div>
                <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
                  {i.teams.map((t) => (
                    <li key={t.teamId} className="flex justify-between gap-2">
                      <span>{teamName(t.teamId)}</span>
                      <span className="font-reading text-muted-foreground">{t.language}</span>
                    </li>
                  ))}
                </ul>
                {i.result && (
                  <p className={i.result === "vitoria" ? "mt-auto font-display text-sm font-semibold text-accent-foreground" : "mt-auto font-display text-sm font-semibold text-destructive"}>
                    {i.result === "vitoria" ? "Missão cumprida!" : "O grupo recuou."}
                  </p>
                )}
              </Scroll>
            </Link>
          ))}
        </div>
      )}
      <NewMission open={open} onOpenChange={setOpen} />
    </PageState>
  );
}



export { Missoes as MissionsPage };
