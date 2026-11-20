"use client";

import { useState } from "react";
import { Scroll } from "@/features/journey/components/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CRITERIA } from "@/constants/evaluation";
import { Flag, Pause, Play, Sparkles } from "@/components/icons/rpg-icons";
import type { ArenaState } from "../schemas/arena";

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
}: ConfigPanelProps) {
  const [teamId, setTeamId] = useState("");
  const [correct, setCorrect] = useState(true);
  const [points, setPoints] = useState("10");
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(CRITERIA.map((criterion) => [criterion.key, 3])),
  );

  const running = state.status === "RUNNING";
  const canAttack = running && state.teams.length > 0;
  const parsedPoints = Number(points);
  const selectedTeam = state.teams.find((team) => team.group_id === Number(teamId));
  const alreadyRegistered = !!selectedTeam?.criteria;

  return (
    <Scroll className="flex h-full flex-col gap-4">
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
        </div>
      )}
    </Scroll>
  );
}
