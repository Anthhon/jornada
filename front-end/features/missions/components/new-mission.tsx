"use client";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, selectClass, SubmitButton } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { fakeSave } from "@/mocks/latency";
import { useJornada } from "@/stores/journey-store";
import { Crest } from "@/features/journey/components/crest";
import { toast } from "sonner";

export function NewMission({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { incursions, teams, createIncursion } = useJornada();
  const nextNumber = Math.max(0, ...incursions.map((i) => i.number)) + 1;
  const empty = { number: String(nextNumber), title: "", date: "", paradigm: "", questions: "5", t: ["", "", ""], l: ["", "", ""] };
  const form = useValidatedForm({ f: empty });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const f = form.watch("f");
  const setF = (next: typeof f) => form.setValue("f", next, { shouldDirty: true });

  async function submit() {
    const x: Record<string, string> = {};
    const n = Number(f.number);
    if (!Number.isInteger(n) || n < 1) x["number"] = "Informe um número válido.";
    else if (incursions.some((i) => i.number === n)) x["number"] = "Já existe uma missão com este número.";
    if (!f.title.trim()) x["title"] = "Informe o título.";
    if (!f.date) x["date"] = "Informe a data.";
    if (!f.paradigm.trim()) x["paradigm"] = "Informe o paradigma.";
    const q = Number(f.questions);
    if (!Number.isInteger(q) || q < 1 || q > 20) x["questions"] = "Entre 1 e 20.";
    f.t.forEach((t, i) => {
      if (!t) x[`t${i}`] = "Escolha um grupo.";
      else if (f.t.indexOf(t) !== i) x[`t${i}`] = "Grupo repetido.";
      if (!f.l[i]?.trim()) x[`l${i}`] = "Informe a linguagem.";
    });
    setErr(x);
    if (Object.keys(x).length) return;
    await fakeSave();
    createIncursion({ number: n, title: f.title.trim(), date: f.date, paradigm: f.paradigm.trim(), questionsPerStage: q, teams: f.t.map((t, i) => ({ teamId: t, language: (f.l[i] ?? "").trim() })) });
    toast.success("Missão registrada no mapa.");
    setF({ ...empty, number: String(nextNumber + 1) });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Nova missão</SheetTitle>
          <SheetDescription className="font-reading">Defina os detalhes e os três grupos que partem juntos.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <Field label="Número" error={err["number"]}><Input type="number" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} /></Field>
            <Field label="Data" error={err["date"]}><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <Field label="Título" error={err["title"]}><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: A Travessia Funcional" /></Field>
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label="Paradigma" error={err["paradigm"]}><Input value={f.paradigm} onChange={(e) => setF({ ...f, paradigm: e.target.value })} /></Field>
            <Field label="Perguntas/fase" error={err["questions"]}><Input type="number" value={f.questions} onChange={(e) => setF({ ...f, questions: e.target.value })} /></Field>
          </div>
          <div className="space-y-3 border-t border-border pt-4">
            <p className="font-display text-sm font-semibold">Grupos</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <Field label={`Grupo ${i + 1}`} error={err[`t${i}`]}>
                  <select className={selectClass} value={f.t[i]} onChange={(e) => { const t = [...f.t]; t[i] = e.target.value; setF({ ...f, t }); }}>
                    <option value="">Escolher…</option>
                    {teams.map((t) => <option key={t.id} value={t.id} disabled={f.t.includes(t.id) && f.t[i] !== t.id}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Linguagem" error={err[`l${i}`]}>
                  <Input value={f.l[i]} onChange={(e) => { const l = [...f.l]; l[i] = e.target.value; setF({ ...f, l }); }} />
                </Field>
              </div>
            ))}
          </div>
          <SubmitButton loading={loading}><Crest className="h-4 w-4" /> Registrar missão</SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}
