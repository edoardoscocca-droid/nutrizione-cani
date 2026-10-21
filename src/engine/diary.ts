// Diario (specifica v2 §7 con le precisazioni 1 e 2 del 21/10/2026).
// - Una ricetta registrata = la razione dell'intero giorno (integratori compresi), anche se divisa in più pasti: conta una
//   volta. Una sola voce attiva per cane e data; ogni data registrata vale un giorno; i giorni non registrati sono esclusi
//   e mostrati come mancanti.
// - Apporto per 1000 kcal sul periodo = Σ nutriente dei giorni registrati / Σ kcal degli stessi giorni × 1000
//   (mai la media semplice delle concentrazioni).
// - Contributo noto, parte sconosciuta (kcal da componenti senza il dato, con i primi responsabili) ed esito del
//   confronto, tenuti distinti (§7.3). Le soglie di 5 giorni valgono solo per le frasi sulla tendenza.
// Calcolo puro: identico per l'archivio di prova e per quello con account.

import { applicableLimits, EAA, type AuditResult } from './audit';
import { auditRecipeV2 } from './auditV2';
import { caPStepOf, DEFAULT_CONFIG, doseRuleOf, type FormulationConfig } from './configV2';
import { doseRangeFor } from './doseGuide';
import { foodStatus, supplementStatus } from './catalogStatus';
import { rawValueOf } from './vitaminA';
import type { RecipeSnapshot } from './snapshot';
import type { Color, DogFormulationProfile, Food, Nutrient, NutrientLimit, RecipeItem, Supplement, ValueStatus } from './types';

export interface DayNutrient {
  /** contributo noto della razione del giorno (unità canonica). */
  known: number;
  /** parte del contributo noto che viene da valori stimati con fonte (§6). */
  estimated: number;
  /** componenti senza il dato (alimenti mancanti, integratori che non lo dichiarano): sconosciuto, mai zero. */
  unknownFrom: string[];
  /** kcal della razione che vengono da quei componenti. */
  unknownKcal: number;
  /** componenti che dichiarano solo la quantità aggiunta: per i massimi il totale è incerto. */
  lowerBoundFrom: string[];
}

export interface DayProfile {
  /** kcal note della razione. */
  kcal: number;
  /** false se un componente ha energia sconosciuta: denominatore parziale. */
  kcalComplete: boolean;
  kcalUnknownFrom: string[];
  items: { name: string; kind: 'food' | 'supplement'; qty: number; unit: string; kcal: number | null }[];
  nutrients: Record<string, DayNutrient>;
  /** avvisi immediati di livello A della razione (massimi, dosi, alimenti vietati), senza soglie di giorni. */
  alerts: string[];
  eaaMarginPct: number;
  statusLabel: string;
}

const DOCUMENTED: ValueStatus[] = ['measured', 'label', 'calculated', 'analytical_zero'];

function isEstimated(values: Record<string, { value: number | null; status?: ValueStatus } | undefined>, id: string): boolean {
  const ids = id === 'vitamin_a' ? [values.vitamin_a?.value !== null && values.vitamin_a?.value !== undefined ? 'vitamin_a' : 'vitamin_a_retinol_ug', 'beta_carotene_ug'] : values[id]?.value !== null && values[id]?.value !== undefined ? [id] : id === 'epa_dha' ? ['epa', 'dha'] : id === 'methionine_cystine' ? ['methionine', 'cystine'] : id === 'phenylalanine_tyrosine' ? ['phenylalanine', 'tyrosine'] : [id];
  return ids.some((k) => {
    const v = values[k];
    return v && v.value !== null && v.value !== undefined && !DOCUMENTED.includes(v.status ?? 'measured');
  });
}

/** Profilo del giorno da una versione di ricetta (istantanea congelata, quantità scelte). */
export function dayProfileOf(version: { snapshot: RecipeSnapshot; chosenItems: RecipeItem[] }, config: FormulationConfig = DEFAULT_CONFIG): DayProfile {
  const s = version.snapshot;
  const audit: AuditResult = auditRecipeV2({
    items: version.chosenItems,
    foods: s.foods,
    supplements: s.supplements,
    nutrients: s.nutrients,
    limits: s.limits,
    legacyFactors: s.factors ?? null,
    dog: s.dog,
    dietMoisture: s.dietMoisture,
    settings: s.settings,
    config: s.formulationConfig ?? config,
  });
  const active = version.chosenItems.filter((it) => it.qty > 0);
  const product = (it: RecipeItem): Food | Supplement => (it.kind === 'food' ? s.foods[it.id] : s.supplements[it.id]);
  const kcalOf = new Map<string, number | null>();
  for (const it of active) {
    const p = product(it);
    kcalOf.set(p.name, it.kind === 'food' ? ((p as Food).kcalMePer100g === null ? null : (((p as Food).kcalMePer100g as number) * it.qty) / 100) : (p as Supplement).kcalPerUnit === null ? null : ((p as Supplement).kcalPerUnit as number) * it.qty);
  }
  const nutrients: Record<string, DayNutrient> = {};
  for (const [id, t] of Object.entries(audit.totals.nutrients)) {
    const unknownFrom = [...new Set([...t.missingFrom, ...t.undeclaredFrom])];
    let estimated = 0;
    for (const c of t.contributions) {
      const it = active.find((x) => product(x).name === c.name);
      if (it && isEstimated(product(it).nutrients, id)) estimated += c.amount;
    }
    nutrients[id] = { known: t.known, estimated, unknownFrom, unknownKcal: unknownFrom.reduce((a, n) => a + (kcalOf.get(n) ?? 0), 0), lowerBoundFrom: t.lowerBoundFrom };
  }
  return {
    kcal: audit.totals.energy.known,
    kcalComplete: audit.totals.energy.complete && !audit.totals.energy.undeclaredFrom.length,
    kcalUnknownFrom: [...audit.totals.energy.missingFrom, ...audit.totals.energy.undeclaredFrom],
    items: active.map((it) => ({ name: product(it).name, kind: it.kind, qty: it.qty, unit: it.kind === 'food' ? 'g' : (product(it) as Supplement).doseUnit, kcal: kcalOf.get(product(it).name) ?? null })),
    nutrients,
    alerts: audit.v2?.excess ?? [],
    eaaMarginPct: s.dog.eaaMarginPct ?? 0,
    statusLabel: audit.statusLabel,
  };
}

/**
 * Divisione della razione del giorno in pasti, SOLO per mostrare i grammi di ogni pasto: il diario conta comunque
 * una razione per data, qualunque sia il numero di pasti (precisazione 1).
 */
export function splitIntoMeals(items: RecipeItem[], meals: number): RecipeItem[][] {
  const m = Math.max(1, Math.floor(meals));
  return Array.from({ length: m }, () => items.map((it) => ({ ...it, qty: Math.round((it.qty / m) * 10) / 10 })));
}

// ───────────────────────── date ─────────────────────────

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** «dal giorno X per N giorni»: le date consecutive (la stessa ricetta si può assegnare a più giorni). */
export function dateRange(from: string, days: number): string[] {
  return Array.from({ length: Math.max(0, Math.floor(days)) }, (_, i) => addDays(from, i));
}

// ───────────────────────── riepilogo del periodo ─────────────────────────

export interface DiaryDay {
  date: string;
  recipeName: string;
  revision: number;
  day: DayProfile;
}

export interface PeriodCheck {
  metric: string;
  label: string;
  unit: string;
  /** min o max di riferimento (per 1000 kcal, al giorno o rapporto). */
  kind: 'min' | 'max' | 'ratio' | 'recommended';
  reference: string;
  /** contributo noto: K/E×1000 (o media al giorno per gli obiettivi giornalieri). */
  value: number | null;
  /** % del minimo (solo minimi). */
  pctOfMin: number | null;
  /** quota delle kcal registrate che viene da componenti senza il dato. */
  unknownShare: number;
  /** primi responsabili della parte sconosciuta: «pollo, 9 giorni su 14». */
  unknownTop: string[];
  estimatedFrom: boolean;
  color: Color;
  message: string;
  /** frase sulla tendenza (solo con almeno 5 giorni registrati). */
  trend: string | null;
}

export interface PeriodSummary {
  windowDays: number;
  from: string;
  to: string;
  /** giorni registrati nella finestra (ogni data registrata vale un giorno). */
  registered: number;
  missingDates: string[];
  /** Σ kcal note dei giorni registrati (denominatore). */
  kcal: number;
  /** denominatore parziale: in qualche giorno un componente ha energia sconosciuta. */
  kcalPartial: boolean;
  kcalUnknownFrom: string[];
  avgKcalPerDay: number | null;
  kcalTarget: number | null;
  checks: PeriodCheck[];
  /** avvisi immediati (livello A) dei singoli giorni, senza soglie di giorni. */
  alerts: { date: string; text: string }[];
  /** «ancora pochi giorni registrati» sotto la soglia della configurazione. */
  fewDays: boolean;
  text: string;
}

const fmt = (n: number, d = 3) => n.toLocaleString('it-IT', { maximumFractionDigits: d });
const nice = (v: number) => fmt(Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 1000);

export interface SummaryInput {
  entries: DiaryDay[];
  /** ultimo giorno della finestra (compreso), AAAA-MM-GG. */
  endDate: string;
  windowDays: number;
  dog: DogFormulationProfile;
  nutrients: Nutrient[];
  /** limiti attivi del catalogo (ufficiali, soglie, obiettivi): si applicano come nelle ricette. */
  limits: NutrientLimit[];
  config?: FormulationConfig;
}

export function periodSummary(input: SummaryInput): PeriodSummary {
  const cfg = input.config ?? DEFAULT_CONFIG;
  const from = addDays(input.endDate, -(input.windowDays - 1));
  const days = input.entries.filter((e) => e.date >= from && e.date <= input.endDate).sort((a, b) => a.date.localeCompare(b.date));
  const registeredDates = new Set(days.map((d) => d.date));
  const missingDates = dateRange(from, input.windowDays).filter((d) => !registeredDates.has(d));
  const n = days.length;
  const E = days.reduce((a, d) => a + d.day.kcal, 0);
  const kcalPartial = days.some((d) => !d.day.kcalComplete);
  const kcalUnknownFrom = [...new Set(days.flatMap((d) => d.day.kcalUnknownFrom))];
  const margin = Math.max(input.dog.eaaMarginPct ?? 0, ...days.map((d) => d.day.eaaMarginPct));
  const limits = applicableLimits(input.limits, { ...input.dog, eaaMarginPct: margin }, null);
  const label = new Map(input.nutrients.map((x) => [x.id, x.label]));
  const unitOf = new Map(input.nutrients.map((x) => [x.id, x.unit]));
  const fewDays = n < cfg.trendMinDays;
  const checks: PeriodCheck[] = [];

  const agg = (metric: string) => {
    let K = 0;
    let est = 0;
    let unknownKcal = 0;
    const byItem = new Map<string, number>();
    const lower = new Set<string>();
    let noData = 0;
    for (const d of days) {
      const x = d.day.nutrients[metric];
      if (!x) {
        noData++;
        unknownKcal += d.day.kcal;
        continue;
      }
      K += x.known;
      est += x.estimated;
      unknownKcal += x.unknownKcal;
      for (const u of x.unknownFrom) byItem.set(u, (byItem.get(u) ?? 0) + 1);
      for (const l of x.lowerBoundFrom) lower.add(l);
    }
    const top = [...byItem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([nm, c]) => `${nm}, ${c} ${c === 1 ? 'giorno' : 'giorni'} su ${n}`);
    const anyUnknown = byItem.size > 0 || noData > 0;
    return { K, est, unknownKcal, anyUnknown, top, lower: [...lower] };
  };
  const trendLow = (c: Color) => (fewDays ? null : c === 'red' || c === 'orange' || c === 'grey' ? 'Questo apporto risulta basso o non dimostrato nei giorni registrati.' : null);

  if (n > 0 && E > 0) {
    for (const l of limits) {
      if (!label.has(l.metric)) continue;
      const isMin = l.lower !== null && (l.limitClass === 'OFFICIAL_MIN' || l.limitClass === 'RECOMMENDED_ALLOWANCE');
      const isMax = l.upper !== null && l.limitClass === 'OFFICIAL_NUTRITIONAL_MAX';
      if ((!isMin && !isMax) || (l.basis !== 'per_1000_kcal_me' && l.basis !== 'per_day')) continue;
      const a = agg(l.metric);
      const perDay = l.basis === 'per_day';
      const value = perDay ? a.K / n : (a.K / E) * 1000;
      const documented = perDay ? (a.K - a.est) / n : ((a.K - a.est) / E) * 1000;
      const u = `${unitOf.get(l.metric)}${perDay ? '/die (media dei giorni registrati)' : '/1000 kcal'}`;
      const unknownShare = E > 0 ? a.unknownKcal / E : 0;
      const unknownText = a.anyUnknown ? ` Parte sconosciuta: ${fmt(Math.round(unknownShare * 1000) / 10)}% delle kcal registrate (${a.top.join('; ')}).` : '';
      const partial = kcalPartial && !perDay ? ` Risultato parziale: energia sconosciuta per ${kcalUnknownFrom.join(', ')}.` : '';
      const base = { metric: l.metric, label: label.get(l.metric) as string, unit: u, value, unknownShare, unknownTop: a.top, estimatedFrom: a.est > 0 };
      if (isMax) {
        const max = l.upper as number;
        let color: Color;
        let msg: string;
        if (value > max * (1 + 1e-6)) {
          color = kcalPartial ? 'grey' : 'red';
          msg = kcalPartial ? `con i dati noti ${nice(value)} ${u}, oltre il massimo ${fmt(max)}, ma il denominatore è parziale: non verificabile.` : `superato: contributo noto ${nice(value)} ${u} oltre il massimo ${fmt(max)} (è un limite inferiore dell’apporto vero).`;
        } else if (a.anyUnknown || a.lower.length) {
          color = 'grey';
          msg = `massimo non verificabile: contributo noto ${nice(value)} ${u} (massimo ${fmt(max)})${a.lower.length ? `; ${a.lower.join(', ')} dichiara solo quantità aggiunte` : ''}.`;
        } else {
          color = 'green';
          msg = `rispettato: ${nice(value)} ${u} (massimo ${fmt(max)}).`;
        }
        checks.push({ ...base, kind: 'max', reference: `max ${fmt(max)}`, pctOfMin: null, color, message: msg + unknownText + partial, trend: null });
        continue;
      }
      const target = l.lower as number;
      const eaa = EAA.has(l.metric) && margin > 0 && l.limitClass === 'OFFICIAL_MIN';
      const baseMin = eaa ? target / (1 + margin / 100) : target;
      const pct = (100 * value) / baseMin;
      let color: Color;
      let msg: string;
      if (value >= target * (1 - 1e-6)) {
        if (documented >= target * (1 - 1e-6) && !(kcalPartial && !perDay)) {
          color = 'green';
          msg = `coperto dai dati noti: ${nice(value)} ${u} (${fmt(Math.round(pct))}% del minimo).`;
        } else {
          color = 'yellow';
          msg = `raggiunto (${nice(value)} ${u}) ${kcalPartial && !perDay ? 'su un denominatore parziale' : 'contando valori stimati con fonte'}.`;
        }
      } else if (eaa && value >= baseMin * (1 - 1e-6)) {
        color = 'yellow';
        msg = `${nice(value)} ${u}: tra il minimo e il minimo +${margin}% (digeribilità non documentata) — prudenza.`;
      } else if (a.anyUnknown) {
        color = 'grey';
        msg = `non dimostrato: noto ${fmt(Math.floor(pct * 10) / 10)}% del minimo (${nice(value)} ${u}).`;
      } else if (!fewDays) {
        color = 'red';
        msg = `sotto il minimo con tutti i dati noti e ${n} giorni registrati: ${fmt(Math.floor(pct * 10) / 10)}% del minimo (${nice(value)} ${u}).`;
      } else {
        color = !eaa && pct >= cfg.yellowFromPct ? 'yellow' : 'orange';
        msg = `sotto riferimento nei giorni registrati: ${fmt(Math.floor(pct * 10) / 10)}% del minimo (${nice(value)} ${u}).`;
      }
      checks.push({ ...base, kind: l.limitClass === 'RECOMMENDED_ALLOWANCE' ? 'recommended' : 'min', reference: `min ${fmt(target)}${eaa ? ` (${fmt(baseMin)} + ${margin}%)` : ''}`, pctOfMin: pct, color, message: msg + unknownText + partial, trend: trendLow(color) });
    }
    // Ca:P sul periodo: totale su totale
    const ca = agg('calcium');
    const p = agg('phosphorus');
    if (p.K > 0) {
      const r = ca.K / p.K;
      const step = caPStepOf(r, cfg);
      const unknown = ca.anyUnknown || p.anyUnknown || ca.lower.length > 0 || p.lower.length > 0;
      const color: Color = unknown ? 'grey' : !step ? 'red' : step.color;
      checks.push({
        metric: 'ca_p_ratio', label: label.get('ca_p_ratio') ?? 'Ca:P', unit: '', kind: 'ratio', reference: '1–2', value: r, pctOfMin: null, unknownShare: (ca.unknownKcal + p.unknownKcal) / (2 * E), unknownTop: [...ca.top, ...p.top].slice(0, 3), estimatedFrom: ca.est > 0 || p.est > 0,
        color, message: unknown ? `con i dati noti ${fmt(r)}: non verificabile (parti sconosciute).` : step ? `${fmt(r)}: ${step.label}.` : `${fmt(r)}: fuori dal limite 1–2.`, trend: null,
      });
    }
  }
  const alerts = days.flatMap((d) => d.day.alerts.map((t) => ({ date: d.date, text: t })));
  const avg = n ? E / n : null;
  const text =
    n === 0
      ? `Nessun giorno registrato negli ultimi ${input.windowDays}.`
      : `Registrati ${n} giorni su ${input.windowDays}${missingDates.length ? ` (mancano ${missingDates.length} giorni, esclusi dal calcolo)` : ''}. Energia media registrata ${fmt(Math.round(avg as number))} kcal/die${input.dog.kcalTarget ? ` su obiettivo ${fmt(input.dog.kcalTarget)}` : ''}${kcalPartial ? ' (parziale: energia sconosciuta per alcuni componenti)' : ''}.${fewDays ? ' Ancora pochi giorni registrati: nessuna frase sulla tendenza.' : ''}`;
  return { windowDays: input.windowDays, from, to: input.endDate, registered: n, missingDates, kcal: E, kcalPartial, kcalUnknownFrom, avgKcalPerDay: avg, kcalTarget: input.dog.kcalTarget, checks, alerts, fewDays, text };
}

// ───────────────────────── suggerimenti simulati (§7.4) ─────────────────────────

export interface DiarySuggestion {
  metric: string;
  label: string;
  candidate: string;
  kind: 'food' | 'supplement';
  toActivate: boolean;
  qty: number;
  unit: string;
  /** % del minimo nella ricetta di riferimento, prima e dopo l'aggiunta simulata. */
  before: number | null;
  after: number | null;
  levelAOk: boolean;
  aProblems: string[];
  text: string;
}

/**
 * Per un nutriente sotto riferimento o non dimostrato nel periodo: alimenti o integratori del catalogo con dato noto,
 * l'apporto che migliorerebbero e di quanto, SIMULANDO l'aggiunta alla ricetta registrata più di recente e rifacendo
 * tutti i controlli di livello A (massimi, Ca:P, dosi). Non applica nulla: sceglie l'utente.
 */
export function diarySuggestions(args: {
  metrics: string[];
  version: { snapshot: RecipeSnapshot; chosenItems: RecipeItem[] };
  catalog: { foods: Food[]; supplements: Supplement[]; nutrients: Nutrient[] };
  config?: FormulationConfig;
  perMetric?: number;
}): DiarySuggestion[] {
  const cfg = args.config ?? args.version.snapshot.formulationConfig ?? DEFAULT_CONFIG;
  const s = args.version.snapshot;
  const label = new Map(args.catalog.nutrients.map((x) => [x.id, x.label]));
  const present = new Set(args.version.chosenItems.map((i) => i.id));
  const auditOf = (items: RecipeItem[], foods: Record<string, Food>, supplements: Record<string, Supplement>) =>
    auditRecipeV2({ items, foods, supplements, nutrients: s.nutrients, limits: s.limits, dog: s.dog, dietMoisture: s.dietMoisture, settings: s.settings, config: cfg });
  const base = auditOf(args.version.chosenItems, s.foods, s.supplements);
  const pctOf = (a: AuditResult, metric: string) => {
    const r = a.rows.find((x) => x.metric === metric);
    const c = r?.checks.find((x) => x.limit.lower !== null && (x.level === 'B' || x.level === 'A'));
    if (!r || !c || c.limit.lower === null) return null;
    const basis = a.minimaBasis?.kcal;
    const v = c.limit.basis === 'per_day' ? r.amount : basis && r.amount !== null ? (r.amount / basis) * 1000 : null;
    return v === null ? null : (100 * v) / (c.limit.lower as number);
  };
  const out: DiarySuggestion[] = [];
  for (const metric of args.metrics) {
    const lim = base.rows.find((r) => r.metric === metric)?.checks.find((c) => c.limit.lower !== null && c.level === 'B')?.limit;
    if (!lim || lim.lower === null) continue;
    const kcal = base.minimaBasis?.kcal ?? base.kcal ?? 0;
    const need = lim.basis === 'per_day' ? lim.lower - (base.rows.find((r) => r.metric === metric)?.amount ?? 0) : (lim.lower * kcal) / 1000 - (base.rows.find((r) => r.metric === metric)?.amount ?? 0);
    if (!(need > 0)) continue;
    const supps = args.catalog.supplements
      .filter((x) => !present.has(x.id) && x.status !== 'missing' && (rawValueOf(x.nutrients, metric) ?? 0) > 0 && supplementStatus(x, args.catalog.nutrients).status !== 'to_complete')
      .slice(0, args.perMetric ?? 1);
    const foods = args.catalog.foods
      .filter((f) => !present.has(f.id) && !f.forbidden && f.kcalMePer100g && (rawValueOf(f.nutrients, metric) ?? 0) > 0 && foodStatus(f, args.catalog.nutrients).status !== 'to_complete')
      .sort((a, b) => (rawValueOf(b.nutrients, metric) as number) / (b.kcalMePer100g as number) - (rawValueOf(a.nutrients, metric) as number) / (a.kcalMePer100g as number))
      .slice(0, args.perMetric ?? 1);
    for (const sp of supps) {
      const per = rawValueOf(sp.nutrients, metric) as number;
      const step = sp.doseUnit === 'g' || sp.doseUnit === 'ml' ? 0.1 : 1;
      const rule = doseRuleOf(sp.id, cfg);
      const range = sp.doseGuide ? doseRangeFor(sp.doseGuide, s.dog.weightCurrentKg, { extrapolate: !!rule?.extrapolate }) : null;
      const cap = range ? range.max : sp.maxDailyUnits !== null && sp.maxDailySource ? sp.maxDailyUnits : null;
      let qty = Math.ceil(need / per / step - 1e-9) * step;
      if (cap !== null) qty = Math.min(qty, Math.floor(cap / step + 1e-9) * step);
      qty = Math.round(qty * 1000) / 1000;
      if (!(qty > 0)) continue;
      const items = [...args.version.chosenItems, { kind: 'supplement' as const, id: sp.id, qty }];
      const a = auditOf(items, s.foods, { ...s.supplements, [sp.id]: sp });
      out.push(result(metric, sp.name, 'supplement', !sp.usableForOptimization, qty, sp.doseUnit, a, cap === null ? ' (dose non indicata dal produttore: quantità calcolata solo sul fabbisogno)' : ''));
    }
    for (const f of foods) {
      const perG = (rawValueOf(f.nutrients, metric) as number) / 100;
      let grams = Math.ceil(need / perG);
      const totalW = args.version.chosenItems.filter((i) => i.kind === 'food').reduce((x, i) => x + i.qty, 0);
      grams = Math.min(grams, Math.max(5, Math.floor(totalW * 0.2)));
      // stessa energia: gli altri alimenti si riducono in proporzione
      const kcalF = ((f.kcalMePer100g as number) * grams) / 100;
      const kcalFoods = args.version.chosenItems.filter((i) => i.kind === 'food').reduce((x, i) => x + ((s.foods[i.id].kcalMePer100g ?? 0) * i.qty) / 100, 0);
      const k = kcalFoods > kcalF ? (kcalFoods - kcalF) / kcalFoods : 1;
      const items: RecipeItem[] = [...args.version.chosenItems.map((i) => (i.kind === 'food' ? { ...i, qty: Math.round(i.qty * k) } : i)), { kind: 'food', id: f.id, qty: grams }];
      const a = auditOf(items, { ...s.foods, [f.id]: f }, s.supplements);
      out.push(result(metric, f.name, 'food', !f.availableToFormulate, grams, 'g', a, ` (gli altri alimenti ridotti del ${Math.round((1 - k) * 100)}% per mantenere le kcal)`));
    }
    if (!supps.length && !foods.length) out.push({ metric, label: label.get(metric) ?? metric, candidate: '—', kind: 'food', toActivate: false, qty: 0, unit: '', before: pctOf(base, metric), after: null, levelAOk: false, aProblems: [], text: `${label.get(metric) ?? metric}: nessun alimento o integratore del catalogo ha un dato noto per questo nutriente.` });
  }
  return out;

  function result(metric: string, name: string, kind: 'food' | 'supplement', toActivate: boolean, qty: number, unit: string, a: AuditResult, extra: string): DiarySuggestion {
    const aProblems = [...(a.v2?.excess ?? []), ...a.rows.flatMap((r) => r.checks.filter((c) => c.level === 'A' && c.color === 'red').map((c) => `${r.label}: ${c.message}`))];
    const before = pctOf(base, metric);
    const after = pctOf(a, metric);
    const nm = label.get(metric) ?? metric;
    const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x)}%`);
    return {
      metric, label: nm, candidate: name, kind, toActivate, qty, unit, before, after, levelAOk: aProblems.length === 0, aProblems,
      text: `${nm}: aggiungendo ${name}${toActivate ? ' (da attivare in catalogo)' : ''} ${qty.toLocaleString('it-IT')} ${unit}/die alla ricetta più recente${extra}, da ${pct(before)} a ${pct(after)} del minimo; livello A ${aProblems.length ? `NON rispettato (${aProblems.slice(0, 2).join('; ')})` : 'rispettato'} nella simulazione.`,
    };
  }
}
