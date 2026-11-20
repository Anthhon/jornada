"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SubmitButton, selectClass } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { fakeSave } from "@/mocks/latency";
import { newId, useJornada } from "@/stores/journey-store";
import type { Boss, BossSkill, BossTrigger } from "@/features/bosses";
import { Plus, Trash2 } from "@/components/icons/rpg-icons";
import { toast } from "sonner";
import { TRIGGERS } from "../constants/bosses-page";

export function BossForm({ initial, onDone }: { initial: Boss | null; onDone: () => void }) {
  const { upsertBoss } = useJornada();
  const form = useValidatedForm({ f: { name: initial?.name ?? "", hp: String(initial?.hp ?? 130), specialty: initial?.specialty ?? "", description: initial?.description ?? "" }, skills: (initial?.skills ?? [{ name: "", trigger: "Tempo", effect: "" }]) as BossSkill[] });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const f = form.watch("f");
  const setF = (next: typeof f) => form.setValue("f", next, { shouldDirty: true });
  const skills = form.watch("skills");
  const setSkills = (next: typeof skills) => form.setValue("skills", next, { shouldDirty: true });

  async function submit() {
    const x: Record<string, string> = {};
    if (!f.name.trim()) x["name"] = "Informe o nome.";
    const hp = Number(f.hp);
    if (!Number.isInteger(hp) || hp < 1) x["hp"] = "HP inteiro maior que zero.";
    if (skills.length === 0) x["skills"] = "Adicione ao menos uma habilidade.";
    skills.forEach((s, i) => { if (!s.name.trim() || !s.effect.trim()) x[`s${i}`] = "Nome e efeito são obrigatórios."; });
    setErr(x);
    if (Object.keys(x).length) return;
    await fakeSave();
    upsertBoss({ id: initial?.id ?? newId("b"), active: initial?.active ?? true, name: f.name.trim(), hp, specialty: f.specialty.trim(), description: f.description.trim(), skills });
    toast.success("Chefe salvo.");
    onDone();
  }

  const patch = (i: number, p: Partial<BossSkill>) => setSkills(skills.map((s, j) => (j === i ? { ...s, ...p } : s)));

  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Field label="Nome" error={err["name"]}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="HP" error={err["hp"]}><Input type="number" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} /></Field>
      </div>
      <Field label="Especialidade"><Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></Field>
      <Field label="Descrição"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Habilidades</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSkills([...skills, { name: "", trigger: "Geral", effect: "" }])}><Plus /> Adicionar</Button>
        </div>
        {err["skills"] && <p className="text-xs text-destructive">{err["skills"]}</p>}
        {skills.map((s, i) => (
          <div key={i} className="space-y-2 rounded-md border border-border bg-card p-3">
            <div className="grid grid-cols-[1fr_140px_auto] gap-2">
              <Input placeholder="Nome" value={s.name} onChange={(e) => patch(i, { name: e.target.value })} />
              <select className={selectClass} value={s.trigger} onChange={(e) => patch(i, { trigger: e.target.value as BossTrigger })}>{TRIGGERS.map((t) => <option key={t}>{t}</option>)}</select>
              <Button type="button" variant="ghost" size="icon" aria-label="Remover" onClick={() => setSkills(skills.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
            <Textarea rows={2} placeholder="Efeito" value={s.effect} onChange={(e) => patch(i, { effect: e.target.value })} />
            {err[`s${i}`] && <p className="text-xs text-destructive">{err[`s${i}`]}</p>}
          </div>
        ))}
      </div>
      <SubmitButton loading={loading}>Salvar chefe</SubmitButton>
    </form>
  );
}
