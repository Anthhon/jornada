"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SubmitButton } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { fakeSave } from "@/mocks/latency";
import { useJornada } from "@/stores/journey-store";
import type { Hero } from "@/features/heroes";
import { toast } from "sonner";

export function HeroForm({ hero, onDone }: { hero: Hero; onDone: () => void }) {
  const { skills, upsertHero } = useJornada();
  const form = useValidatedForm({ f: { ...hero, attrs: { forca: String(hero.attributes.forca), sabedoria: String(hero.attributes.sabedoria), carisma: String(hero.attributes.carisma) } } });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const f = form.watch("f");
  const setF = (next: typeof f) => form.setValue("f", next, { shouldDirty: true });

  async function submit() {
    const x: Record<string, string> = {};
    if (!f.name.trim()) x["name"] = "Informe o nome.";
    if (!f.description.trim()) x["description"] = "Informe a descrição.";
    (["forca", "sabedoria", "carisma"] as const).forEach((k) => { const v = Number(f.attrs[k]); if (!Number.isInteger(v) || v < 0 || v > 5) x[k] = "0 a 5"; });
    setErr(x);
    if (Object.keys(x).length) return;
    await fakeSave();
    upsertHero({
      ...hero, name: f.name.trim(), description: f.description.trim(), passive: f.passive, passiveReview: f.passive.includes("[revisar]"), skillIds: f.skillIds,
      attributes: { forca: Number(f.attrs.forca), sabedoria: Number(f.attrs.sabedoria), carisma: Number(f.attrs.carisma) }
    });
    toast.success("Ficha do herói atualizada.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
      <Field label="Nome" error={err["name"]}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Descrição" error={err["description"]}><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Passiva"><Textarea rows={2} value={f.passive} onChange={(e) => setF({ ...f, passive: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        {(["forca", "sabedoria", "carisma"] as const).map((k) => (
          <Field key={k} label={k === "forca" ? "Força" : k === "sabedoria" ? "Sabedoria" : "Carisma"} error={err[k]}>
            <Input type="number" min={0} max={5} value={f.attrs[k]} onChange={(e) => setF({ ...f, attrs: { ...f.attrs, [k]: e.target.value } })} />
          </Field>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Habilidades</p>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {skills.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-accent">
              <Checkbox checked={f.skillIds.includes(s.id)} onCheckedChange={(c) => setF({ ...f, skillIds: c ? [...f.skillIds, s.id] : f.skillIds.filter((x) => x !== s.id) })} />
              <span className="flex-1">{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.cost} PR · {s.dice}</span>
            </label>
          ))}
        </div>
      </div>
      <SubmitButton loading={loading}>Salvar ficha</SubmitButton>
    </form>
  );
}
