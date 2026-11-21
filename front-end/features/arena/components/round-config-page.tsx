"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dices,
  Gem,
  RefreshCw,
  Scroll,
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
          {/* Barra superior: rodada, datas e status (mockup). */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-background p-4 md:grid-cols-4">
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
            <Field label="Prazo de Entrega">
              <Input
                type="date"
                value={draft.deadline}
                onChange={(event) => setRule("deadline", event.target.value)}
              />
            </Field>
            <Field label="Status">
              <div className="pt-1">
                <StatusBadge status={round.status} />
              </div>
            </Field>
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
