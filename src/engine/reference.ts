// Trasforma i file del pacchetto (FEDIAF JSON, allegati A e C) in dizionario e limiti del motore.
// I numeri vengono copiati tali e quali dai file; qui non si aggiunge nessun valore nutrizionale,
// tranne il selenio per diete secche, riportato dalla guida FEDIAF del pacchetto (§4) e marcato "da rivedere".

import type { CustomThreshold, Nutrient, NutrientKind, NutrientLimit, ReferenceVersion } from './types';

export interface FediafRecord {
  id: string;
  name_it: string;
  group: string;
  unit_per_1000_kcal: string;
  fediaf_adult_95_min: number | null;
  fediaf_adult_nutritional_max: number | null;
  minimum_origin: string;
  maximum_origin: string;
  review_class: string;
  notes: string;
  legal_limit_requires_separate_basis: boolean;
  formula: string | null;
}

export interface FediafDataset {
  metadata: { version: string; source_url: string; source_document: string; source_table: string };
  nutrients: FediafRecord[];
}

export interface DictionaryA {
  nutrients: { id: string; label_it: string; group: string; unit: string; type: string; formula: string | null }[];
}

export interface ThresholdsC {
  version: string;
  custom_thresholds: {
    id: string;
    metric: string;
    min: number | null;
    max: number | null;
    status: string;
    severity: string;
    solver_priority: string;
    rationale: string;
    requires_review: boolean;
  }[];
}

export const FEDIAF_REFERENCE_ID = 'FEDIAF_2025_adult_95_v1.0';
export const PACKAGE_C_REFERENCE_ID = 'PACCHETTO_C_v1.0';
export const ADULT = 'adult_maintenance';

export function buildReferenceVersions(fediaf: FediafDataset, c: ThresholdsC): ReferenceVersion[] {
  return [
    {
      id: FEDIAF_REFERENCE_ID,
      source: 'FEDIAF',
      label: `${fediaf.metadata.source_document} — ${fediaf.metadata.source_table} (dataset ${fediaf.metadata.version})`,
      url: fediaf.metadata.source_url,
      status: 'verified',
    },
    {
      id: PACKAGE_C_REFERENCE_ID,
      source: 'Allegato C (soglie non ufficiali)',
      label: `Target e semaforo v${c.version}`,
      url: null,
      status: 'draft',
    },
  ];
}

export function buildNutrients(a: DictionaryA, fediaf: FediafDataset): Nutrient[] {
  const notes = new Map(fediaf.nutrients.map((r) => [r.id, r.notes || null]));
  return a.nutrients.map((n) => ({
    id: n.id,
    label: n.label_it,
    unit: n.unit,
    group: n.group,
    kind: n.type as NutrientKind,
    formula: n.formula,
    notes: notes.get(n.id) ?? null,
  }));
}

export function buildOfficialLimits(fediaf: FediafDataset): NutrientLimit[] {
  const out: NutrientLimit[] = [];
  const source = `FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)`;
  for (const r of fediaf.nutrients) {
    const basis = r.unit_per_1000_kcal === 'ratio' ? 'ratio' : 'per_1000_kcal_me';
    const applicability = r.id === 'selenium_wet' ? { dietMoisture: 'wet' as const } : undefined;
    if (r.fediaf_adult_95_min !== null) {
      out.push({
        id: `fediaf_min_${r.id}`,
        referenceVersionId: FEDIAF_REFERENCE_ID,
        metric: r.id,
        lifeStage: ADULT,
        lower: r.fediaf_adult_95_min,
        upper: null,
        unit: r.unit_per_1000_kcal,
        basis,
        limitClass: 'OFFICIAL_MIN',
        hardness: 'hard',
        severity: 'red',
        applicability,
        source,
        status: 'verified',
        notes: r.notes || null,
      });
    }
    if (r.fediaf_adult_nutritional_max !== null) {
      out.push({
        id: `fediaf_max_${r.id}`,
        referenceVersionId: FEDIAF_REFERENCE_ID,
        metric: r.id,
        lifeStage: ADULT,
        lower: null,
        upper: r.fediaf_adult_nutritional_max,
        unit: r.unit_per_1000_kcal,
        basis,
        limitClass: 'OFFICIAL_NUTRITIONAL_MAX',
        hardness: 'hard',
        severity: 'red',
        applicability,
        source,
        status: 'verified',
        notes: r.notes || null,
      });
    }
  }
  // Guida FEDIAF del pacchetto, §4: selenio per diete secche 55,00 µg/1000 kcal (non presente nel JSON).
  out.push({
    id: 'fediaf_min_selenium_dry',
    referenceVersionId: FEDIAF_REFERENCE_ID,
    metric: 'selenium_wet',
    lifeStage: ADULT,
    lower: 55,
    upper: null,
    unit: 'µg',
    basis: 'per_1000_kcal_me',
    limitClass: 'OFFICIAL_MIN',
    hardness: 'hard',
    severity: 'red',
    applicability: { dietMoisture: 'dry' },
    source: 'FEDIAF 2025 tab. III-3b, diete secche — valore riportato nella guida del pacchetto §4',
    status: 'review_required',
    notes: 'Valore non presente nel JSON FEDIAF: da confermare (decisione D3).',
  });
  // Nota c FEDIAF riportata dalla guida: livelli considerati sicuri per cani sani, NON massimi nutrizionali.
  for (const [metric, value] of [
    ['sodium', 3.75],
    ['chloride', 5.87],
  ] as const) {
    out.push({
      id: `fediaf_info_${metric}`,
      referenceVersionId: FEDIAF_REFERENCE_ID,
      metric,
      lifeStage: ADULT,
      lower: null,
      upper: value,
      unit: 'g',
      basis: 'per_1000_kcal_me',
      limitClass: 'INFORMATIONAL_REFERENCE',
      hardness: 'soft',
      severity: 'blue',
      source: 'FEDIAF 2025, nota c (guida del pacchetto §4)',
      status: 'verified',
      notes: 'Livello indicato come sicuro per cani sani; non è un massimo nutrizionale e non va applicato alle diete cliniche.',
    });
  }
  return out;
}

export function buildCustomThresholds(c: ThresholdsC): CustomThreshold[] {
  return c.custom_thresholds.map((t) => ({
    id: t.id,
    metric: t.metric,
    lower: t.min,
    upper: t.max,
    status: t.status,
    severity: 'orange',
    solverPriority: 'soft',
    rationale: t.rationale,
    requiresReview: t.requires_review,
    enabled: true,
  }));
}

/** Le soglie non ufficiali diventano limiti arancioni, morbidi, separati per classe. */
export function thresholdsAsLimits(thresholds: CustomThreshold[]): NutrientLimit[] {
  return thresholds
    .filter((t) => t.enabled)
    .map((t) => ({
      id: `custom_${t.id}`,
      referenceVersionId: PACKAGE_C_REFERENCE_ID,
      metric: t.metric === 'calcium_phosphorus_ratio' ? 'ca_p_ratio' : t.metric,
      lifeStage: ADULT,
      lower: t.lower,
      upper: t.upper,
      unit: 'ratio',
      basis: 'ratio',
      limitClass: 'NON_OFFICIAL_ATTENTION',
      hardness: 'soft',
      severity: 'orange',
      source: `Allegato C — ${t.status}`,
      status: t.requiresReview ? 'draft' : 'verified',
      notes: t.rationale,
    }));
}
