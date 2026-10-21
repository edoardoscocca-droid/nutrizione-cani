// Logica delle ricette, indipendente dall'archivio (locale o Supabase).

import { auditRecipe, type DietMoisture } from '../engine/audit';
import { auditRecipeV2 } from '../engine/auditV2';
import { ENGINE_VERSION_V2, resolveConfig, type FormulationOverrides } from '../engine/configV2';
import { recipeCost, unitPrice, type CostSummary } from '../engine/cost';
import { toFormulationProfile, type BreedNote } from '../engine/dogProfile';
import type { FormulationInput, FormulationResult } from '../engine/formulate';
import type { FormulationInputV2 } from '../engine/formulateV2';

/** Chi esegue il calcolo: il motore locale (web, test) o il server di calcolo (app iPhone). */
export type Formulator = (input: FormulationInput) => Promise<FormulationResult>;
import { thresholdsAsLimits } from '../engine/reference';
import { diffItems, staleDependencies, type Dependency, type QuantityDiff, type RecipeSnapshot } from '../engine/snapshot';
import type { Catalog, EngineSettings, ItemConstraint, RecipeItem } from '../engine/types';
import { MAX_RECIPES_PER_DOG, type Dog, type Recipe, type RecipeVersion, type UserPrice, type VersionOrigin } from './model';

export interface Selection {
  foods: { id: string; constraint?: ItemConstraint }[];
  supplements: { id: string; constraint?: ItemConstraint }[];
  dietMoisture: DietMoisture;
  /** digeribilità proteica della DIETA ≥ 80% documentata (con riferimento): senza, minimi degli aminoacidi essenziali +10%. */
  proteinDigestibility?: { atLeast80: boolean; reference: string | null } | null;
}

/** La digeribilità vale solo se documentata: serve il riferimento. */
export function digestibilityRef(sel: Pick<Selection, 'proteinDigestibility'>): string | null {
  const d = sel.proteinDigestibility;
  return d?.atLeast80 && d.reference?.trim() ? d.reference.trim() : null;
}

export interface CatalogState extends Catalog {
  breedNotes: BreedNote[];
}

export class RecipeLimitError extends Error {
  constructor() {
    super(`Limite raggiunto: al massimo ${MAX_RECIPES_PER_DOG} ricette attive per cane (le archiviate non contano). Archivia o elimina una ricetta per crearne una nuova (nessuna ricetta viene eliminata automaticamente).`);
  }
}

/** ricette che contano per il limite: le archiviate no (specifica v2 §8). */
export function activeRecipeCount(recipesOfDog: Recipe[]): number {
  return recipesOfDog.filter((r) => !r.archived).length;
}

export function assertCanAddRecipe(recipesOfDog: Recipe[]) {
  if (activeRecipeCount(recipesOfDog) >= MAX_RECIPES_PER_DOG) throw new RecipeLimitError();
}

/** Limiti in uso: ufficiali + soglie non ufficiali attive (quelle disattivate dall'amministratore restano fuori). */
export function activeLimits(cat: Catalog) {
  return [...cat.limits.filter((l) => l.limitClass !== 'NON_OFFICIAL_ATTENTION'), ...thresholdsAsLimits(cat.customThresholds)];
}

export function pricesByItem(cat: Catalog, prices: UserPrice[]): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = {};
  for (const f of cat.foods) {
    const p = prices.find((x) => x.active && x.productKind === 'food' && x.productId === f.id);
    if (p) out[f.id] = unitPrice(p, 'g', null) ?? undefined;
  }
  for (const s of cat.supplements) {
    const p = prices.find((x) => x.active && x.productKind === 'supplement' && x.productId === s.id);
    if (p) out[s.id] = unitPrice(p, s.doseUnit, s.massPerUnitG) ?? undefined;
  }
  return out;
}

export function buildInput(dog: Dog, sel: Selection, cat: CatalogState, settings: EngineSettings & { formulationV2?: FormulationOverrides | null }, prices: UserPrice[]): FormulationInputV2 {
  const foods = sel.foods.map((f) => {
    const food = cat.foods.find((x) => x.id === f.id);
    if (!food) throw new Error(`Alimento non più presente in catalogo: ${f.id}`);
    return { food, constraint: f.constraint };
  });
  const supplements = sel.supplements.map((s) => {
    const supplement = cat.supplements.find((x) => x.id === s.id);
    if (!supplement) throw new Error(`Integratore non più presente in catalogo: ${s.id}`);
    return { supplement, constraint: s.constraint };
  });
  const ref = digestibilityRef(sel);
  return {
    dog: { ...toFormulationProfile(dog, cat.breedNotes, cat.recommendedTargets, cat.nutrients), eaaMarginPct: ref ? 0 : 10, proteinDigestibilityRef: ref },
    foods,
    supplements,
    nutrients: cat.nutrients,
    limits: activeLimits(cat),
    dietMoisture: sel.dietMoisture,
    settings,
    unitPrices: pricesByItem(cat, prices),
    catalogForSuggestions: { foods: cat.foods, supplements: cat.supplements },
    // formulazione v2: configurazione [PROPOSTA] con le modifiche dell'utente, congelata nell'istantanea
    config: resolveConfig(settings.formulationV2),
  };
}

export function snapshotOf(input: FormulationInput & { config?: FormulationInputV2['config'] }, engineVersion: string, now = new Date().toISOString()): RecipeSnapshot {
  const constraints: Record<string, ItemConstraint> = {};
  for (const f of input.foods) if (f.constraint) constraints[f.food.id] = f.constraint;
  for (const s of input.supplements) if (s.constraint) constraints[s.supplement.id] = s.constraint;
  // copia profonda: l'istantanea non deve cambiare se cambia il catalogo in memoria
  return structuredClone({
    engineVersion,
    createdAt: now,
    dog: input.dog,
    foods: Object.fromEntries(input.foods.map((f) => [f.food.id, f.food])),
    supplements: Object.fromEntries(input.supplements.map((s) => [s.supplement.id, s.supplement])),
    constraints,
    nutrients: input.nutrients,
    limits: input.limits,
    referenceVersionIds: [...new Set(input.limits.map((l) => l.referenceVersionId))],
    dietMoisture: input.dietMoisture,
    settings: input.settings,
    // solo i risultati del generatore v2 (e le analisi v2) congelano la configurazione: una versione del motore
    // precedente resta verificata con le sue regole
    ...(input.config && engineVersion === ENGINE_VERSION_V2 ? { formulationConfig: input.config } : {}),
  });
}

export function selectionFromSnapshot(s: RecipeSnapshot): Selection {
  return {
    foods: Object.keys(s.foods).map((id) => ({ id, constraint: s.constraints[id] })),
    supplements: Object.keys(s.supplements).map((id) => ({ id, constraint: s.constraints[id] })),
    dietMoisture: s.dietMoisture,
    proteinDigestibility: s.dog.proteinDigestibilityRef ? { atLeast80: true, reference: s.dog.proteinDigestibilityRef } : null,
  };
}

export function versionFromResult(
  args: { id: string; recipeId: string; revision: number; origin: VersionOrigin; parentVersionId: string | null; author: string; note?: string | null },
  result: FormulationResult,
  input: FormulationInput,
  now = new Date().toISOString(),
): RecipeVersion {
  // si salvano le soluzioni e, come BOZZA, le proposte diagnostiche (preferenze non raggiungibili, vincoli necessari rispettati)
  const draft = result.outcome === 'preferences_unreachable';
  if ((result.outcome !== 'solved' && !draft) || !result.audit || !result.items.length) throw new Error('Si salvano solo formulazioni con una proposta di quantità.');
  return {
    id: args.id,
    recipeId: args.recipeId,
    revision: args.revision,
    origin: draft ? 'diagnostic' : args.origin,
    draft,
    parentVersionId: args.parentVersionId,
    suggestedItems: result.items,
    chosenItems: result.items,
    audit: result.audit,
    snapshot: snapshotOf(input, result.engineVersion, now),
    constraintsUsed: result.constraints,
    conflicts: result.conflicts,
    engineNotes: result.notes,
    excluded: result.excluded.map((e) => ({ name: e.name, reason: e.reason })),
    author: args.author,
    createdAt: now,
    note: args.note ?? null,
  };
}

/** Verifica completa di un insieme di quantità sull'istantanea congelata (v2 se l'istantanea ne ha la configurazione). */
export function auditOnSnapshot(snapshot: RecipeSnapshot, items: RecipeItem[], excluded: { name: string; reason: string }[] = []) {
  return (snapshot.formulationConfig ? auditRecipeV2 : auditRecipe)({
    config: snapshot.formulationConfig,
    items,
    foods: snapshot.foods,
    supplements: snapshot.supplements,
    nutrients: snapshot.nutrients,
    limits: snapshot.limits,
    legacyFactors: snapshot.factors ?? null,
    dog: snapshot.dog,
    dietMoisture: snapshot.dietMoisture,
    settings: snapshot.settings,
    excluded,
  });
}

/**
 * Modalità analisi (specifica v2 §8): una ricetta già fatta (anche della veterinaria) inserita a grammi fissi viene
 * solo verificata, con le stesse regole e gli stessi dati del generatore; nessuna quantità viene cambiata.
 */
export function analysisVersion(
  args: { id: string; recipeId: string; revision: number; author: string; note?: string | null },
  input: FormulationInputV2,
  items: RecipeItem[],
  now = new Date().toISOString(),
): RecipeVersion {
  for (const it of items) if (!(it.qty >= 0) || !Number.isFinite(it.qty)) throw new Error('Quantità non valida');
  if (!items.some((it) => it.qty > 0)) throw new Error('Inserisci almeno una quantità.');
  const snapshot = snapshotOf(input, ENGINE_VERSION_V2, now);
  return {
    id: args.id,
    recipeId: args.recipeId,
    revision: args.revision,
    origin: 'analysis',
    draft: false,
    parentVersionId: null,
    suggestedItems: items,
    chosenItems: items,
    audit: auditOnSnapshot(snapshot, items),
    snapshot,
    constraintsUsed: [],
    conflicts: [],
    engineNotes: ['Ricetta inserita a grammi fissi (modalità analisi): nessuna formulazione, solo verifica con le regole v2.'],
    excluded: [],
    author: args.author,
    createdAt: now,
    note: args.note ?? null,
  };
}

/** Modifica esplicita delle quantità: nuova versione separata, proposta originale conservata, verifica rifatta da zero. */
export function editedVersion(prev: RecipeVersion, items: RecipeItem[], args: { id: string; revision: number; author: string; note?: string | null }, now = new Date().toISOString()): RecipeVersion {
  for (const it of items) if (!(it.qty >= 0) || !Number.isFinite(it.qty)) throw new Error('Quantità non valida');
  return {
    ...prev,
    id: args.id,
    revision: args.revision,
    origin: 'user_edit',
    // quantità scelte dall'utente: analizzate così come sono (non è più la bozza del motore)
    draft: false,
    parentVersionId: prev.id,
    chosenItems: items,
    audit: auditOnSnapshot(prev.snapshot, items, prev.excluded),
    author: args.author,
    createdAt: now,
    note: args.note ?? null,
  };
}

export interface RecalcPreview {
  stale: Dependency[];
  result: FormulationResult;
  input: FormulationInput;
  diff: QuantityDiff[];
}

export function staleFor(version: RecipeVersion, dog: Dog, cat: CatalogState): Dependency[] {
  return staleDependencies(version.snapshot, {
    foods: cat.foods,
    supplements: cat.supplements,
    limits: activeLimits(cat),
    dog: toFormulationProfile(dog, cat.breedNotes, cat.recommendedTargets, cat.nutrients),
  });
}

/** Anteprima del ricalcolo con i dati attuali. Nessun salvataggio: serve la conferma esplicita. */
export async function previewRecalculation(
  version: RecipeVersion,
  dog: Dog,
  cat: CatalogState,
  settings: EngineSettings,
  prices: UserPrice[],
  run: Formulator,
  selection?: Selection,
): Promise<RecalcPreview> {
  const sel = selection ?? selectionFromSnapshot(version.snapshot);
  const input = buildInput(dog, sel, cat, settings, prices);
  const result = await run(input);
  const names: Record<string, string> = {};
  for (const f of [...Object.values(version.snapshot.foods), ...input.foods.map((x) => x.food)]) names[f.id] = f.name;
  for (const s of [...Object.values(version.snapshot.supplements), ...input.supplements.map((x) => x.supplement)]) names[s.id] = s.name;
  return { stale: staleFor(version, dog, cat), result, input, diff: diffItems(version.chosenItems, result.items, names) };
}

export function costOf(version: { chosenItems: RecipeItem[]; snapshot: RecipeSnapshot }, prices: UserPrice[]): CostSummary {
  const info: Parameters<typeof recipeCost>[1] = {};
  for (const f of Object.values(version.snapshot.foods)) info[f.id] = { name: f.name, doseUnit: 'g', massPerUnitG: null };
  for (const s of Object.values(version.snapshot.supplements)) info[s.id] = { name: s.name, doseUnit: s.doseUnit, massPerUnitG: s.massPerUnitG };
  return recipeCost(version.chosenItems, info, prices);
}
