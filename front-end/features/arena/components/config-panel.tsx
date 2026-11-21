"use client";

import { useEffect, useState } from "react";
import { Scroll } from "@/features/journey/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CRITERIA } from "@/constants/evaluation";
import { Flag, Pause, Play, RefreshCw, Sparkles } from "@/components/icons/rpg-icons";
import { cn } from "@/lib/utils";
import type { ArenaState, ArenaTeamAbility } from "../schemas/arena";

interface ConfigPanelProps {
  state: ArenaState;
  busy: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onAttack: (payload: { group_id: number; correct: boolean; points: number }) => void;
  /** Registro por equipe com as 7 notas da rubric (dispara as habilidades). */
  onApplyPerformance: (payload: { group_id: number; criteria: Record<string, number> }) => void;
  /** Habilidade de equipe (d20 rolado no servidor) — `true` se deu certo. */
  onUseAbility: (payload: { group_id: number; ability_id: number }) => Promise<boolean>;
  /** Professor repõe as cargas da equipe selecionada. */
  onRenewAbilities: (group_id: number) => void;
}

/** Descrição curta do efeito da habilidade de equipe (ADR-021). */
function abilityDescription(ability: ArenaTeamAbility): string {
  switch (ability.effect) {
    case "STRIKE":
      return `${ability.value} de dano direto ao chefe`;
    case "HEAL":
      return `recupera até ${ability.value} pontos perdidos`;
    case "SHIELD":
      return `escudo de ${ability.value} pontos`;
    case "BUFF":
      return `+${ability.value}% no próximo ataque`;
    default:
      return `valor ${ability.value}`;
  }
}

function diceVerdict(roll: number): { text: string; className: string } {
  if (roll >= 19) return { text: "Crítico! ×2", className: "text-success" };
  if (roll <= 2) return { text: "Falha… ×½", className: "text-destructive" };
  return { text: "Resultado normal", className: "text-foreground" };
}

/** Painel do professor: config da rodada, controle de vida e registro de ataque. */
export function ConfigPanel({
  state,
  busy,
  onStart,
  onPause,
  onResume,
  onEnd,
  onAttack,
  onApplyPerformance,
  onUseAbility,
  onRenewAbilities,
}: ConfigPanelProps) {
  const [teamId, setTeamId] = useState("");
  const [correct, setCorrect] = useState(true);
  const [points, setPoints] = useState("10");
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(CRITERIA.map((criterion) => [criterion.key, 3])),
  );
  /** `sinceEventId` enquanto o dado rola; o resultado é derivado dos eventos. */
  const [rolling, setRolling] = useState<number | null>(null);

  const running = state.status === "RUNNING";
  const canAttack = running && state.teams.length > 0;
  const parsedPoints = Number(points);
  const selectedTeam = state.teams.find((team) => team.group_id === Number(teamId));
  const alreadyRegistered = !!selectedTeam?.criteria;
  const anyAbilities = state.teams.some((team) => team.abilities.length > 0);

  // Evento `roll` chega no polling → a animação vira resultado (ADR-019).
  const resultEvent =
    rolling != null
      ? state.events.find(
          (item) =>
            item.id > rolling &&
            item.kind === "ABILITY" &&
            item.actor === "TEAM" &&
            item.roll != null,
        ) ?? null
      : null;
  const resultId = resultEvent?.id ?? null;

  const handleUse = async (abilityId: number) => {
    if (!selectedTeam) return;
    const sinceEventId = state.events.reduce((acc, event) => Math.max(acc, event.id), 0);
    setRolling(sinceEventId);
    const ok = await onUseAbility({ group_id: selectedTeam.group_id, ability_id: abilityId });
    if (!ok) setRolling(null); // erro já avisa o toast do painel pai
  };

  // Dispensa do dado: resultado fica ~3.6s; sem resultado (polling falho) há
  // uma rede de segurança de 8s. O setState acontece só no callback do timer.
  useEffect(() => {
    if (rolling == null) return undefined;
    const timer = setTimeout(() => setRolling(null), resultId != null ? 3600 : 8000);
    return () => clearTimeout(timer);
  }, [rolling, resultId]);

  return (
    <Scroll className="relative flex h-full flex-col gap-4">
      <h2 className="font-display text-lg">Configuração da Batalha</h2>

      <dl className="space-y-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-2.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">PV do chefe</dt>
          <dd className="font-display font-semibold">{state.hp}/{state.max_hp}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Nível</dt>
          <dd className="font-display font-semibold">{state.level}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Multiplicador</dt>
          <dd className="font-display font-semibold">×{state.multiplier}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Retaliação</dt>
          <dd className="font-display font-semibold">{Math.round(state.retaliation_ratio * 100)}%</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Recompensa</dt>
          <dd className="font-display font-semibold">×{state.reward_factor}</dd>
        </div>
        {state.balance_ref_teams > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Escala do bando</dt>
            <dd className="font-display font-semibold">
              ×{Math.round(state.balance * 100) / 100}
              <span className="ml-1 text-[0.7rem] font-normal text-muted-foreground">
                (ref. {state.balance_ref_teams} equipes)
              </span>
            </dd>
          </div>
        )}
        {state.treasure > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Saque do chefe</dt>
            <dd className="font-display font-semibold">{state.treasure} pts</dd>
          </div>
        )}
      </dl>

      {/* Controle do ciclo de vida */}
      <div className="space-y-2">
        {state.status === "CONFIG" && (
          <Button className="w-full" disabled={busy} onClick={onStart}>
            <Play /> Iniciar Batalha
          </Button>
        )}
        {state.status === "RUNNING" && (
          <>
            <Button variant="outline" className="w-full" disabled={busy} onClick={onPause}>
              <Pause /> Pausar
            </Button>
            <Button variant="destructive" className="w-full" disabled={busy} onClick={onEnd}>
              <Flag /> Encerrar
            </Button>
          </>
        )}
        {state.status === "PAUSED" && (
          <>
            <Button className="w-full" disabled={busy} onClick={onResume}>
              <Play /> Retomar
            </Button>
            <Button variant="destructive" className="w-full" disabled={busy} onClick={onEnd}>
              <Flag /> Encerrar
            </Button>
          </>
        )}
        {state.status === "ENDED" && (
          <p className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-center text-sm text-muted-foreground">
            Batalha encerrada
            {state.outcome === "VICTORY" ? " · chefe derrotado" : ""}
            {state.outcome === "RETREAT" ? " · chefe em fuga com o saque" : ""}
            {state.rewards_credited ? " · recompensas creditadas" : ""}
          </p>
        )}
      </div>

      {/* Registro de desempenho por equipe — notas da rubric (ADR-017) */}
      {running && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Registrar desempenho (notas)</p>
          <select
            aria-label="Equipe"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">Selecione a equipe…</option>
            {state.teams.map((team) => (
              <option key={team.group_id} value={String(team.group_id)}>
                {team.group_name}
                {team.criteria ? " · notas registradas" : ""}
              </option>
            ))}
          </select>

          <div className="space-y-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
            {CRITERIA.map((criterion) => (
              <div key={criterion.key} className="flex items-center justify-between gap-2">
                <label htmlFor={`criteria-${criterion.key}`} className="text-xs text-muted-foreground">
                  {criterion.label}
                </label>
                <select
                  id={`criteria-${criterion.key}`}
                  className="w-36 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={scores[criterion.key]}
                  onChange={(event) =>
                    setScores({ ...scores, [criterion.key]: Number(event.target.value) })
                  }
                >
                  <option value={3}>Bom (3)</option>
                  <option value={1}>Parcial (1)</option>
                  <option value={-1}>Ausente (−1)</option>
                </select>
              </div>
            ))}
          </div>

          <Button
            className="w-full"
            variant="secondary"
            disabled={!teamId || busy || alreadyRegistered}
            onClick={() => onApplyPerformance({ group_id: Number(teamId), criteria: scores })}
          >
            <Sparkles /> Aplicar notas da equipe
          </Button>
          {alreadyRegistered && (
            <p className="text-xs text-muted-foreground">
              {selectedTeam?.group_name} já tem notas registradas (uma vez por equipe).
            </p>
          )}
        </div>
      )}

      {/* Registro de ataque (acerto/erro de uma equipe) */}
      {running && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Registrar ataque</p>
          <select
            aria-label="Equipe"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">Selecione a equipe…</option>
            {state.teams.map((team) => (
              <option key={team.group_id} value={String(team.group_id)}>
                {team.group_name}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input px-2 py-2 text-sm">
              <input
                type="radio"
                name="attack-result"
                checked={correct}
                onChange={() => setCorrect(true)}
              />
              Acerto
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input px-2 py-2 text-sm">
              <input
                type="radio"
                name="attack-result"
                checked={!correct}
                onChange={() => setCorrect(false)}
              />
              Erro
            </label>
          </div>

          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              aria-label="Pontos de dano"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
              className="flex-1"
            />
            <Button
              disabled={!teamId || busy || (correct && (!Number.isFinite(parsedPoints) || parsedPoints < 0))}
              onClick={() => onAttack({ group_id: Number(teamId), correct, points: parsedPoints || 0 })}
            >
              Registrar
            </Button>
          </div>
          {!canAttack && (
            <p className="text-xs text-muted-foreground">Aguardando equipes…</p>
          )}
          <p className="text-[0.7rem] text-muted-foreground">
            O ataque padrão acima não rola dado — o d20 só aparece nas
            habilidades abaixo (o fallback quando as cargas acabam).
          </p>
        </div>
      )}

      {/* Habilidades de equipe: 3 + 1 do professor, d20 no uso (ADR-019/021) */}
      {running && anyAbilities && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Habilidades da equipe</p>
          {!selectedTeam && (
            <p className="text-xs text-muted-foreground">
              Selecione a equipe no painel acima para usar as habilidades dela.
            </p>
          )}
          {selectedTeam && selectedTeam.abilities.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {selectedTeam.group_name} não tem habilidades atribuídas
              (professor escolhe 3 + 1 na equipe).
            </p>
          )}
          {selectedTeam && selectedTeam.abilities.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                {selectedTeam.group_name}
                {selectedTeam.shield > 0 && <> · escudo {selectedTeam.shield}</>}
                {selectedTeam.damage_buff > 0 && (
                  <> · próximo ataque +{Math.round(selectedTeam.damage_buff * 100)}%</>
                )}
              </p>
              <ul className="space-y-1.5">
                {selectedTeam.abilities.map((ability) => (
                  <li
                    key={ability.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {ability.name}
                        {ability.kind === "ULTIMATE" && (
                          <span className="ml-1.5 rounded-full border border-accent/50 bg-accent/15 px-1.5 py-0.5 align-middle text-[0.6rem] uppercase tracking-wider text-accent-foreground">
                            ultimate
                          </span>
                        )}
                      </p>
                      <p className="text-[0.7rem] text-muted-foreground">{abilityDescription(ability)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "font-display text-xs font-semibold",
                          ability.charges_left === 0 ? "text-destructive" : "text-foreground",
                        )}
                        title="Cargas restantes"
                      >
                        ×{ability.charges_left}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || ability.charges_left === 0}
                        onClick={() => void handleUse(ability.id)}
                      >
                        Usar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => onRenewAbilities(selectedTeam.group_id)}
              >
                <RefreshCw /> Renovar cargas (professor)
              </Button>
            </>
          )}
        </div>
      )}

      {/* Animação do dado do destino (d20 só nas habilidades — ADR-019) */}
      {rolling != null && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-md bg-background/85 px-4 backdrop-blur-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-primary bg-card shadow-lg">
            <span
              className={cn(
                "font-display text-3xl font-bold",
                resultEvent?.roll != null && "dice-spin",
              )}
            >
              {resultEvent?.roll ?? "?"}
            </span>
          </div>
          <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">d20 do destino</p>
          {resultEvent?.roll != null ? (
            <>
              <p className={cn("font-display text-lg font-semibold", diceVerdict(resultEvent.roll).className)}>
                {diceVerdict(resultEvent.roll).text}
              </p>
              <p className="max-w-[90%] text-center text-xs text-muted-foreground">{resultEvent.message}</p>
            </>
          ) : (
            <p className="animate-pulse text-xs text-muted-foreground">Rolando o dado…</p>
          )}
        </div>
      )}
    </Scroll>
  );
}
