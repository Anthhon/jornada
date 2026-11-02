"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SKILL_TYPE_LABEL } from "@/features/journey/components/skill-card";
import { Field, SubmitButton, selectClass } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { isValidDice } from "@/lib/journey/rules";
import { fakeSave } from "@/mocks/latency";
import { newId, useJornada } from "@/stores/journey-store";
import type { Skill, SkillType } from "@/features/skills";
import { toast } from "sonner";

export function SkillForm({ initial, onDone }: { initial: Skill | null; onDone: () => void }) {
  const { upsertSkill } = useJornada();
  const form = useValidatedForm({ f: { name: initial?.name ?? "", cost: String(initial?.cost ?? 2), type: initial?.type ?? ("dano" as SkillType), dice: initial?.dice ?? "", effect: initial?.effect ?? "", review: initial?.review ?? false } });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const f = form.watch("f");
  const setF = (next: typeof f) => form.setValue("f", next, { shouldDirty: true });

  async function submit() {
    const x: Record<string, string> = {};
    if (!f.name.trim()) x["name"] = "Informe o nome.";
    if (![2, 3, 5].includes(Number(f.cost))) x["cost"] = "Custo de 2, 3 ou 5.";
    if (f.dice.trim() !== "—" && !isValidDice(f.dice)) x["dice"] = "Use XdY ou XdY+Z, ou — para nenhum.";
    if (!f.effect.trim()) x["effect"] = "Descreva o efeito.";
    setErr(x);
    if (Object.keys(x).length) return;
    await fakeSave();
    upsertSkill({ id: initial?.id ?? newId("k"), name: f.name.trim(), cost: Number(f.cost), type: f.type, dice: f.dice.trim(), effect: f.effect.trim(), review: f.review });
    toast.success("Habilidade salva.");
    onDone();
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
      <Field label="Nome" error={err["name"]}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Custo" error={err["cost"]}>
          <select className={selectClass} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })}>{[2, 3, 5].map((c) => <option key={c} value={c}>{c} PR</option>)}</select>
        </Field>
        <Field label="Tipo">
          <select className={selectClass} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as SkillType })}>
            {(Object.keys(SKILL_TYPE_LABEL) as SkillType[]).map((t) => <option key={t} value={t}>{SKILL_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Dados" error={err["dice"]}><Input value={f.dice} onChange={(e) => setF({ ...f, dice: e.target.value })} placeholder="2d10" /></Field>
      </div>
      <Field label="Efeito" error={err["effect"]}><Textarea rows={4} value={f.effect} onChange={(e) => setF({ ...f, effect: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.review} onCheckedChange={(c) => setF({ ...f, review: !!c })} /> Marcar como [revisar]</label>
      <SubmitButton loading={loading}>Salvar habilidade</SubmitButton>
    </form>
  );
}
