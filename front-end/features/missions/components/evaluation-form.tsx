"use client";
import { CRITERIA } from "@/constants/evaluation";

import { Input } from "@/components/ui/input";
import { Field, SubmitButton } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { presentationGrade } from "@/lib/journey/rules";
import { cn } from "@/lib/utils";
import type { CriterionKey, CriterionScore, Evaluation } from "@/features/missions";
import { SCORE_OPTS } from "../constants/mission-details-page";

export function EvaluationForm({ initial, onSave }: { initial: Evaluation | null; onSave: (e: Evaluation) => Promise<void> }) {
  const form = useValidatedForm({ crit: (initial?.criteria ?? {}) as Partial<Record<CriterionKey, CriterionScore>>, correct: String(initial?.correct ?? 0) });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const crit = form.watch("crit");
  const setCrit = (next: typeof crit) => form.setValue("crit", next, { shouldDirty: true });
  const correct = form.watch("correct");
  const setCorrect = (next: typeof correct) => form.setValue("correct", next, { shouldDirty: true });

  const complete = CRITERIA.every((c) => crit[c.key] !== undefined);
  const preview = complete ? presentationGrade({ criteria: crit as Evaluation["criteria"], correct: 0 }) : null;

  async function submit() {
    const x: Record<string, string> = {};
    CRITERIA.forEach((c) => { if (crit[c.key] === undefined) x[c.key] = "Escolha uma opção."; });
    const n = Number(correct);
    if (!Number.isInteger(n) || n < 0 || n > 5) x["correct"] = "Entre 0 e 5.";
    setErr(x);
    if (Object.keys(x).length) return;
    await onSave({ criteria: crit as Evaluation["criteria"], correct: n });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-5" noValidate>
      {CRITERIA.map((c) => (
        <div key={c.key}>
          <p className="mb-1.5 text-sm font-medium">{c.label}{c.key === "tempo" && <span className="ml-1 text-xs font-normal text-muted-foreground">(não entra na nota)</span>}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {SCORE_OPTS.map((o) => (
              <button type="button" key={o.v} onClick={() => setCrit({ ...crit, [c.key]: o.v })}
                className={cn("h-10 rounded-md border text-xs transition-colors",
                  crit[c.key] === o.v ? (o.v === -1 ? "border-destructive bg-destructive/10 text-destructive" : "border-success bg-accent text-accent-foreground") : "border-input bg-secondary/40 hover:bg-secondary")}>
                {o.label}
              </button>
            ))}
          </div>
          {err[c.key] && <p className="mt-1 text-xs text-destructive">{err[c.key]}</p>}
        </div>
      ))}
      <Field label="Perguntas acertadas (0 a 5)" error={err["correct"]}>
        <Input type="number" min={0} max={5} value={correct} onChange={(e) => setCorrect(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 p-3">
        <span className="text-sm text-muted-foreground">Nota prevista</span>
        <span className="font-display text-xl font-semibold">{preview === null ? "—" : preview.toFixed(1)}</span>
      </div>
      <SubmitButton loading={loading}>Salvar avaliação</SubmitButton>
    </form>
  );
}
