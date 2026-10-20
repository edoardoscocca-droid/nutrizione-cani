// Verifica finale indipendente (§9.3, allegato F step_four).
// Ricalcola da zero ogni nutriente come somma di tutti gli alimenti e integratori della ricetta,
// sui dati congelati nell'istantanea, e confronta con i limiti applicabili. Non usa il modello dell'ottimizzatore.

import { CATALOG_STATUS_LABEL, foodStatus, supplementStatus } from './catalogStatus';
import { estimateMeFromMacros, fediafReferenceKcal } from './energy';
import { doseRangeFor, weightSpan, type DoseRange } from './doseGuide';
import { recommendedAsLimits } from './recommended';
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
  /** intervallo richiesto, risultato e scostamento (nella base del limite). */
  gap?: { requested: string; result: number; deviation: number; unit: string };
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
  | 'TARGETS_NOT_MET'
  | 'INSUFFICIENT_DATA'
  | 'FAILS_OFFICIAL_LIMITS'
  | 'NO_VALID_SOLUTION';

export const STATUS_LABEL: Record<RecipeStatus, string> = {
  VERIFIED_AVAILABLE_CHECKS: 'Verificata rispetto ai controlli disponibili',
  PREFERENCES_VIOLATED: 'Rispetta i limiti ufficiali, ma non tutte le preferenze',
  TARGETS_NOT_MET: 'Rispetta i limiti ufficiali, ma non tutti gli obiettivi aggiuntivi',
  INSUFFICIENT_DATA: 'Bozza parziale: dati mancanti, non interamente verificabile',
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

export interface DoseCheck {
  name: string;
  qty: number;
  unit: string;
  range: DoseRange | null;
  color: Color;
  message: string;
}

export interface AuditResult {
  status: RecipeStatus;
  statusLabel: string;
  /** almeno un controllo rispettato solo sulla composizione dichiarata degli integratori. */
  declaredCompositionOnly?: boolean;
  /** fabbisogni (limiti ufficiali e target rigidi): dimostrabilmente soddisfatti, non soddisfatti, non verificabili per dati mancanti. */
  summary?: { satisfied: string[]; notMet: string[]; unverifiable: string[] };
  /** obiettivi aggiuntivi (es. apporto raccomandato NRC), tenuti distinti dai requisiti FEDIAF. */
  additional?: { id: string; label: string; metric: string; color: Color; message: string; gap?: LimitCheck['gap']; amount?: number | null; required?: number | null; unit?: string }[];
  /** origine dell'energia di ogni componente e confronto con i macronutrienti (metodo energetico). */
  energySources?: EnergySource[];
  /** somma delle quote energetiche di proteine, grassi e carboidrati disponibili (% dell'energia della ricetta). */
  macroEnergySumPct?: number | null;
  /** solo per la proposta del motore: perché una preferenza o un obiettivo aggiuntivo non è stato rispettato. */
  softGaps?: SoftGap[];
  /** dosi degli integratori rispetto alla tabella d'impiego del produttore (arancione fuori intervallo). */
  doseChecks?: DoseCheck[];
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

/**
 * Analisi del motore su una preferenza o un obiettivo aggiuntivo non rispettato.
 * blockedBy: vincoli rigidi che andrebbero violati per rispettarlo (individuati dal modello, non ipotizzati);
 * unreachable: con gli ingredienti selezionati non si raggiunge in nessuna quantità.
 */
export interface SoftGap {
  label: string;
  metric?: string;
  kind: string;
  blockedBy: string[];
  unreachable: boolean;
}

export interface EnergySource {
  name: string;
  kind: 'food' | 'supplement';
  /** declared = inserita (misurata o da fonte); calculated = calcolata con il metodo energetico; null = sconosciuta. */
  origin: 'declared' | 'calculated' | null;
  /** kcal per 100 g (alimenti) o per dose (integratori). */
  kcal: number | null;
  basis: string;
  /** stessa energia calcolata dai macronutrienti con il metodo del componente (null se non calcolabile). */
  fromMacros: number | null;
  methodLabel: string | null;
  /** (inserita − calcolata) / calcolata × 100. */
  diffPct: number | null;
  source: string | null;
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

const EAA = new Set(['arginine', 'histidine', 'isoleucine', 'leucine', 'lysine', 'methionine', 'methionine_cystine', 'phenylalanine', 'phenylalanine_tyrosine', 'threonine', 'tryptophan', 'valine']);

/** Limiti applicabili alla fase di vita e al tipo di dieta (selenio umido/secco). */
export function applicableLimits(limits: NutrientLimit[], dog: DogFormulationProfile, dietMoisture: DietMoisture): NutrientLimit[] {
  // selenio (§11): mangime secco completo identificato → riferimento secco; casalinga, mista, umida o ignota → il maggiore
  // dei due (prudenziale). Aminoacidi essenziali: +10% se non è garantita una digeribilità proteica ≥ 80% (§4).
  const out = limits
    .filter((l) => {
      if (l.lifeStage !== dog.lifeStage) return false;
      const m = l.applicability?.dietMoisture;
      if (m === 'dry' && dietMoisture !== 'dry') return false;
      if (m === 'wet' && dietMoisture === 'dry') return false;
      return true;
    })
    .map((l) =>
      dog.eaaMarginPct && l.limitClass === 'OFFICIAL_MIN' && l.lower !== null && EAA.has(l.metric)
        ? { ...l, lower: Math.round(l.lower * (1 + dog.eaaMarginPct / 100) * 1e6) / 1e6, source: `${l.source} + ${dog.eaaMarginPct}% (digeribilità proteica della dieta ≥ 80% non documentata)` }
        : l,
    );
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
  out.push(...recommendedAsLimits(dog));
  return out;
}

function fmt(n: number): string {
  return n.toLocaleString('it-IT', { maximumFractionDigits: 3 });
}

/** arrotondamento per i messaggi: 1 decimale per percentuali e valori ≥ 10, altrimenti 3. */
function nice(v: number, unit: string) {
  return fmt(unit.includes('%') || Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 1000);
}

function unitText(unit: string, l: NutrientLimit) {
  return `${unit === 'ratio' ? '' : unit}${l.basis === 'per_1000_kcal_me' ? '/1000 kcal' : l.basis === 'per_day' ? '/die' : l.basis === 'energy_pct' ? ' energia macro (4/9/4)' : ''}`.trim();
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
      return l.hardness === 'hard' ? 'target professionale' : l.source.includes('preferenza') ? 'preferenza' : 'target personale';
    case 'RECOMMENDED_ALLOWANCE':
      return l.displayLabel ?? 'apporto raccomandato';
    default:
      return 'riferimento informativo';
  }
}

interface Measured {
  /** valore per il confronto con i minimi (per 1000 kcal: su E_controllo = max(E_target, E_finale)). */
  valueMin: number | null;
  /** valore per il confronto con i massimi (per 1000 kcal: su E_finale). */
  valueMax: number | null;
  /** rapporti e quote: intervallo dimostrabile quando una parte è nota solo entro limiti. */
  range?: [number, number] | null;
  /** tutti i contributi sono noti (alimenti con il dato, integratori che lo dichiarano come totale). */
  complete: boolean;
  /** sorgenti senza il dato: alimenti con dato mancante, integratori che non lo dichiarano (sconosciuti, mai zero). */
  unknownFrom: string[];
  /** integratori con il solo valore aggiunto: per i massimi il loro apporto vero può essere maggiore. */
  lowerBoundFrom: string[];
  reason?: string;
}

function measure(
  l: NutrientLimit,
  t: Total | undefined,
  d: DerivedValue | undefined,
  energy: { kcal: number | null; kcalTarget: number | null; complete: boolean },
  dryMatterG: number | null,
): Measured {
  const none = (reason: string): Measured => ({ valueMin: null, valueMax: null, complete: false, unknownFrom: [], lowerBoundFrom: [], reason });
  if (l.basis === 'ratio' || l.basis === 'energy_pct') {
    if (!d) return none('metrica non calcolabile');
    if (!d.complete && !d.range) return { ...none(d.reason ?? 'dati incompleti'), valueMin: d.value, valueMax: d.value };
    return { valueMin: d.value, valueMax: d.value, range: d.complete ? null : d.range, complete: d.complete, unknownFrom: [], lowerBoundFrom: [], reason: d.reason };
  }
  if (!t) return none('nutriente non presente nel dizionario');
  if (t.noData) return { ...none('nessun dato disponibile'), unknownFrom: [...t.missingFrom, ...t.undeclaredFrom] };
  const unknownFrom = [...t.missingFrom, ...t.undeclaredFrom];
  const base = { complete: t.complete && !t.undeclaredFrom.length, unknownFrom, lowerBoundFrom: t.lowerBoundFrom };
  if (l.basis === 'per_day') return { ...base, valueMin: t.known, valueMax: t.known };
  if (l.basis === 'per_1000_kcal_me') {
    if (!energy.complete || !energy.kcal) return { ...none('energia della ricetta incompleta: densità per 1000 kcal non calcolabile'), unknownFrom };
    const eControl = Math.max(energy.kcal, energy.kcalTarget ?? 0);
    return { ...base, valueMin: (t.known / eControl) * 1000, valueMax: (t.known / energy.kcal) * 1000 };
  }
  // Basi su sostanza secca: confronto solo con conversione approvata e sostanza secca nota (controllo legale distinto, §4).
  if (l.basis === 'per_kg_dry_matter' && l.applicability?.conversionApproved && dryMatterG && dryMatterG > 0) {
    const v = t.known / (dryMatterG / 1000);
    return { ...base, valueMin: v, valueMax: v };
  }
  return none('limite espresso su sostanza secca/mangime: nessun confronto senza sostanza secca nota e conversione verificata');
}

const names = (xs: string[]) => [...new Set(xs)].join(', ');

function evaluate(l: NutrientLimit, m: Measured, kcal: number | null, kcalTarget: number | null, unit: string): LimitCheck {
  const dailyReference =
    l.basis === 'per_1000_kcal_me' && kcal
      ? l.lower !== null
        ? l.lower * (Math.max(kcal, kcalTarget ?? 0) / 1000)
        : (l.upper as number) * (kcal / 1000)
      : l.basis === 'per_day'
        ? (l.lower ?? l.upper)
        : null;
  const ref = [l.lower !== null ? `min ${fmt(l.lower)}` : null, l.upper !== null ? `max ${fmt(l.upper)}` : null]
    .filter(Boolean)
    .join(' · ');
  const what = `${classLabel(l)} (${ref} ${unitText(unit, l)})`.replace(' )', ')');
  const fail = failColor(l);
  const u = unitText(unit, l);
  if (l.limitClass === 'INFORMATIONAL_REFERENCE') {
    const v = m.valueMax;
    const above = v !== null && l.upper !== null && v > l.upper + EPS;
    return { limit: l, color: 'blue', dailyReference, message: `${what}: ${above ? 'valore superiore al livello indicato' : 'solo informativo'}` };
  }
  const below = (v: number) => l.lower !== null && v < l.lower * (1 - 1e-6) - EPS;
  const above = (v: number) => l.upper !== null && v > l.upper * (1 + 1e-6) + EPS;
  const requested = l.lower !== null && l.upper !== null ? `${fmt(l.lower)}–${fmt(l.upper)}` : l.lower !== null ? `almeno ${fmt(l.lower)}` : `non oltre ${fmt(l.upper as number)}`;
  const soft = fail === 'orange';
  const gapOf = (v: number) => ({ requested: `${requested} ${u}`, result: v, deviation: below(v) ? v - (l.lower as number) : above(v) ? v - (l.upper as number) : 0, unit: u });
  const gapText = (v: number) => {
    const g = gapOf(v);
    // scostamenti piccoli: cifre significative, mai «+0»
    const sig = (x: number, d: number) => x.toLocaleString('it-IT', { maximumSignificantDigits: d });
    const dev = nice(g.deviation, u) === fmt(0) ? sig(g.deviation, 2) : nice(g.deviation, u);
    const res = nice(v, u) === fmt(l.upper ?? l.lower ?? NaN) ? sig(v, 8) : nice(v, u);
    return ` — richiesto ${g.requested}, risultato ${res} ${u}, scostamento ${g.deviation > 0 ? '+' : ''}${dev} ${u}`;
  };
  const failed = (v: number, how: string): LimitCheck => ({ limit: l, color: fail, dailyReference, message: `${what}: ${how}${soft ? gapText(v) : ''}`, gap: soft ? gapOf(v) : undefined });
  const grey = (msg: string): LimitCheck => ({ limit: l, color: 'grey', dailyReference, message: `${what}: ${msg}` });

  // rapporti e quote con un intervallo dimostrabile (§12): dentro = rispettato, fuori = scostamento certo, a cavallo = non verificabile
  if (m.range) {
    const [lo, hi] = m.range;
    if (below(hi)) return failed(hi, `non raggiunto in tutto l’intervallo possibile (${nice(lo, u)}–${nice(hi, u)} ${u})`);
    if (above(lo)) return failed(lo, `superato in tutto l’intervallo possibile (${nice(lo, u)}–${nice(hi, u)} ${u})`);
    if (below(lo) || above(hi)) return grey(`non verificabile — intervallo possibile ${nice(lo, u)}–${nice(hi, u)} ${u}; ${m.reason ?? 'dati parziali'}`);
    return { limit: l, color: 'green', dailyReference, message: `${what}: rispettato in tutto l’intervallo possibile (${nice(lo, u)}–${nice(hi, u)} ${u}). ${m.reason ?? ''}`.trim(), uncertain: m.reason };
  }
  if (m.valueMin === null && m.valueMax === null) return grey(`non verificabile — ${m.reason ?? 'dati mancanti'}`);
  if ((l.basis === 'ratio' || l.basis === 'energy_pct') && !m.complete) {
    return grey(`non verificabile — ${m.reason ?? 'dati incompleti'}${m.valueMax !== null ? ` (con i soli valori noti ${`${nice(m.valueMax, u)} ${u}`.trim()}, non usato per il giudizio)` : ''}`);
  }
  const unknown = names(m.unknownFrom);
  const lowerB = names(m.lowerBoundFrom);
  // massimo: superato dai soli contributi noti = superamento dimostrato
  if (l.upper !== null && m.valueMax !== null && above(m.valueMax)) return failed(m.valueMax, 'superato');
  // minimo
  if (l.lower !== null && m.valueMin !== null && below(m.valueMin)) {
    if (unknown) return grey(`copertura non verificabile — con i dati noti ${nice(m.valueMin, u)} ${u}; dato sconosciuto (non zero) in ${unknown}`);
    return failed(m.valueMin, 'non raggiunto');
  }
  // massimo con apporti ignoti non limitati o valori solo aggiunti
  if (l.upper !== null && (unknown || lowerB)) {
    return grey(
      `massimo non verificabile — con i dati noti ${nice(m.valueMax as number, u)} ${u}; ${[unknown ? `dato sconosciuto in ${unknown}` : '', lowerB ? `${lowerB} dichiara solo quantità aggiunte (totale incerto)` : ''].filter(Boolean).join('; ')}`,
    );
  }
  const noMax = l.limitClass === 'OFFICIAL_MIN' ? ' Massimo non definito: valori elevati non sono automaticamente sicuri.' : '';
  const demonstrated = l.lower !== null && unknown ? `Minimo dimostrato dai dati disponibili (altri apporti sconosciuti in ${unknown}).` : undefined;
  const okResult = soft ? ` Risultato ${nice((m.valueMin ?? m.valueMax) as number, u)} ${u}.` : '';
  return { limit: l, color: 'green', dailyReference, message: `${what}: rispettato.${okResult}${noMax}${demonstrated ? ` ${demonstrated}` : ''}`, uncertain: demonstrated };
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
  const energyCtx = { kcal, kcalTarget: dog.kcalTarget, complete: kcalComplete };
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
  if (input.dietMoisture !== 'dry') {
    warnings.push('Selenio: dieta casalinga, mista, umida o di tipo non indicato → si usa il maggiore dei due minimi FEDIAF (scelta prudenziale del progetto, non un’equivalenza fisiologica).');
  }
  if (dog.eaaMarginPct) {
    warnings.push(`Aminoacidi essenziali: minimi aumentati del ${dog.eaaMarginPct}% perché per questa dieta non è documentata una digeribilità proteica di almeno l’80% (margine indicato da FEDIAF).`);
  } else if (dog.proteinDigestibilityRef) {
    warnings.push(`Digeribilità proteica della dieta ≥ 80% documentata (${dog.proteinDigestibilityRef}): nessun margine sugli aminoacidi essenziali.`);
  }
  // lacune del catalogo segnalate e non ancora risolte con dati documentati (§15): la ricetta non è interamente verificata
  for (const it of items) {
    if (!(it.qty > 0)) continue;
    const p = it.kind === 'food' ? foods[it.id] : supplements[it.id];
    for (const g of p?.openGaps ?? []) blockers.push(`Lacuna del catalogo non risolta — ${p.name}: ${g}`);
  }

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
    const checks = ls.map((l) => evaluate(l, measure(l, t, d, energyCtx, dryMatterG), kcal, dog.kcalTarget, m.unit));
    let color: Color;
    const complete = t ? t.complete && !t.noData : (d?.complete ?? false);
    if (checks.length) color = worst(checks.map((c) => c.color));
    else color = complete ? 'blue' : 'grey';
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
      energyMsg += `. Energia sconosciuta per ${parts.join(', ')}${share !== null ? ` (${fmt(Math.round(share * 10) / 10)}% del peso della razione)` : ''}: totale parziale, la tolleranza energetica non è attestata.`;
      // energia sconosciuta non è zero (§7, §12): totale parziale, nessuna attestazione della tolleranza energetica
      energyColor = 'grey';
      blockers.push(`Energia non determinabile: energia sconosciuta per ${energyUncertainFrom.join(', ')} (totale parziale ${fmt(kcal)} kcal).`);
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
  // Tabella d'impiego del produttore: intervalli consigliati (non limiti tossicologici, non sostituiscono i controlli nutrizionali)
  const doseChecks: DoseCheck[] = [];
  for (const it of items) {
    const s = it.kind === 'supplement' && it.qty > 0 ? supplements[it.id] : undefined;
    if (!s?.doseGuide) continue;
    const r = doseRangeFor(s.doseGuide, dog.weightCurrentKg);
    const u = s.doseUnit;
    if (!r) {
      doseChecks.push({ name: s.name, qty: it.qty, unit: u, range: null, color: 'grey', message: `${s.name}: la tabella d’impiego del produttore copre ${weightSpan(s.doseGuide)}; per il peso attuale di ${fmt(dog.weightCurrentKg)} kg non c’è un intervallo consigliato.` });
      continue;
    }
    const where = `intervallo consigliato dal produttore ${r.text} ${u}/die per il peso attuale di ${fmt(dog.weightCurrentKg)} kg`;
    if (it.qty > r.max + 1e-9) {
      doseChecks.push({ name: s.name, qty: it.qty, unit: u, range: r, color: 'orange', message: `${s.name}: ${fmt(it.qty)} ${u}/die supera la dose massima consigliata (${where}). Serve una valutazione veterinaria.` });
    } else if (it.qty < r.min - 1e-9) {
      doseChecks.push({ name: s.name, qty: it.qty, unit: u, range: r, color: 'orange', message: `${s.name}: ${fmt(it.qty)} ${u}/die è sotto la dose consigliata (${where}).` });
    } else {
      doseChecks.push({ name: s.name, qty: it.qty, unit: u, range: r, color: 'green', message: `${s.name}: ${fmt(it.qty)} ${u}/die entro l’${where}.` });
    }
  }
  for (const d of doseChecks) if (d.color !== 'green') warnings.push(d.message);
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
  // minimi dimostrati dai soli dati disponibili (altri apporti sconosciuti, mai zero)
  const uncertainRows = rows.filter((r) => r.checks.some((c) => c.uncertain));
  if (uncertainRows.length) {
    warnings.push(`Dimostrati dai dati disponibili, con altri apporti sconosciuti: ${uncertainRows.map((r) => r.label).join(', ')}. I valori mancanti o non dichiarati restano sconosciuti, non zero.`);
  }
  // Obiettivi aggiuntivi (es. apporto raccomandato NRC): sezione propria, distinta dai requisiti FEDIAF
  const additional = rows.flatMap((r) =>
    r.checks
      .filter((c) => c.limit.limitClass === 'RECOMMENDED_ALLOWANCE')
      .map((c) => ({ id: c.limit.id, label: `${r.label} — ${c.limit.displayLabel ?? 'apporto raccomandato'}`, metric: r.metric, color: c.color, message: c.message, gap: c.gap, amount: r.complete ? r.amount : null, required: c.limit.lower, unit: r.unit })),
  );
  for (const a of additional) {
    if (a.color === 'orange' && a.gap) {
      warnings.push(`Obiettivo aggiuntivo non raggiunto: ${a.label} — richiesto ${a.gap.requested}, risultato ${nice(a.gap.result, a.gap.unit)} ${a.gap.unit} (mancano ${nice(-a.gap.deviation, a.gap.unit)} ${a.gap.unit}).`);
    } else if (a.color === 'grey') warnings.push(`Obiettivo aggiuntivo non verificabile: ${a.label} — ${a.message}.`);
  }

  // Origine dell'energia: inserita (con fonte) o calcolata, e confronto con i macronutrienti (nessuna rinormalizzazione)
  const energySources: EnergySource[] = [];
  for (const it of items) {
    if (!(it.qty > 0)) continue;
    if (it.kind === 'food') {
      const f = foods[it.id];
      const m = f.energyMethod ?? null;
      const calc = m ? estimateMeFromMacros(f.nutrients, m) : null;
      energySources.push({
        name: f.name, kind: 'food', origin: f.kcalMePer100g === null ? null : (f.kcalMeOrigin ?? 'declared'), kcal: f.kcalMePer100g, basis: 'kcal/100 g',
        fromMacros: calc, methodLabel: m ? m.label : null,
        diffPct: f.kcalMePer100g !== null && calc ? (100 * (f.kcalMePer100g - calc)) / calc : null,
        source: f.kcalMeOrigin === 'calculated' ? null : (f.meMethod ?? f.source ?? null),
      });
    } else {
      const sp = supplements[it.id];
      const m = sp.energyMethod ?? null;
      const calc = m ? estimateMeFromMacros(sp.nutrients, m) : null;
      energySources.push({
        name: sp.name, kind: 'supplement', origin: sp.kcalPerUnit === null ? null : (sp.kcalOrigin ?? 'declared'), kcal: sp.kcalPerUnit, basis: `kcal/${sp.doseUnit}`,
        fromMacros: calc, methodLabel: m ? m.label : null,
        diffPct: sp.kcalPerUnit !== null && calc ? (100 * (sp.kcalPerUnit - calc)) / calc : null,
        source: sp.kcalOrigin === 'calculated' ? null : (sp.labelSource ?? null),
      });
    }
  }
  // ripartizione energetica stimata 4/9/4 (somma 100% per costruzione), separata dalla EM usata per i fabbisogni
  const pcts = ['protein_energy_pct', 'fat_energy_pct', 'carb_energy_pct'].map((k) => totals.derived[k]);
  const macroEnergySumPct = pcts.every((d) => d?.complete && d.value !== null) ? pcts.reduce((a, d) => a + (d!.value as number), 0) : null;
  const differing = energySources.filter((e) => e.origin === 'declared' && e.diffPct !== null && Math.abs(e.diffPct) >= 0.5);
  if (differing.length) {
    warnings.push(
      `Energia inserita diversa da quella stimata dai macronutrienti: ${differing.map((e) => `${e.name} (${fmt(e.kcal as number)} contro ${fmt(e.fromMacros as number)} ${e.basis}, ${(e.diffPct as number) > 0 ? '+' : ''}${fmt(Math.round((e.diffPct as number) * 10) / 10)}%)`).join(', ')}. Per i fabbisogni vale l’energia inserita; la ripartizione 4/9/4 delle quote è una stima separata.`,
    );
  }

  const allChecks = rows.flatMap((r) => r.checks);
  const prefChecks = allChecks.filter((c) => c.limit.limitClass !== 'RECOMMENDED_ALLOWANCE');
  let status: RecipeStatus;
  if (allChecks.some((c) => c.color === 'red')) status = 'FAILS_OFFICIAL_LIMITS';
  else if (blockers.length) status = 'INSUFFICIENT_DATA';
  else if (additional.some((a) => a.color === 'orange')) status = 'TARGETS_NOT_MET';
  else if (prefChecks.some((c) => c.color === 'orange') || energyColor === 'orange' || doseChecks.some((d) => d.color === 'orange')) status = 'PREFERENCES_VIOLATED';
  else status = 'VERIFIED_AVAILABLE_CHECKS';
  const prefsToo = status === 'TARGETS_NOT_MET' && (prefChecks.some((c) => c.color === 'orange') || energyColor === 'orange' || doseChecks.some((d) => d.color === 'orange'));

  // Sintesi richiesta: fabbisogni dimostrabilmente soddisfatti, non soddisfatti, non verificabili (limiti ufficiali e target rigidi)
  const essentialRows = rows.filter((r) => r.checks.some((c) => isEssential(c.limit)));
  const summary = {
    satisfied: essentialRows.filter((r) => r.checks.filter((c) => isEssential(c.limit)).every((c) => c.color === 'green')).map((r) => r.label),
    notMet: essentialRows.filter((r) => r.checks.some((c) => isEssential(c.limit) && c.color === 'red')).map((r) => r.label),
    unverifiable: essentialRows.filter((r) => !r.checks.some((c) => isEssential(c.limit) && c.color === 'red') && r.checks.some((c) => isEssential(c.limit) && c.color === 'grey')).map((r) => r.label),
  };
  const qualifiers = [
    uncertainRows.length ? 'alcuni minimi dimostrati dai soli dati disponibili' : null,
    lowQuality.length ? `con dati di composizione stimati o non convalidati (${lowQuality.join(', ')})` : null,
  ].filter(Boolean);
  return {
    status,
    statusLabel:
      (prefsToo ? `${STATUS_LABEL[status]} né tutte le preferenze` : STATUS_LABEL[status]) +
      (qualifiers.length && (status === 'VERIFIED_AVAILABLE_CHECKS' || status === 'PREFERENCES_VIOLATED' || status === 'TARGETS_NOT_MET') ? ` — ${qualifiers.join('; ')}` : ''),
    summary,
    additional,
    energySources,
    macroEnergySumPct,
    doseChecks,
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
