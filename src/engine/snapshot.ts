// Istantanee congelate delle dipendenze di una versione di ricetta (§9.3, §11, T10, T16).
// La verifica di una versione salvata usa SOLO i dati dell'istantanea: un aggiornamento del catalogo
// o degli standard non cambia i valori delle ricette esistenti, ma le segnala come da aggiornare.

import type { DietMoisture } from './audit';
import { methodKey } from './energy';
import type { DogFormulationProfile, EnergyFactors, EngineSettings, Food, ItemConstraint, Nutrient, NutrientLimit, RecipeItem, Supplement } from './types';

export interface RecipeSnapshot {
  engineVersion: string;
  createdAt: string;
  dog: DogFormulationProfile;
  foods: Record<string, Food>;
  supplements: Record<string, Supplement>;
  constraints: Record<string, ItemConstraint>;
  nutrients: Nutrient[];
  limits: NutrientLimit[];
  referenceVersionIds: string[];
  /** solo nelle istantanee salvate prima dei metodi energetici per tipologia (oggi il metodo è dentro ogni alimento). */
  factors?: EnergyFactors;
  dietMoisture: DietMoisture;
  settings: EngineSettings;
}

export interface Dependency {
  kind: 'food' | 'supplement' | 'reference' | 'dog' | 'energy_method' | 'limits';
  id: string;
  name: string;
  frozen: string;
  current: string;
}

export interface CurrentState {
  foods: Food[];
  supplements: Supplement[];
  limits: NutrientLimit[];
  dog: DogFormulationProfile;
}

function limitsSignature(limits: NutrientLimit[]): string {
  return JSON.stringify(
    [...limits]
      .map((l) => [l.id, l.referenceVersionId, l.lower, l.upper, l.basis, l.status, l.hardness, l.applicability ?? null])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}

/** Elenco delle dipendenze cambiate rispetto all'istantanea. Il peso attuale non è una dipendenza. */
export function staleDependencies(snap: RecipeSnapshot, cur: CurrentState): Dependency[] {
  const out: Dependency[] = [];
  for (const f of Object.values(snap.foods)) {
    const now = cur.foods.find((x) => x.id === f.id);
    if (!now) out.push({ kind: 'food', id: f.id, name: f.name, frozen: `v${f.profileVersion}`, current: 'rimosso dal catalogo' });
    else if (now.profileVersion !== f.profileVersion) out.push({ kind: 'food', id: f.id, name: f.name, frozen: `v${f.profileVersion}`, current: `v${now.profileVersion}` });
    else if (methodKey(now.energyMethod) !== methodKey(f.energyMethod) || now.kcalMePer100g !== f.kcalMePer100g) {
      out.push({ kind: 'energy_method', id: f.id, name: `${f.name}: metodo energetico`, frozen: methodKey(f.energyMethod), current: methodKey(now.energyMethod) });
    }
  }
  for (const s of Object.values(snap.supplements)) {
    const now = cur.supplements.find((x) => x.id === s.id);
    if (!now) out.push({ kind: 'supplement', id: s.id, name: s.name, frozen: `v${s.profileVersion}`, current: 'rimosso dal catalogo' });
    else if (now.profileVersion !== s.profileVersion) out.push({ kind: 'supplement', id: s.id, name: s.name, frozen: `v${s.profileVersion}`, current: `v${now.profileVersion}` });
    else if (s.energyMethod !== undefined && methodKey(now.energyMethod) !== methodKey(s.energyMethod)) {
      out.push({ kind: 'energy_method', id: s.id, name: `${s.name}: metodo energetico`, frozen: methodKey(s.energyMethod), current: methodKey(now.energyMethod) });
    }
  }
  const frozenRefs = new Set(snap.limits.map((l) => l.referenceVersionId));
  const curRefs = new Set(cur.limits.map((l) => l.referenceVersionId));
  const removed = [...frozenRefs].filter((r) => !curRefs.has(r));
  const added = [...curRefs].filter((r) => !frozenRefs.has(r));
  if (removed.length || added.length) {
    out.push({ kind: 'reference', id: [...removed, ...added].join(','), name: 'Standard di riferimento', frozen: [...frozenRefs].join(', '), current: [...curRefs].join(', ') });
  }
  if (limitsSignature(snap.limits) !== limitsSignature(cur.limits) && !out.some((d) => d.kind === 'reference')) {
    out.push({ kind: 'limits', id: 'limits', name: 'Valori di riferimento o soglie', frozen: 'istantanea', current: 'modificati' });
  }
  // istantanee precedenti ai metodi per tipologia: fattori unici, oggi sostituiti
  if (snap.factors && !Object.values(snap.foods).some((f) => f.energyMethod)) {
    out.push({ kind: 'energy_method', id: 'factors', name: 'Metodo energetico', frozen: snap.factors.version, current: 'metodi per tipologia di alimento' });
  }
  if (snap.dog.formulationRevision !== cur.dog.formulationRevision) {
    out.push({ kind: 'dog', id: snap.dog.id, name: `Profilo di ${snap.dog.name}`, frozen: `rev. ${snap.dog.formulationRevision}`, current: `rev. ${cur.dog.formulationRevision}` });
  }
  return out;
}

export interface QuantityDiff {
  id: string;
  kind: 'food' | 'supplement';
  name: string;
  before: number | null;
  after: number | null;
}

export function diffItems(before: RecipeItem[], after: RecipeItem[], names: Record<string, string>): QuantityDiff[] {
  const ids = [...new Set([...before.map((i) => `${i.kind}:${i.id}`), ...after.map((i) => `${i.kind}:${i.id}`)])];
  return ids.map((key) => {
    const [kind, id] = key.split(':') as ['food' | 'supplement', string];
    const b = before.find((i) => i.kind === kind && i.id === id);
    const a = after.find((i) => i.kind === kind && i.id === id);
    return { id, kind, name: names[id] ?? id, before: b?.qty ?? null, after: a?.qty ?? null };
  });
}
