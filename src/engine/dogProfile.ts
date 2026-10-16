// Regole di aggiornamento del profilo del cane (§3, §11, T01).

import type { Dog } from '../data/model';
import { mer, weightGapNeedsWarning } from './energy';
import type { DogFormulationProfile, PersonalTarget } from './types';

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
export function toFormulationProfile(dog: Dog, breedNotes: BreedNote[]): DogFormulationProfile {
  const targets: PersonalTarget[] = [...dog.targets];
  for (const m of dog.macroPreferences) {
    if (m.lower === null && m.upper === null) continue;
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
  if (dog.fiberTarget && (dog.fiberTarget.lower !== null || dog.fiberTarget.upper !== null)) {
    targets.push({
      id: 'fiber',
      metric: 'fiber',
      lower: dog.fiberTarget.lower,
      upper: dog.fiberTarget.upper,
      unit: 'g',
      basis: dog.fiberTarget.basis,
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
    formulationRevision: dog.formulationRevision,
  };
}
