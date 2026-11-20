"use client";

import { useEffect, useRef } from "react";
import { Scroll } from "@/features/journey/components/ui";
import {
  AlertTriangle,
  Flag,
  Flame,
  Gem,
  Play,
  Skull,
  Sparkles,
} from "@/components/icons/rpg-icons";
import { cn } from "@/lib/utils";
import type { ArenaEvent } from "../schemas/arena";

function eventIcon(kind: string) {
  switch (kind) {
    case "DAMAGE":
      return <Flame className="h-4 w-4 text-destructive" aria-hidden />;
    case "RETALIATION":
      return <Skull className="h-4 w-4 text-destructive" aria-hidden />;
    case "ABILITY":
      return <Sparkles className="h-4 w-4 text-accent-foreground" aria-hidden />;
    case "REWARD":
      return <Gem className="h-4 w-4 text-accent-foreground" aria-hidden />;
    case "END":
      return <Flag className="h-4 w-4 text-muted-foreground" aria-hidden />;
    case "PAUSE":
      return <AlertTriangle className="h-4 w-4 text-info" aria-hidden />;
    default:
      return <Play className="h-4 w-4 text-info" aria-hidden />;
  }
}

/** Registro da batalha: log ao vivo (append-only), mais recente embaixo. */
export function BattleLog({ events }: { events: ArenaEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [events.length]);

  return (
    <Scroll className="flex h-full min-h-64 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg">Registro da Batalha</h2>
        <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          {events.length} eventos
        </span>
      </div>

      {events.length === 0 ? (
        <p className="font-reading text-sm text-muted-foreground">
          Nada aconteceu ainda. Inicie a batalha para ver o registro.
        </p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {events.map((event) => (
            <div
              key={event.id}
              className={cn(
                "flex items-start gap-2.5 rounded-md border border-border/50 bg-background/40 px-3 py-2 text-sm",
                event.kind === "RETALIATION" && "border-destructive/30",
                event.kind === "ABILITY" && "border-accent/40",
                event.kind === "REWARD" && "border-accent/40",
              )}
            >
              <span className="mt-0.5 shrink-0">{eventIcon(event.kind)}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words leading-snug">{event.message}</p>
                {event.created_at && (
                  <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                    {new Date(event.created_at).toLocaleTimeString("pt-BR")}
                  </p>
                )}
              </div>
              {event.value > 0 && (
                <span className="shrink-0 font-display text-xs font-semibold text-muted-foreground">
                  {event.value}
                </span>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </Scroll>
  );
}
