"use client";
import { Input } from "@/components/ui/input";
import { DiceRoller } from "@/features/journey/components/dice-roller";
import { Field, Scroll, selectClass, SubmitButton } from "@/features/journey/components/ui";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { presentationGrade } from "@/lib/journey/rules";
import { fakeSave } from "@/mocks/latency";
import { useJornada } from "@/stores/journey-store";
import type { Incursion, TurnEffect } from "@/features/missions";
import { Crest } from "@/features/journey/components/crest";
import { toast } from "sonner";
import { EFFECT_LABEL } from "../constants/mission-details-page";

export function TurnForm({ inc }: { inc: Incursion }) {
  const { teams, heroes, skills, bosses, addTurn } = useJornada();
  const boss = bosses.find((b) => b.id === inc.bossId)!;
  const form = useValidatedForm({ actor: "", skillName: "", value: "", roll: "", effect: ("dano") as TurnEffect });
  const { handleSubmit, formState: { isSubmitting: loading }, validationErrors: err, setValidationErrors: setErr } = form;
  const actor = form.watch("actor");
  const setActor = (next: typeof actor) => form.setValue("actor", next, { shouldDirty: true });
  const skillName = form.watch("skillName");
  const setSkillName = (next: typeof skillName) => form.setValue("skillName", next, { shouldDirty: true });
  const value = form.watch("value");
  const setValue = (next: typeof value) => form.setValue("value", next, { shouldDirty: true });
  const roll = form.watch("roll");
  const setRoll = (next: typeof roll) => form.setValue("roll", next, { shouldDirty: true });
  const effect = form.watch("effect");
  const setEffect = (next: typeof effect) => form.setValue("effect", next, { shouldDirty: true });

  const it = inc.teams.find((t) => t.teamId === actor);
  const hero = heroes.find((h) => h.id === it?.heroId);
  const heroSkills = hero ? skills.filter((s) => hero.skillIds.includes(s.id)) : [];
  const selectedSkill = heroSkills.find((s) => s.name === skillName);
  const dice = selectedSkill?.dice ?? "";

  const options =
    actor === "chefe" ? boss.skills.map((s) => s.name)
      : actor ? ["Dano Base da apresentação", ...heroSkills.map((s) => s.name)] : [];

  function pickSkill(name: string) {
    setSkillName(name);
    setRoll("");
    const sk = heroSkills.find((s) => s.name === name);
    if (actor === "chefe") setEffect("penalidade");
    else if (sk) setEffect(sk.type === "suporte" ? "escudo" : sk.type);
    else setEffect("dano");
    if (name === "Dano Base da apresentação" && it?.evaluation) {
      setValue(String(Math.round((presentationGrade(it.evaluation) ?? 0) * 10)));
    }
  }

  async function submit() {
    const x: Record<string, string> = {};
    if (!actor) x["actor"] = "Escolha quem agiu.";
    if (!skillName) x["skill"] = "Escolha a habilidade.";
    const v = Number(value);
    if (!value || !Number.isFinite(v) || v < 0) x["value"] = "Informe um valor válido.";
    setErr(x);
    if (Object.keys(x).length) return;
    await fakeSave(300);
    addTurn(inc.id, { actor, skillName, roll: roll || "—", value: v, effect });
    toast.success("Turno registrado.");
    setSkillName(""); setValue(""); setRoll("");
  }

  return (
    <Scroll>
      <h2 className="mb-4 text-lg">Novo turno</h2>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quem agiu" error={err["actor"]}>
            <select className={selectClass} value={actor} onChange={(e) => { setActor(e.target.value); setSkillName(""); setRoll(""); }}>
              <option value="">Escolher…</option>
              {inc.teams.map((t) => <option key={t.teamId} value={t.teamId}>{teams.find((x) => x["id"] === t.teamId)?.name}</option>)}
              <option value="chefe">{boss.name} (chefe)</option>
            </select>
          </Field>
          <Field label="Habilidade" error={err["skill"]}>
            <select className={selectClass} value={skillName} disabled={!actor} onChange={(e) => pickSkill(e.target.value)}>
              <option value="">{actor && !hero && actor !== "chefe" ? "Grupo sem herói" : "Escolher…"}</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
        {selectedSkill && <p className="font-reading text-xs text-muted-foreground">{selectedSkill.cost} PR · {selectedSkill.effect}</p>}
        {dice && dice !== "—" && (
          <DiceRoller expression={dice} onRoll={(r) => { setValue(String(r.total)); setRoll(`${r.expression} → ${r.rolls.join(", ")}${r.modifier ? ` (${r.modifier > 0 ? "+" : ""}${r.modifier})` : ""}`); }} />
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor" error={err["value"]}><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          <Field label="Efeito">
            <select className={selectClass} value={effect} onChange={(e) => setEffect(e.target.value as TurnEffect)}>
              {(Object.keys(EFFECT_LABEL) as TurnEffect[]).map((k) => <option key={k} value={k}>{EFFECT_LABEL[k]}</option>)}
            </select>
          </Field>
        </div>
        <SubmitButton loading={loading}><Crest className="h-4 w-4" /> Registrar turno</SubmitButton>
      </form>
    </Scroll>
  );
}
