"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SubmitButton, selectClass } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { upsertBoss } from "@/lib/catalog-mutations";
import { newId } from "@/stores/journey-store";
import type { Boss, BossSkill } from "@/features/bosses";
import { Plus, Trash2 } from "@/components/icons/rpg-icons";
import { toast } from "sonner";
import {
  EFFECTS, EFFECT_LABELS, MODES, MODE_LABELS, SCOPES, SCOPES_LABELS,
  TRIGGERS, TRIGGER_LABELS,
} from "../constants/bosses-page";
import { imageUrlSchema } from "../schemas/boss";
import { useState } from "react";

/** Habilidade vazia com os padrões do motor (ADR-017). */
function emptySkill(): BossSkill {
  return {
    name: "", trigger: "TEMPO", effect: "PENALTY", value: 10, every: 1,
    threshold: 3, mode: "ANY", scope: "TEAM", min_count: 1, description: "",
  };
}

const numberOrEmpty = (value: number) => (Number.isFinite(value) ? String(value) : "");

export function BossForm({ initial, onDone }: { initial: Boss | null; onDone: () => void }) {
  const form = useValidatedForm({
    f: {
      name: initial?.name ?? "",
      hp: String(initial?.hp ?? 130),
      specialty: initial?.specialty ?? "",
      description: initial?.description ?? "",
    },
    skills: (initial?.skills ?? [emptySkill()]) as BossSkill[],
  });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const f = form.watch("f");
  const [image, setImage] = useState(initial?.image ?? "");
  const setF = (next: typeof f) => form.setValue("f", next, { shouldDirty: true });
  const skills = form.watch("skills");
  const setSkills = (next: typeof skills) => form.setValue("skills", next, { shouldDirty: true });

  async function submit() {
    const x: Record<string, string> = {};
    if (!f.name.trim()) x["name"] = "Informe o nome.";
    if (!imageUrlSchema.safeParse(image).success) x["image"] = "Use caminho local ou URL HTTPS.";
    const hp = Number(f.hp);
    if (!Number.isInteger(hp) || hp < 1) x["hp"] = "HP inteiro maior que zero.";
    if (skills.length === 0) x["skills"] = "Adicione ao menos uma habilidade.";
    skills.forEach((s, i) => {
      if (!s.name.trim() || !s.description.trim()) { x[`s${i}`] = "Nome e descrição são obrigatórios."; return; }
      if (!Number.isInteger(s.value) || s.value < 0) { x[`s${i}`] = "Valor inválido (inteiro ≥ 0)."; return; }
      if (!Number.isInteger(s.every) || s.every < 1) { x[`s${i}`] = "“A cada N erros” deve ser um inteiro ≥ 1."; return; }
      if (!Number.isInteger(s.threshold) || s.threshold < -1 || s.threshold > 4) { x[`s${i}`] = "Nota de corte entre -1 e 4."; return; }
      if (!Number.isInteger(s.min_count) || s.min_count < 1) { x[`s${i}`] = "Mínimo de equipes afetadas ≥ 1."; return; }
    });
    setErr(x);
    if (Object.keys(x).length) return;
    if (!await upsertBoss({
      id: initial?.id ?? newId("b"),
      active: initial?.active ?? true,
      name: f.name.trim(),
      hp,
      image,
      specialty: f.specialty.trim(),
      description: f.description.trim(),
      skills,
    })) return;
    toast.success("Chefe salvo.");
    onDone();
  }

  const patch = (i: number, p: Partial<BossSkill>) =>
    setSkills(skills.map((s, j) => (j === i ? { ...s, ...p } : s)));

  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <Field label="Nome" error={err["name"]}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="HP" error={err["hp"]}>
          <Input type="number" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} />
        </Field>
      </div>
      <Field label="Especialidade">
        <Input value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} />
      </Field>
      <Field label="Imagem (caminho local ou URL HTTPS)" error={err["image"]}>
        <Input value={image} onChange={(event) => setImage(event.target.value)} placeholder="/personagens/chefe.jpg" />
      </Field>
      <Field label="Descrição">
        <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Habilidades (gatilho → efeito)</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSkills([...skills, emptySkill()])}>
            <Plus /> Adicionar
          </Button>
        </div>
        {err["skills"] && <p className="text-xs text-destructive">{err["skills"]}</p>}

        {skills.map((s, i) => (
          <div key={i} className="space-y-2 rounded-md border border-border bg-card p-3">
            <div className="grid grid-cols-[1fr_150px_auto] gap-2">
              <Input placeholder="Nome da habilidade" value={s.name} onChange={(e) => patch(i, { name: e.target.value })} />
              <select
                aria-label="Gatilho" className={selectClass} value={s.trigger}
                onChange={(e) => patch(i, { trigger: e.target.value as BossSkill["trigger"] })}
              >
                {TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>)}
              </select>
              <Button
                type="button" variant="ghost" size="icon" aria-label="Remover"
                onClick={() => setSkills(skills.filter((_, j) => j !== i))}
              ><Trash2 /></Button>
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-2">
              <select
                aria-label="Efeito" className={selectClass} value={s.effect}
                onChange={(e) => patch(i, { effect: e.target.value as BossSkill["effect"] })}
              >
                {EFFECTS.map((eff) => <option key={eff} value={eff}>{EFFECT_LABELS[eff]}</option>)}
              </select>
              <Field label="Valor">
                <Input
                  type="number" value={numberOrEmpty(s.value)}
                  onChange={(e) => patch(i, { value: e.target.valueAsNumber })}
                />
              </Field>
            </div>

            {s.trigger === "PERGUNTAS" && (
              <Field label="A cada N erros">
                <Input
                  type="number" min={1} value={numberOrEmpty(s.every)}
                  onChange={(e) => patch(i, { every: e.target.valueAsNumber })}
                />
              </Field>
            )}

            <Textarea
              rows={2} placeholder="Descrição exibida (o que a habilidade faz)"
              value={s.description} onChange={(e) => patch(i, { description: e.target.value })}
            />

            <details className="rounded-md border border-border/60 bg-background/40 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Condição avançada (modo, corte, escopo)
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Modo">
                  <select
                    aria-label="Modo" className={selectClass} value={s.mode}
                    onChange={(e) => patch(i, { mode: e.target.value as BossSkill["mode"] })}
                  >
                    {MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
                  </select>
                </Field>
                <Field label="Nota de corte">
                  <Input
                    type="number" min={-1} max={4} value={numberOrEmpty(s.threshold)}
                    onChange={(e) => patch(i, { threshold: e.target.valueAsNumber })}
                  />
                </Field>
                <Field label="Escopo">
                  <select
                    aria-label="Escopo" className={selectClass} value={s.scope}
                    onChange={(e) => patch(i, { scope: e.target.value as BossSkill["scope"] })}
                  >
                    {SCOPES.map((sc) => <option key={sc} value={sc}>{SCOPES_LABELS[sc]}</option>)}
                  </select>
                </Field>
                <Field label="Mín. equipes (aliança)">
                  <Input
                    type="number" min={1} value={numberOrEmpty(s.min_count)}
                    onChange={(e) => patch(i, { min_count: e.target.valueAsNumber })}
                  />
                </Field>
              </div>
            </details>

            {err[`s${i}`] && <p className="text-xs text-destructive">{err[`s${i}`]}</p>}
          </div>
        ))}
      </div>

      <SubmitButton loading={loading}>Salvar chefe</SubmitButton>
    </form>
  );
}
