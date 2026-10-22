// Configurazione della formulazione v2 (specifiche del 21/10/2026): gruppi del pasto, tetti di quantità, tolleranza
// energetica, gradini di Ca:P e delle dosi, limiti legali su sostanza secca. I valori [PROPOSTA] stanno nei file di
// dati/riferimenti (non nel codice) e si possono cambiare da Impostazioni; ogni ricetta congela la configurazione usata.

import configJson from '../../dati/riferimenti/formulazione_v2.json';
import legalJson from '../../dati/riferimenti/limiti_legali_fediaf.json';
import type { Food } from './types';

/** versione del generatore v2 (definita qui per non caricare il risolutore nell'app). */
export const ENGINE_VERSION_V2 = 'motore-3.0.0';

export interface MealGroup {
  id: string;
  label: string;
  categories: string[];
  subcategories: string[];
  minPctKcal: number;
  maxPctKcal: number;
  /** il minimo è una preferenza (scostamento penalizzato), non un vincolo rigido (verdure, decisione del 22/10). */
  minIsPreference?: boolean;
  source: string;
}

export interface DefaultCap {
  id: string;
  group?: string;
  /** vale solo per questa sottocategoria (es. fegato): ha la precedenza sui predefiniti più generali. */
  subcategory?: string;
  secretingOffal?: boolean;
  excludeSubcategories?: string[];
  maxFreshWeightPct?: number;
  maxPctKcal?: number;
  source: string;
}

export interface DoseRule {
  supplementId: string;
  /** gradino 2: fino a questa percentuale oltre il massimo della tabella (giallo). */
  marginPct: number;
  /** fuori tabella si estrapola il rapporto g/kg della prima o dell'ultima riga. */
  extrapolate: boolean;
  source: string;
}

export interface CaPStep {
  step: 1 | 2 | 3;
  lower: number;
  upper: number;
  color: 'green' | 'yellow';
  label: string;
}

export interface LegalLimit {
  metric: string;
  /** massimo per 100 g di sostanza secca, nell'unità canonica del nutriente. */
  upper: number;
  unit: string;
}

export interface FormulationConfig {
  version: string;
  energyTolerancePct: number;
  groups: MealGroup[];
  defaultCaps: DefaultCap[];
  yellowFromPct: number;
  caPSteps: CaPStep[];
  doseRules: DoseRule[];
  trendMinDays: number;
  windows: number[];
  maxRecipesPerDog: number;
  legalLimits: LegalLimit[];
  legalSource: string;
  categoryWarnings: { subcategory: string; text: string }[];
  generalWarnings: string[];
  /** alimenti pesati in uno stato diverso da quello servito (crudi o secchi da cuocere): serve la resa documentata. */
  needsYield: { categories: string[]; processingStates: string[] };
  /** nutrienti determinanti che devono essere documentati prima dell'uso nel generatore (prodotti concentrati). */
  activationRequirements: { subcategory?: string; supplementClass?: string; nutrients: string[]; source: string }[];
}

/** Modifiche dell'utente da Impostazioni (solo intervalli dei gruppi ed energia). */
export interface FormulationOverrides {
  energyTolerancePct?: number | null;
  groups?: { id: string; minPctKcal: number; maxPctKcal: number }[];
}

const raw = configJson as unknown as {
  version: string;
  energyTolerancePct: { value: number };
  groups: MealGroup[];
  defaultCaps: DefaultCap[];
  levelB: { yellowFromPct: number };
  caPSteps: CaPStep[];
  doseRules: DoseRule[];
  diary: { trendMinDays: number; windows: number[] };
  maxRecipesPerDog: { value: number };
  warnings: { categories: { subcategory: string; text: string }[]; general: string[] };
  preparedWeight: { needsYield: { categories: string[]; processingStates: string[] } };
  activationRequirements: FormulationConfig['activationRequirements'];
};

export const DEFAULT_CONFIG: FormulationConfig = {
  version: raw.version,
  energyTolerancePct: raw.energyTolerancePct.value,
  groups: raw.groups,
  defaultCaps: raw.defaultCaps,
  yellowFromPct: raw.levelB.yellowFromPct,
  caPSteps: raw.caPSteps,
  doseRules: raw.doseRules,
  trendMinDays: raw.diary.trendMinDays,
  windows: raw.diary.windows,
  maxRecipesPerDog: raw.maxRecipesPerDog.value,
  legalLimits: (legalJson as { limits: LegalLimit[] }).limits,
  legalSource: (legalJson as { source: string }).source,
  categoryWarnings: raw.warnings.categories,
  generalWarnings: raw.warnings.general,
  needsYield: raw.preparedWeight.needsYield,
  activationRequirements: raw.activationRequirements,
};

export function resolveConfig(over?: FormulationOverrides | null): FormulationConfig {
  const cfg = structuredClone(DEFAULT_CONFIG);
  if (!over) return cfg;
  if (over.energyTolerancePct && over.energyTolerancePct > 0) cfg.energyTolerancePct = over.energyTolerancePct;
  for (const g of over.groups ?? []) {
    const cur = cfg.groups.find((x) => x.id === g.id);
    if (!cur || !(g.minPctKcal >= 0) || !(g.maxPctKcal >= g.minPctKcal) || g.maxPctKcal > 100) continue;
    if (cur.minPctKcal !== g.minPctKcal || cur.maxPctKcal !== g.maxPctKcal) {
      cur.minPctKcal = g.minPctKcal;
      cur.maxPctKcal = g.maxPctKcal;
      cur.source = `${cur.source}; modificato dall'utente in Impostazioni`;
    }
  }
  return cfg;
}

export function groupOf(food: Pick<Food, 'categoryId' | 'subcategoryId'>, cfg: FormulationConfig): MealGroup | null {
  return cfg.groups.find((g) => g.subcategories.includes(food.subcategoryId)) ?? cfg.groups.find((g) => g.categories.includes(food.categoryId) && !cfg.groups.some((o) => o.subcategories.includes(food.subcategoryId))) ?? null;
}

export function isSecretingOffal(food: Pick<Food, 'subcategoryId'>): boolean {
  return food.subcategoryId.startsWith('secreting_offal');
}

export interface FoodCap {
  maxFreshWeightPct: number | null;
  maxPctKcal: number | null;
  maxGPer1000Kcal: number | null;
  source: string[];
}

/** Tetto di quantità di un alimento: campo del catalogo se presente, altrimenti il predefinito del suo gruppo. */
export function capOf(food: Food, cfg: FormulationConfig): FoodCap {
  const g = groupOf(food, cfg);
  const defaults = cfg.defaultCaps.filter(
    (c) => (c.group && c.group === g?.id) || (c.subcategory && c.subcategory === food.subcategoryId) || (c.secretingOffal && isSecretingOffal(food) && !(c.excludeSubcategories ?? []).includes(food.subcategoryId)),
  );
  const pick = (k: 'maxFreshWeightPct' | 'maxPctKcal') => {
    // il predefinito della sottocategoria (es. fegato) ha la precedenza su quelli generali
    const all = defaults.filter((d) => d[k] !== undefined);
    const ds = all.some((d) => d.subcategory) ? all.filter((d) => d.subcategory) : all;
    return ds.length ? { v: Math.min(...ds.map((d) => d[k] as number)), src: ds.map((d) => d.source) } : null;
  };
  const fw = food.maxFreshWeightPct ?? null;
  const dfw = pick('maxFreshWeightPct');
  const dk = pick('maxPctKcal');
  const source: string[] = [];
  if (fw !== null) source.push(`catalogo: ${food.name} ≤ ${fw}% del peso degli alimenti`);
  else if (dfw) source.push(...dfw.src);
  if (dk) source.push(...dk.src);
  if (food.maxGPer1000Kcal !== null && food.maxGPer1000Kcal !== undefined) source.push(`catalogo: ${food.name} ≤ ${food.maxGPer1000Kcal} g per 1000 kcal`);
  return { maxFreshWeightPct: fw ?? dfw?.v ?? null, maxPctKcal: dk?.v ?? null, maxGPer1000Kcal: food.maxGPer1000Kcal ?? null, source };
}

export function doseRuleOf(supplementId: string, cfg: FormulationConfig): DoseRule | null {
  return cfg.doseRules.find((r) => r.supplementId === supplementId) ?? null;
}

export function caPStepOf(ratio: number, cfg: FormulationConfig): CaPStep | null {
  const eps = 1e-9;
  return [...cfg.caPSteps].sort((a, b) => a.step - b.step).find((s) => ratio >= s.lower - eps && ratio <= s.upper + eps) ?? null;
}

const STATE_LABEL: Record<string, string> = {
  raw: 'pesato crudo', cooked_boiled: 'pesato cotto (bollito)', cooked_steamed: 'pesato cotto al vapore', cooked_baked: 'pesato cotto al forno',
  cooked_other: 'pesato cotto', dried: 'pesato secco', canned: 'pesato in scatola', raw_or_unspecified: 'stato di pesata non indicato',
};
export const weighingStateLabel = (f: Pick<Food, 'processingState'>) => STATE_LABEL[f.processingState] ?? f.processingState;

/**
 * Peso dell'alimento nella razione pronta per 1 g pesato. 1 se il profilo è già nello stato servito; la resa documentata
 * per cereali, tuberi e legumi pesati crudi o secchi; null se la resa servirebbe ma manca (mai inventata).
 */
export function preparedFactor(f: Food, cfg: FormulationConfig): number | null {
  if (f.preparedYield && f.preparedYield > 0) return f.preparedYield;
  const needs = cfg.needsYield.categories.includes(f.categoryId) && cfg.needsYield.processingStates.includes(f.processingState);
  return needs ? null : 1;
}

/** nutrienti determinanti non documentati per un prodotto concentrato (vuoto = utilizzabile). */
export function missingActivationNutrients(p: { subcategoryId?: string; supplementClass?: string | null; nutrients: Record<string, { value: number | null } | undefined> }, cfg: FormulationConfig): string[] {
  const reqs = cfg.activationRequirements.filter((r) => (r.subcategory && r.subcategory === p.subcategoryId) || (r.supplementClass && r.supplementClass === p.supplementClass));
  const out: string[] = [];
  for (const r of reqs) {
    for (const n of r.nutrients) {
      const known =
        n === 'vitamin_a'
          ? (p.nutrients.vitamin_a?.value ?? p.nutrients.vitamin_a_retinol_ug?.value ?? null) !== null && (p.nutrients.beta_carotene_ug?.value ?? null) !== null
          : (p.nutrients[n]?.value ?? null) !== null;
      if (!known && !out.includes(n)) out.push(n);
    }
  }
  return out;
}
