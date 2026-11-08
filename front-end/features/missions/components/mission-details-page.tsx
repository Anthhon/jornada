"use client";
import { useParams } from "next/navigation";


import { EvaluationForm } from "./evaluation-form";

import { TurnForm } from "./turn-form";


import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Confirm, EmptyState, Field, Gems, HpBar, PageState, Scroll, Seal, selectClass } from "@/features/journey/components/ui";
import { useSimulatedLoad } from "@/hooks/use-simulated-load";
import { formatDate, formatTime } from "@/lib/date-format";
import { presentationGrade, remainingHp, resourcePoints } from "@/lib/journey/rules";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { fakeSave } from "@/mocks/latency";
import { useJornada } from "@/stores/journey-store";
import type { Incursion, TurnEffect } from "@/features/missions";
import { ArrowLeft, Check, Flag, Flame, Heart, Lock, Play, ScrollText, Shield, Skull } from "@/components/icons/rpg-icons";
import { Crest } from "@/features/journey/components/crest";
import { useState } from "react";
import { toast } from "sonner";



function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { status, retry } = useSimulatedLoad();
  const inc = useJornada((s) => s.incursions.find((i) => i.id === id));

  return (
    <PageState status={status} retry={retry}>
      <Link to="/missoes" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Missões
      </Link>
      {!inc ? (
        <EmptyState title="Missão não encontrada" hint="Ela pode ter sido removida do mapa." />
      ) : (
        <>
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Missão {inc.number} · {formatDate(inc.date)} · Paradigma {inc.paradigm}</p>
              <h1 className="mt-1 text-[1.85rem] leading-tight">{inc.title}</h1>
            </div>
            <Seal kind={inc.result === "derrota" ? "derrota" : inc.status} />
          </div>
          <Tabs defaultValue="fases">
            <TabsList className="mb-6 h-11 rounded-md bg-secondary/70 p-1">
              <TabsTrigger value="fases" className="h-9 rounded-sm px-4 font-display">Fases</TabsTrigger>
              <TabsTrigger value="grupos" className="h-9 rounded-sm px-4 font-display">Grupos</TabsTrigger>
              <TabsTrigger value="batalha" className="h-9 rounded-sm px-4 font-display">Batalha</TabsTrigger>
            </TabsList>
            <TabsContent value="fases" className="page-enter"><Phases inc={inc} /></TabsContent>
            <TabsContent value="grupos" className="page-enter"><Groups inc={inc} /></TabsContent>
            <TabsContent value="batalha" className="page-enter"><Battle inc={inc} /></TabsContent>
          </Tabs>
        </>
      )}
    </PageState>
  );
}

/* ---------------- Fases ---------------- */

function Phases({ inc }: { inc: Incursion }) {
  const { teams, bosses, startStage, finishStage } = useJornada();
  const [pending, setPending] = useState<{ level: number; action: "start" | "finish" } | null>(null);
  const anyRunning = inc.stages.some((s) => s.status === "andamento");
  const canStart = (level: number) => {
    const s = inc.stages[level - 1];
    return s?.status === "aguardando" && !anyRunning && (level === 1 || inc.stages[level - 2]?.status === "concluida") && !inc.result;
  };
  const locked = (level: number) => level > 1 && inc.stages[level - 2]?.status !== "concluida" && inc.stages[level - 1]?.status === "aguardando";
  const teamName = (id: string | null) => (id ? teams.find((t) => t.id === id)?.name : "Toda a Aliança") ?? "—";

  const confirm = () => {
    if (!pending) return;
    if (pending.action === "start") {
      const bossId = startStage(inc.id, pending.level);
      if (pending.level === 4) {
        const b = bosses.find((x) => x["id"] === bossId);
        if (b) toast.success(`O chefe desperta: ${b.name}.`);
        else toast.error("Nenhum chefe ativo para o sorteio.");
      } else toast.success(`Fase ${pending.level} iniciada.`);
    } else {
      finishStage(inc.id, pending.level);
      toast.success(`Fase ${pending.level} concluída.`);
    }
    setPending(null);
  };

  return (
    <div className="space-y-8">
      {/* Mapa de fases */}
      <Scroll className="px-6 py-8">
        <div className="relative flex items-start justify-between">
          <div className="absolute left-[12%] right-[12%] top-6 border-t-2 border-dashed border-border-strong/40" aria-hidden />
          {inc.stages.map((s) => {
            const isLocked = locked(s.level);
            const Icon = s.level === 4 ? Skull : s.status === "concluida" ? Check : isLocked ? Lock : Crest;
            return (
              <div key={s.level} className="relative z-10 flex w-1/4 flex-col items-center text-center">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 bg-card transition-all duration-200",
                  s.status === "concluida" && "border-success bg-accent text-accent-foreground",
                  s.status === "andamento" && "border-info text-info ring-4 ring-info/25",
                  s.status === "aguardando" && (isLocked ? "border-border-strong/30 text-muted-foreground" : "border-border-strong text-foreground"),
                )}>
                  {isLocked && s.level === 4 ? <Lock className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <p className="mt-2 font-display text-xs font-semibold uppercase tracking-wider">Fase {s.level}</p>
                <p className="font-reading text-xs text-muted-foreground">{s.name}</p>
              </div>
            );
          })}
        </div>
      </Scroll>

      <div className="space-y-3">
        {inc.stages.map((s) => (
          <Scroll key={s.level} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display font-semibold">Fase {s.level} — {s.name}{s.level === 4 && " (chefe)"}</p>
              <p className="text-sm text-muted-foreground">
                Responsável: {teamName(s.responsibleTeamId)} · Início {formatTime(s.startedAt)} · Fim {formatTime(s.endedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {s.status === "concluida" && <span className="text-sm text-accent-foreground">Concluída</span>}
              {s.status === "andamento" && <Button onClick={() => setPending({ level: s.level, action: "finish" })}><Flag /> Concluir</Button>}
              {s.status === "aguardando" && (
                canStart(s.level)
                  ? <Button variant="outline" onClick={() => setPending({ level: s.level, action: "start" })}><Play /> Iniciar</Button>
                  : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Aguarda a fase anterior</span>
              )}
            </div>
          </Scroll>
        ))}
      </div>

      <Confirm
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.action === "start" ? `Iniciar a fase ${pending.level}?` : `Concluir a fase ${pending?.level}?`}
        description={pending?.action === "start" && pending.level === 4 ? "Um chefe ativo será sorteado para o Covil do Monólito." : "O horário será registrado agora."}
        confirmLabel={pending?.action === "start" ? "Iniciar" : "Concluir"}
        onConfirm={confirm}
      />
    </div>
  );
}

/* ---------------- Grupos ---------------- */

function Groups({ inc }: { inc: Incursion }) {
  const { teams, heroes, setHero } = useJornada();
  const [evalTeam, setEvalTeam] = useState<string | null>(null);
  const usedHeroes = inc.teams.map((t) => t.heroId).filter(Boolean);

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {inc.teams.map((t) => {
          const team = teams.find((x) => x["id"] === t.teamId);
          const hero = heroes.find((h) => h.id === t.heroId);
          const grade = presentationGrade(t.evaluation);
          return (
            <Scroll key={t.teamId} className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg">{team?.name}</h3>
                <p className="font-reading text-sm text-muted-foreground">{t.language}</p>
              </div>
              <Field label="Herói">
                <select className={selectClass} value={t.heroId ?? ""} disabled={!!inc.result} onChange={(e) => { setHero(inc.id, t.teamId, e.target.value); toast.success("Herói escolhido."); }}>
                  <option value="" disabled>Escolher herói…</option>
                  {heroes.map((h) => (
                    <option key={h.id} value={h.id} disabled={usedHeroes.includes(h.id) && h.id !== t.heroId}>
                      {h.name} — {h.heroClass}{usedHeroes.includes(h.id) && h.id !== t.heroId ? " (em uso)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              {hero && <p className="text-xs text-muted-foreground">{hero.role === "Ataque" ? <Crest className="mr-1 inline h-3 w-3" /> : <Shield className="mr-1 inline h-3 w-3" />}{hero.role}</p>}
              <div className="flex items-end justify-between border-t border-border pt-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Nota</p>
                  <p className="font-display text-2xl font-semibold">{grade === null ? "—" : grade.toFixed(1)}</p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Recursos</p>
                  <Gems value={resourcePoints(t.evaluation?.correct ?? 0)} />
                </div>
              </div>
              <Button variant="outline" onClick={() => setEvalTeam(t.teamId)}><ScrollText /> Avaliar apresentação</Button>
            </Scroll>
          );
        })}
      </div>
      <EvaluationSheet inc={inc} teamId={evalTeam} onClose={() => setEvalTeam(null)} />
    </>
  );
}


function EvaluationSheet({ inc, teamId, onClose }: { inc: Incursion; teamId: string | null; onClose: () => void }) {
  const { teams, setEvaluation } = useJornada();
  const current = inc.teams.find((t) => t.teamId === teamId)?.evaluation;
  return (
    <Sheet open={!!teamId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Avaliar apresentação</SheetTitle>
          <SheetDescription className="font-reading">{teams.find((t) => t.id === teamId)?.name}</SheetDescription>
        </SheetHeader>
        {teamId && <EvaluationForm key={teamId} initial={current ?? null} onSave={async (ev) => { await fakeSave(); setEvaluation(inc.id, teamId, ev); toast.success("Avaliação registrada."); onClose(); }} />}
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Batalha ---------------- */

const EFFECT_LABEL: Record<TurnEffect, string> = { dano: "Dano", cura: "Cura", escudo: "Escudo", penalidade: "Penalidade" };
const EFFECT_ICON: Record<TurnEffect, typeof Heart> = { dano: Flame, cura: Heart, escudo: Shield, penalidade: Skull };

function Battle({ inc }: { inc: Incursion }) {
  const { bosses, teams, setResult } = useJornada();
  const boss = bosses.find((b) => b.id === inc.bossId);
  const [result, setPendingResult] = useState<"vitoria" | "derrota" | null>(null);
  if (!boss) return <EmptyState title="O covil está em silêncio" hint="O chefe é sorteado ao iniciar a Fase 4, na aba Fases." />;
  const hp = remainingHp(boss.hp, inc.turns);
  const actorName = (a: string) => (a === "chefe" ? boss.name : teams.find((t) => t.id === a)?.name ?? "—");

  return (
    <div className="space-y-6">
      {inc.result && (
        <Scroll className={cn("text-center", inc.result === "vitoria" ? "bg-accent" : "bg-destructive/5")}>
          <p className={cn("font-display text-2xl font-semibold", inc.result === "vitoria" ? "text-accent-foreground" : "text-destructive")}>
            {inc.result === "vitoria" ? "Missão cumprida!" : "O grupo recuou."}
          </p>
        </Scroll>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Scroll className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-destructive/50 bg-destructive/10"><Skull className="h-6 w-6 text-destructive" strokeWidth={1.5} /></div>
            <div>
              <h3 className="text-xl">{boss.name}</h3>
              <p className="font-reading text-sm text-muted-foreground">{boss.description}</p>
            </div>
          </div>
          <HpBar hp={hp} max={boss.hp} />
          <ul className="space-y-2 border-t border-border pt-4">
            {boss.skills.map((s) => (
              <li key={s.name} className="text-sm">
                <span className="font-medium">{s.name}</span> <span className="text-xs text-muted-foreground">· {s.trigger}</span>
                <p className="font-reading text-xs text-muted-foreground">{s.effect}</p>
              </li>
            ))}
          </ul>
          {!inc.result && (
            <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
              <Button onClick={() => setPendingResult("vitoria")}><Check /> Vitória</Button>
              <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setPendingResult("derrota")}>Derrota</Button>
            </div>
          )}
        </Scroll>

        <div className="space-y-6">
          {!inc.result && <TurnForm inc={inc} />}
          <section>
            <h2 className="mb-3 text-lg">Registro de turnos</h2>
            {inc.turns.length === 0 ? (
              <p className="font-reading text-sm text-muted-foreground">Nenhum turno registrado ainda.</p>
            ) : (
              <ol className="space-y-2">
                {inc.turns.map((t, i) => {
                  const Icon = EFFECT_ICON[t.effect];
                  return (
                    <li key={t.id} className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-sm">
                      <span className="w-6 font-display text-xs text-muted-foreground">{i + 1}</span>
                      <Icon className={cn("h-4 w-4 shrink-0", t.effect === "dano" || t.effect === "penalidade" ? "text-destructive" : "text-accent-foreground")} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate"><span className="font-medium">{actorName(t.actor)}</span> · {t.skillName}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.roll}</p>
                      </div>
                      <span className="text-right"><span className="font-display font-semibold">{t.value}</span> <span className="text-xs text-muted-foreground">{EFFECT_LABEL[t.effect]}</span></span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
      <Confirm
        open={!!result}
        onOpenChange={(o) => !o && setPendingResult(null)}
        title={result === "vitoria" ? "Registrar vitória?" : "Registrar derrota?"}
        description="A missão será concluída com este resultado."
        confirmLabel="Registrar"
        destructive={result === "derrota"}
        onConfirm={() => { if (result) { setResult(inc.id, result); toast.success(result === "vitoria" ? "Missão cumprida!" : "O grupo recuou."); } setPendingResult(null); }}
      />
    </div>
  );
}



export { MissionDetail as MissionDetailsPage };
