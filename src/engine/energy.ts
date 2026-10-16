// Stime energetiche (allegato F, energy_calculation).

import type { AppliedEnergyMethod, EnergyAssignment, EnergyMethod, Food, ProcessingGroup, ProcessingState, Supplement } from './types';

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

/**
 * Energia metabolizzabile stimata da proteine, grassi e carboidrati disponibili (kcal/100 g) con i fattori kcal/g
 * di un metodo approvato. Senza fattori o senza uno dei tre macronutrienti restituisce null (mai zero).
 * Non usa l'energia «umana» delle tabelle alimentari.
 */
export function estimateMeFromMacros(
  nutrients: Record<string, { value: number | null } | undefined>,
  factors: { protein: number | null; fat: number | null; carbohydrate: number | null },
): number | null {
  if (factors.protein === null || factors.fat === null || factors.carbohydrate === null) return null;
  const p = nutrients.protein?.value;
  const f = nutrients.fat?.value;
  const c = nutrients.carbohydrate_available?.value;
  if (p === null || p === undefined || f === null || f === undefined || c === null || c === undefined) return null;
  return Math.round((p * factors.protein + f * factors.fat + c * factors.carbohydrate) * 10) / 10;
}

export function processingGroup(state: ProcessingState): ProcessingGroup | null {
  if (state === 'raw') return 'raw';
  if (state === 'cooked_boiled' || state === 'cooked_steamed' || state === 'cooked_baked' || state === 'cooked_other' || state === 'canned') return 'cooked';
  if (state === 'dried') return 'any';
  return null; // crudo o non specificato: la preparazione non è nota
}

/**
 * Metodo energetico della tipologia dell'alimento: prima la sottocategoria, poi la categoria;
 * a parità, l'associazione per lo stato di preparazione (crudo/cotto) prevale su «qualsiasi stato».
 */
export function findAssignment(food: Pick<Food, 'categoryId' | 'subcategoryId' | 'processingState'>, assignments: EnergyAssignment[]): EnergyAssignment | null {
  const group = processingGroup(food.processingState);
  for (const cat of [food.subcategoryId, food.categoryId]) {
    const own = assignments.filter((a) => a.categoryId === cat);
    const hit = (group && group !== 'any' ? own.find((a) => a.processing === group) : undefined) ?? own.find((a) => a.processing === 'any');
    if (hit) return hit;
  }
  return null;
}

export function appliedMethod(food: Food, methods: EnergyMethod[], assignments: EnergyAssignment[]): AppliedEnergyMethod | null {
  const a = findAssignment(food, assignments);
  const id = food.energyMethodId || a?.methodId;
  const m = methods.find((x) => x.id === id && x.active);
  if (!m) return null;
  return { id: m.id, version: m.version, label: m.label, protein: m.protein, fat: m.fat, carbohydrate: m.carbohydrate, caution: a?.caution ?? null };
}

export function methodKey(m: AppliedEnergyMethod | null | undefined): string {
  return m ? `${m.id}@${m.version}` : 'nessuno';
}

/**
 * Applica il metodo energetico all'alimento. Se l'EM è stata inserita da un amministratore (misurata o da fonte)
 * resta quella; altrimenti si calcola con il metodo della tipologia, solo se lo stato crudo/cotto è noto
 * (il profilo deve essere quello dell'alimento come viene pesato).
 */
export function resolveFoodEnergy(food: Food, methods: EnergyMethod[], assignments: EnergyAssignment[]): Food {
  const method = appliedMethod(food, methods, assignments);
  const declared = food.kcalMeOrigin !== 'calculated' && food.kcalMePer100g !== null;
  if (declared) return { ...food, kcalMeOrigin: 'declared', energyMethod: method };
  const kcal = method && processingGroup(food.processingState) !== null ? estimateMeFromMacros(food.nutrients, method) : null;
  if (kcal === null) return { ...food, kcalMePer100g: null, kcalMeOrigin: null, meMethod: food.kcalMeOrigin === 'calculated' ? null : food.meMethod, energyMethod: method };
  return {
    ...food,
    kcalMePer100g: kcal,
    kcalMeOrigin: 'calculated',
    meMethod: `Calcolata: ${method!.label} (v. ${method!.version}) — ${method!.protein}/${method!.fat}/${method!.carbohydrate} kcal/g su proteine, grassi e carboidrati disponibili`,
    energyMethod: method,
  };
}

/** Perché l'EM di un alimento non si può calcolare (null se è calcolabile o già inserita). */
export function energyGap(food: Food, methods: EnergyMethod[], assignments: EnergyAssignment[]): string | null {
  if (food.kcalMePer100g !== null) return null;
  if (processingGroup(food.processingState) === null) return 'stato crudo/cotto non indicato: l’energia non si calcola';
  if (!appliedMethod(food, methods, assignments)) return 'nessun metodo energetico associato a questa tipologia';
  const miss = (['protein', 'fat', 'carbohydrate_available'] as const).filter((k) => food.nutrients[k]?.value === null || food.nutrients[k]?.value === undefined);
  return miss.length ? `per calcolare l’energia mancano: ${miss.map((k) => ({ protein: 'proteine', fat: 'grassi', carbohydrate_available: 'carboidrati disponibili' })[k]).join(', ')}` : null;
}

/** Categoria con cui si associa un metodo energetico agli integratori (solo quote dei macronutrienti dichiarati). */
export const SUPPLEMENT_ENERGY_CATEGORY = 'supplement';

/**
 * Energia per dose di un integratore che non la dichiara: si stima SOLO se l'etichetta dichiara proteine, grassi e
 * carboidrati disponibili (anche come zero documentato) e c'è un metodo approvato per gli integratori.
 * Altrimenti resta sconosciuta: nessun valore sostitutivo.
 */
export function resolveSupplementEnergy(s: Supplement, method: AppliedEnergyMethod | null): Supplement {
  if (s.kcalOrigin !== 'calculated' && s.kcalPerUnit !== null) return { ...s, kcalOrigin: 'declared', energyMethod: method };
  const kcal = method ? estimateMeFromMacros(s.nutrients, method) : null; // per dose: i macronutrienti sono in g per dose
  if (kcal === null) return { ...s, kcalPerUnit: null, kcalOrigin: null, energyMethod: method };
  return { ...s, kcalPerUnit: kcal, kcalOrigin: 'calculated', energyMethod: method };
}

/** Applica i metodi energetici a tutto il catalogo: EM calcolata degli alimenti e fattori per le quote energetiche. */
export function applyEnergyMethods<C extends { foods: Food[]; supplements: Supplement[]; energyMethods: EnergyMethod[]; energyAssignments: EnergyAssignment[] }>(cat: C): C {
  const a = cat.energyAssignments.find((x) => x.categoryId === SUPPLEMENT_ENERGY_CATEGORY);
  const m = a ? cat.energyMethods.find((x) => x.id === a.methodId && x.active) : undefined;
  const suppMethod: AppliedEnergyMethod | null = m
    ? { id: m.id, version: m.version, label: m.label, protein: m.protein, fat: m.fat, carbohydrate: m.carbohydrate, caution: a?.caution ?? null }
    : null;
  return {
    ...cat,
    foods: cat.foods.map((f) => resolveFoodEnergy(f, cat.energyMethods, cat.energyAssignments)),
    supplements: cat.supplements.map((s) => resolveSupplementEnergy(s, suppMethod)),
  };
}

/** Metodi energetici usati dagli alimenti di una ricetta, per la riga delle fonti. */
export function methodsSummary(foods: Record<string, Food> | undefined, legacyVersion?: string | null): string {
  const used = [...new Set(Object.values(foods ?? {}).map((f) => (f.energyMethod ? `${f.energyMethod.label} v. ${f.energyMethod.version}` : null)).filter(Boolean))];
  if (used.length) return used.join(', ');
  return legacyVersion ? `fattori ${legacyVersion}` : 'nessuno';
}
