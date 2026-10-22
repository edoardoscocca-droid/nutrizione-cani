// Verifica v2 (specifiche del 21/10/2026, §4–§6 e precisazioni 3–4).
// Parte dalla verifica indipendente esistente (auditRecipe: stessi totali, stessi dati congelati) e ne riclassifica i
// controlli in due livelli:
//  - A, obbligatorio nella singola razione: energia, proteine, grassi, calcio, fosforo, Ca:P a gradini, tutti i massimi
//    (nutrizionali N e legali L su sostanza secca), dosi degli integratori, alimenti vietati → rosso se violato;
//  - B, monitorato nel tempo: gli altri minimi FEDIAF e gli obiettivi aggiuntivi → verde / giallo / arancione / grigio.
// Le ricette salvate con la verifica precedente restano come sono (la versione v1 non cambia).

import { auditRecipe, EAA, itemDataList, needsBasisConfirmation, type AuditInput, type AuditResult, type CapCheck, type CheckRow, type DoseCheck, type GroupShare, type LegalCheck, type LimitCheck, type RecipeStatus } from './audit';
import { capOf, caPStepOf, DEFAULT_CONFIG, doseRuleOf, groupOf, preparedFactor, weighingStateLabel, type FormulationConfig } from './configV2';
import { doseRangeFor, weightSpan } from './doseGuide';
import { itemValue, type ItemData, type Total } from './totals';
import type { Color, Food, NutrientLimit, Supplement, ValueStatus } from './types';

export interface AuditV2Input extends AuditInput {
  config?: FormulationConfig;
}

/** minimi di livello A: definiscono la formulazione e hanno dati affidabili (§4). */
export const A_MINIMA = new Set(['protein', 'fat', 'calcium', 'phosphorus']);

export const STATUS_LABEL_V2: Record<RecipeStatus, string> = {
  VERIFIED_AVAILABLE_CHECKS: 'Verificata rispetto ai controlli disponibili',
  PREFERENCES_VIOLATED: 'Verificata con avvisi',
  TARGETS_NOT_MET: 'Verificata con avvisi',
  INSUFFICIENT_DATA: 'Controlli obbligatori non tutti verificabili: dati mancanti',
  FAILS_OFFICIAL_LIMITS: 'Non rispetta limiti ufficiali',
  NO_VALID_SOLUTION: 'Nessuna soluzione valida',
};

export const LEVEL_CRITERION =
  'Livello A, obbligatorio in ogni razione: tutti i massimi, le dosi degli integratori, gli alimenti vietati, l’energia, proteine, grassi, calcio, fosforo e Ca:P (un solo pasto sbagliato può già causare danno o squilibrio). ' +
  'Livello B, monitorato nel tempo: gli altri minimi, la cui carenza non ha effetto con una sola razione e i cui dati sono spesso incompleti; nella ricetta è un avviso, nel diario l’esito sul periodo. ' +
  'I minimi FEDIAF sono definiti per un alimento completo dato come dieta unica: il monitoraggio nel tempo è una scelta operativa dell’app, non un’equivalenza scientifica validata. L’app non dichiara mai una «dieta completa».';

const EPS = 1e-6;
const fmt = (n: number, d = 3) => n.toLocaleString('it-IT', { maximumFractionDigits: d });
const nice = (v: number) => fmt(Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 1000);
const names = (xs: string[]) => [...new Set(xs)].join(', ');
const RANK: Record<Color, number> = { red: 6, grey: 5, orange: 4, yellow: 3, green: 2, blue: 1, purple: 0 };
const worst = (cs: Color[]) => cs.reduce<Color>((a, c) => (RANK[c] > RANK[a] ? c : a), 'blue');
const DOCUMENTED: ValueStatus[] = ['measured', 'label', 'calculated', 'analytical_zero'];
const MASS_FACTOR: Record<string, number> = { g: 1, mg: 1000, µg: 1e6 };

/** stato di un valore (con le stesse regole di vitamina A e valori composti del calcolo dei totali). */
function statusOf(values: Record<string, { value: number | null; status?: ValueStatus } | undefined>, id: string): 'documented' | 'estimated' | null {
  const st = (k: string) => (values[k]?.value === null || values[k]?.value === undefined ? null : (values[k]?.status ?? 'measured'));
  const parts: (ValueStatus | null)[] =
    id === 'vitamin_a'
      ? [st('vitamin_a') ?? st('vitamin_a_retinol_ug'), st('beta_carotene_ug')]
      : st(id) !== null
        ? [st(id)]
        : id === 'epa_dha'
          ? [st('epa'), st('dha')]
          : id === 'methionine_cystine'
            ? [st('methionine'), st('cystine')]
            : id === 'phenylalanine_tyrosine'
              ? [st('phenylalanine'), st('tyrosine')]
              : [];
  const known = parts.filter((p): p is ValueStatus => p !== null);
  if (!known.length) return null;
  return known.some((p) => p === 'estimated' || !DOCUMENTED.includes(p)) ? 'estimated' : 'documented';
}

export function auditRecipeV2(input: AuditV2Input): AuditResult {
  const cfg = input.config ?? DEFAULT_CONFIG;
  const base = auditRecipe({ ...input, settings: { ...input.settings, energyTolerancePct: cfg.energyTolerancePct } });
  const { items, foods, supplements, dog, nutrients } = input;
  const active = items.filter((it) => it.qty > 0);
  const product = (kind: 'food' | 'supplement', id: string): Food | Supplement => (kind === 'food' ? foods[id] : supplements[id]);
  const data: ItemData[] = itemDataList(active, foods, supplements);
  const nutrient = new Map(nutrients.map((n) => [n.id, n]));
  const totals = base.totals;
  const kcal = base.kcal; // energia nota della razione (parziale se un integratore ha energia sconosciuta)
  const minimaKcal = base.minimaBasis?.kcal ?? null;

  // ── componenti con valori stimati (§6: usati come i documentati, sempre segnati come stima) ──
  const estimatedFor = (metric: string) => {
    let amount = 0;
    const from: string[] = [];
    for (const d of data) {
      const v = itemValue(d, metric);
      if (v === null) continue;
      if (statusOf(product(d.kind, d.item.id).nutrients, metric) === 'estimated') {
        amount += v * d.item.qty;
        from.push(d.name);
      }
    }
    return { amount, from };
  };

  // ── parte non dichiarata di un integratore limitata dalla massa della dose non attribuita ai macronutrienti ──
  // (solo per minerali e aminoacidi, che non possono stare dentro la frazione grassa; vitamine e acidi grassi no)
  // withAdded: anche la parte di base (non dichiarata) di un valore dichiarato solo come «aggiunto»
  const residualBound = (metric: string, withAdded = false) => {
    const n = nutrient.get(metric);
    const factor = n ? MASS_FACTOR[n.unit] : undefined;
    const boundable = !!n && factor !== undefined && (n.group === 'minerals' || n.group === 'essential_amino_acids');
    let bound = 0;
    const unbounded: string[] = [];
    const bounded: string[] = [];
    for (const d of data) {
      const addedOnly = withAdded && d.kind === 'supplement' && itemValue(d, metric) !== null && !!d.lowerBound?.(metric);
      if (d.kind !== 'supplement' || (itemValue(d, metric) !== null && !addedOnly)) continue;
      if (!boundable || d.macroResidual === null || d.macroResidual === undefined) unbounded.push(d.name);
      else {
        bound += d.macroResidual * d.item.qty * (factor as number);
        bounded.push(`${d.name} ≤ ${nice(d.macroResidual * d.item.qty * (factor as number))} ${n!.unit}`);
      }
    }
    return { bound, unbounded, bounded };
  };

  // ── peso e sostanza secca (§4: denominatore = Σ massa × (1 − umidità); umidità mancante → ipotesi prudente) ──
  let totalWeight = 0;
  let dmLow = 0;
  let dmHigh = 0;
  let massUnknown = false;
  const moistureMissing: string[] = [];
  const massOf = (kind: 'food' | 'supplement', id: string, qty: number): number | null => {
    if (kind === 'food') return qty;
    const s = supplements[id];
    if (s.doseUnit === 'g') return qty;
    return s.massPerUnitG === null ? null : s.massPerUnitG * qty;
  };
  for (const it of active) {
    const p = product(it.kind, it.id);
    const mass = massOf(it.kind, it.id, it.qty);
    if (mass === null) {
      massUnknown = true;
      moistureMissing.push(`${p.name} (massa della dose)`);
      continue;
    }
    totalWeight += mass;
    const m = p.nutrients.moisture?.value;
    if (m === null || m === undefined) {
      moistureMissing.push(p.name);
      dmHigh += mass;
      continue;
    }
    // alimenti: g per 100 g; integratori: g per unità di dose
    const water = it.kind === 'food' ? (mass * m) / 100 : it.qty * m;
    dmLow += Math.max(0, mass - water);
    dmHigh += Math.max(0, mass - water);
  }

  // ── Ca:P con le parti non dichiarate limitate (intervallo dimostrabile) ──
  const caPRange = (): { lo: number; hi: number } | { reason: string } => {
    const ca = totals.nutrients.calcium;
    const p = totals.nutrients.phosphorus;
    if (!ca || !p) return { reason: 'calcio o fosforo non nel dizionario' };
    if (ca.missingFrom.length || p.missingFrom.length) return { reason: `dato mancante per ${names([...ca.missingFrom, ...p.missingFrom])}` };
    if (ca.lowerBoundFrom.length || p.lowerBoundFrom.length) return { reason: `${names([...ca.lowerBoundFrom, ...p.lowerBoundFrom])} dichiara solo quantità aggiunte (totale incerto)` };
    const bc = residualBound('calcium');
    const bp = residualBound('phosphorus');
    if (bc.unbounded.length || bp.unbounded.length) return { reason: `${names([...bc.unbounded, ...bp.unbounded])} non dichiara calcio o fosforo` };
    if (!(p.known > 0)) return { reason: 'fosforo zero: rapporto non definito' };
    return { lo: ca.known / (p.known + bp.bound), hi: (ca.known + bc.bound) / p.known };
  };
  const caP = caPRange();
  let caPStep: 1 | 2 | 3 | null = null;

  const unitText = (unit: string, basis: string) => `${unit === 'ratio' ? '' : unit}${basis === 'per_1000_kcal_me' ? '/1000 kcal' : basis === 'per_day' ? '/die' : ''}`.trim();

  // ── livello B: minimi e obiettivi aggiuntivi (§4, precisazione 3) ──
  const levelB = (c: LimitCheck, t: Total | undefined, metric: string): LimitCheck => {
    const l = c.limit;
    const target = l.lower as number;
    const perDay = l.basis === 'per_day';
    const u = unitText(nutrient.get(metric)?.unit ?? l.unit, l.basis);
    const eaa = EAA.has(metric) && !!dog.eaaMarginPct && l.limitClass === 'OFFICIAL_MIN';
    const baseMin = eaa ? target / (1 + (dog.eaaMarginPct as number) / 100) : target;
    const kind = l.limitClass === 'RECOMMENDED_ALLOWANCE' ? (l.displayLabel ?? 'apporto raccomandato') : 'minimo FEDIAF';
    const what = `${kind}, livello B (${eaa ? `min ${fmt(baseMin)} + ${dog.eaaMarginPct}% = ${fmt(target)}` : `min ${fmt(target)}`} ${u})`;
    const mk = (color: Color, msg: string, val?: number): LimitCheck => ({
      ...c,
      level: 'B',
      color,
      message: `${what}: ${msg}`,
      gap: val !== undefined && color !== 'green' ? { requested: `almeno ${fmt(target)} ${u}`, result: val, deviation: val - target, unit: u } : undefined,
      uncertain: undefined,
    });
    if (!t || t.noData) return mk('grey', `minimo non dimostrato: nessun dato${t ? ` (manca per ${names([...t.missingFrom, ...t.undeclaredFrom])})` : ''}`);
    if (!perDay && !minimaKcal) return mk('grey', 'energia della razione non calcolabile: concentrazione per 1000 kcal non determinabile');
    const scale = perDay ? 1 : 1000 / (minimaKcal as number);
    const val = t.known * scale;
    const est = estimatedFor(metric);
    const documented = (t.known - est.amount) * scale;
    const unknown = [...t.missingFrom, ...t.undeclaredFrom];
    const pct = (100 * val) / baseMin;
    // sotto il minimo non si arrotonda mai a 100%
    const pctText = `${fmt(val >= target * (1 - EPS) ? Math.round(pct) : Math.floor(pct * 10) / 10)}% del minimo`;
    if (val >= target * (1 - EPS)) {
      if (documented >= target * (1 - EPS)) return mk('green', `coperto dai contributi noti (${nice(val)} ${u}, ${pctText})${unknown.length ? `; altri apporti sconosciuti in ${names(unknown)}` : ''}.`);
      return mk('yellow', `raggiunto (${nice(val)} ${u}) contando valori stimati con fonte di ${names(est.from)}: segnato come stima.`, val);
    }
    if (eaa && val >= baseMin * (1 - EPS)) return mk('yellow', `${nice(val)} ${u}: tra il minimo e il minimo +${dog.eaaMarginPct}% — prudenza, la digeribilità proteica della dieta non è documentata.`, val);
    if (unknown.length) return mk('grey', `minimo non dimostrato: noto ${pctText} (${nice(val)} ${u}); manca il dato per: ${names(unknown)}. Non trattato come zero e non compensato.`, val);
    if (!eaa && pct >= cfg.yellowFromPct) return mk('yellow', `noto ${pctText} (${nice(val)} ${u}), tra il ${cfg.yellowFromPct}% e il 100%: sotto riferimento in questo menù.`, val);
    return mk('orange', `sotto riferimento in questo menù: ${pctText} (${nice(val)} ${u}), dati tutti noti.`, val);
  };

  // ── livello A: massimi con parti non dichiarate limitate dalla massa della dose ──
  const refineMax = (c: LimitCheck, t: Total | undefined, metric: string): LimitCheck => {
    const l = c.limit;
    if (c.color !== 'grey' || l.upper === null || !t || t.missingFrom.length || t.lowerBoundFrom.length || !t.undeclaredFrom.length) return c;
    const rb = residualBound(metric);
    if (rb.unbounded.length) return c;
    const scale = l.basis === 'per_1000_kcal_me' ? (kcal ? 1000 / kcal : null) : l.basis === 'per_day' ? 1 : null;
    if (scale === null) return c;
    const upper = (t.known + rb.bound) * scale;
    if (upper > l.upper * (1 + EPS)) return c;
    return { ...c, color: 'green', message: `${c.message.split(':')[0]}: rispettato anche contando la parte non dichiarata, limitata dalla massa della dose (${rb.bounded.join('; ')}): al più ${nice(upper)}.` };
  };

  const caPRatioCheck = (c: LimitCheck): LimitCheck => {
    if (!('lo' in caP)) return { ...c, level: 'A' };
    const { lo, hi } = caP;
    const l = c.limit;
    const range = Math.abs(hi - lo) < 1e-9 ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
    if (l.lower !== null) {
      if (hi < l.lower * (1 - EPS)) return { ...c, level: 'A', color: 'red', message: `Ca:P minimo FEDIAF ${fmt(l.lower)}: non raggiunto (${range})` };
      if (lo >= l.lower * (1 - EPS)) return { ...c, level: 'A', color: 'green', message: `Ca:P minimo FEDIAF ${fmt(l.lower)}: rispettato (${range})` };
    } else if (l.upper !== null) {
      if (lo > l.upper * (1 + EPS)) return { ...c, level: 'A', color: 'red', message: `Ca:P massimo FEDIAF ${fmt(l.upper)}: superato (${range})` };
      if (hi <= l.upper * (1 + EPS)) return { ...c, level: 'A', color: 'green', message: `Ca:P massimo FEDIAF ${fmt(l.upper)}: rispettato (${range})` };
    }
    return { ...c, level: 'A', color: 'grey', message: `Ca:P: non verificabile — intervallo possibile ${range}` };
  };

  const caPStepCheck = (c: LimitCheck): LimitCheck => {
    if (!('lo' in caP)) return { ...c, level: 'A', color: 'grey', message: `Ca:P a gradini: non verificabile — ${caP.reason}` };
    const s1 = caPStepOf(caP.lo, cfg);
    const s2 = caPStepOf(caP.hi, cfg);
    const range = Math.abs(caP.hi - caP.lo) < 1e-9 ? fmt(caP.lo) : `${fmt(caP.lo)}–${fmt(caP.hi)}`;
    if (!s1 || !s2) return { ...c, level: 'A', color: 'red', message: `Ca:P ${range}: fuori dal limite non sforabile 1–2` };
    const step = s1.step >= s2.step ? s1 : s2;
    caPStep = step.step;
    return { ...c, level: 'A', color: step.color, message: `Ca:P ${range}: ${step.label}` };
  };

  // ── riclassificazione dei controlli esistenti ──
  const rows: CheckRow[] = base.rows.map((r) => {
    const t = totals.nutrients[r.metric];
    const checks = r.checks.map((c): LimitCheck => {
      const l = c.limit;
      switch (l.limitClass) {
        case 'INFORMATIONAL_REFERENCE':
          return { ...c, level: 'info' };
        case 'NON_OFFICIAL_ATTENTION':
          if (r.metric === 'ca_p_ratio') return caPStepCheck(c);
          return { ...c, level: 'info', color: 'blue', message: `Solo informativo nella formulazione v2 — ${c.message}` };
        case 'PERSONAL_TARGET':
          if (l.hardness === 'hard') return { ...c, level: 'A', color: c.color === 'orange' ? 'red' : c.color };
          return { ...c, level: 'info', color: 'blue', message: `Preferenza solo informativa (non guida la formulazione v2) — ${c.message}` };
        case 'RECOMMENDED_ALLOWANCE':
          return levelB(c, t, r.metric);
        case 'OFFICIAL_MIN':
          if (l.basis === 'ratio') return caPRatioCheck(c);
          if (A_MINIMA.has(r.metric)) return { ...c, level: 'A' };
          return levelB(c, t, r.metric);
        case 'OFFICIAL_NUTRITIONAL_MAX':
          if (l.basis === 'ratio') return caPRatioCheck(c);
          return { ...refineMax(c, t, r.metric), level: 'A' };
        default:
          return { ...c, level: 'A' };
      }
    });
    return { ...r, checks };
  });

  // ── limiti legali su sostanza secca, solo per i nutrienti aggiunti come additivo (§4, precisazione 4) ──
  const legal: LegalCheck[] = [];
  for (const ll of cfg.legalLimits) {
    const added = active.filter((it) => it.kind === 'supplement' && supplements[it.id]?.nutrients[ll.metric]?.declared === 'added' && (supplements[it.id].nutrients[ll.metric].value ?? 0) > 0);
    const row = rows.find((r) => r.metric === ll.metric);
    const t = totals.nutrients[ll.metric];
    if (!added.length || !row || !t) continue;
    const label = nutrient.get(ll.metric)?.label ?? ll.metric;
    const u = `${ll.unit}/100 g di sostanza secca`;
    const knownLow = dmHigh > 0 && !massUnknown ? (t.known / dmHigh) * 100 : null;
    const prudent = dmLow > 0 ? (t.known / dmLow) * 100 : null;
    // numeratore: contributi noti + parti non dichiarate limitate dalla massa della dose (anche la base di un additivo)
    const rb = residualBound(ll.metric, true);
    const numComplete = !t.missingFrom.length && !rb.unbounded.length;
    const numUpper = numComplete ? t.known + rb.bound : null;
    const head = `Massimo legale L (additivi, FEDIAF tab. III-3a) ${fmt(ll.upper)} ${u}`;
    let color: Color;
    let msg: string;
    if (knownLow !== null && knownLow > ll.upper * (1 + EPS)) {
      color = 'red';
      msg = `superato dai soli contributi noti: ${nice(knownLow)} ${u}`;
    } else if (numUpper !== null && dmLow > 0 && (numUpper / dmLow) * 100 <= ll.upper * (1 + EPS)) {
      color = 'green';
      msg = `rispettato: ${nice((numUpper / dmLow) * 100)} ${u}${moistureMissing.length ? ` (calcolato con ipotesi prudente: umidità mancante per ${names(moistureMissing)}, contata come sostanza secca zero)` : ''}`;
    } else if (numUpper !== null) {
      color = 'grey';
      const parts = rb.bounded.length ? `la parte non dichiarata (${t.lowerBoundFrom.length ? `${names(t.lowerBoundFrom)} dichiara solo la quantità aggiunta; ` : ''}limite dalla massa della dose: ${rb.bounded.join('; ')}) potrebbe superarlo` : '';
      msg = `non verificabile — ${[moistureMissing.length && (numUpper / Math.max(dmHigh, 1e-9)) * 100 <= ll.upper ? `umidità mancante per ${names(moistureMissing)}` : '', parts].filter(Boolean).join('; ') || `umidità mancante per ${names(moistureMissing)}`}${prudent !== null ? `; con i soli contributi noti ${nice(prudent)} ${u}` : ''}`;
    } else {
      color = 'grey';
      const why = [
        t.lowerBoundFrom.length ? `${names(t.lowerBoundFrom)} dichiara solo la quantità aggiunta (il totale del prodotto è incerto)` : '',
        t.missingFrom.length ? `dato mancante per ${names(t.missingFrom)}` : '',
        rb.unbounded.length ? `${names(rb.unbounded)} non dichiara il nutriente` : '',
      ].filter(Boolean);
      msg = `massimo non verificabile — ${why.join('; ')}${prudent !== null ? `; con i soli contributi noti ${nice(prudent)} ${u}` : ''}`;
    }
    legal.push({ metric: ll.metric, label, limit: ll.upper, unit: ll.unit, value: prudent, color, message: `${head}: ${msg}` });
    const limit: NutrientLimit = {
      id: `legal_${ll.metric}`, referenceVersionId: 'FEDIAF_2025_III-3a', metric: ll.metric, lifeStage: dog.lifeStage, lower: null, upper: ll.upper, unit: ll.unit,
      basis: 'per_100g_dry_matter', limitClass: 'LEGAL_MAX', hardness: 'hard', severity: 'red', source: cfg.legalSource, status: 'verified',
    };
    row.checks.push({ limit, color, dailyReference: null, message: `${head}: ${msg}`, level: 'A' });
  }

  // ── colori, livello, stime e «nessun limite applicabile» per riga ──
  for (const r of rows) {
    if (r.checks.length) r.color = worst(r.checks.map((c) => c.color));
    r.level = r.checks.some((c) => c.level === 'A') ? 'A' : r.checks.some((c) => c.level === 'B') ? 'B' : r.checks.length ? 'info' : undefined;
    const est = estimatedFor(r.metric).from;
    if (est.length) r.estimatedFrom = est;
    const hasMax = r.checks.some((c) => c.limit.upper !== null && c.level === 'A');
    if (r.checks.length && !hasMax && r.metric !== 'ca_p_ratio') {
      const isLegal = cfg.legalLimits.some((x) => x.metric === r.metric);
      r.noLimitNote = `Nessun limite FEDIAF applicabile${isLegal ? ' (il nutriente non è aggiunto come additivo da un integratore di questa ricetta, quindi il massimo legale non si applica)' : ''}: non significa che qualsiasi quantità sia sicura.`;
    }
  }

  // ── energia (livello A, ±tolleranza della configurazione) ──
  const energyRow: CheckRow = { ...base.energyRow, level: 'A' };
  if (energyRow.color === 'orange') energyRow.color = 'red';
  energyRow.note = `${energyRow.note ?? ''}${energyRow.color === 'red' ? ' — fuori dalla tolleranza (livello A).' : ''}`;

  // ── dosi degli integratori (§5) ──
  const doseChecks: DoseCheck[] = [];
  const doseOver: string[] = [];
  const doseSteps: NonNullable<AuditResult['v2']>['doseSteps'] = [];
  for (const it of active) {
    if (it.kind !== 'supplement') continue;
    const s = supplements[it.id];
    const u = s.doseUnit;
    const rule = doseRuleOf(s.id, cfg);
    const r = s.doseGuide ? doseRangeFor(s.doseGuide, dog.weightCurrentKg, { extrapolate: !!rule?.extrapolate }) : null;
    const per = (q: number) => (dog.weightCurrentKg > 0 && u === 'g' ? ` (${fmt(q / dog.weightCurrentKg, 3)} g/kg)` : '');
    if (r) {
      const max2 = rule ? r.max * (1 + rule.marginPct / 100) : r.max;
      const over = (100 * (it.qty - r.max)) / r.max;
      const where = `${r.text} ${u}/die per il peso attuale di ${fmt(dog.weightCurrentKg)} kg`;
      if (it.qty <= r.max + 1e-9) {
        const low = it.qty < r.min - 1e-9;
        doseChecks.push({
          name: s.name, qty: it.qty, unit: u, range: r, color: r.extrapolated || low ? 'yellow' : 'green',
          message: `${s.name}: ${fmt(it.qty)} ${u}/die${per(it.qty)} entro il massimo (${where})${r.extrapolated ? ' — estrapolato, non indicato dal produttore' : ''}${low ? '; sotto la dose minima consigliata' : ''}.`,
        });
        doseSteps.push({ name: s.name, step: 1, extrapolated: !!r.extrapolated });
      } else if (rule && it.qty <= max2 + 1e-9) {
        doseChecks.push({ name: s.name, qty: it.qty, unit: u, range: r, color: 'yellow', message: `${s.name}: ${fmt(it.qty)} ${u}/die${per(it.qty)} supera di poco l’indicazione del produttore (+${fmt(Math.round(over * 10) / 10)}%, gradino 2 fino a +${rule.marginPct}%; ${where}). Scelta operativa dell’utente, non un margine di sicurezza dimostrato.` });
        doseSteps.push({ name: s.name, step: 2, extrapolated: !!r.extrapolated });
      } else {
        // dose del produttore e margine operativo sono cose distinte dai limiti nutrizionali e legali dei nutrienti
        const overText = `+${fmt(Math.round(over * 10) / 10)}%`;
        doseOver.push(`${s.name} ${fmt(it.qty)} ${u}/die${per(it.qty)}: ${overText} sul massimo indicato dal produttore (${fmt(r.max)} ${u}/die${r.extrapolated ? ', estrapolato' : ''}); margine operativo configurato per il generatore ${rule ? `+${rule.marginPct}%, superato anch’esso` : 'nessuno per questo prodotto'}`);
        doseChecks.push({
          name: s.name, qty: it.qty, unit: u, range: r, color: 'red',
          message: `${s.name}: ${fmt(it.qty)} ${u}/die${per(it.qty)} supera la dose massima indicata dal produttore di ${overText} (${where})${rule ? ` e il margine operativo configurato (+${rule.marginPct}%)` : ''}. È l’indicazione d’uso del produttore, non un limite nutrizionale e non una prova di tossicità: i limiti dei singoli nutrienti si controllano a parte. Serve una valutazione veterinaria.`,
        });
        doseSteps.push({ name: s.name, step: null, extrapolated: !!r.extrapolated });
      }
    } else if (s.maxDailyUnits !== null && s.maxDailySource) {
      const ok = it.qty <= s.maxDailyUnits + 1e-9;
      doseChecks.push({ name: s.name, qty: it.qty, unit: u, range: null, color: ok ? 'green' : 'red', message: `${s.name}: ${fmt(it.qty)} ${u}/die ${ok ? 'entro' : 'oltre'} la dose massima del catalogo (${fmt(s.maxDailyUnits)} ${u}/die, ${s.maxDailySource}).` });
    } else {
      doseChecks.push({
        name: s.name, qty: it.qty, unit: u, range: null, color: 'blue',
        message: s.doseGuide ? `${s.name}: la tabella d’impiego copre ${weightSpan(s.doseGuide)}; per ${fmt(dog.weightCurrentKg)} kg dose non indicata dal produttore.` : `${s.name}: dose non indicata dal produttore.`,
      });
    }
  }

  // ── alimenti vietati (livello A) ──
  const forbidden = active.filter((it) => it.kind === 'food' && foods[it.id]?.forbidden).map((it) => foods[it.id].name);

  // ── gruppi del pasto e tetti di quantità ([PROPOSTA], §3) ──
  const foodKcal = (it: { id: string; qty: number }) => ((foods[it.id].kcalMePer100g ?? 0) / 100) * it.qty;
  const groups: GroupShare[] = cfg.groups.map((g) => {
    const its = active.filter((it) => it.kind === 'food' && groupOf(foods[it.id], cfg)?.id === g.id);
    const k = its.reduce((a, it) => a + foodKcal(it), 0);
    const pct = kcal ? (100 * k) / kcal : null;
    const grams = its.reduce((a, it) => a + it.qty, 0);
    const inRange = pct !== null && pct >= g.minPctKcal - 1e-6 && pct <= g.maxPctKcal + 1e-6;
    const color: Color = !its.length && g.minPctKcal > 0 ? 'yellow' : pct === null ? 'grey' : inRange ? 'green' : 'yellow';
    const range = g.minIsPreference ? `${g.minPctKcal}% preferito, al più ${g.maxPctKcal}%` : `intervallo proposto ${g.minPctKcal}–${g.maxPctKcal}%`;
    const belowPref = g.minIsPreference && pct !== null && pct < g.minPctKcal - 1e-6;
    const message = !its.length
      ? g.minPctKcal > 0 ? `${g.label}: nessun alimento del gruppo (${range} delle kcal${g.minIsPreference ? '; preferenza, non vincolo' : ''}).` : `${g.label}: nessuno.`
      : `${g.label}: ${fmt(Math.round(grams))} g come pesati, ${fmt(Math.round(k))} kcal${pct !== null ? ` = ${fmt((belowPref ? Math.floor(pct * 100) : Math.round(pct * 100)) / 100)}%` : ''} (${range})${inRange ? '' : belowPref ? ' — sotto la preferenza (non è un vincolo)' : ' — fuori dall’intervallo'}.`;
    return { id: g.id, label: g.label, kcal: k, pct, grams, foods: its.map((it) => foods[it.id].name), range: [g.minPctKcal, g.maxPctKcal], color, message };
  });
  // tetti in % del peso: sul peso degli ALIMENTI della razione pronta (senza acqua aggiunta né integratori); per cereali,
  // tuberi e legumi pesati crudi o secchi serve la resa documentata, altrimenti il controllo non è determinabile
  const activeFoods = active.filter((it) => it.kind === 'food');
  const weighedFoods = activeFoods.reduce((a, it) => a + it.qty, 0);
  const yieldMissing = activeFoods.filter((it) => preparedFactor(foods[it.id], cfg) === null).map((it) => `${foods[it.id].name} (${weighingStateLabel(foods[it.id])})`);
  const preparedFoods = yieldMissing.length ? null : activeFoods.reduce((a, it) => a + it.qty * (preparedFactor(foods[it.id], cfg) as number), 0);
  const caps: CapCheck[] = [];
  let capUndetermined = false;
  for (const it of active) {
    if (it.kind !== 'food') continue;
    const f = foods[it.id];
    const cap = capOf(f, cfg);
    const parts: string[] = [];
    let over = false;
    if (cap.maxFreshWeightPct !== null && weighedFoods > 0) {
      const self = it.qty * (preparedFactor(f, cfg) ?? 1);
      if (preparedFoods !== null) {
        const v = (100 * self) / preparedFoods;
        over ||= v > cap.maxFreshWeightPct + 1e-6;
        parts.push(`${fmt(Math.round(v * 10) / 10)}% del peso degli alimenti della razione pronta (tetto ${cap.maxFreshWeightPct}%; ${weighingStateLabel(f)})`);
      } else {
        capUndetermined = true;
        const v = (100 * self) / weighedFoods;
        parts.push(`tetto del ${cap.maxFreshWeightPct}% non verificabile: manca la resa di cottura documentata per ${names(yieldMissing)}; sul peso come pesato sarebbe ${fmt(Math.round(v * 10) / 10)}%`);
      }
    }
    if (cap.maxPctKcal !== null && kcal) {
      const v = (100 * foodKcal(it)) / kcal;
      over ||= v > cap.maxPctKcal + 1e-6;
      parts.push(`${fmt(Math.round(v * 10) / 10)}% delle kcal (tetto ${cap.maxPctKcal}%)`);
    }
    if (cap.maxGPer1000Kcal !== null && kcal) {
      const v = (it.qty * 1000) / kcal;
      over ||= v > cap.maxGPer1000Kcal + 1e-6;
      parts.push(`${fmt(Math.round(v))} g per 1000 kcal (tetto ${cap.maxGPer1000Kcal})`);
    }
    if (parts.length) caps.push({ name: f.name, color: over ? 'yellow' : capUndetermined && cap.maxFreshWeightPct !== null ? 'grey' : 'green', message: `${f.name}: ${parts.join(', ')}${over ? ' — oltre il tetto' : ''}.` });
  }

  // ── blocchi, avvisi e stato ──
  const aChecks = rows.flatMap((r) => r.checks.filter((c) => c.level === 'A').map((c) => ({ r, c })));
  const bChecks = rows.flatMap((r) => r.checks.filter((c) => c.level === 'B').map((c) => ({ r, c })));
  const aGreyRows = [...new Set(aChecks.filter((x) => x.c.color === 'grey').map((x) => x.r.label))];
  const blockers: string[] = [];
  for (const e of input.excluded ?? []) blockers.push(`${e.name} escluso dal calcolo: ${e.reason}`);
  if (dog.lifeStage !== 'adult_maintenance') blockers.push('Standard disponibile solo per cane adulto in mantenimento: per questa fase di vita la ricetta non è verificabile.');
  if (!base.kcalComplete) blockers.push(`Energia incompleta: kcal mancanti per ${totals.energy.missingFrom.join(', ')}.`);
  if (base.dataQuality?.unknownEnergy.length) blockers.push(`Energia non determinabile: energia sconosciuta per ${base.dataQuality.unknownEnergy.join(', ')}.`);
  if (!dog.kcalTarget) blockers.push('Obiettivo kcal non impostato.');
  for (const it of active) if (it.kind === 'supplement' && needsBasisConfirmation(supplements[it.id])) blockers.push(`${supplements[it.id].name}: base quantitativa degli additivi da confermare.`);
  if (aGreyRows.length) blockers.push(`Controlli obbligatori (livello A) non verificabili per dati mancanti: ${aGreyRows.join(', ')}.`);
  if (forbidden.length) blockers.push(`Alimento vietato presente: ${forbidden.join(', ')}.`);

  const oldDose = new Set((base.doseChecks ?? []).map((d) => d.message));
  const warnings = base.warnings.filter((w) => !oldDose.has(w) && !w.startsWith('Obiettivo aggiuntivo') && !w.startsWith('Dati troppo incompleti'));
  for (const it of active) {
    const p = product(it.kind, it.id);
    for (const g of p.openGaps ?? []) warnings.push(`Lacuna del catalogo — ${p.name}: ${g}`);
    if (it.kind === 'food') {
      const f = foods[it.id];
      if (f.preparationWarning) warnings.push(`${f.name}: ${f.preparationWarning}`);
      for (const w of cfg.categoryWarnings) if (w.subcategory === f.subcategoryId) warnings.push(`${f.name}: ${w.text}`);
    }
  }
  for (const d of doseChecks) if (d.color !== 'green' && d.color !== 'blue') warnings.push(d.message);

  const energyBad = energyRow.color === 'red';
  const aRed = aChecks.some((x) => x.c.color === 'red') || doseChecks.some((d) => d.color === 'red') || forbidden.length > 0 || energyBad;
  const additional = (base.additional ?? []).map((a) => {
    const c = rows.find((r) => r.metric === a.metric)?.checks.find((x) => x.limit.id === a.id);
    return c ? { ...a, color: c.color, message: c.message, gap: c.gap } : a;
  });
  const bIssue =
    bChecks.some((x) => x.c.color !== 'green') ||
    doseChecks.some((d) => d.color === 'yellow') ||
    aChecks.some((x) => x.c.color === 'yellow') ||
    groups.some((g) => g.color !== 'green' && !(g.foods.length === 0 && g.range[0] === 0)) ||
    caps.some((c) => c.color !== 'green');
  const status: RecipeStatus = aRed ? 'FAILS_OFFICIAL_LIMITS' : blockers.length ? 'INSUFFICIENT_DATA' : bIssue ? 'PREFERENCES_VIOLATED' : 'VERIFIED_AVAILABLE_CHECKS';
  // il superamento della dose del produttore si descrive per quello che è, non come «limite ufficiale»
  const nutrientRed = aChecks.some((x) => x.c.color === 'red') || forbidden.length > 0 || energyBad;
  const doseText = doseOver.length ? `Dose oltre l’indicazione del produttore — ${doseOver.join('; ')}. Non è un limite nutrizionale né una prova di tossicità: serve una valutazione veterinaria.` : '';
  const statusLabel = status === 'FAILS_OFFICIAL_LIMITS' && !nutrientRed && doseText ? doseText : STATUS_LABEL_V2[status] + (status === 'FAILS_OFFICIAL_LIMITS' && doseText ? `; inoltre: ${doseText}` : '');

  // ── riepilogo per l'utente ──
  const below = [
    ...aChecks.filter((x) => x.c.color === 'red' && x.c.limit.lower !== null).map((x) => `${x.r.label} (livello A): ${x.c.message}`),
    // solo ciò che è davvero sotto il riferimento (un giallo «raggiunto con stime» va tra le stime)
    ...bChecks.filter((x) => (x.c.color === 'orange' || x.c.color === 'yellow') && !!x.c.gap && x.c.gap.deviation < 0).map((x) => `${x.r.label}: ${x.c.message}`),
  ];
  const excess = [
    ...aChecks.filter((x) => x.c.color === 'red' && x.c.limit.upper !== null).map((x) => `${x.r.label}: ${x.c.message}`),
    ...doseChecks.filter((d) => d.color === 'red' || d.color === 'yellow').map((d) => d.message),
    ...(energyBad ? [`Energia: ${energyRow.note}`] : []),
    ...forbidden.map((f) => `Alimento vietato: ${f}`),
  ];
  const unknown = [...aChecks, ...bChecks].filter((x) => x.c.color === 'grey').map((x) => `${x.r.label}${x.c.level === 'A' ? ' (livello A)' : ''}: ${x.c.message}`);
  const estimated = rows.filter((r) => r.estimatedFrom?.length && r.checks.some((c) => c.level === 'A' || c.level === 'B')).map((r) => `${r.label}: stima con fonte per ${names(r.estimatedFrom!)}`);

  const essential = rows.filter((r) => r.checks.some((c) => c.level === 'A'));
  const summary = {
    satisfied: essential.filter((r) => r.checks.filter((c) => c.level === 'A').every((c) => c.color === 'green' || c.color === 'yellow')).map((r) => r.label),
    notMet: essential.filter((r) => r.checks.some((c) => c.level === 'A' && c.color === 'red')).map((r) => r.label),
    unverifiable: essential.filter((r) => !r.checks.some((c) => c.level === 'A' && c.color === 'red') && r.checks.some((c) => c.level === 'A' && c.color === 'grey')).map((r) => r.label),
  };

  return {
    ...base,
    status,
    statusLabel,
    summary,
    additional,
    doseChecks,
    energyRow,
    rows,
    blockers,
    warnings: [...new Set(warnings)],
    v2: {
      configVersion: cfg.version,
      energyTolerancePct: cfg.energyTolerancePct,
      groups,
      caps,
      totalWeightG: massUnknown ? null : totalWeight,
      weighedFoodsG: weighedFoods,
      preparedFoodsG: preparedFoods,
      yieldMissing,
      doseOnlyFailure: status === 'FAILS_OFFICIAL_LIMITS' && !nutrientRed && doseOver.length > 0,
      dryMatterG: [dmLow, massUnknown ? null : dmHigh],
      moistureMissing,
      caPStep,
      doseSteps,
      legal,
      forbidden,
      below,
      excess,
      unknown,
      estimated,
      criterion: LEVEL_CRITERION,
    },
  };
}
