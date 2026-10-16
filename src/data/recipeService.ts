// Logica delle ricette, indipendente dall'archivio (locale o Supabase).

import { auditRecipe, type DietMoisture } from '../engine/audit';
import { recipeCost, unitPrice, type CostSummary } from '../engine/cost';
import { toFormulationProfile, type BreedNote } from '../engine/dogProfile';
import { formulate, type FormulationInput, type FormulationResult } from '../engine/formulate';
import { thresholdsAsLimits } from '../engine/reference';
import { diffItems, staleDependencies, type Dependency, type QuantityDiff, type RecipeSnapshot } from '../engine/snapshot';
import type { Catalog, EngineSettings, ItemConstraint, RecipeItem } from '../engine/types';
import { MAX_RECIPES_PER_DOG, type Dog, type Recipe, type RecipeVersion, type UserPrice, type VersionOrigin } from './model';

export interface Selection {
  foods: { id: string; constraint?: ItemConstraint }[];
  supplements: { id: string; constraint?: ItemConstraint }[];
  dietMoisture: DietMoisture;
}

export interface CatalogState extends Catalog {
  breedNotes: BreedNote[];
}

export class RecipeLimitError extends Error {
  constructor() {
    super(`Limite raggiunto: al massimo ${MAX_RECIPES_PER_DOG} ricette salvate per cane. Elimina una ricetta per crearne una nuova (nessuna ricetta viene eliminata automaticamente).`);
  }
}

export function assertCanAddRecipe(recipesOfDog: Recipe[]) {
  if (recipesOfDog.length >= MAX_RECIPES_PER_DOG) throw new RecipeLimitError();
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

export function buildInput(dog: Dog, sel: Selection, cat: CatalogState, settings: EngineSettings, prices: UserPrice[]): FormulationInput {
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
  return {
    dog: toFormulationProfile(dog, cat.breedNotes),
    foods,
    supplements,
    nutrients: cat.nutrients,
    limits: activeLimits(cat),
    factors: cat.energyFactors,
    dietMoisture: sel.dietMoisture,
    settings,
    unitPrices: pricesByItem(cat, prices),
    catalogForSuggestions: { foods: cat.foods, supplements: cat.supplements },
  };
}

export function snapshotOf(input: FormulationInput, engineVersion: string, now = new Date().toISOString()): RecipeSnapshot {
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
    factors: input.factors,
    dietMoisture: input.dietMoisture,
    settings: input.settings,
  });
}

export function selectionFromSnapshot(s: RecipeSnapshot): Selection {
  return {
    foods: Object.keys(s.foods).map((id) => ({ id, constraint: s.constraints[id] })),
    supplements: Object.keys(s.supplements).map((id) => ({ id, constraint: s.constraints[id] })),
    dietMoisture: s.dietMoisture,
  };
}

export function versionFromResult(
  args: { id: string; recipeId: string; revision: number; origin: VersionOrigin; parentVersionId: string | null; author: string; note?: string | null },
  result: FormulationResult,
  input: FormulationInput,
  now = new Date().toISOString(),
): RecipeVersion {
  if (result.outcome !== 'solved' || !result.audit) throw new Error('Si salvano solo formulazioni con una proposta di quantità.');
  return {
    id: args.id,
    recipeId: args.recipeId,
    revision: args.revision,
    origin: args.origin,
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

/** Verifica completa di un insieme di quantità sull'istantanea congelata. */
export function auditOnSnapshot(snapshot: RecipeSnapshot, items: RecipeItem[], excluded: { name: string; reason: string }[] = []) {
  return auditRecipe({
    items,
    foods: snapshot.foods,
    supplements: snapshot.supplements,
    nutrients: snapshot.nutrients,
    limits: snapshot.limits,
    factors: snapshot.factors,
    dog: snapshot.dog,
    dietMoisture: snapshot.dietMoisture,
    settings: snapshot.settings,
    excluded,
  });
}

/** Modifica esplicita delle quantità: nuova versione separata, proposta originale conservata, verifica rifatta da zero. */
export function editedVersion(prev: RecipeVersion, items: RecipeItem[], args: { id: string; revision: number; author: string; note?: string | null }, now = new Date().toISOString()): RecipeVersion {
  for (const it of items) if (!(it.qty >= 0) || !Number.isFinite(it.qty)) throw new Error('Quantità non valida');
  return {
    ...prev,
    id: args.id,
    revision: args.revision,
    origin: 'user_edit',
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
    factors: cat.energyFactors,
    dog: toFormulationProfile(dog, cat.breedNotes),
  });
}

/** Anteprima del ricalcolo con i dati attuali. Nessun salvataggio: serve la conferma esplicita. */
export async function previewRecalculation(
  version: RecipeVersion,
  dog: Dog,
  cat: CatalogState,
  settings: EngineSettings,
  prices: UserPrice[],
  selection?: Selection,
): Promise<RecalcPreview> {
  const sel = selection ?? selectionFromSnapshot(version.snapshot);
  const input = buildInput(dog, sel, cat, settings, prices);
  const result = await formulate(input);
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
