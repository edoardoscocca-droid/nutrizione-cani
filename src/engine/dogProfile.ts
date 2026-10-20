// Regole di aggiornamento del profilo del cane (§3, §11, T01).

import type { Dog } from '../data/model';
import { mer, weightGapNeedsWarning } from './energy';
import { recommendedFor } from './recommended';
import type { DogFormulationProfile, Nutrient, PersonalTarget, RecommendedTarget } from './types';

export interface DogChangePlan {
  /** true se cambia qualcosa che incide sulla formulazione → ricette da ricalcolare (con conferma). */
  formulationChanged: boolean;
  weightGapWarning: boolean;
  /** nuova stima MER (peso ideale × fattore), se calcolabile. */
  newEstimate: number | null;
  /** proporre di aggiornare le kcal obiettivo alla nuova stima (mai in automatico). */
  proposeKcalUpdate: boolean;
  changedFields: string[];
}

/** Fibra in g/die: in modalità automatica si ricava dall'obiettivo energetico (g per 1.000 kcal). */
export function fiberPerDay(dog: Pick<Dog, 'fiberTarget' | 'kcalTarget'>): { lower: number | null; upper: number | null } | null {
  const f = dog.fiberTarget;
  if (!f) return null;
  if (f.auto) {
    if (!dog.kcalTarget || !(dog.kcalTarget > 0)) return { lower: null, upper: null };
    const r = (x: number) => Math.round(((x * dog.kcalTarget!) / 1000) * 10) / 10;
    return { lower: r(f.auto.lowerPer1000), upper: r(f.auto.upperPer1000) };
  }
  return { lower: f.lower, upper: f.upper };
}

/** Aggiorna i g/die della fibra se è ancora in modalità automatica (i valori personalizzati restano). */
export function syncAutoFiber(dog: Dog): Dog {
  if (!dog.fiberTarget?.auto) return dog;
  const v = fiberPerDay(dog)!;
  return { ...dog, fiberTarget: { ...dog.fiberTarget, lower: v.lower, upper: v.upper, basis: 'per_day' } };
}

const FORMULATION_KEYS: (keyof Dog)[] = [
  'weightIdealKg',
  'kcalTarget',
  'activityFactor',
  'targets',
  'lifeStage',
  'macroPreferences',
  'fiberTarget',
  'notes',
];

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function planDogChange(before: Dog, after: Dog): DogChangePlan {
  const changedFields = FORMULATION_KEYS.filter((k) => !same(before[k], after[k])).map(String);
  const idealOrFactorChanged = before.weightIdealKg !== after.weightIdealKg || before.activityFactor !== after.activityFactor;
  const newEstimate = mer(after.weightIdealKg, after.activityFactor);
  return {
    formulationChanged: changedFields.length > 0,
    weightGapWarning: weightGapNeedsWarning(after.weightCurrentKg, after.weightIdealKg),
    newEstimate,
    proposeKcalUpdate: idealOrFactorChanged && newEstimate !== null && !same(after.kcalTarget, newEstimate),
    changedFields,
  };
}

/**
 * Applica la modifica. Il peso attuale da solo NON cambia kcal né revisione (le ricette restano valide).
 * @param acceptEstimate true solo se l'utente ha confermato di usare la nuova stima come kcal obiettivo.
 */
export function applyDogChange(before: Dog, after: Dog, acceptEstimate: boolean, now = new Date().toISOString()): Dog {
  const plan = planDogChange(before, after);
  let next: Dog = { ...after, updatedAt: now };
  if (acceptEstimate && plan.newEstimate !== null) {
    next = { ...next, kcalTarget: Math.round(plan.newEstimate), kcalSource: 'estimated' };
  }
  const finalPlan = planDogChange(before, next);
  if (finalPlan.formulationChanged) next = { ...next, formulationRevision: before.formulationRevision + 1 };
  else next = { ...next, formulationRevision: before.formulationRevision };
  return next;
}

export function newDog(fields: Pick<Dog, 'name' | 'weightCurrentKg'> & Partial<Dog>, id: string, now = new Date().toISOString()): Dog {
  return {
    breed: null,
    birthDate: null,
    ageYears: null,
    sex: null,
    sterilized: null,
    lifeStage: 'adult_maintenance',
    bcs: null,
    activity: null,
    activityFactor: null,
    kcalTarget: null,
    kcalSource: 'user',
    macroPreferences: [],
    fiberTarget: null,
    ingredientPreferences: null,
    targets: [],
    clinicalNotes: null,
    notes: [],
    formulationRevision: 1,
    createdAt: now,
    updatedAt: now,
    ...fields,
    id,
    // alla creazione: peso ideale = peso attuale (§3)
    weightIdealKg: fields.weightIdealKg ?? fields.weightCurrentKg,
  };
}

export interface BreedNote {
  id: string;
  breedMatch: string[];
  text: string;
  source: string;
  metrics?: string[];
}

export function breedNotesFor(breed: string | null, notes: BreedNote[]) {
  const b = (breed ?? '').trim().toLowerCase();
  if (!b) return [];
  return notes.filter((n) => n.breedMatch.some((m) => b.includes(m)));
}

/** Profilo usato dal motore: target personali + preferenze macro/fibra come target etichettati, note di razza in viola. */
export function toFormulationProfile(dog: Dog, breedNotes: BreedNote[], recommendedTargets: RecommendedTarget[] = [], nutrients: Nutrient[] = []): DogFormulationProfile {
  const targets: PersonalTarget[] = [...dog.targets];
  for (const m of dog.macroPreferences) {
    if (m.enabled === false || (m.lower === null && m.upper === null)) continue;
    targets.push({
      id: `macro_${m.metric}`,
      metric: m.metric,
      lower: m.lower,
      upper: m.upper,
      unit: '%',
      basis: 'energy_pct',
      locked: m.locked,
      setBy: m.locked ? 'professionista' : 'preferenza utente',
      setAt: dog.updatedAt.slice(0, 10),
    });
  }
  const fiber = fiberPerDay(dog);
  // fibra automatica: g per 1.000 kcal (§5); quella personalizzata resta nella sua unità, senza trasformazioni silenziose
  const auto = dog.fiberTarget?.auto;
  if (dog.fiberTarget && dog.fiberTarget.enabled !== false && fiber && (auto || fiber.lower !== null || fiber.upper !== null)) {
    targets.push({
      id: 'fiber',
      metric: 'fiber',
      lower: auto ? auto.lowerPer1000 : fiber.lower,
      upper: auto ? auto.upperPer1000 : fiber.upper,
      unit: 'g',
      basis: auto ? 'per_1000_kcal_me' : dog.fiberTarget.basis,
      locked: false,
      setBy: 'preferenza utente',
      setAt: dog.updatedAt.slice(0, 10),
    });
  }
  return {
    id: dog.id,
    name: dog.name,
    breed: dog.breed,
    lifeStage: dog.lifeStage,
    weightCurrentKg: dog.weightCurrentKg,
    weightIdealKg: dog.weightIdealKg,
    kcalTarget: dog.kcalTarget,
    targets,
    attentionNotes: [...breedNotesFor(dog.breed, breedNotes).map((n) => ({ text: n.text, source: n.source, metrics: n.metrics })), ...dog.notes],
    recommended: recommendedFor(dog, recommendedTargets, nutrients),
    // margine sugli aminoacidi essenziali: riguarda la DIETA (digeribilità proteica documentata nella ricetta, vedi buildInput)
    eaaMarginPct: 10,
    formulationRevision: dog.formulationRevision,
  };
}
