"use client";

import { useEffect, useState } from "react";
import { arenaService } from "../services/arena-service";
import type { ArenaState } from "../schemas/arena";

type LoadStatus = "idle" | "loading" | "ready" | "error";

/**
 * Faz polling do estado da raid (`GET /arena/rounds/{id}/state/`).
 * - o resultado é etiquetado pela rodada: trocar de rodada nunca mostra os
 *   dados da anterior (o `loading` é derivado, sem efeito que zera estado);
 * - `retry` releê sem zerar a tela (evita flicker no meio da batalha);
 * - `intervalMs` padrão 3 s (contrato aceita 2–5 s).
 */
export function useArenaState(roundId: number | null, intervalMs = 3000) {
  const [loaded, setLoaded] = useState<{ id: number; state: ArenaState } | null>(null);
  const [failed, setFailed] = useState<{ id: number; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!roundId) return undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const data = await arenaService.getState(roundId);
        if (!cancelled) {
          setLoaded({ id: roundId, state: data });
          setFailed(null);
        }
      } catch (e) {
        if (!cancelled) {
          setFailed({
            id: roundId,
            message: e instanceof Error ? e.message : "Não foi possível carregar a batalha.",
          });
        }
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [roundId, intervalMs, attempt]);

  const state = loaded?.id === roundId ? loaded.state : null;
  const error = failed?.id === roundId ? failed.message : null;
  const status: LoadStatus = !roundId ? "idle" : error ? "error" : state ? "ready" : "loading";

  return { state, status, error, retry: () => setAttempt((value) => value + 1) };
}
