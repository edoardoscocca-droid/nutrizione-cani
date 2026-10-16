// Verifica finale indipendente (§9.3, allegato F step_four).
// Ricalcola da zero ogni nutriente come somma di tutti gli alimenti e integratori della ricetta,
// sui dati congelati nell'istantanea, e confronta con i limiti applicabili. Non usa il modello dell'ottimizzatore.

import { CATALOG_STATUS_LABEL, foodStatus, supplementStatus } from './catalogStatus';
import { fediafReferenceKcal } from './energy';
import { computeTotals, foodData, supplementData, type DerivedValue, type ItemData, type RecipeTotals, type Total } from './totals';
import type {
  Color,
  DogFormulationProfile,
  EnergyFactors,
  EngineSettings,
  Food,
  Nutrient,
  NutrientLimit,
  RecipeItem,
  Supplement,
} from './types';

export type DietMoisture = 'wet' | 'dry' | null;

export interface LimitCheck {
  limit: NutrientLimit;
  color: Color;
  /** valore di riferimento convertito sul giorno (per 1000 kcal → kcal effettive). */
  dailyReference: number | null;
  message: string;
}

export interface CheckRow {
  metric: string;
  label: string;
  unit: string;
  kind: string;
  group: string;
  /** totale giornaliero dei contributi noti (o valore del rapporto/percentuale). */
  amount: number | null;
  per1000kcal: number | null;
  complete: boolean;
  missingFrom: string[];
  contributions: { name: string; amount: number }[];
  checks: LimitCheck[];
  color: Color;
  purple: string[];
  note?: string;
}

export type RecipeStatus =
  | 'VERIFIED_AVAILABLE_CHECKS'
  | 'PREFERENCES_VIOLATED'
  | 'INSUFFICIENT_DATA'
  | 'FAILS_OFFICIAL_LIMITS'
  | 'NO_VALID_SOLUTION';

export const STATUS_LABEL: Record<RecipeStatus, string> = {
  VERIFIED_AVAILABLE_CHECKS: 'Verificata rispetto ai controlli disponibili',
  PREFERENCES_VIOLATED: 'Rispetta i limiti ufficiali, ma non tutte le preferenze',
  INSUFFICIENT_DATA: 'Dati insufficienti: non verificabile',
  FAILS_OFFICIAL_LIMITS: 'Non rispetta limiti ufficiali',
  NO_VALID_SOLUTION: 'Nessuna soluzione valida',
};

export interface AuditInput {
  items: RecipeItem[];
  foods: Record<string, Food>;
  supplements: Record<string, Supplement>;
  nutrients: Nutrient[];
  limits: NutrientLimit[];
  factors: EnergyFactors;
  dog: DogFormulationProfile;
  dietMoisture: DietMoisture;
  settings: EngineSettings;
  /** componenti scelti dall'utente ma esclusi dal calcolo (dati mancanti). */
  excluded?: { name: string; reason: string }[];
}

export interface AuditResult {
  status: RecipeStatus;
  statusLabel: string;
  kcal: number | null;
  kcalComplete: boolean;
  kcalTarget: number | null;
  energyRow: CheckRow;
  rows: CheckRow[];
  blockers: string[];
  warnings: string[];
  dataFlags: { testData: boolean; estimated: string[]; reviewRequiredLimits: string[] };
  totals: RecipeTotals;
}

const EPS = 1e-9;

export function itemDataList(items: RecipeItem[], foods: Record<string, Food>, supplements: Record<string, Supplement>): ItemData[] {
  return items.map((it) => {
    if (it.kind === 'food') {
      const f = foods[it.id];
      if (!f) throw new Error(`Alimento ${it.id} assente dall'istantanea`);
      return foodData(it, f);
    }
    const s = supplements[it.id];
    if (!s) throw new Error(`Integratore ${it.id} assente dall'istantanea`);
    return supplementData(it, s);
  });
}

/** Limiti applicabili alla fase di vita e al tipo di dieta (selenio umido/secco). */
export function applicableLimits(limits: NutrientLimit[], dog: DogFormulationProfile, dietMoisture: DietMoisture): NutrientLimit[] {
  const out = limits.filter((l) => {
    if (l.lifeStage !== dog.lifeStage) return false;
    const m = l.applicability?.dietMoisture;
    if (m && m !== dietMoisture) return false;
    return true;
  });
  for (const t of dog.targets) {
    out.push({
      id: `personal_${t.id}`,
      referenceVersionId: 'PERSONAL',
      metric: t.metric,
      lifeStage: dog.lifeStage,
      lower: t.lower,
      upper: t.upper,
      unit: t.unit,
      basis: t.basis,
      limitClass: 'PERSONAL_TARGET',
      hardness: t.locked ? 'hard' : 'soft',
      severity: 'orange',
      source: `Target personale — ${t.setBy} (${t.setAt})`,
      status: 'verified',
      notes: t.notes ?? null,
    });
  }
  return out;
}

function fmt(n: number): string {
  return n.toLocaleString('it-IT', { maximumFractionDigits: 3 });
}

function failColor(l: NutrientLimit): Color {
  if (l.limitClass === 'INFORMATIONAL_REFERENCE') return 'blue';
  if (l.limitClass === 'OFFICIAL_MIN' || l.limitClass === 'OFFICIAL_NUTRITIONAL_MAX' || l.limitClass === 'LEGAL_MAX') return 'red';
  return 'orange';
}

function classLabel(l: NutrientLimit): string {
  switch (l.limitClass) {
    case 'OFFICIAL_MIN':
      return 'minimo ufficiale';
    case 'OFFICIAL_NUTRITIONAL_MAX':
      return 'massimo nutrizionale ufficiale';
    case 'LEGAL_MAX':
      return 'massimo legale';
    case 'NON_OFFICIAL_ATTENTION':
      return 'soglia di attenzione NON ufficiale';
    case 'PERSONAL_TARGET':
      return l.hardness === 'hard' ? 'target professionale' : 'target personale';
    default:
      return 'riferimento informativo';
  }
}

interface Measured {
  value: number | null; // nella base del limite
  knownLowerBound: number | null; // valore dei soli contributi noti
  complete: boolean;
  reason?: string;
}

function measure(
  l: NutrientLimit,
  t: Total | undefined,
  d: DerivedValue | undefined,
  kcal: number | null,
  kcalComplete: boolean,
  dryMatterG: number | null,
): Measured {
  if (l.basis === 'ratio' || l.basis === 'energy_pct') {
    if (!d) return { value: null, knownLowerBound: null, complete: false, reason: 'metrica non calcolabile' };
    return { value: d.value, knownLowerBound: null, complete: d.complete, reason: d.reason };
  }
  if (!t) return { value: null, knownLowerBound: null, complete: false, reason: 'nutriente non presente nel dizionario' };
  if (t.noData) return { value: null, knownLowerBound: null, complete: false, reason: 'nessun dato disponibile' };
  if (l.basis === 'per_day') {
    return { value: t.complete ? t.known : null, knownLowerBound: t.known, complete: t.complete, reason: t.complete ? undefined : 'dati mancanti' };
  }
  if (l.basis === 'per_1000_kcal_me') {
    if (!kcalComplete || !kcal) return { value: null, knownLowerBound: null, complete: false, reason: 'energia della ricetta incompleta' };
    const dens = (t.known / kcal) * 1000;
    return { value: t.complete ? dens : null, knownLowerBound: dens, complete: t.complete, reason: t.complete ? undefined : 'dati mancanti' };
  }
  // Basi su sostanza secca o mangime al 12% di umidità: confronto solo con conversione approvata (T14).
  if (l.basis === 'per_kg_dry_matter' && l.applicability?.conversionApproved && dryMatterG && dryMatterG > 0) {
    const v = t.known / (dryMatterG / 1000);
    return { value: t.complete ? v : null, knownLowerBound: v, complete: t.complete, reason: t.complete ? undefined : 'dati mancanti' };
  }
  return {
    value: null,
    knownLowerBound: null,
    complete: false,
    reason: 'limite espresso su sostanza secca/mangime: nessun confronto senza conversione verificata',
  };
}

function evaluate(l: NutrientLimit, m: Measured, kcal: number | null, unit: string): LimitCheck {
  const dailyReference =
    l.basis === 'per_1000_kcal_me' && kcal
      ? ((l.lower ?? l.upper) as number) * (kcal / 1000)
      : l.basis === 'per_day'
        ? (l.lower ?? l.upper)
        : null;
  const ref = [l.lower !== null ? `min ${fmt(l.lower)}` : null, l.upper !== null ? `max ${fmt(l.upper)}` : null]
    .filter(Boolean)
    .join(' · ');
  const what = `${classLabel(l)} (${ref} ${unit === 'ratio' ? '' : unit}${l.basis === 'per_1000_kcal_me' ? '/1000 kcal' : l.basis === 'per_day' ? '/die' : l.basis === 'energy_pct' ? '% kcal' : ''})`;
  const fail = failColor(l);
  if (l.limitClass === 'INFORMATIONAL_REFERENCE') {
    const v = m.value ?? m.knownLowerBound;
    const above = v !== null && l.upper !== null && v > l.upper + EPS;
    return { limit: l, color: 'blue', dailyReference, message: `${what}: ${above ? 'valore superiore al livello indicato' : 'solo informativo'}` };
  }
  // Massimo: anche con dati parziali, se i soli contributi noti lo superano la violazione è certa.
  if (l.upper !== null && m.knownLowerBound !== null && m.knownLowerBound > l.upper * (1 + 1e-6) + EPS) {
    return { limit: l, color: fail, dailyReference, message: `${what}: superato` };
  }
  if (!m.complete || m.value === null) {
    let extra = '';
    if (l.lower !== null && m.knownLowerBound !== null && m.knownLowerBound >= l.lower) {
      extra = ' (il minimo risulta raggiunto anche senza i dati mancanti, ma il controllo resta incompleto)';
    }
    return { limit: l, color: 'grey', dailyReference, message: `${what}: non verificabile — ${m.reason ?? 'dati mancanti'}${extra}` };
  }
  if (l.lower !== null && m.value < l.lower * (1 - 1e-6) - EPS) {
    return { limit: l, color: fail, dailyReference, message: `${what}: non raggiunto` };
  }
  if (l.upper !== null && m.value > l.upper * (1 + 1e-6) + EPS) {
    return { limit: l, color: fail, dailyReference, message: `${what}: superato` };
  }
  const noMax = l.limitClass === 'OFFICIAL_MIN' ? ' Massimo non definito: valori elevati non sono automaticamente sicuri.' : '';
  return { limit: l, color: 'green', dailyReference, message: `${what}: rispettato.${noMax}` };
}

const COLOR_RANK: Record<Color, number> = { red: 5, grey: 4, orange: 3, green: 2, blue: 1, purple: 0 };

function worst(colors: Color[]): Color {
  return colors.reduce<Color>((a, c) => (COLOR_RANK[c] > COLOR_RANK[a] ? c : a), 'blue');
}

const DERIVED_LABELS: Record<string, { label: string; unit: string }> = {
  ca_p_ratio: { label: 'Rapporto calcio/fosforo', unit: 'ratio' },
  omega6_omega3_ratio: { label: 'Rapporto omega-6/omega-3', unit: 'ratio' },
  protein_energy_pct: { label: 'Quota energia da proteine', unit: '%' },
  fat_energy_pct: { label: 'Quota energia da grassi', unit: '%' },
  carb_energy_pct: { label: 'Quota energia da carboidrati disponibili', unit: '%' },
};

export function auditRecipe(input: AuditInput): AuditResult {
  const { items, foods, supplements, nutrients, dog, settings } = input;
  const data = itemDataList(items, foods, supplements);
  const totals = computeTotals(data, nutrients, input.factors);
  const kcalComplete = totals.energy.complete && !totals.energy.noData;
  const kcal = kcalComplete ? totals.energy.known : null;
  const limits = applicableLimits(input.limits, dog, input.dietMoisture);
  const moisture = totals.nutrients.moisture;
  const totalMass = items.reduce((a, it) => {
    if (it.kind === 'food') return a + it.qty;
    const s = supplements[it.id];
    return a + (s?.doseUnit === 'g' ? it.qty : (s?.massPerUnitG ?? NaN) * it.qty);
  }, 0);
  const dryMatterG = moisture && moisture.complete && Number.isFinite(totalMass) ? totalMass - moisture.known : null;

  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const e of input.excluded ?? []) blockers.push(`${e.name} escluso dal calcolo: ${e.reason}`);
  if (dog.lifeStage !== 'adult_maintenance') {
    blockers.push('Standard disponibile solo per cane adulto in mantenimento: per questa fase di vita la ricetta non è verificabile.');
  }
  if (!kcalComplete) blockers.push(`Energia incompleta: kcal mancanti per ${totals.energy.missingFrom.join(', ')}.`);
  if (input.dietMoisture === null) blockers.push('Tipo di dieta (umida/secca) non indicato: il minimo di selenio non è determinabile.');

  const byMetric = new Map<string, NutrientLimit[]>();
  for (const l of limits) byMetric.set(l.metric, [...(byMetric.get(l.metric) ?? []), l]);

  const purpleFor = (metric: string) => dog.attentionNotes.filter((n) => n.metrics?.includes(metric)).map((n) => n.text);

  const rows: CheckRow[] = [];
  const metrics: { id: string; label: string; unit: string; kind: string; group: string }[] = nutrients
    .filter((n) => n.id !== 'metabolizable_energy')
    .map((n) => ({ id: n.id, label: n.label, unit: n.unit, kind: n.kind, group: n.group }));
  for (const m of metrics) {
    const t = totals.nutrients[m.id];
    const d = totals.derived[m.id] ?? (DERIVED_LABELS[m.id] ? { value: null, complete: false, reason: 'non calcolabile' } : undefined);
    const ls = byMetric.get(m.id) ?? [];
    const checks = ls.map((l) => evaluate(l, measure(l, t, d, kcal, kcalComplete, dryMatterG), kcal, m.unit));
    let color: Color;
    const complete = t ? t.complete && !t.noData : (d?.complete ?? false);
    if (checks.length) color = worst(checks.map((c) => c.color));
    else color = complete ? 'blue' : 'grey';
    if (m.id === 'selenium_wet' && input.dietMoisture === null) color = 'grey';
    let note: string | undefined;
    if (!checks.length) note = complete ? 'Monitorato: nessun limite numerico appropriato disponibile.' : 'Dato insufficiente.';
    if (m.kind === 'advanced' && !complete) note = 'Aminoacido essenziale senza dati: la qualità proteica non è verificabile.';
    rows.push({
      metric: m.id,
      label: m.label,
      unit: m.unit,
      kind: m.kind,
      group: m.group,
      amount: t ? t.known : (d?.value ?? null),
      per1000kcal: t && kcal ? (t.known / kcal) * 1000 : null,
      complete,
      missingFrom: t ? t.missingFrom : [],
      contributions: t ? t.contributions : [],
      checks,
      color,
      purple: purpleFor(m.id),
      note: d && !d.complete ? d.reason : note,
    });
  }

  // Energia rispetto all'obiettivo
  const tol = settings.energyTolerancePct / 100;
  let energyColor: Color = 'grey';
  let energyMsg = 'Energia non calcolabile: dati kcal mancanti.';
  if (kcal !== null && dog.kcalTarget) {
    const dev = (kcal - dog.kcalTarget) / dog.kcalTarget;
    energyColor = Math.abs(dev) <= tol + 1e-9 ? 'green' : 'orange';
    energyMsg = `${fmt(kcal)} kcal su obiettivo ${fmt(dog.kcalTarget)} (tolleranza ±${settings.energyTolerancePct}%)`;
  } else if (!dog.kcalTarget) {
    energyMsg = 'Obiettivo kcal non impostato.';
    blockers.push('Obiettivo kcal non impostato.');
  }
  const energyRow: CheckRow = {
    metric: 'metabolizable_energy',
    label: 'Energia metabolizzabile',
    unit: 'kcal',
    kind: 'composition',
    group: 'energy',
    amount: totals.energy.known,
    per1000kcal: null,
    complete: kcalComplete,
    missingFrom: totals.energy.missingFrom,
    contributions: totals.energy.contributions,
    checks: [],
    color: energyColor,
    purple: [],
    note: energyMsg,
  };

  // Controlli essenziali: ogni metrica con limite ufficiale o target professionale.
  const essentialGrey = rows.filter((r) =>
    r.checks.some((c) => c.color === 'grey' && (c.limit.hardness === 'hard' || c.limit.limitClass === 'OFFICIAL_MIN')),
  );
  if (essentialGrey.length) {
    blockers.push(`Controlli non verificabili per dati mancanti: ${essentialGrey.map((r) => r.label).join(', ')}.`);
  }
  if (dog.kcalTarget && dog.weightIdealKg > 0 && dog.kcalTarget < fediafReferenceKcal(dog.weightIdealKg) - 1e-6) {
    warnings.push(
      'Le kcal obiettivo sono inferiori al riferimento FEDIAF di 95 kcal/kg^0,75 usato dai minimi per 1000 kcal: i minimi potrebbero sottostimare il fabbisogno reale (decisione D2). Valutazione professionale consigliata.',
    );
  }
  for (const n of dog.attentionNotes) warnings.push(`Nota di attenzione: ${n.text} (${n.source})`);

  // Stato di catalogo dei componenti usati: con dati parziali la ricetta non può essere dichiarata completa.
  for (const it of items) {
    if (!(it.qty > 0)) continue;
    const st = it.kind === 'food' ? foodStatus(foods[it.id], nutrients) : supplementStatus(supplements[it.id], nutrients);
    if (st.status !== 'verified') {
      const name = it.kind === 'food' ? foods[it.id].name : supplements[it.id].name;
      blockers.push(`${name}: ${CATALOG_STATUS_LABEL[st.status].toLowerCase()} (${st.reasons.join('; ')}) — la ricetta non può essere dichiarata completa.`);
    }
  }
  const estimated = items
    .filter((i) => i.qty > 0 && i.kind === 'food' && foods[i.id]?.dataStatus === 'estimated')
    .map((i) => foods[i.id].name);
  if (estimated.length) warnings.push(`Profili stimati con incertezza: ${estimated.join(', ')}.`);
  const testData = items.some(
    (i) => (i.kind === 'food' ? foods[i.id]?.dataStatus : supplements[i.id]?.status) === 'test_fixture',
  );
  const labelOf = new Map(nutrients.map((n) => [n.id, n.label]));
  const reviewRequiredLimits = limits
    .filter((l) => l.status !== 'verified')
    .map((l) => `${labelOf.get(l.metric) ?? l.metric} ${[l.lower, l.upper].filter((x) => x !== null).map((x) => fmt(x as number)).join('–')} — ${l.source}`);

  const greyEssential = rows.filter((r) => r.checks.some((c) => c.color === 'grey' && c.limit.limitClass === 'OFFICIAL_MIN')).length;
  if (greyEssential >= 5 || !kcalComplete) {
    warnings.unshift(
      `Dati troppo incompleti${!kcalComplete ? ' (energia compresa)' : ''}: le quantità proposte sono solo indicative e possono risultare poco realistiche. Non usarle per preparare la ricetta finché i dati mancanti non sono completati.`,
    );
  }
  const allChecks = rows.flatMap((r) => r.checks);
  let status: RecipeStatus;
  if (allChecks.some((c) => c.color === 'red')) status = 'FAILS_OFFICIAL_LIMITS';
  else if (blockers.length) status = 'INSUFFICIENT_DATA';
  else if (allChecks.some((c) => c.color === 'orange') || energyColor === 'orange') status = 'PREFERENCES_VIOLATED';
  else status = 'VERIFIED_AVAILABLE_CHECKS';

  return {
    status,
    statusLabel: STATUS_LABEL[status],
    kcal,
    kcalComplete,
    kcalTarget: dog.kcalTarget,
    energyRow,
    rows,
    blockers,
    warnings,
    dataFlags: { testData, estimated, reviewRequiredLimits },
    totals,
  };
}
