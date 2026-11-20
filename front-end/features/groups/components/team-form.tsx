"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SubmitButton, selectClass } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { fakeSave } from "@/mocks/latency";
import { newId, useJornada } from "@/stores/journey-store";
import type { Team } from "@/features/groups";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

export function TeamForm({ initial, onDone }: { initial: Team | null; onDone: () => void }) {
  const { teams, students, upsertTeam } = useJornada();
  const form = useValidatedForm({ name: initial?.name ?? "", members: (initial?.memberIds ?? []) as string[], extra: (Object.fromEntries(Object.entries(initial?.extraPoints ?? {}).map(([k, v]) => [k, String(v)]))) as Record<string, string>, pick: "" });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const name = form.watch("name");
  const setName = (next: typeof name) => form.setValue("name", next, { shouldDirty: true });
  const members = form.watch("members");
  const setMembers = (next: typeof members) => form.setValue("members", next, { shouldDirty: true });
  const extra = form.watch("extra");
  const setExtra = (next: typeof extra) => form.setValue("extra", next, { shouldDirty: true });
  const pick = form.watch("pick");
  const setPick = (next: typeof pick) => form.setValue("pick", next, { shouldDirty: true });

  const teamOf = (id: string) => teams.find((t) => t.id !== initial?.id && t.memberIds.includes(id))?.name;

  async function submit() {
    const x: Record<string, string> = {};
    if (!name.trim()) x["name"] = "Informe o nome do grupo.";
    else if (teams.some((t) => t.name.toLowerCase() === name.trim().toLowerCase() && t.id !== initial?.id)) x["name"] = "Já existe um grupo com este nome.";
    members.forEach((m) => { const v = Number(extra[m] || 0); if (!Number.isFinite(v) || v < 0 || v > 2) x[m] = "Entre 0 e 2."; });
    setErr(x);
    if (Object.keys(x).length) return;
    await fakeSave();
    upsertTeam({ id: initial?.id ?? newId("t"), name: name.trim(), memberIds: members, extraPoints: Object.fromEntries(members.map((m) => [m, Number(extra[m] || 0)]).filter(([, v]) => v)) });
    toast.success("Grupo salvo.");
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-5" noValidate>
      <Field label="Nome" error={err["name"]}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="space-y-2">
        <p className="text-sm font-medium">Membros</p>
        <div className="flex gap-2">
          <select className={selectClass} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Adicionar aventureiro…</option>
            {students.filter((s) => !members.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}{teamOf(s.id) ? ` (sai de ${teamOf(s.id)})` : ""}</option>)}
          </select>
          <Button type="button" variant="outline" disabled={!pick} onClick={() => { setMembers([...members, pick]); setPick(""); }}><Plus /></Button>
        </div>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
              <span className="flex-1 text-sm">{students.find((s) => s.id === m)?.name}</span>
              <div className="w-24">
                <Input aria-label="Pontos extras" type="number" step="0.1" className="h-9" placeholder="+0" value={extra[m] ?? ""} onChange={(e) => setExtra({ ...extra, [m]: e.target.value })} />
                {err[m] && <span className="text-xs text-destructive">{err[m]}</span>}
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Remover" onClick={() => setMembers(members.filter((x) => x !== m))}><X /></Button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">O campo ao lado de cada nome lança pontos extras individuais.</p>
      </div>
      <SubmitButton loading={loading}>Salvar grupo</SubmitButton>
    </form>
  );
}
