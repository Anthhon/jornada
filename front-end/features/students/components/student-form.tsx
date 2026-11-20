"use client";
import { Input } from "@/components/ui/input";
import { Field, SubmitButton } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { validateRegistration } from "@/lib/journey/students";
import { fakeSave } from "@/mocks/latency";
import { newId, useJornada } from "@/stores/journey-store";
import type { Student } from "@/features/students";
import { toast } from "sonner";

export function StudentForm({ initial, onDone }: { initial: Student | null; onDone: () => void }) {
  const { students, upsertStudent } = useJornada();
  const form = useValidatedForm({ f: { name: initial?.name ?? "", registration: initial?.registration ?? "" } });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const f = form.watch("f");
  const setF = (next: typeof f) => form.setValue("f", next, { shouldDirty: true });

  async function submit() {
    const x: Record<string, string> = {};
    if (!f.name.trim()) x["name"] = "Informe o nome.";
    const registrationError = validateRegistration(f.registration, students, initial?.id);
    if (registrationError) x["registration"] = registrationError;
    setErr(x);
    if (Object.keys(x).length) return;
    await fakeSave();
    upsertStudent({ id: initial?.id ?? newId("s"), name: f.name.trim(), registration: f.registration.trim() });
    toast.success("Aventureiro salvo.");
    onDone();
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4" noValidate>
      <Field label="Nome" error={err["name"]}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Matrícula" error={err["registration"]}><Input required value={f.registration} onChange={(e) => setF({ ...f, registration: e.target.value })} /></Field>
      <SubmitButton loading={loading}>Salvar</SubmitButton>
    </form>
  );
}
