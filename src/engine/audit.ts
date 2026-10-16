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
  /** rispettato sulla composizione dichiarata, con integratori che non dichiarano il valore o l'energia. */
  uncertain?: string;
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
  /** integratori che non dichiarano il valore: sconosciuto, non zero. */
  undeclaredFrom: string[];
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
  /** solo per le istantanee salvate prima dei metodi energetici per tipologia. */
  legacyFactors?: EnergyFactors | null;
  dog: DogFormulationProfile;
  dietMoisture: DietMoisture;
  settings: EngineSettings;
  /** componenti scelti dall'utente ma esclusi dal calcolo (dati mancanti). */
  excluded?: { name: string; reason: string }[];
}

export interface AuditResult {
  status: RecipeStatus;
  statusLabel: string;
  /** almeno un controllo rispettato solo sulla composizione dichiarata degli integratori. */
  declaredCompositionOnly?: boolean;
  /** fabbisogni (limiti ufficiali e target rigidi): dimostrabilmente soddisfatti, non soddisfatti, non verificabili per dati mancanti. */
  summary?: { satisfied: string[]; notMet: string[]; unverifiable: string[] };
  /** componenti con dati stimati o non convalidati; integratori con energia sconosciuta. */
  dataQuality?: { lowQuality: string[]; unknownEnergy: string[] };
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
  /** valore sui dati dichiarati, nella base del limite (null se incompleto). */
  value: number | null;
  /** limite inferiore certo: soli contributi noti e, per 1000 kcal, energia massima possibile. */
  low: number | null;
  complete: boolean;
  /** integratori che non dichiarano il nutriente (o una parte del rapporto): valore sconosciuto, non zero. */
  undeclared: string[];
  /** integratori senza kcal dichiarate: l'energia vera può essere più alta di quella dichiarata. */
  energyUncertain: string[];
  reason?: string;
}

function measure(
  l: NutrientLimit,
  t: Total | undefined,
  d: DerivedValue | undefined,
  energy: { kcal: number | null; kcalMax: number | null; complete: boolean; uncertainFrom: string[] },
  dryMatterG: number | null,
): Measured {
  const none = (reason: string): Measured => ({ value: null, low: null, complete: false, undeclared: [], energyUncertain: [], reason });
  if (l.basis === 'ratio' || l.basis === 'energy_pct') {
    if (!d) return none('metrica non calcolabile');
    return { value: d.value, low: null, complete: d.complete, undeclared: d.undeclaredFrom ?? [], energyUncertain: l.basis === 'energy_pct' ? energy.uncertainFrom : [], reason: d.reason };
  }
  if (!t) return none('nutriente non presente nel dizionario');
  if (t.noData) return none('nessun dato disponibile');
  const missing = t.complete ? undefined : 'dati mancanti';
  if (l.basis === 'per_day') {
    return { value: t.complete ? t.known : null, low: t.known, complete: t.complete, undeclared: t.undeclaredFrom, energyUncertain: [], reason: missing };
  }
  if (l.basis === 'per_1000_kcal_me') {
    if (!energy.complete || !energy.kcal || energy.kcalMax === null) return none('energia della ricetta incompleta');
    const dens = (t.known / energy.kcal) * 1000;
    return {
      value: t.complete ? dens : null,
      low: (t.known / energy.kcalMax) * 1000,
      complete: t.complete,
      undeclared: t.undeclaredFrom,
      // l'energia sconosciuta di un integratore non rende incerti i controlli dei nutrienti (decisione della nutrizionista)
      energyUncertain: [],
      reason: missing,
    };
  }
  // Basi su sostanza secca o mangime al 12% di umidità: confronto solo con conversione approvata (T14).
  if (l.basis === 'per_kg_dry_matter' && l.applicability?.conversionApproved && dryMatterG && dryMatterG > 0) {
    const v = t.known / (dryMatterG / 1000);
    return { value: t.complete ? v : null, low: v, complete: t.complete, undeclared: t.undeclaredFrom, energyUncertain: [], reason: missing };
  }
  return none('limite espresso su sostanza secca/mangime: nessun confronto senza conversione verificata');
}

const names = (xs: string[]) => [...new Set(xs)].join(', ');

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
  const undeclaredNote = m.undeclared.length ? `${names(m.undeclared)} non dichiara questo valore (sconosciuto, non zero)` : '';
  const energyNote = m.energyUncertain.length ? `l’energia di ${names(m.energyUncertain)} non è dichiarata` : '';
  if (l.limitClass === 'INFORMATIONAL_REFERENCE') {
    const v = m.value ?? m.low;
    const above = v !== null && l.upper !== null && v > l.upper + EPS;
    return { limit: l, color: 'blue', dailyReference, message: `${what}: ${above ? 'valore superiore al livello indicato' : 'solo informativo'}` };
  }
  // Massimo: se già i soli contributi certi lo superano la violazione è certa, anche con dati parziali.
  if (l.upper !== null && m.low !== null && m.low > l.upper * (1 + 1e-6) + EPS) {
    return { limit: l, color: fail, dailyReference, message: `${what}: superato` };
  }
  if (!m.complete || m.value === null) {
    let extra = '';
    if (l.lower !== null && m.low !== null && m.low >= l.lower) {
      extra = ' (il minimo risulta raggiunto anche senza i dati mancanti, ma il controllo resta incompleto)';
    }
    return { limit: l, color: 'grey', dailyReference, message: `${what}: non verificabile — ${m.reason ?? 'dati mancanti'}${extra}` };
  }
  const below = (v: number) => l.lower !== null && v < l.lower * (1 - 1e-6) - EPS;
  const above = (v: number) => l.upper !== null && v > l.upper * (1 + 1e-6) + EPS;
  const ratioLike = l.basis === 'ratio' || l.basis === 'energy_pct';
  if (below(m.value)) {
    // con la composizione dichiarata il minimo non c'è: è un difetto certo solo se nessun integratore tace sul nutriente
    if (m.undeclared.length || (ratioLike && m.energyUncertain.length)) {
      return { limit: l, color: 'grey', dailyReference, message: `${what}: non dimostrato — non raggiunto con i valori dichiarati; ${undeclaredNote || energyNote}` };
    }
    return { limit: l, color: fail, dailyReference, message: `${what}: non raggiunto` };
  }
  if (m.low !== null && below(m.low)) {
    return { limit: l, color: 'grey', dailyReference, message: `${what}: non dimostrato — raggiunto con l’energia dichiarata, ma ${energyNote}: inserire le kcal per dose` };
  }
  if (above(m.value)) {
    if (ratioLike && (m.undeclared.length || m.energyUncertain.length)) {
      return { limit: l, color: 'grey', dailyReference, message: `${what}: non dimostrato — fuori intervallo con i valori dichiarati; ${undeclaredNote || energyNote}` };
    }
    if (!ratioLike && m.energyUncertain.length) {
      return { limit: l, color: 'grey', dailyReference, message: `${what}: non dimostrato — superato con l’energia dichiarata, ma ${energyNote}` };
    }
    return { limit: l, color: fail, dailyReference, message: `${what}: superato` };
  }
  const noMax = l.limitClass === 'OFFICIAL_MIN' ? ' Massimo non definito: valori elevati non sono automaticamente sicuri.' : '';
  // rispettato; con integratori che tacciono sul nutriente il massimo (o il rapporto) vale solo sulla composizione dichiarata
  // (un'energia vera più alta abbassa la densità per 1000 kcal: per i massimi non è un'incertezza; per le quote % sì)
  const energyMatters = l.basis === 'energy_pct' && m.energyUncertain.length > 0;
  const uncertain =
    (l.upper !== null || ratioLike) && (m.undeclared.length || energyMatters)
      ? `Calcolato sulla composizione dichiarata: ${[undeclaredNote, energyMatters ? energyNote : ''].filter(Boolean).join('; ')}.`
      : undefined;
  return { limit: l, color: 'green', dailyReference, message: `${what}: rispettato.${noMax}${uncertain ? ` ${uncertain}` : ''}`, uncertain };
}

/** limite che definisce un fabbisogno: ufficiale (minimo, massimo, legale) o target fissato da un professionista. */
function isEssential(l: NutrientLimit): boolean {
  return l.limitClass === 'OFFICIAL_MIN' || l.limitClass === 'OFFICIAL_NUTRITIONAL_MAX' || l.limitClass === 'LEGAL_MAX' || (l.limitClass === 'PERSONAL_TARGET' && l.hardness === 'hard');
}

/** valori dell'integratore la cui base (per dose, per kg…) va ancora confermata dalla fonte. */
export function needsBasisConfirmation(s: Supplement | undefined): boolean {
  return !!s && Object.values(s.nutrients).some((v) => v.value !== null && /PER_KG_ASSUMED_CONFIRM/.test(v.method ?? ''));
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
  const totals = computeTotals(data, nutrients, input.legacyFactors);
  const kcalComplete = totals.energy.complete && !totals.energy.noData;
  const kcal = kcalComplete ? totals.energy.known : null;
  // integratori senza kcal (né dichiarate né stimabili con un metodo): energia sconosciuta, nessun valore sostitutivo;
  // incide solo sull'incertezza dell'energia e delle quote energetiche, non sui controlli di aminoacidi e vitamine
  const energyUncertainFrom = totals.energy.undeclaredFrom;
  const energyCtx = { kcal, kcalMax: kcal, complete: kcalComplete, uncertainFrom: energyUncertainFrom };
  const limits = applicableLimits(input.limits, dog, input.dietMoisture);
  const moisture = totals.nutrients.moisture;
  const totalMass = items.reduce((a, it) => {
    if (it.kind === 'food') return a + it.qty;
    const s = supplements[it.id];
    return a + (s?.doseUnit === 'g' ? it.qty : (s?.massPerUnitG ?? NaN) * it.qty);
  }, 0);
  const dryMatterG = moisture && moisture.complete && !moisture.undeclaredFrom.length && Number.isFinite(totalMass) ? totalMass - moisture.known : null;

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
    const checks = ls.map((l) => evaluate(l, measure(l, t, d, energyCtx, dryMatterG), kcal, m.unit));
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
      undeclaredFrom: t ? t.undeclaredFrom : (d?.undeclaredFrom ?? []),
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
    if (energyUncertainFrom.length) {
      // impatto: quanto pesano, nella razione, i componenti con energia sconosciuta
      const unknown = items.filter((it) => it.kind === 'supplement' && it.qty > 0 && supplements[it.id]?.kcalPerUnit === null);
      const mass = (it: RecipeItem) => (supplements[it.id]?.doseUnit === 'g' ? it.qty : (supplements[it.id]?.massPerUnitG ?? null) === null ? null : supplements[it.id]!.massPerUnitG! * it.qty);
      const parts = unknown.map((it) => {
        const g = mass(it);
        return `${supplements[it.id].name} ${g === null ? `${fmt(it.qty)} ${supplements[it.id].doseUnit}` : `${fmt(g)} g`}`;
      });
      const knownMass = unknown.every((it) => mass(it) !== null) && Number.isFinite(totalMass) && totalMass > 0;
      const share = knownMass ? (100 * unknown.reduce((a, it) => a + (mass(it) as number), 0)) / totalMass : null;
      energyMsg += `. Energia sconosciuta per ${parts.join(', ')}${share !== null ? ` (${fmt(Math.round(share * 10) / 10)}% del peso della razione)` : ''}: le kcal comprendono solo i componenti con energia nota.`;
    }
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
    undeclaredFrom: totals.energy.undeclaredFrom,
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

  // Qualità dei dati dei componenti (stato del catalogo): non impedisce il calcolo né la verifica, ma si dichiara.
  // I nutrienti davvero mancanti emergono nei controlli (grigi); qui si elencano fonti, stime e convalide.
  const lowQuality: string[] = [];
  for (const it of items) {
    if (!(it.qty > 0)) continue;
    const st = it.kind === 'food' ? foodStatus(foods[it.id], nutrients) : supplementStatus(supplements[it.id], nutrients);
    const name = it.kind === 'food' ? foods[it.id].name : supplements[it.id].name;
    if (st.status !== 'verified') {
      lowQuality.push(name);
      warnings.push(`${name}: ${CATALOG_STATUS_LABEL[st.status].toLowerCase()} — ${st.reasons.join('; ')}.`);
    }
    if (it.kind === 'supplement' && needsBasisConfirmation(supplements[it.id])) {
      blockers.push(`${name}: base quantitativa degli additivi da confermare (es. «per kg»): valori da non usare per una formulazione reale finché non è confermata.`);
    }
    if (it.kind === 'food' && foods[it.id].preparation) warnings.push(`${name} — preparazione: ${foods[it.id].preparation}`);
  }
  for (const it of items) {
    const f = it.kind === 'food' && it.qty > 0 ? foods[it.id] : undefined;
    if (f?.kcalMeOrigin === 'calculated' && f.energyMethod?.caution) warnings.push(`${f.name} — energia calcolata (${f.energyMethod.label}): ${f.energyMethod.caution}`);
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
  // composizione dichiarata degli integratori: controlli rispettati ma con valori non dichiarati
  const uncertainRows = rows.filter((r) => r.checks.some((c) => c.uncertain));
  if (uncertainRows.length) {
    const who = names(uncertainRows.flatMap((r) => [...r.undeclaredFrom, ...(r.checks.some((c) => c.uncertain?.includes('energia')) ? energyUncertainFrom : [])]));
    warnings.push(
      `Verifica sulla composizione dichiarata degli integratori (${who}): ${uncertainRows.map((r) => r.label).join(', ')} rispettati sui soli valori dichiarati. I valori non dichiarati sono sconosciuti, non zero.`,
    );
  }
  const allChecks = rows.flatMap((r) => r.checks);
  let status: RecipeStatus;
  if (allChecks.some((c) => c.color === 'red')) status = 'FAILS_OFFICIAL_LIMITS';
  else if (blockers.length) status = 'INSUFFICIENT_DATA';
  else if (allChecks.some((c) => c.color === 'orange') || energyColor === 'orange') status = 'PREFERENCES_VIOLATED';
  else status = 'VERIFIED_AVAILABLE_CHECKS';

  // Sintesi richiesta: fabbisogni dimostrabilmente soddisfatti, non soddisfatti, non verificabili (limiti ufficiali e target rigidi)
  const essentialRows = rows.filter((r) => r.checks.some((c) => isEssential(c.limit)));
  const summary = {
    satisfied: essentialRows.filter((r) => r.checks.filter((c) => isEssential(c.limit)).every((c) => c.color === 'green')).map((r) => r.label),
    notMet: essentialRows.filter((r) => r.checks.some((c) => isEssential(c.limit) && c.color === 'red')).map((r) => r.label),
    unverifiable: essentialRows.filter((r) => !r.checks.some((c) => isEssential(c.limit) && c.color === 'red') && r.checks.some((c) => isEssential(c.limit) && c.color === 'grey')).map((r) => r.label),
  };
  const qualifiers = [
    uncertainRows.length || energyUncertainFrom.length ? 'sulla composizione dichiarata degli integratori' : null,
    lowQuality.length ? `con dati di composizione stimati o non convalidati (${lowQuality.join(', ')})` : null,
  ].filter(Boolean);
  return {
    status,
    statusLabel:
      qualifiers.length && (status === 'VERIFIED_AVAILABLE_CHECKS' || status === 'PREFERENCES_VIOLATED')
        ? `${STATUS_LABEL[status]} — ${qualifiers.join('; ')}`
        : STATUS_LABEL[status],
    summary,
    dataQuality: { lowQuality, unknownEnergy: energyUncertainFrom },
    declaredCompositionOnly: uncertainRows.length > 0,
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
