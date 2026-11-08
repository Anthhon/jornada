"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IncursionStatus } from "@/features/missions";
import { AlertTriangle, Compass, CornerOrnament, Gem, Loader2, Lock, RefreshCw } from "@/components/icons/rpg-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";

/* ---------- Ornamentos e cartões ---------- */

function Corner({ className }: { className: string }) {
  return (
    <CornerOrnament className={cn("pointer-events-none absolute h-4 w-4 opacity-70", className)} />
  );
}

export function Ornaments() {
  return (
    <>
      <Corner className="left-1.5 top-1.5" />
      <Corner className="right-1.5 top-1.5 rotate-90" />
      <Corner className="bottom-1.5 right-1.5 rotate-180" />
      <Corner className="bottom-1.5 left-1.5 -rotate-90" />
    </>
  );
}

export function Scroll({ children, className, hover = false, onClick }: { children: ReactNode; className?: string; hover?: boolean; onClick?: () => void }) {
  return (
    <div className={cn("parchment-card p-5", hover && "parchment-hover cursor-pointer", className)} onClick={onClick}>
      <Ornaments />
      {children}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.85rem] leading-tight text-foreground">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl font-reading text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Selos de status ---------- */

type SealKind = IncursionStatus | "derrota" | "vitoria";
const sealStyles: Record<SealKind, string> = {
  planejada: "bg-parchment text-parchment-foreground border-parchment-foreground/30",
  andamento: "bg-info/15 text-info border-info/40",
  concluida: "bg-accent text-accent-foreground border-success/40",
  vitoria: "bg-accent text-accent-foreground border-success/40",
  derrota: "bg-destructive/10 text-destructive border-destructive/40",
};
const sealLabels: Record<SealKind, string> = {
  planejada: "Planejada",
  andamento: "Em andamento",
  concluida: "Concluída",
  vitoria: "Missão cumprida",
  derrota: "Derrota",
};

export function Seal({ kind, className }: { kind: SealKind; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-display text-[0.7rem] font-semibold uppercase tracking-wider", sealStyles[kind], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {sealLabels[kind]}
    </span>
  );
}

/* ---------- Gemas (pontos de recurso) ---------- */

export function Gems({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${value} de ${max} pontos de recurso`}>
      {Array.from({ length: max }, (_, i) => (
        <Gem key={i} className={cn("h-4 w-4", i < value ? "opacity-100" : "opacity-30 grayscale")} />
      ))}
    </div>
  );
}

/* ---------- Barra de HP segmentada ---------- */

export function HpBar({ hp, max }: { hp: number; max: number }) {
  const segments = 20;
  const filled = Math.ceil((hp / max) * segments);
  const prev = useRef(hp);
  const [shake, setShake] = useState(false);
  useEffect(() => {
    if (hp < prev.current) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 340);
      prev.current = hp;
      return () => clearTimeout(t);
    }
    prev.current = hp;
    return undefined;
  }, [hp]);
  return (
    <div className={cn(shake && "hp-shake")}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vida</span>
        <span className="font-display text-lg font-semibold text-destructive">HP {hp}/{max}</span>
      </div>
      <div className="flex gap-0.5 rounded-md border border-border-strong/50 bg-secondary/60 p-1" role="meter" aria-valuenow={hp} aria-valuemax={max} aria-valuemin={0}>
        {Array.from({ length: segments }, (_, i) => (
          <div key={i} className={cn("h-3 flex-1 rounded-[2px] transition-colors duration-200", i < filled ? "bg-destructive" : "bg-destructive/10")} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Estados ---------- */

export function LoadingState({ label = "Consultando os pergaminhos…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="font-reading">{label}</p>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <Scroll className="flex flex-col items-center gap-3 py-14 text-center">
      <Compass className="h-8 w-8 text-accent-foreground" strokeWidth={1.25} />
      <h3 className="text-lg">{title}</h3>
      <p className="max-w-sm font-reading text-muted-foreground">{hint}</p>
      {action}
    </Scroll>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Scroll className="flex flex-col items-center gap-3 py-14 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" strokeWidth={1.25} />
      <h3 className="text-lg">O mensageiro não voltou</h3>
      <p className="font-reading text-muted-foreground">Não foi possível carregar estas informações.</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw /> Tentar novamente
      </Button>
    </Scroll>
  );
}

/** Simula o carregamento de uma fonte remota. */


export function PageState({ status, retry, children }: { status: "loading" | "ready" | "error"; retry: () => void; children: ReactNode }) {
  if (status === "loading") return <LoadingState />;
  if (status === "error") return <ErrorState onRetry={retry} />;
  return <div className="page-enter">{children}</div>;
}

/* ---------- Confirmação ---------- */

export function Confirm({
  open, onOpenChange, title, description, confirmLabel = "Confirmar", destructive, onConfirm,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel?: string; destructive?: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="parchment-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription className="font-reading">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 rounded-md">Voltar</AlertDialogCancel>
          <AlertDialogAction
            className={cn("h-11 rounded-md", destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary-hover")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------- Campos ---------- */

export function Field({ label, error, children, hint }: { label: string; error?: string | undefined; hint?: string | undefined; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={loading} className="w-full">
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

export function LockedNote({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Lock className="h-3 w-3" /> {children}
    </span>
  );
}



export const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-secondary/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
