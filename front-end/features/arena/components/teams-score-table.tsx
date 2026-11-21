"use client";

import { Input } from "@/components/ui/input";
import { Pencil } from "@/components/icons/rpg-icons";
import { cn } from "@/lib/utils";
import type { ArenaGroupOption } from "../schemas/arena";

interface TeamsScoreTableProps {
  /** Grupos ativos da rodada (ordem do backend: por nome). */
  groups: ArenaGroupOption[];
  /** Placar em edição (group_id -> string). */
  scores: Record<string, string>;
  onScoreChange: (groupId: number, value: string) => void;
}

function asNumber(value: string | undefined): number {
  if (value == null || value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const SITUACAO_STYLES: Record<string, string> = {
  first: "border-primary/40 bg-primary/10 text-primary",
  second: "border-info/40 bg-info/15 text-info",
  third: "border-accent/50 bg-accent/15 text-accent-foreground",
  open: "border-parchment-foreground/30 bg-parchment text-parchment-foreground",
};

/**
 * Tabela "Pontos e Placares" (M-49): o professor edita o placar de cada
 * equipe na rodada. A situação reflete o ranking entre as equipes — pódio
 * (1º/2º/3º) ou "Em disputa" (sem pontos, como no mockup).
 */
export function TeamsScoreTable({ groups, scores, onScoreChange }: TeamsScoreTableProps) {
  const ranked = groups
    .map((group) => ({ group, value: asNumber(scores[String(group.id)]) }))
    .sort((a, b) => b.value - a.value || a.group.name.localeCompare(b.group.name));
  const rankOf = new Map<number, number>();
  ranked.forEach((row, index) => rankOf.set(row.group.id, index + 1));

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">Equipe</th>
            <th className="px-4 py-2.5 text-left font-medium">
              <span className="inline-flex items-center gap-1">
                Placar da Rodada <Pencil className="h-3 w-3" />
              </span>
            </th>
            <th className="px-4 py-2.5 text-right font-medium">Pontuação Total</th>
            <th className="px-4 py-2.5 text-right font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const rank = rankOf.get(group.id) ?? groups.length;
            const value = asNumber(scores[String(group.id)]);
            const situacao =
              value <= 0
                ? { label: "Em disputa", style: SITUACAO_STYLES.open }
                : rank === 1
                  ? { label: "1º", style: SITUACAO_STYLES.first }
                  : rank === 2
                    ? { label: "2º", style: SITUACAO_STYLES.second }
                    : rank === 3
                      ? { label: "3º", style: SITUACAO_STYLES.third }
                      : { label: "Em disputa", style: SITUACAO_STYLES.open };
            return (
              <tr key={group.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5 font-medium">{group.name}</td>
                <td className="px-4 py-2.5">
                  <Input
                    type="number"
                    min={0}
                    aria-label={`Placar da rodada de ${group.name}`}
                    className="w-28 text-right"
                    value={scores[String(group.id)] ?? "0"}
                    onChange={(event) => onScoreChange(group.id, event.target.value)}
                  />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {group.total_points.toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold",
                      situacao.style,
                    )}
                  >
                    {situacao.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
