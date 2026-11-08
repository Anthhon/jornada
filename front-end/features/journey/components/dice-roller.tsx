"use client";
import type { DiceRoll } from "@/features/journey";

import { Button } from "@/components/ui/button";
import { rollDice } from "@/lib/journey/rules";
import { Dices } from "@/components/icons/rpg-icons";
import { useState } from "react";

export function DiceRoller({ expression, onRoll }: { expression: string; onRoll: (r: DiceRoll) => void }) {
  const [result, setResult] = useState<DiceRoll | null>(null);
  const [key, setKey] = useState(0);
  const valid = rollDice(expression) !== null;

  return (
    <div className="flex items-center gap-4 rounded-md border border-border bg-secondary/40 p-3">
      <Button type="button" variant="outline" disabled={!valid} onClick={() => {
        const r = rollDice(expression);
        if (r) { setResult(r); setKey((k) => k + 1); onRoll(r); }
      }}>
        <Dices /> Rolar {valid ? expression : ""}
      </Button>
      {result ? (
        <div key={key} className="flex items-center gap-3">
          <span className="dice-spin font-display text-4xl font-bold leading-none">{result.total}</span>
          <span className="text-xs text-muted-foreground">
            [{result.rolls.join(", ")}]{result.modifier ? ` ${result.modifier > 0 ? "+" : ""}${result.modifier}` : ""}
          </span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">{valid ? "Os dados aguardam." : "Sem dados para rolar — informe o valor."}</span>
      )}
    </div>
  );
}
