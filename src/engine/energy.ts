// Stime energetiche (allegato F, energy_calculation).

/** Soglia UX concordata (§3), non un limite clinico. */
export const WEIGHT_GAP_WARNING_KG = 5;

/** RER = 70 × peso^0,75 (kcal/die). */
export function rer(referenceWeightKg: number): number {
  if (!(referenceWeightKg > 0)) throw new Error('Peso di riferimento non valido');
  return 70 * referenceWeightKg ** 0.75;
}

/** MER = RER × fattore. Nessun fattore predefinito: senza fattore la MER non si stima. */
export function mer(referenceWeightKg: number, activityFactor: number | null | undefined): number | null {
  if (activityFactor === null || activityFactor === undefined || !(activityFactor > 0)) return null;
  return rer(referenceWeightKg) * activityFactor;
}

/** Energia di riferimento della colonna FEDIAF usata dal dataset: 95 kcal/kg^0,75. Solo confronto. */
export function fediafReferenceKcal(weightKg: number): number {
  return 95 * weightKg ** 0.75;
}

/** true se |ideale − attuale| è strettamente maggiore di 5 kg (T01). */
export function weightGapNeedsWarning(currentKg: number, idealKg: number): boolean {
  return Math.abs(idealKg - currentKg) > WEIGHT_GAP_WARNING_KG;
}

export const WEIGHT_GAP_MESSAGE =
  'Uno scostamento superiore a 5 kg richiede la valutazione di un veterinario nutrizionista';

/**
 * Campi del profilo che incidono sulla formulazione. Il peso attuale NON c'è:
 * cambiarlo non modifica kcal né ricette (§3, T01).
 */
export const FORMULATION_FIELDS = [
  'weightIdealKg',
  'kcalTarget',
  'activityFactor',
  'targets',
  'lifeStage',
  'macroPreferences',
] as const;
