"use client";

import { cn } from "@/lib/utils";
import type { Skill, SkillType } from "@/features/skills";
import { Dices, Flame, Gem, Heart, Shield, Sparkles } from "@/components/icons/rpg-icons";

const ICON: Record<SkillType, typeof Flame> = { dano: Flame, cura: Heart, escudo: Shield, suporte: Sparkles };
const LABEL: Record<SkillType, string> = { dano: "Dano", cura: "Cura", escudo: "Escudo", suporte: "Suporte" };

export function SkillCard({ skill, compact, children }: { skill: Skill; compact?: boolean; children?: React.ReactNode }) {
  const Icon = ICON[skill.type];
  return (
    <div className="relative flex flex-col gap-2 rounded-md border border-border-strong/50 bg-card p-3.5 shadow-[inset_0_0_0_3px_var(--card),inset_0_0_0_4px_var(--accent)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", skill.type === "dano" ? "text-destructive" : "text-accent-foreground")} strokeWidth={1.6} />
          <p className="font-display text-sm font-semibold leading-tight">{skill.name}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold"><Gem className="h-3 w-3" />{skill.cost}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{LABEL[skill.type]}</span>
        <span className="inline-flex items-center gap-1"><Dices className="h-3 w-3" />{skill.dice}</span>
        {skill.review && <span className="rounded bg-parchment px-1.5 text-parchment-foreground">[revisar]</span>}
      </div>
      {!compact && <p className="font-reading text-xs leading-relaxed text-muted-foreground">{skill.effect}</p>}
      {children}
    </div>
  );
}

export const SKILL_TYPE_LABEL = LABEL;
