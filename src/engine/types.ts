// Tipi condivisi dal motore nutrizionale. Nessun valore numerico nutrizionale è definito qui:
// tutti i numeri arrivano dai dataset (FEDIAF, allegati A–F) o dal catalogo Supabase.

export type NutrientKind = 'core' | 'descriptive' | 'advanced' | 'informational' | 'derived' | 'composition';

export interface Nutrient {
  id: string;
  label: string;
  unit: string; // unità canonica: g, mg, µg, IU, kcal, ratio, %
  group: string;
  kind: NutrientKind;
  formula: string | null;
  notes?: string | null;
}

/** Classe del limite: tiene separate le soglie ufficiali da quelle personali o non ufficiali. */
export type LimitClass =
  | 'OFFICIAL_MIN'
  | 'OFFICIAL_NUTRITIONAL_MAX'
  | 'LEGAL_MAX'
  | 'NON_OFFICIAL_ATTENTION'
  | 'PERSONAL_TARGET'
  | 'INFORMATIONAL_REFERENCE';

/** Base di espressione del limite. */
export type LimitBasis =
  | 'per_1000_kcal_me'
  | 'per_day'
  | 'ratio'
  | 'energy_pct'
  | 'per_kg_dry_matter'
  | 'per_kg_feed_12pct_moisture';

export interface NutrientLimit {
  id: string;
  referenceVersionId: string;
  /** ID nutriente o metrica derivata (es. ca_p_ratio, protein_energy_pct). */
  metric: string;
  lifeStage: string;
  lower: number | null;
  upper: number | null;
  unit: string;
  basis: LimitBasis;
  limitClass: LimitClass;
  /** hard = vincolo del calcolo; soft = preferenza penalizzata. */
  hardness: 'hard' | 'soft';
  /** Colore se il limite non è rispettato. */
  severity: 'red' | 'orange' | 'blue';
  applicability?: { dietMoisture?: 'wet' | 'dry'; conversionApproved?: boolean };
  source: string;
  status: 'verified' | 'draft' | 'review_required';
  notes?: string | null;
}

export interface ReferenceVersion {
  id: string;
  source: string;
  label: string;
  url?: string | null;
  status: string;
}

export type ValueStatus = 'measured' | 'label' | 'calculated' | 'estimated' | 'analytical_zero' | 'unknown';

export interface NutrientValue {
  /** null = non disponibile. MAI equivalente a zero. */
  value: number | null;
  status?: ValueStatus;
  source?: string | null;
  method?: string | null;
  /** valore e unità come nella fonte, prima di una conversione (es. 10 mg di vitamina E). */
  sourceValue?: number | null;
  sourceUnit?: string | null;
  /** forma chimica dichiarata nella fonte (es. d_alpha_tocopherol). */
  form?: string | null;
}

export type ProcessingState =
  | 'raw'
  | 'cooked_boiled'
  | 'cooked_steamed'
  | 'cooked_baked'
  | 'cooked_other'
  | 'dried'
  | 'canned'
  | 'raw_or_unspecified';

export type DataStatus = 'verified' | 'estimated' | 'review_required' | 'unverified' | 'test_fixture';

export interface Food {
  id: string;
  name: string;
  categoryId: string;
  subcategoryId: string;
  speciesCut?: string | null;
  processingState: ProcessingState;
  preparation?: string | null;
  ediblePortion?: string | null;
  /** kcal di energia metabolizzabile per 100 g di parte edibile nello stato indicato. */
  kcalMePer100g: number | null;
  meMethod?: string | null;
  /** declared = EM inserita da un amministratore (misurata o da fonte); calculated = calcolata con il metodo energetico. */
  kcalMeOrigin?: 'declared' | 'calculated' | null;
  /** metodo energetico scelto per questo alimento (sostituisce quello della sua tipologia). */
  energyMethodId?: string | null;
  /** metodo energetico applicato (risolto al caricamento del catalogo; congelato nelle istantanee). */
  energyMethod?: AppliedEnergyMethod | null;
  source?: string | null;
  sourceVersion?: string | null;
  dataStatus: DataStatus;
  availableToFormulate: boolean;
  profileVersion: number;
  uncertainty?: string | null;
  notes?: string | null;
  /** convalida esplicita di un amministratore; decade a ogni modifica del profilo. */
  validatedBy?: string | null;
  validatedAt?: string | null;
  /** valori per 100 g, unità canonica del nutriente. */
  nutrients: Record<string, NutrientValue>;
}

export type DoseUnit = 'g' | 'ml' | 'capsule' | 'tablet' | 'scoop';

export interface Supplement {
  id: string;
  name: string;
  brand?: string | null;
  variant?: string | null;
  supplementClass?: string | null;
  doseUnit: DoseUnit;
  /** contenuto della singola unità (g per capsula/misurino), se noto. */
  massPerUnitG: number | null;
  kcalPerUnit: number | null;
  /** declared = energia per dose dall'etichetta; calculated = stimata dai macronutrienti dichiarati con un metodo approvato. */
  kcalOrigin?: 'declared' | 'calculated' | null;
  /** metodo energetico per le quote di energia dei macronutrienti dichiarati (risolto al caricamento). */
  energyMethod?: AppliedEnergyMethod | null;
  /** true = solo dosi intere (capsule, compresse). */
  integerDose: boolean;
  maxDailyUnits: number | null;
  maxDailySource?: string | null;
  labelSource?: string | null;
  version?: string | null;
  status: 'verified' | 'review_required' | 'missing' | 'test_fixture';
  usableForOptimization: boolean;
  /** true se l'etichetta dichiara solo le quantità aggiunte: non è un'analisi completa. */
  labelAddedOnly?: boolean;
  profileVersion: number;
  notes?: string | null;
  validatedBy?: string | null;
  validatedAt?: string | null;
  /** valori per 1 unità di dose (1 g, 1 ml, 1 capsula…). */
  nutrients: Record<string, NutrientValue>;
}

/** Fattori unici delle versioni precedenti (solo per leggere le istantanee già salvate). */
export interface EnergyFactors {
  version: string;
  protein: number | null;
  fat: number | null;
  carbohydrate: number | null;
  source?: string | null;
}

/**
 * Metodo di stima dell'energia metabolizzabile da proteine, grassi e carboidrati disponibili (ENA), in kcal/g.
 * Approvato e aggiornabile da un amministratore; si associa alle tipologie di alimento (EnergyAssignment).
 */
export interface EnergyMethod {
  id: string;
  version: string;
  label: string;
  protein: number;
  fat: number;
  /** kcal/g di carboidrati disponibili (estrattivi inazotati, ENA/NFE). */
  carbohydrate: number;
  source: string;
  approvedBy: string;
  approvedAt?: string | null;
  notes?: string | null;
  active: boolean;
}

/** raw = crudo; cooked = cotto (bollito, al forno, altro, in scatola); any = qualsiasi stato. */
export type ProcessingGroup = 'any' | 'raw' | 'cooked';

/** Associazione tipologia di alimento (+ stato di preparazione) → metodo energetico, con avvertenza facoltativa. */
export interface EnergyAssignment {
  categoryId: string;
  processing: ProcessingGroup;
  methodId: string;
  /** avvertenza su digeribilità o preparazione (testo, nessun coefficiente numerico). */
  caution?: string | null;
}

/** Conversione approvata tra unità non di massa (es. vitamina E mg → UI per una forma chimica precisa). */
export interface UnitConversion {
  id: string;
  nutrientId: string;
  fromUnit: string;
  toUnit: string;
  /** forma chimica; null = vale per qualsiasi forma del nutriente. */
  form: string | null;
  formLabel: string;
  factor: number;
  source: string;
}

export interface AppliedEnergyMethod {
  id: string;
  version: string;
  label: string;
  protein: number;
  fat: number;
  carbohydrate: number;
  caution: string | null;
}

export interface CustomThreshold {
  id: string;
  metric: string;
  lower: number | null;
  upper: number | null;
  status: string;
  severity: 'orange';
  solverPriority: 'soft';
  rationale: string;
  requiresReview: boolean;
  enabled: boolean;
}

export interface PersonalTarget {
  id: string;
  metric: string;
  lower: number | null;
  upper: number | null;
  unit: string;
  basis: 'per_1000_kcal_me' | 'per_day' | 'energy_pct' | 'ratio';
  /** locked = fissato da un professionista: vincolo rigido. */
  locked: boolean;
  setBy: string; // es. "Dott.ssa Rossi" o "utente"
  setAt: string;
  notes?: string | null;
}

export type LifeStage = 'adult_maintenance' | 'growth' | 'gestation' | 'lactation' | 'other';

export interface AttentionNote {
  text: string;
  source: string;
  /** nutrienti a cui la nota va affiancata (es. taurine). Nessun valore numerico. */
  metrics?: string[];
}

export interface DogFormulationProfile {
  id: string;
  name: string;
  breed?: string | null;
  lifeStage: LifeStage;
  weightCurrentKg: number;
  weightIdealKg: number;
  kcalTarget: number | null;
  targets: PersonalTarget[];
  /** Note di attenzione (razza o individuali) — viola, nessun numero. */
  attentionNotes: AttentionNote[];
  formulationRevision: number;
}

export interface Catalog {
  nutrients: Nutrient[];
  limits: NutrientLimit[];
  referenceVersions: ReferenceVersion[];
  energyMethods: EnergyMethod[];
  energyAssignments: EnergyAssignment[];
  unitConversions: UnitConversion[];
  customThresholds: CustomThreshold[];
  foods: Food[];
  supplements: Supplement[];
}

export interface EngineSettings {
  energyTolerancePct: number;
  roundingFoodG: number;
  roundingSupplementG: number;
  roundingSupplementMl: number;
  timeLimitSeconds: number;
  /** Minimizza il costo come ultimo criterio se tutti i prezzi sono noti. */
  preferLowerCost: boolean;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  energyTolerancePct: 2,
  roundingFoodG: 1,
  roundingSupplementG: 0.1,
  roundingSupplementMl: 0.1,
  timeLimitSeconds: 10,
  preferLowerCost: true,
};

export interface ItemConstraint {
  minQty?: number | null;
  maxQty?: number | null;
}

export interface RecipeItem {
  kind: 'food' | 'supplement';
  id: string;
  /** grammi per gli alimenti; unità di dose per gli integratori. */
  qty: number;
}

export type Color = 'red' | 'orange' | 'green' | 'blue' | 'grey' | 'purple';
