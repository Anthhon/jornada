"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface FloatingValue {
  id: number;
  /** Texto já formatado: `−120` (perda) ou `+40` (ganho). */
  text: string;
  /** `hit` = vermelho (dano/perda), `heal` = verde (cura/ganho). */
  tone: "hit" | "heal";
  /** Posição horizontal em % (o keyframe centraliza com -50%). */
  x: number;
}

/** Faixa horizontal padrão dos flutuantes (constante estável p/ as deps). */
const DEFAULT_SPREAD: readonly [number, number] = [25, 65];

/**
 * Observa um número e gera números flutuantes ao mudar (ADR-022):
 * queda → `−X` vermelho sobe; subida → `+X` verde sobe. A primeira leitura
 * só ancora a referência (sem flutuante no mount).
 *
 * `spread` precisa ser uma referência estável (constante de módulo).
 */
export function useDeltaFloats(
  value: number,
  spread: readonly [number, number] = DEFAULT_SPREAD,
) {
  const [floats, setFloats] = useState<FloatingValue[]>([]);
  const prev = useRef(value);
  const seq = useRef(0);

  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    if (delta === 0) return undefined;
    const [from, to] = spread;
    const id = ++seq.current;
    const entry: FloatingValue = {
      id,
      text: delta > 0 ? `+${delta}` : `\u2212${-delta}`,
      tone: delta > 0 ? "heal" : "hit",
      x: from + Math.random() * (to - from),
    };
    setFloats((current) => [...current, entry]);
    const timer = setTimeout(
      () => setFloats((current) => current.filter((item) => item.id !== id)),
      1500,
    );
    return () => clearTimeout(timer);
  }, [value, spread]);

  return floats;
}

/** Camada dos números flutuantes (absolute dentro de um container relative). */
export function FloatingNumbers({
  items,
  className,
}: {
  items: FloatingValue[];
  className?: string;
}) {
  return (
    <>
      {items.map((item) => (
        <span
          key={item.id}
          style={{ left: `${item.x}%` }}
          className={cn(
            "float-up pointer-events-none absolute bottom-3 z-10 font-display text-xl font-bold",
            "drop-shadow-[0_1px_2px_rgb(0_0_0/0.35)]",
            item.tone === "heal" ? "text-success" : "text-destructive",
            className,
          )}
        >
          {item.text}
        </span>
      ))}
    </>
  );
}
