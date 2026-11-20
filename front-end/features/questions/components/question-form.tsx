"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SubmitButton } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { cn } from "@/lib/utils";
import { fakeSave } from "@/mocks/latency";
import { newId, useJornada } from "@/stores/journey-store";
import type { Question } from "@/features/questions";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function QuestionForm({ initial, onDone }: { initial: Question | null; onDone: () => void }) {
  const { upsertQuestion } = useJornada();
  const form = useValidatedForm({ statement: initial?.statement ?? "", options: initial?.options ?? [{ text: "", correct: true }, { text: "", correct: false }] });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const statement = form.watch("statement");
  const setStatement = (next: typeof statement) => form.setValue("statement", next, { shouldDirty: true });
  const options = form.watch("options");
  const setOptions = (next: typeof options) => form.setValue("options", next, { shouldDirty: true });

  async function submit() {
    const x: Record<string, string> = {};
    if (!statement.trim()) x["statement"] = "Informe o enunciado.";
    const filled = options.filter((o) => o.text.trim());
    if (filled.length < 2) x["options"] = "Informe ao menos duas alternativas.";
    else if (!filled.some((o) => o.correct)) x["options"] = "Marque ao menos uma alternativa correta.";
    setErr(x);
    if (Object.keys(x).length) return;
    await fakeSave();
    upsertQuestion({ id: initial?.id ?? newId("q"), statement: statement.trim(), options: filled.map((o) => ({ ...o, text: o.text.trim() })) });
    toast.success("Pergunta salva.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
      <Field label="Enunciado" error={err["statement"]}><Textarea rows={3} value={statement} onChange={(e) => setStatement(e.target.value)} /></Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Alternativas</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, { text: "", correct: false }])}><Plus /> Adicionar</Button>
        </div>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <button type="button" aria-label="Marcar como correta" onClick={() => setOptions(options.map((x, j) => (j === i ? { ...x, correct: !x.correct } : x)))}
              className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md border", o.correct ? "border-success bg-accent text-accent-foreground" : "border-input text-muted-foreground")}>
              {o.correct ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </button>
            <Input value={o.text} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={`Alternativa ${i + 1}`} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remover" disabled={options.length <= 2} onClick={() => setOptions(options.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        {err["options"] && <p className="text-xs text-destructive">{err["options"]}</p>}
      </div>
      <SubmitButton loading={loading}>Salvar pergunta</SubmitButton>
    </form>
  );
}
