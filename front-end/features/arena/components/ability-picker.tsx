"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Check, Flame, Heart, Shield, Sparkles } from "@/components/icons/rpg-icons";
import { apiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { TeamAbilityTemplate } from "../schemas/arena";
import { arenaService } from "../services/arena-service";
import {
  MAX_BASICS,
  MAX_ULTIMATES,
  countKinds,
  isCompleteSelection,
  toggleSelection,
} from "../lib/ability-selection";

/** Equipe da rodada com a escolha atual (ids dos templates). */
export interface PickerTeam {
  groupId: number;
  name: string;
  templateIds: number[];
}

interface AbilityPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Equipes da rodada (estado atual da batalha). */
  teams: PickerTeam[];
  /** Equipe pré-selecionada (a escolhida no painel). */
  initialGroupId?: number | null;
  /** Persiste no backend; em erro, lança para o sheet exibir. */
  onSave: (groupId: number, templateIds: number[]) => Promise<void>;
}

function effectIcon(effect: string) {
  switch (effect) {
    case "STRIKE":
      return Flame;
    case "HEAL":
      return Heart;
    case "SHIELD":
      return Shield;
    default:
      return Sparkles;
  }
}

/** Texto curto do efeito (usado só se o modelo vier sem descrição). */
function effectHint(template: TeamAbilityTemplate): string {
  switch (template.effect) {
    case "STRIKE":
      return `${template.value} de dano direto ao chefe`;
    case "HEAL":
      return `recupera até ${template.value} pontos perdidos`;
    case "SHIELD":
      return `escudo de ${template.value} pontos`;
    case "BUFF":
      return `+${template.value}% no próximo ataque`;
    default:
      return `valor ${template.value}`;
  }
}

/**
 * Seletor 3 + 1 de habilidades de equipe (ADR-021): um tema por equipe,
 * limites ao vivo (3 básicas + 1 ultimate) e gravação no backend real
 * (`PATCH /groups/{id}/`). As cargas da rodada são repostas pelo painel.
 */
export function AbilityPicker({
  open,
  onOpenChange,
  teams,
  initialGroupId,
  onSave,
}: AbilityPickerProps) {
  const [templates, setTemplates] = useState<TeamAbilityTemplate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState("");
  const [theme, setTheme] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // As equipes mudam a cada polling (3 s); a hidratação lê o valor atual
  // pela ref sem depender do array — senão a seleção em curso seria zerada.
  const teamsRef = useRef(teams);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  const fetchCatalog = useCallback((signal?: AbortSignal) => {
    arenaService
      .listTeamAbilities(signal)
      .then((data) => {
        setTemplates(data);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (signal?.aborted) return;
        setLoadError(
          apiErrorMessage(error, "Não foi possível carregar o catálogo de habilidades."),
        );
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal);
    return () => controller.abort();
  }, [fetchCatalog]);

  // Hidrata equipe + tema + seleção quando abre ou troca de equipe.
  useEffect(() => {
    if (!open || !templates || !groupId) return;
    if (hydratedFor === groupId) return;
    const current =
      teamsRef.current.find((team) => String(team.groupId) === groupId)?.templateIds ?? [];
    const present = current.filter((id) => templates.some((item) => item.id === id));
    setSelected(present);
    setTheme(
      templates.find((item) => present.includes(item.id))?.theme ??
        templates[0]?.theme ??
        "",
    );
    setSaveError(null);
    setHydratedFor(groupId);
  }, [open, templates, groupId, hydratedFor]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setGroupId(String(initialGroupId ?? teams[0]?.groupId ?? ""));
      setHydratedFor(null); // força a hidratação da equipe escolhida
      setSaveError(null);
    }
    onOpenChange(next);
  };

  const handleTeamChange = (value: string) => {
    setGroupId(value);
    setHydratedFor(null); // re-hidrata com a seleção da nova equipe
  };

  const handleThemeChange = (value: string) => {
    if (value === theme) return;
    setTheme(value);
    setSelected([]); // uma equipe segue um único tema (ADR-021)
  };

  const team = teams.find((item) => String(item.groupId) === groupId) ?? null;
  const visible = templates?.filter((item) => item.theme === theme) ?? [];
  const { basics: selBasics, ultimates: selUltimates } = countKinds(
    selected,
    templates ?? [],
  );
  const complete = !!templates && isCompleteSelection(selected, templates);

  const submit = async () => {
    if (!team || !complete || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(team.groupId, selected);
      onOpenChange(false);
    } catch (error: unknown) {
      setSaveError(apiErrorMessage(error, "Não foi possível salvar as habilidades."));
    } finally {
      setSaving(false);
    }
  };

  const renderCard = (template: TeamAbilityTemplate) => {
    const isSelected = selected.includes(template.id);
    const Icon = effectIcon(template.effect);
    const blocked =
      !isSelected &&
      (template.kind === "ULTIMATE"
        ? selUltimates >= MAX_ULTIMATES
        : selBasics >= MAX_BASICS);
    return (
      <button
        key={template.id}
        type="button"
        aria-pressed={isSelected}
        disabled={blocked}
        onClick={() =>
          setSelected((current) => toggleSelection(current, template, templates ?? []))
        }
        className={cn(
          "flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors",
          isSelected
            ? "border-primary bg-primary/10"
            : "border-border hover:bg-background/50",
          blocked && "cursor-not-allowed opacity-50 hover:bg-transparent",
        )}
      >
        <Icon className="mt-0.5 h-4 w-4" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {template.name}
            {template.kind === "ULTIMATE" && (
              <span className="ml-1.5 rounded-full border border-accent/50 bg-accent/15 px-1.5 py-0.5 align-middle text-[0.6rem] uppercase tracking-wider text-accent-foreground">
                ultimate
              </span>
            )}
          </span>
          <span className="block text-[0.7rem] text-muted-foreground">
            {template.description || effectHint(template)}
          </span>
        </span>
        {isSelected && <Check className="mt-1 h-4 w-4 text-primary" />}
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Habilidades da equipe</SheetTitle>
          <SheetDescription className="font-reading">
            O professor escolhe <strong>3 básicas + 1 ultimate</strong> de um mesmo
            tema por equipe (ADR-021) — usadas só na Arena, com d20 no uso.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Equipe</span>
            <select
              aria-label="Equipe"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={groupId}
              onChange={(event) => handleTeamChange(event.target.value)}
            >
              {teams.length === 0 && <option value="">Nenhuma equipe na rodada</option>}
              {teams.map((item) => (
                <option key={item.groupId} value={String(item.groupId)}>
                  {item.name}
                  {item.templateIds.length > 0
                    ? ` · ${item.templateIds.length} escolhidas`
                    : " · sem habilidades"}
                </option>
              ))}
            </select>
          </label>

          {loadError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              <p>{loadError}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => fetchCatalog()}
              >
                Tentar de novo
              </Button>
            </div>
          )}

          {!templates && !loadError && (
            <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
          )}

          {templates && (
            <>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium">Tema</span>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(templates.map((item) => item.theme))].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleThemeChange(item)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        item === theme
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-border text-muted-foreground hover:bg-background/50",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <p className="text-[0.7rem] text-muted-foreground">
                  Trocar de tema limpa a seleção — cada equipe segue um tema só.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  Básicas — {selBasics}/{MAX_BASICS}
                </p>
                <div className="space-y-1.5">
                  {visible.filter((item) => item.kind === "BASIC").map(renderCard)}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                  Ultimate — {selUltimates}/{MAX_ULTIMATES}
                </p>
                <div className="space-y-1.5">
                  {visible.filter((item) => item.kind !== "BASIC").map(renderCard)}
                </div>
              </div>

              {saveError && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {saveError}
                </p>
              )}

              <Button
                className="w-full"
                disabled={!complete || !team || saving}
                onClick={() => void submit()}
              >
                {saving
                  ? "Salvando…"
                  : team
                    ? `Salvar em ${team.name}`
                    : "Selecione a equipe"}
              </Button>
              {!complete && (
                <p className="text-center text-[0.7rem] text-muted-foreground">
                  Faltam {Math.max(0, MAX_BASICS - selBasics)} básica(s) e{" "}
                  {Math.max(0, MAX_ULTIMATES - selUltimates)} ultimate — clique para
                  escolher ou remover.
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
