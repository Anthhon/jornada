"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState, PageHeader, PageState } from "@/features/journey/components/ui";
import { Plus } from "@/components/icons/rpg-icons";
import { cn } from "@/lib/utils";
import { useArenaState } from "../hooks/use-arena-state";
import { arenaService } from "../services/arena-service";
import type { ArenaRound } from "../schemas/arena";
import { BattleLog } from "./battle-log";
import { BossCard } from "./boss-card";
import { ConfigPanel } from "./config-panel";
import { PlacarCard } from "./placar-card";
import { RoundForm } from "./round-form";
import { StatusBadge } from "./status-badge";

function Arena() {
  const [rounds, setRounds] = useState<ArenaRound[]>([]);
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadRounds = useCallback(async (): Promise<ArenaRound[]> => {
    try {
      const data = await arenaService.list();
      setRounds(data);
      setListStatus("ready");
      return data;
    } catch {
      setListStatus("error");
      return [];
    }
  }, []);

  useEffect(() => {
    let active = true;
    arenaService.list().then(
      (data) => {
        if (active) {
          setRounds(data);
          setListStatus("ready");
        }
      },
      () => {
        if (active) setListStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // Rodada efetiva: a escolhida pelo professor ou a primeira da lista.
  // (Derivada — sem efeito de auto-seleção.)
  const effectiveId =
    selectedId !== null && rounds.some((round) => round.id === selectedId)
      ? selectedId
      : (rounds[0]?.id ?? null);

  const { state, status: stateStatus, error: stateError, retry } = useArenaState(effectiveId);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      await loadRounds();
      retry();
      toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "A ação falhou.");
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => {
    if (effectiveId) void run(() => arenaService.start(effectiveId), "Batalha iniciada.");
  };
  const handlePause = () => {
    if (effectiveId) void run(() => arenaService.pause(effectiveId), "Batalha pausada.");
  };
  const handleResume = () => {
    if (effectiveId) void run(() => arenaService.resume(effectiveId), "Batalha retomada.");
  };
  const handleEnd = () => {
    if (effectiveId) void run(() => arenaService.end(effectiveId), "Batalha encerrada.");
  };
  const handleAttack = (payload: { group_id: number; correct: boolean; points: number }) => {
    if (effectiveId) void run(() => arenaService.attack(effectiveId, payload), "Ataque registrado.");
  };
  const handleApplyPerformance = (payload: { group_id: number; criteria: Record<string, number> }) => {
    if (effectiveId) void run(() => arenaService.applyPerformance(effectiveId, payload), "Notas registradas.");
  };

  const handleCreated = (id: number) => {
    setCreating(false);
    setSelectedId(id);
    void loadRounds();
  };

  return (
    <PageState status={listStatus} retry={() => void loadRounds()}>
      <PageHeader
        title="Arena"
        description="Batalha de chefe coletiva: todas as equipes contra um chefe da rodada."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Nova rodada
          </Button>
        }
      />

      {rounds.length === 0 ? (
        <EmptyState
          title="Nenhuma rodada"
          hint="Crie a primeira rodada da arena para começar a batalha de chefe."
        />
      ) : (
        <>
          {/* Seletor de rodadas */}
          <div className="mb-5 flex flex-wrap gap-2">
            {rounds.map((round) => (
              <button
                key={round.id}
                type="button"
                onClick={() => setSelectedId(round.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                  round.id === effectiveId
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-background/50",
                )}
              >
                {round.name}
                <StatusBadge status={round.status} />
              </button>
            ))}
          </div>

          {/* Vista de batalha (polling do estado) */}
          {stateStatus === "loading" && (
            <p className="font-reading text-sm text-muted-foreground">Carregando batalha…</p>
          )}

          {stateStatus === "error" && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              <p>{stateError}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
                Tentar de novo
              </Button>
            </div>
          )}

          {state && stateStatus === "ready" && (
            <div className="grid gap-5 lg:grid-cols-3">
              <PlacarCard teams={state.teams} />
              <div className="flex flex-col gap-5">
                <BossCard state={state} />
                <BattleLog events={state.events} />
              </div>
              <ConfigPanel
                state={state}
                busy={busy}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onEnd={handleEnd}
                onAttack={handleAttack}
                onApplyPerformance={handleApplyPerformance}
              />
            </div>
          )}
        </>
      )}

      {/* Criar rodada */}
      <Sheet open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">Nova rodada</SheetTitle>
            <SheetDescription className="font-reading">
              Configure o chefe e as fórmulas da raid.
            </SheetDescription>
          </SheetHeader>
          <RoundForm onDone={handleCreated} />
        </SheetContent>
      </Sheet>
    </PageState>
  );
}

export { Arena as ArenaPage };
