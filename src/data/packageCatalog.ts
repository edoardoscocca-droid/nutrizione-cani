// Catalogo di partenza costruito dai file del pacchetto (dati/pacchetto).
// Alimenti e integratori hanno SOLO nomi e categorie: nessuna composizione, stato NOT_VERIFIED / MISSING,
// quindi non utilizzabili per formulazioni reali finché un amministratore non inserisce dati verificati.

import fediafJson from '../../dati/pacchetto/02_Riferimenti_FEDIAF/FEDIAF_2025_cane_adulto_nutrienti.json';
import dictA from '../../dati/pacchetto/03_Allegati_A_F/A_dizionario_nutrienti.json';
import dictExt from '../../dati/estensioni/dizionario_estensioni.json';
import thresholdsC from '../../dati/pacchetto/03_Allegati_A_F/C_target_e_semaforo.json';
import foodsD from '../../dati/pacchetto/03_Allegati_A_F/D_catalogo_alimenti_seed.json';
import suppE from '../../dati/pacchetto/03_Allegati_A_F/E_catalogo_integratori_seed.json';
import energyJson from '../../dati/riferimenti/metodi_energetici.json';
import conversionsJson from '../../dati/riferimenti/conversioni_unita.json';
import recommendedJson from '../../dati/riferimenti/obiettivi_aggiuntivi.json';
import gapsJson from '../../dati/riferimenti/lacune_catalogo.json';
import {
  buildCustomThresholds,
  buildNutrients,
  buildOfficialLimits,
  buildReferenceVersions,
  thresholdsAsLimits,
  type DictionaryA,
  type FediafDataset,
  type ThresholdsC,
} from '../engine/reference';
import type { Catalog, DoseUnit, RecommendedTarget, EnergyAssignment, EnergyMethod, Food, Nutrient, ProcessingState, Supplement, UnitConversion } from '../engine/types';

export interface Category {
  id: string;
  parentId: string | null;
  label: string;
  /** frattaglia secernente: classificazione distinta dal cuore (§5). */
  secretingOffal?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: 'animal', parentId: null, label: 'Alimenti animali' },
  { id: 'muscle', parentId: 'animal', label: 'Carne muscolare' },
  { id: 'heart', parentId: 'animal', label: 'Cuore' },
  { id: 'secreting_offal_liver', parentId: 'animal', label: 'Frattaglie secernenti · fegato', secretingOffal: true },
  { id: 'secreting_offal_kidney', parentId: 'animal', label: 'Frattaglie secernenti · rene', secretingOffal: true },
  { id: 'secreting_offal_spleen', parentId: 'animal', label: 'Frattaglie secernenti · milza', secretingOffal: true },
  { id: 'secreting_offal_other', parentId: 'animal', label: 'Frattaglie secernenti · altre', secretingOffal: true },
  { id: 'fish', parentId: 'animal', label: 'Pesce' },
  { id: 'egg', parentId: 'animal', label: 'Uova' },
  { id: 'animal_other', parentId: 'animal', label: 'Altre fonti animali' },
  { id: 'starch', parentId: null, label: 'Cereali e fonti amidacee' },
  { id: 'cereal', parentId: 'starch', label: 'Cereali' },
  { id: 'tuber', parentId: 'starch', label: 'Tuberi' },
  { id: 'legume', parentId: 'starch', label: 'Legumi' },
  { id: 'vegetable', parentId: null, label: 'Verdure e altre fonti vegetali' },
  { id: 'vegetable_generic', parentId: 'vegetable', label: 'Verdure' },
  { id: 'fat_oil', parentId: 'other', label: 'Oli e grassi' },
  { id: 'other', parentId: null, label: 'Altri alimenti' },
];

export const PROCESSING_LABEL: Record<ProcessingState, string> = {
  raw: 'crudo',
  cooked_boiled: 'cotto (bollito)',
  cooked_steamed: 'cotto al vapore',
  cooked_baked: 'cotto (al forno)',
  cooked_other: 'cotto',
  dried: 'essiccato',
  canned: 'in scatola',
  raw_or_unspecified: 'crudo o non specificato',
};

export const fediaf = fediafJson as unknown as FediafDataset;

export function packageReferences(): Pick<Catalog, 'nutrients' | 'limits' | 'referenceVersions' | 'customThresholds' | 'energyMethods' | 'energyAssignments' | 'unitConversions' | 'recommendedTargets'> {
  const c = thresholdsC as unknown as ThresholdsC;
  const customThresholds = buildCustomThresholds(c);
  return {
    nutrients: [
      ...buildNutrients(dictA as DictionaryA, fediaf),
      // estensioni documentate in dati/estensioni: solo dati di fonte, nessun limite
      ...(dictExt as { nutrients: (DictionaryA['nutrients'][number] & { notes: string })[] }).nutrients.map((n) => ({
        id: n.id, label: n.label_it, unit: n.unit, group: n.group, kind: n.type as Nutrient['kind'], formula: n.formula, notes: n.notes,
      })),
    ],
    limits: [...buildOfficialLimits(fediaf), ...thresholdsAsLimits(customThresholds)],
    referenceVersions: buildReferenceVersions(fediaf, c),
    customThresholds,
    // D4 e D19: metodi energetici e conversioni approvati dalla nutrizionista (dati/riferimenti)
    energyMethods: (energyJson as { methods: EnergyMethod[] }).methods,
    energyAssignments: (energyJson as { assignments: EnergyAssignment[] }).assignments,
    unitConversions: (conversionsJson as { conversions: UnitConversion[] }).conversions,
    recommendedTargets: packageRecommendedTargets(),
  };
}

/** Obiettivi aggiuntivi approvati (oggi solo dal pacchetto, anche con Supabase). */
export function packageRecommendedTargets(): RecommendedTarget[] {
  return (recommendedJson as unknown as { targets: RecommendedTarget[] }).targets;
}

/** Lacune del catalogo reale non ancora risolte (§15 della specifica del 20/10/2026), per id prodotto. */
export function packageCatalogGaps(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of (gapsJson as { gaps: { products: string[]; text: string }[] }).gaps) for (const id of g.products) (out[id] ??= []).push(g.text);
  return out;
}

/** Applica le lacune ai prodotti (restano nel profilo e vengono congelate nelle istantanee delle ricette). */
export function withCatalogGaps<C extends { foods: Food[]; supplements: Supplement[] }>(cat: C): C {
  const gaps = packageCatalogGaps();
  return {
    ...cat,
    foods: cat.foods.map((f) => (gaps[f.id] ? { ...f, openGaps: gaps[f.id] } : f)),
    supplements: cat.supplements.map((s) => (gaps[s.id] ? { ...s, openGaps: gaps[s.id] } : s)),
  };
}

function mapSub(category: string, sub: string): string {
  if (category === 'vegetable' && sub === 'vegetable') return 'vegetable_generic';
  return sub;
}

export function packageFoods(): Food[] {
  return (foodsD as { food_items: Record<string, string | boolean | null>[] }).food_items.map((f) => ({
    id: String(f.id),
    name: String(f.name_it),
    categoryId: String(f.category),
    subcategoryId: mapSub(String(f.category), String(f.subcategory)),
    processingState: 'raw_or_unspecified',
    ediblePortion: null,
    kcalMePer100g: null,
    dataStatus: 'unverified',
    availableToFormulate: false,
    profileVersion: 1,
    notes: String(f.notes ?? ''),
    nutrients: {},
  }));
}

const DOSE: Record<string, DoseUnit> = { gram: 'g', capsule: 'capsule', ml: 'ml', tablet: 'tablet', scoop: 'scoop' };

export function packageSupplements(): Supplement[] {
  return (suppE as { supplements: Record<string, string | number | boolean | null>[] }).supplements.map((s) => ({
    id: String(s.id),
    name: String(s.name_it),
    supplementClass: String(s.class),
    doseUnit: DOSE[String(s.dose_unit)] ?? 'g',
    massPerUnitG: (s.dose_mass_g as number | null) ?? null,
    kcalPerUnit: null,
    integerDose: s.dose_unit === 'capsule',
    maxDailyUnits: (s.max_daily_product_dose as number | null) ?? null,
    maxDailySource: (s.max_daily_dose_source as string | null) ?? null,
    labelSource: (s.source_label_url as string | null) ?? null,
    version: (s.version as string | null) ?? null,
    status: 'missing',
    usableForOptimization: false,
    profileVersion: 1,
    notes: String(s.notes ?? ''),
    nutrients: {},
  }));
}

/** Nota di razza prevista dalla specifica (§3, §10): solo attenzione, nessun numero. */
export const BREED_NOTES = [
  {
    id: 'irish_wolfhound_heart',
    breedMatch: ['irish wolfhound', 'levriero irlandese'],
    text: 'Razza con predisposizione cardiaca: monitorare la taurina con il veterinario. Nessun valore specifico di razza disponibile; la sola dieta non previene le cardiomiopatie.',
    source: 'Specifica funzionale v1.0 §3 e §10',
    metrics: ['taurine'],
  },
];
