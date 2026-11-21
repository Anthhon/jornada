"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dices,
  Flag,
  Gem,
  Heart,
  Pause,
  Play,
  RefreshCw,
  Scroll,
  Trash2,
} from "@/components/icons/rpg-icons";
import {
  EmptyState,
  Field,
  PageHeader,
  PageState,
  selectClass,
} from "@/features/journey/components/ui";
import { apiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

import { ARENA_STATUS_META, type ArenaGroupOption, type ArenaRound } from "../schemas/arena";
import { arenaService } from "../services/arena-service";
import {
  baseDraft,
  changedRoundFields,
  isDraftDirty,
  isOverdue,
  resetTeamWarning,
  scoreOverrides,
  type RoundConfigDraft,
} from "../lib/round-config";
import { StatusBadge } from "./status-badge";
import { TeamsScoreTable } from "./teams-score-table";

type ListStatus = "loading" | "ready" | "error";

/** Campos escalares do rascunho (o placar tem handler próprio). */
type ScalarField = Exclude<keyof RoundConfigDraft, "scores">;

/**
 * Configuração da Rodada (M-49, mockup `telas/Configuração da Rodada`):
 * o professor manipula as equipes da rodada — placar por equipe, datas e
 * parâmetros da fórmula — tudo salvando no backend real
 * (`PATCH /arena/rounds/{id}/` + `POST .../override/`).
 *
 * O rascunho fica guardado por `roundId` e é **derivado** na renderização
 * (sem effect de sincronia): trocar de rodada cai no rascunho novo, e a
 * recarga pós-salvamento atualiza a base de comparação — assim um ajuste
 * já aplicado sai do delta e nunca é aplicado duas vezes.
 */
export function RoundConfigPage() {
  const router = useRouter();
  const [rounds, setRounds] = useState<ArenaRound[]>([]);
  const [groups, setGroups] = useState<ArenaGroupOption[]>([]);
  const [listStatus, setListStatus] = useState<ListStatus>("loading");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftStored, setDraftStored] = useState<{
    roundId: number;
    draft: RoundConfigDraft;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hpDraft, setHpDraft] = useState<{
    roundId: number;
    value: string;
  } | null>(null);
  /** Equipe escolhida para o reset completo (M-51) — null = diálogo fechado. */
  const [resetTarget, setResetTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Busca compartilhada (sem setState — o effect só lê em callback).
  const fetchAll = useCallback(
    () => Promise.all([arenaService.list(), arenaService.listGroups()]),
    [],
  );

  useEffect(() => {
    let active = true;
    fetchAll().then(
      ([roundList, groupList]) => {
        if (!active) return;
        setRounds(roundList);
        setGroups(groupList);
        setListStatus("ready");
      },
      () => {
        if (active) setListStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, [fetchAll]);

  const loadAll = useCallback(async () => {
    try {
      const [roundList, groupList] = await fetchAll();
      setRounds(roundList);
      setGroups(groupList);
      setListStatus("ready");
    } catch {
      setListStatus("error");
    }
  }, [fetchAll]);

  // Rodada efetiva: a escolhida ou a primeira da lista (derivada).
  const effectiveId =
    selectedId !== null && rounds.some((round) => round.id === selectedId)
      ? selectedId
      : (rounds[0]?.id ?? null);
  const round = rounds.find((item) => item.id === effectiveId) ?? null;
  const activeGroups = groups.filter((group) => group.is_active);
  const base = round ? baseDraft(round, activeGroups) : null;
  const draft =
    draftStored && draftStored.roundId === effectiveId && base
      ? draftStored.draft
      : base;
  const scope = { includeRules: round?.status === "CONFIG" };
  const dirty = base && draft ? isDraftDirty(base, draft, scope) : false;
  // PV editável: rascunho por rodada, derivado na renderização (M-50).
  const hpValue =
    hpDraft && hpDraft.roundId === effectiveId
      ? hpDraft.value
      : String(round?.hp ?? "");

  const updateDraft = (fn: (current: RoundConfigDraft) => RoundConfigDraft) => {
    if (!draft || effectiveId == null) return;
    setDraftStored({ roundId: effectiveId, draft: fn(draft) });
  };

  const setRule = (field: ScalarField, value: string) =>
    updateDraft((current) => ({ ...current, [field]: value }));

  const setScore = (groupId: number, value: string) =>
    updateDraft((current) => ({
      ...current,
      scores: { ...current.scores, [String(groupId)]: value },
    }));

  const save = async () => {
    if (!round || !base || !draft || !dirty) return;
    setSaving(true);
    try {
      const patch = changedRoundFields(base, draft, scope);
      if (Object.keys(patch).length > 0) {
        await arenaService.updateRound(round.id, patch);
      }
      for (const item of scoreOverrides(base, draft)) {
        await arenaService.override(round.id, item);
      }
      await loadAll();
      setDraftStored(null); // o servidor virou a fonte da verdade
      toast.success("Configuração salva.");
    } catch (e) {
      // Recarrega mesmo no erro: o que já saiu fica fora do delta (nada
      // é aplicado 2×) e o que falta continua sujo para a próxima tentativa.
      await loadAll();
      toast.error(apiErrorMessage(e, "Não foi possível salvar a configuração."));
    } finally {
      setSaving(false);
    }
  };

  const restore = () => {
    setDraftStored(null);
    toast.message("Alterações restauradas.");
  };

  /** Ação imediata (ciclo, PV, desfazer…): roda, recarrega e avisa. */
  const runAction = async (
    fn: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> => {
    if (!round) return false;
    setBusy(true);
    try {
      await fn();
      await loadAll();
      toast.success(success);
      return true;
    } catch (e) {
      await loadAll();
      toast.error(apiErrorMessage(e, "Ação não concluída."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const applyHp = async () => {
    if (!round) return;
    const parsed = Number(hpValue);
    if (hpValue.trim() === "" || !Number.isFinite(parsed) || parsed < 0) {
      toast.error("PV inválido — informe um número ≥ 0.");
      return;
    }
    const done = await runAction(
      () => arenaService.setHp(round.id, Math.round(parsed)),
      "PV do chefe atualizado.",
    );
    if (done) setHpDraft(null);
  };

  const restoreHp = async () => {
    if (!round) return;
    const done = await runAction(
      () => arenaService.setHp(round.id, round.max_hp),
      "PV do chefe restaurado.",
    );
    if (done) setHpDraft(null);
  };

  /** Reset completo da equipe: zerar, devolver o PV e limpar o log (M-51). */
  const resetTeam = async () => {
    if (!round || !resetTarget) return;
    await runAction(
      () => arenaService.resetTeam(round.id, { group_id: resetTarget.id }),
      `Equipe ${resetTarget.name} resetada.`,
    );
  };

  const duplicate = async () => {
    if (!round) return;
    setBusy(true);
    try {
      const copy = await arenaService.duplicate(round.id);
      setSelectedId(copy.id);
      setDraftStored(null);
      await loadAll();
      toast.success(`Rodada duplicada: ${copy.name}.`);
    } catch (e) {
      await loadAll();
      toast.error(apiErrorMessage(e, "Não foi possível duplicar a rodada."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!round) return;
    setBusy(true);
    try {
      await arenaService.remove(round.id);
      setSelectedId(null);
      setDraftStored(null);
      await loadAll();
      toast.success("Rodada excluída.");
    } catch (e) {
      await loadAll();
      toast.error(apiErrorMessage(e, "Não foi possível excluir a rodada."));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => router.push("/arena");

  const field = (
    name: ScalarField,
    label: string,
    inputProps: { step?: string; min?: string } = {},
  ) => (
    <Field label={label}>
      <Input
        type="number"
        min={inputProps.min ?? "0"}
        step={inputProps.step}
        disabled={!scope.includeRules}
        value={String(draft?.[name] ?? "")}
        onChange={(event) => setRule(name, event.target.value)}
      />
    </Field>
  );

  const TAB_TRIGGER =
    "rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2.5 pt-2 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary";

  return (
    <PageState status={listStatus} retry={() => void loadAll()}>
      <PageHeader
        title="Configuração da Rodada"
        description="Defina as equipes, os pontos e os parâmetros desta rodada."
        action={
          round ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm">
              {round.name}
              <StatusBadge status={round.status} />
            </span>
          ) : undefined
        }
      />

      {rounds.length === 0 ? (
        <EmptyState
          title="Nenhuma rodada"
          hint="Crie a primeira rodada na Arena para configurar a batalha."
          action={
            <Button asChild>
              <Link href="/arena">Ir para a Arena</Link>
            </Button>
          }
        />
      ) : round && base && draft ? (
        <>
          {/* Barra superior: rodada, datas, PV do chefe e status (mockup). */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-3 xl:grid-cols-5">
            <Field label="Rodada">
              <select
                className={selectClass}
                value={effectiveId ?? ""}
                onChange={(event) => setSelectedId(Number(event.target.value))}
              >
                {rounds.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {ARENA_STATUS_META[item.status].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data da Rodada">
              <Input
                type="date"
                value={draft.date}
                onChange={(event) => setRule("date", event.target.value)}
              />
            </Field>
            <Field
              label="Prazo de Entrega"
              hint={
                isOverdue(draft.deadline, round.status)
                  ? "Prazo vencido — remarque a data ou cobre as equipes."
                  : undefined
              }
            >
              <Input
                type="date"
                value={draft.deadline}
                onChange={(event) => setRule("deadline", event.target.value)}
              />
            </Field>
            <Field
              label="PV do Chefe"
              hint={`PV ${round.hp} de ${round.max_hp}`}
            >
              <div className="flex flex-wrap gap-2">
                <Input
                  type="number"
                  min="0"
                  value={hpValue}
                  onChange={(event) =>
                    setHpDraft({ roundId: round.id, value: event.target.value })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void applyHp();
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void applyHp()}
                >
                  Aplicar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  title="Restaurar o PV máximo do chefe"
                  onClick={() => void restoreHp()}
                >
                  <Heart /> Restaurar
                </Button>
              </div>
            </Field>
            <Field label="Status">
              <div className="pt-1">
                <StatusBadge status={round.status} />
              </div>
            </Field>
          </div>

          {/* Faixa de gerência da disputa: ciclo + utilitários (M-50). */}
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3">
            {round.status === "CONFIG" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => arenaService.start(round.id),
                    "Batalha iniciada.",
                  )
                }
              >
                <Play /> Iniciar
              </Button>
            )}
            {round.status === "RUNNING" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => arenaService.pause(round.id),
                      "Batalha pausada.",
                    )
                  }
                >
                  <Pause /> Pausar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => arenaService.end(round.id),
                      "Batalha encerrada.",
                    )
                  }
                >
                  <Flag /> Encerrar
                </Button>
              </>
            )}
            {round.status === "PAUSED" && (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => arenaService.resume(round.id),
                      "Batalha retomada.",
                    )
                  }
                >
                  <Play /> Retomar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () => arenaService.end(round.id),
                      "Batalha encerrada.",
                    )
                  }
                >
                  <Flag /> Encerrar
                </Button>
              </>
            )}
            {round.status === "ENDED" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => arenaService.reopen(round.id),
                    "Disputa reaberta.",
                  )
                }
              >
                <Play /> Reabrir
              </Button>
            )}

            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                title="Desfazer a última ação registrada"
                onClick={() =>
                  void runAction(
                    () => arenaService.undo(round.id),
                    "Última ação desfeita.",
                  )
                }
              >
                <RefreshCw /> Desfazer
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void duplicate()}
              >
                Duplicar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busy}
                  >
                    <Trash2 /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Excluir a rodada “{round.name}”?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      A disputa e todo o registro dela (placar, log e
                      marcações) serão apagados. Essa ação não pode ser
                      desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={busy}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => void remove()}
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <Tabs defaultValue="pontos" className="mt-5">
            <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger value="pontos" className={TAB_TRIGGER}>
                <Gem className="mr-1.5 h-4 w-4" /> Pontos e Placares
              </TabsTrigger>
              <TabsTrigger value="desafios" className={TAB_TRIGGER}>
                <Dices className="mr-1.5 h-4 w-4" /> Desafios da Rodada
              </TabsTrigger>
              <TabsTrigger value="regras" className={TAB_TRIGGER}>
                <Scroll className="mr-1.5 h-4 w-4" /> Regras e Parâmetros
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pontos" className="mt-4 space-y-3">
              {activeGroups.length === 0 ? (
                <EmptyState
                  title="Nenhuma equipe ativa"
                  hint="Ative grupos na página Grupos para que entrem na rodada."
                />
              ) : (
                <TeamsScoreTable
                  groups={activeGroups}
                  scores={draft.scores}
                  onScoreChange={setScore}
                  onReset={(group) =>
                    setResetTarget({ id: group.id, name: group.name })
                  }
                  canReset={round.status !== "ENDED"}
                />
              )}
              <p className="text-xs text-muted-foreground">
                O placar é gravado como <strong>ajuste manual</strong> de cada
                equipe — edite os números e use <strong>Salvar configuração</strong>{" "}
                no fim da página. Na Arena, cada ajuste aparece no registro da
                batalha.
              </p>
            </TabsContent>

            <TabsContent value="desafios" className="mt-4">
              <EmptyState
                title="Desafios da Rodada"
                hint="O módulo de desafios por rodada entra na próxima fase — hoje a rodada usa a rubrica da apresentação e o banco de perguntas."
              />
            </TabsContent>

            <TabsContent value="regras" className="mt-4 space-y-4">
              {!scope.includeRules && (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  A batalha já começou: os parâmetros da fórmula travam durante
                  a rodada (datas e prazo continuam editáveis).
                </p>
              )}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {field("multiplier", "Multiplicador", { step: "0.1" })}
                {field("retaliation_ratio", "Taxa de retaliação", { step: "0.05" })}
                {field("reward_factor", "Fator de recompensa", { step: "0.1" })}
                {field("treasure", "Saque do chefe")}
                {field("balance_ref_teams", "Escala do bando")}
                {field("level", "Nível", { min: "1" })}
                {field("max_hp", "PV máximo", { min: "1" })}
              </div>
              <p className="text-[0.7rem] text-muted-foreground">
                O <strong>saque</strong> do chefe só cai se a batalha terminar em
                vitória — quem derrubar o chefe leva 10% do total, o resto rateado
                por dano. A <strong>escala do bando</strong> comprime os PV do chefe
                e as cargas das habilidades quando há muitas equipes.
              </p>
            </TabsContent>
          </Tabs>

          {/* Reset de equipe: aviso obrigatório antes de zerar (M-51). */}
          <AlertDialog
            open={resetTarget !== null}
            onOpenChange={(open) => {
              if (!open) setResetTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Resetar a equipe “{resetTarget?.name}”?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {resetTeamWarning(resetTarget?.name ?? "")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => void resetTeam()}
                >
                  Resetar equipe
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Rodapé de ações (mockup). */}
          <div
            className={cn(
              "mt-6 flex flex-col gap-3 border-t border-border pt-4",
              "sm:flex-row sm:items-center sm:justify-between",
            )}
          >
            <Button
              variant="outline"
              onClick={restore}
              disabled={saving || !dirty}
            >
              <RefreshCw /> Restaurar alterações
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? "Salvando…" : "Salvar configuração"}
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </PageState>
  );
}
