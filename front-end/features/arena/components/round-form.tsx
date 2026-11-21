"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { arenaService } from "../services/arena-service";
import type { ArenaBossOption } from "../schemas/arena";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

/** Formulário de criação de rodada (professor): chefe + fórmulas da raid. */
export function RoundForm({ onDone }: { onDone: (id: number) => void }) {
  const [bosses, setBosses] = useState<ArenaBossOption[]>([]);
  const [bossError, setBossError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [boss, setBoss] = useState("");
  const [level, setLevel] = useState("1");
  const [maxHp, setMaxHp] = useState("15000");
  const [multiplier, setMultiplier] = useState("1.5");
  const [retaliation, setRetaliation] = useState("0.25");
  const [reward, setReward] = useState("1");
  const [treasure, setTreasure] = useState("500");
  const [balance, setBalance] = useState("4");
  const [initialHp, setInitialHp] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    arenaService
      .listBosses(controller.signal)
      .then((data) => {
        setBosses(data);
        if (data.length > 0) setBoss((current) => current || String(data[0].id));
      })
      .catch(() => {
        if (!controller.signal.aborted) setBossError("Não foi possível carregar os chefes.");
      });
    return () => controller.abort();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !boss) return;
    setSaving(true);
    try {
      const created = await arenaService.create({
        name: name.trim(),
        boss: Number(boss),
        max_hp: Number(maxHp) || undefined,
        level: Number(level) || undefined,
        multiplier: Number(multiplier) || undefined,
        retaliation_ratio: Number(retaliation),
        reward_factor: Number(reward),
        treasure: Number(treasure) || 0,
        balance_ref_teams: Number(balance) || 0,
        ...(Number(initialHp) > 0 ? { initial_hp: Number(initialHp) } : {}),
      });
      toast.success("Rodada criada.");
      onDone(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a rodada.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field label="Nome da rodada">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Rodada 2"
          maxLength={100}
          required
        />
      </Field>

      <Field label="Chefe da rodada">
        {bossError ? (
          <p className="text-sm text-destructive">{bossError}</p>
        ) : (
          <select
            value={boss}
            onChange={(event) => setBoss(event.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Selecione um chefe…</option>
            {bosses.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name} ({item.max_hp} PV)
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nível">
          <Input type="number" min={1} value={level} onChange={(e) => setLevel(e.target.value)} />
        </Field>
        <Field label="PV máximo">
          <Input type="number" min={1} value={maxHp} onChange={(e) => setMaxHp(e.target.value)} />
        </Field>
        <Field label="Multiplicador">
          <Input type="number" step="0.1" min={0} value={multiplier} onChange={(e) => setMultiplier(e.target.value)} />
        </Field>
        <Field label="Recompensa (×)">
          <Input type="number" step="0.1" min={0} value={reward} onChange={(e) => setReward(e.target.value)} />
        </Field>
        <Field label="Saque do chefe (pts)">
          <Input type="number" min={0} value={treasure} onChange={(e) => setTreasure(e.target.value)} />
        </Field>
        <Field label="Escala (ref. equipes)">
          <Input type="number" min={0} value={balance} onChange={(e) => setBalance(e.target.value)} />
        </Field>
      </div>

      <p className="-mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
        O <strong>saque</strong> só cai se o chefe for derrotado (na derrota ele
        escapa com ele). A <strong>escala</strong> deixa menos equipes mais
        fortes — <code>4</code> = referência, <code>0</code> = desligado.
      </p>

      <Field label="PV inicial (opcional)">
        <Input
          type="number"
          min={1}
          value={initialHp}
          onChange={(e) => setInitialHp(e.target.value)}
          placeholder="Chefe em fuga: continue do dano acumulado"
        />
      </Field>

      <Field label="Retaliação (%)">
        <Input type="number" step="0.01" min={0} max={1} value={retaliation} onChange={(e) => setRetaliation(e.target.value)} />
      </Field>

      <Button type="submit" className="w-full" disabled={saving || !name.trim() || !boss}>
        {saving ? "Criando…" : "Criar rodada"}
      </Button>
    </form>
  );
}
