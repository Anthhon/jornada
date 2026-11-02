"use client";


import { PageHeader, PageState, Scroll, Seal } from "@/features/journey/components/ui";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { formatDate } from "@/lib/date-format";
import { Link } from "@/lib/router-compat";
import { useJornada } from "@/stores/journey-store";
import { ArrowRight, BookOpen, Scroll as ScrollIcon, Shield, Skull, Swords, Users } from "lucide-react";



function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <Scroll>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-4xl font-semibold">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-accent-foreground" strokeWidth={1.5} />
      </div>
    </Scroll>
  );
}

function Salao() {
  const { status, retry } = useSimulatedLoad();
  const { students, teams, incursions, session } = useJornada();
  const count = (s: string) => incursions.filter((i) => i.status === s).length;
  const upcoming = [...incursions].filter((i) => i.status !== "concluida").sort((a, b) => a.date.localeCompare(b.date));
  const shortcuts = [
    { to: "/aventureiros", label: "Aventureiros", icon: Users },
    { to: "/grupos", label: "Grupos", icon: Shield },
    { to: "/habilidades", label: "Habilidades", icon: BookOpen },
    { to: "/chefes", label: "Chefes", icon: Skull },
    { to: "/perguntas", label: "Perguntas", icon: ScrollIcon },
  ] as const;

  return (
    <PageState status={status} retry={retry}>
      <PageHeader title="Salão da Guilda" description={`Bem-vinda de volta, ${session?.name}. Aqui está o estado das jornadas.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Aventureiros" value={students.length} icon={Users} />
        <Stat label="Grupos" value={teams.length} icon={Shield} />
        <Stat label="Missões" value={incursions.length} icon={Swords} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {(["planejada", "andamento", "concluida"] as const).map((k) => (
          <Scroll key={k} className="flex items-center justify-between py-4">
            <Seal kind={k} />
            <span className="font-display text-2xl font-semibold">{count(k)}</span>
          </Scroll>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-4 text-xl">Próximas missões</h2>
          <div className="space-y-3">
            {upcoming.length === 0 && <p className="font-reading text-muted-foreground">Nenhuma missão pendente.</p>}
            {upcoming.map((i) => (
              <Link key={i.id} to="/missoes/$id" params={{ id: i.id }} className="block">
                <Scroll hover className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Missão {i.number} · {formatDate(i.date)}</p>
                    <p className="font-display text-base font-semibold">{i.title}</p>
                    <p className="font-reading text-sm text-muted-foreground">{i.paradigm}</p>
                  </div>
                  <div className="flex items-center gap-3"><Seal kind={i.status} /><ArrowRight className="h-4 w-4 text-muted-foreground" /></div>
                </Scroll>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-4 text-xl">Atalhos</h2>
          <div className="grid gap-2">
            {shortcuts.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="flex h-11 items-center gap-3 rounded-md border border-border bg-card px-4 text-sm transition-colors hover:border-primary-hover hover:bg-accent">
                <Icon className="h-4 w-4 text-accent-foreground" strokeWidth={1.6} /> {label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageState>
  );
}

export { Salao as DashboardPage };
