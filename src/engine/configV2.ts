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
  source: string;
}

export interface DefaultCap {
  id: string;
  group?: string;
  secretingOffal?: boolean;
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
  const defaults = cfg.defaultCaps.filter((c) => (c.group && c.group === g?.id) || (c.secretingOffal && isSecretingOffal(food)));
  const pick = (k: 'maxFreshWeightPct' | 'maxPctKcal') => {
    const ds = defaults.filter((d) => d[k] !== undefined);
    return ds.length ? { v: Math.min(...ds.map((d) => d[k] as number)), src: ds.map((d) => d.source) } : null;
  };
  const fw = food.maxFreshWeightPct ?? null;
  const dfw = pick('maxFreshWeightPct');
  const dk = pick('maxPctKcal');
  const source: string[] = [];
  if (fw !== null) source.push(`catalogo: ${food.name} ≤ ${fw}% del peso fresco`);
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
