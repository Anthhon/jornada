/**
 * Regra do ADR-021 na ponta do mouse: exatamente **3 básicas + 1 ultimate**,
 * sempre de um **mesmo tema**. Funções puras — testáveis sem React.
 */

export const MAX_BASICS = 3;
export const MAX_ULTIMATES = 1;

export interface AbilityTemplateRef {
  id: number;
  /** BASIC | ULTIMATE */
  kind: string;
}

/** Conta básicas/ultimates válidas na seleção (ids fora do catálogo não contam). */
export function countKinds(
  selected: readonly number[],
  templates: readonly AbilityTemplateRef[],
): { basics: number; ultimates: number } {
  let basics = 0;
  let ultimates = 0;
  for (const id of selected) {
    const template = templates.find((item) => item.id === id);
    if (!template) continue;
    if (template.kind === "ULTIMATE") ultimates += 1;
    else basics += 1;
  }
  return { basics, ultimates };
}

/**
 * Liga/desliga uma habilidade respeitando o limite 3+1: não passa do máximo
 * (clicar numa básica com as 3 cheias não faz nada) e remove ao clicar de novo.
 */
export function toggleSelection(
  selected: readonly number[],
  template: AbilityTemplateRef,
  templates: readonly AbilityTemplateRef[],
): number[] {
  if (selected.includes(template.id)) {
    return selected.filter((id) => id !== template.id);
  }
  const { basics, ultimates } = countKinds(selected, templates);
  if (template.kind === "ULTIMATE") {
    return ultimates >= MAX_ULTIMATES ? [...selected] : [...selected, template.id];
  }
  return basics >= MAX_BASICS ? [...selected] : [...selected, template.id];
}

/** `true` quando a seleção é exatamente o 3 + 1 completo, sem repetir nem sumir. */
export function isCompleteSelection(
  selected: readonly number[],
  templates: readonly AbilityTemplateRef[],
): boolean {
  if (selected.length !== MAX_BASICS + MAX_ULTIMATES) return false;
  if (new Set(selected).size !== selected.length) return false;
  if (!selected.every((id) => templates.some((item) => item.id === id))) return false;
  const { basics, ultimates } = countKinds(selected, templates);
  return basics === MAX_BASICS && ultimates === MAX_ULTIMATES;
}
