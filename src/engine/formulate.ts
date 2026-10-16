// Motore di formulazione (§9, allegato F).
// Tutti gli alimenti e gli integratori selezionati sono variabili di UN SOLO modello di ottimizzazione:
// nessuna correzione in sequenza "aggiungi calcio → aggiungi fosforo" (T04).
// Ordine delle priorità: vincoli rigidi (limiti ufficiali, target professionali, bounds) →
// copertura dei nutrienti con dati parziali → obiettivo kcal → preferenze → praticità/costo.

import { foodStatus, supplementStatus } from './catalogStatus';
import { COMPOUNDS } from './totals';
import { doseRangeFor, weightSpan } from './doseGuide';
import { applicableLimits, auditRecipe, type AuditResult, type DietMoisture } from './audit';
import { solve, type Model, type Row, type SolveResult, type Term, type VarDef, loadSolver } from './lp';
import type {
  DogFormulationProfile,
  EngineSettings,
  Food,
  ItemConstraint,
  Nutrient,
  NutrientLimit,
  RecipeItem,
  Supplement,
} from './types';

export const ENGINE_VERSION = 'motore-1.0.0';

export interface FormulationInput {
  dog: DogFormulationProfile;
  foods: { food: Food; constraint?: ItemConstraint }[];
  supplements: { supplement: Supplement; constraint?: ItemConstraint }[];
  nutrients: Nutrient[];
  limits: NutrientLimit[];
  dietMoisture: DietMoisture;
  settings: EngineSettings;
  /** €/unità di quantità (€/g o €/dose) per id, se l'utente ha prezzi. Solo per l'ultimo criterio. */
  unitPrices?: Record<string, number | undefined>;
  /** Catalogo completo, per suggerire alimenti/integratori in caso di conflitto (solo dati reali presenti). */
  catalogForSuggestions?: { foods: Food[]; supplements: Supplement[] };
}

export type ConstraintKind =
  | 'official_min'
  | 'official_max'
  | 'legal_max'
  | 'official_ratio'
  | 'energy'
  | 'user_bound'
  | 'product_max'
  | 'personal_locked'
  | 'personal_soft'
  | 'non_official'
  | 'coverage_partial'
  | 'product_range';

export interface ConstraintInfo {
  name: string;
  label: string;
  kind: ConstraintKind;
  hardness: 'hard' | 'soft';
  metric?: string;
}

export interface Conflict {
  label: string;
  kind: ConstraintKind;
  metric?: string;
  /** violazione minima necessaria, nell'unità del vincolo. */
  shortfall: number;
  direction: 'deficit' | 'excess';
}

export type Outcome = 'solved' | 'infeasible' | 'blocked' | 'timeout' | 'error';

export interface FormulationResult {
  outcome: Outcome;
  engineVersion: string;
  items: RecipeItem[];
  excluded: { kind: 'food' | 'supplement'; id: string; name: string; reason: string }[];
  conflicts: Conflict[];
  suggestions: string[];
  notes: string[];
  constraints: ConstraintInfo[];
  phases: { name: string; status: string; objective: number | null }[];
  audit: AuditResult | null;
  message: string;
}

interface ModelItem {
  kind: 'food' | 'supplement';
  id: string;
  name: string;
  v: string;
  step: number;
  integerUnits: boolean;
  kcal: number; // per passo (noto; per gli integratori senza kcal è 0 nel modello e la verifica lo segnala)
  macro: { protein: number; fat: number; carbohydrate: number } | null;
  value: (n: string) => number | null; // per passo
  lb: number; // in passi
  ub: number | null;
  minQty: number | null;
  maxQty: number | null;
  productMax: number | null;
  /** dose minima consigliata dal produttore per il peso del cane (unità di dose), preferenza morbida. */
  guideMin: number | null;
  /** testo dell'intervallo consigliato (per le etichette dei vincoli). */
  guideText: string | null;
}

function rawValue(nutrients: Record<string, { value: number | null } | undefined>, id: string): number | null {
  const v = nutrients[id]?.value;
  if (v !== null && v !== undefined) return v;
  const pair = COMPOUNDS[id];
  if (pair) {
    const a = nutrients[pair[0]]?.value;
    const b = nutrients[pair[1]]?.value;
    if (a !== null && a !== undefined && b !== null && b !== undefined) return a + b;
  }
  return null;
}

function supplementStep(s: Supplement, st: EngineSettings): number {
  if (s.doseUnit === 'g') return st.roundingSupplementG;
  if (s.doseUnit === 'ml') return st.roundingSupplementMl;
  return 1;
}

/** Controllo preliminare dei dati (allegato F, step_one). */
export function checkUsability(input: FormulationInput) {
  const excluded: FormulationResult['excluded'] = [];
  const foods = input.foods.filter(({ food }) => {
    const st = foodStatus(food, input.nutrients);
    if (st.status === 'to_complete') {
      excluded.push({ kind: 'food', id: food.id, name: food.name, reason: `da completare in catalogo (${st.reasons[0]})` });
      return false;
    }
    if (!food.availableToFormulate) {
      excluded.push({ kind: 'food', id: food.id, name: food.name, reason: 'non ancora attivato per la formulazione da un amministratore' });
      return false;
    }
    return true;
  });
  const supplements = input.supplements.filter(({ supplement: s }) => {
    const st = supplementStatus(s, input.nutrients);
    if (st.status === 'to_complete' || s.status === 'missing') {
      excluded.push({
        kind: 'supplement',
        id: s.id,
        name: s.name,
        reason: `composizione dell’etichetta non disponibile: servono i dati del prodotto (variante esatta)${st.reasons[0] ? ` — ${st.reasons[0]}` : ''}`,
      });
      return false;
    }
    if (!s.usableForOptimization) {
      excluded.push({ kind: 'supplement', id: s.id, name: s.name, reason: 'non ancora attivato per la formulazione da un amministratore' });
      return false;
    }
    return true;
  });
  return { foods, supplements, excluded };
}

function buildItems(input: FormulationInput, foods: FormulationInput['foods'], supplements: FormulationInput['supplements'], notes: string[] = []): ModelItem[] {
  const st = input.settings;
  const items: ModelItem[] = [];
  foods.forEach(({ food, constraint }, i) => {
    const step = st.roundingFoodG;
    items.push({
      kind: 'food',
      id: food.id,
      name: food.name,
      v: `f${i}`,
      step,
      integerUnits: true,
      kcal: ((food.kcalMePer100g as number) / 100) * step,
      macro: food.energyMethod ?? null,
      value: (n) => {
        const x = rawValue(food.nutrients, n);
        return x === null ? null : (x / 100) * step;
      },
      lb: constraint?.minQty ? Math.ceil(constraint.minQty / step - 1e-9) : 0,
      ub: constraint?.maxQty !== null && constraint?.maxQty !== undefined ? Math.floor(constraint.maxQty / step + 1e-9) : null,
      minQty: constraint?.minQty ?? null,
      maxQty: constraint?.maxQty ?? null,
      productMax: null,
      guideMin: null,
      guideText: null,
    });
  });
  supplements.forEach(({ supplement: s, constraint }, i) => {
    const step = supplementStep(s, st);
    // tabella d'impiego del produttore: il massimo consigliato non si supera in automatico (serve una valutazione veterinaria)
    const range = doseRangeFor(s.doseGuide, input.dog.weightIdealKg);
    if (s.doseGuide && !range) notes.push(`${s.name}: la tabella d’impiego del produttore copre ${weightSpan(s.doseGuide)}; per ${input.dog.weightIdealKg} kg nessun intervallo applicato.`);
    const declaredMax = s.maxDailyUnits !== null && s.maxDailySource ? s.maxDailyUnits : null;
    const productMax = range ? (declaredMax === null ? range.max : Math.min(declaredMax, range.max)) : declaredMax;
    items.push({
      kind: 'supplement',
      id: s.id,
      name: s.name,
      v: `s${i}`,
      step,
      integerUnits: true,
      kcal: (s.kcalPerUnit ?? 0) * step,
      macro: s.energyMethod ?? null,
      value: (n) => {
        const x = rawValue(s.nutrients, n);
        return x === null ? null : x * step;
      },
      lb: constraint?.minQty ? Math.ceil(constraint.minQty / step - 1e-9) : 0,
      ub: constraint?.maxQty !== null && constraint?.maxQty !== undefined ? Math.floor(constraint.maxQty / step + 1e-9) : null,
      minQty: constraint?.minQty ?? null,
      maxQty: constraint?.maxQty ?? null,
      productMax: productMax !== null ? Math.floor(productMax / step + 1e-9) : null,
      guideMin: range ? range.min : null,
      guideText: range ? `${range.text} ${s.doseUnit}/die — ${s.doseGuide!.source}` : null,
    });
  });
  return items;
}

interface BuiltRow extends Row {
  info: ConstraintInfo;
  /** scala per normalizzare scarti/violazioni. */
  scale: number;
  /** per righe morbide: nome della variabile di scarto e gruppo di priorità. */
  dev?: { v: string; group: 'coverage' | 'preference' };
}

function fmt(n: number) {
  return n.toLocaleString('it-IT', { maximumFractionDigits: 3 });
}

const RATIO_PARTS: Record<string, [string, string]> = {
  ca_p_ratio: ['calcium', 'phosphorus'],
  omega6_omega3_ratio: ['omega6_total', 'omega3_total'],
};
const MACRO_PARTS: Record<string, 'protein' | 'fat' | 'carbohydrate_available'> = {
  protein_energy_pct: 'protein',
  fat_energy_pct: 'fat',
  carb_energy_pct: 'carbohydrate_available',
};

function buildRows(
  input: FormulationInput,
  items: ModelItem[],
  limits: NutrientLimit[],
  notes: string[],
): { rows: BuiltRow[]; extraVars: VarDef[] } {
  const K = input.dog.kcalTarget as number;
  const label = new Map(input.nutrients.map((n) => [n.id, n.label]));
  const unit = new Map(input.nutrients.map((n) => [n.id, n.unit]));
  const rows: BuiltRow[] = [];
  const extraVars: VarDef[] = [];
  let devCount = 0;
  // gli integratori valgono per la composizione dichiarata (non dichiarato = sconosciuto, nel modello conta 0:
  // per i minimi e per i massimi i contributi noti sono un limite inferiore del vero totale)
  const complete = (n: string) => items.every((it) => it.kind === 'supplement' || it.value(n) !== null);
  const coef = (n: string) => items.map((it) => ({ v: it.v, c: it.value(n) ?? 0 }));
  const minDaily = (n: string) => {
    const l = limits.find((x) => x.metric === n && x.limitClass === 'OFFICIAL_MIN' && x.basis === 'per_1000_kcal_me');
    return l?.lower ? (l.lower * K) / 1000 : 1;
  };

  const kindOf = (l: NutrientLimit, isUpper: boolean): ConstraintKind => {
    if (l.limitClass === 'OFFICIAL_MIN') return l.basis === 'ratio' ? 'official_ratio' : 'official_min';
    if (l.limitClass === 'OFFICIAL_NUTRITIONAL_MAX') return l.basis === 'ratio' ? 'official_ratio' : 'official_max';
    if (l.limitClass === 'LEGAL_MAX') return 'legal_max';
    if (l.limitClass === 'PERSONAL_TARGET') return l.hardness === 'hard' ? 'personal_locked' : 'personal_soft';
    void isUpper;
    return 'non_official';
  };

  for (const l of limits) {
    if (l.limitClass === 'INFORMATIONAL_REFERENCE') continue;
    const sides: ['lower' | 'upper', number][] = [];
    if (l.lower !== null) sides.push(['lower', l.lower]);
    if (l.upper !== null) sides.push(['upper', l.upper]);
    for (const [side, bound] of sides) {
      let terms: Term[] = [];
      let dataComplete = true;
      let scale = 1;
      let unitLabel = '';
      if (l.basis === 'per_1000_kcal_me' || l.basis === 'per_day') {
        if (!label.has(l.metric)) continue;
        dataComplete = complete(l.metric);
        terms = coef(l.metric);
        if (l.basis === 'per_1000_kcal_me') {
          // energia dichiarata (composizione dichiarata degli integratori): se un integratore non dichiara le kcal,
          // la verifica finale controlla anche l'energia massima possibile e segnala i minimi non dimostrati
          for (const it of items) terms.push({ v: it.v, c: (-bound / 1000) * it.kcal });
          scale = Math.max((bound * K) / 1000, 1e-9);
          unitLabel = `${unit.get(l.metric)}/1000 kcal`;
        } else {
          scale = Math.max(bound, 1e-9);
          unitLabel = `${unit.get(l.metric)}/die`;
        }
      } else if (l.basis === 'ratio') {
        const parts = RATIO_PARTS[l.metric];
        if (!parts) continue;
        const [a, b] = parts;
        dataComplete = complete(a) && complete(b);
        terms = [...coef(a), ...coef(b).map((t) => ({ v: t.v, c: -bound * t.c }))];
        scale = minDaily(a);
        unitLabel = '';
      } else if (l.basis === 'energy_pct') {
        const part = MACRO_PARTS[l.metric];
        if (!part) continue;
        const key = part === 'carbohydrate_available' ? 'carbohydrate' : part;
        const noMethod = items.filter((it) => (it.value(part) ?? 0) > 0 && !it.macro);
        if (noMethod.length) {
          notes.push(`${label.get(l.metric) ?? l.metric}: preferenza non applicata, nessun metodo energetico per ${noMethod.map((i) => i.name).join(', ')}.`);
          continue;
        }
        dataComplete = complete(part);
        terms = [
          ...items.map((it) => ({ v: it.v, c: (it.value(part) ?? 0) * (it.macro?.[key] ?? 0) })),
          ...items.map((it) => ({ v: it.v, c: (-bound / 100) * it.kcal })),
        ];
        scale = K;
        unitLabel = '% kcal';
      } else {
        notes.push(`${label.get(l.metric) ?? l.metric}: limite su base ${l.basis} non usato nel calcolo (nessuna conversione verificata).`);
        continue;
      }
      const op: '>=' | '<=' = side === 'lower' ? '>=' : '<=';
      const kind = kindOf(l, side === 'upper');
      const desc = `${label.get(l.metric) ?? l.metric}: ${side === 'lower' ? 'minimo' : 'massimo'} ${fmt(bound)} ${unitLabel} (${l.source})`.replace('  ', ' ');
      // Regole sui dati parziali:
      //  - massimo: i soli contributi noti sono un limite inferiore del vero totale → vincolo rigido corretto;
      //  - minimo o rapporto con dati parziali: non dimostrabile → solo copertura morbida, la verifica resta grigia.
      let hard = l.hardness === 'hard';
      let group: 'coverage' | 'preference' = 'preference';
      if (hard && !dataComplete && !(side === 'upper' && l.basis !== 'ratio')) {
        hard = false;
        group = 'coverage';
      }
      const name = `r${rows.length}`;
      const row: BuiltRow = {
        name,
        terms,
        op,
        rhs: 0,
        scale,
        info: { name, label: desc + (group === 'coverage' ? ' — dati parziali' : ''), kind: group === 'coverage' ? 'coverage_partial' : kind, hardness: hard ? 'hard' : 'soft', metric: l.metric },
      };
      if (l.basis === 'per_day') row.rhs = bound;
      if (!hard) {
        const dv = `d${devCount++}`;
        extraVars.push({ name: dv, lb: 0, ub: null, integer: false });
        row.terms = [...row.terms, { v: dv, c: op === '>=' ? 1 : -1 }];
        row.dev = { v: dv, group };
      }
      rows.push(row);
    }
  }
  // dose minima consigliata dal produttore: preferenza (arancione se non raggiunta), mai sopra i limiti nutrizionali
  for (const it of items) {
    if (it.guideMin === null || !(it.guideMin > 0)) continue;
    const dv = `d${devCount++}`;
    extraVars.push({ name: dv, lb: 0, ub: null, integer: false });
    const name = `r${rows.length}`;
    rows.push({
      name,
      terms: [{ v: it.v, c: it.step }, { v: dv, c: 1 }],
      op: '>=',
      rhs: it.guideMin,
      scale: Math.max(it.guideMin, 1e-9),
      dev: { v: dv, group: 'preference' },
      info: { name, label: `${it.name}: dose consigliata dal produttore ${it.guideText}`, kind: 'product_range', hardness: 'soft' },
    });
  }
  return { rows, extraVars };
}

interface Built {
  model: Model;
  rows: BuiltRow[];
  items: ModelItem[];
  energyDev: string[];
  K: number;
}

function buildModel(input: FormulationInput, items: ModelItem[], limits: NutrientLimit[], notes: string[]): Built {
  const K = input.dog.kcalTarget as number;
  const tol = input.settings.energyTolerancePct / 100;
  const { rows, extraVars } = buildRows(input, items, limits, notes);
  const vars: VarDef[] = items.map((it) => {
    let ub = it.ub;
    if (it.productMax !== null) ub = ub === null ? it.productMax : Math.min(ub, it.productMax);
    if (ub === null) {
      // limite tecnico per evitare modelli illimitati (un componente senza energia): 10 kg o 10.000 dosi
      ub = Math.ceil((it.kind === 'food' ? 10000 : 10000) / it.step);
    }
    return { name: it.v, lb: it.lb, ub, integer: it.integerUnits };
  });
  const energyRow: BuiltRow = {
    name: 'energy',
    terms: [...items.map((it) => ({ v: it.v, c: it.kcal })), { v: 'ep', c: -1 }, { v: 'en', c: 1 }],
    op: '=',
    rhs: K,
    scale: K,
    info: { name: 'energy', label: `Energia: ${fmt(K)} kcal ±${input.settings.energyTolerancePct}%`, kind: 'energy', hardness: 'hard' },
  };
  vars.push({ name: 'ep', lb: 0, ub: tol * K, integer: false }, { name: 'en', lb: 0, ub: tol * K, integer: false }, ...extraVars);
  return { model: { vars, rows: [energyRow, ...rows], objective: [] }, rows: [energyRow, ...rows], items, energyDev: ['ep', 'en'], K };
}

function devObjective(rows: BuiltRow[], group: 'coverage' | 'preference'): Term[] {
  return rows.filter((r) => r.dev?.group === group).map((r) => ({ v: r.dev!.v, c: 1 / r.scale }));
}

function fixObjective(model: Model, terms: Term[], opt: number, name: string): Model {
  if (!terms.length) return model;
  const slack = Math.max(1e-7, Math.abs(opt) * 1e-6);
  return { ...model, rows: [...model.rows, { name, terms, op: '<=', rhs: opt + slack }] };
}

/** Diagnosi dei conflitti: modello elastico che rilassa ogni vincolo rigido e minimizza le violazioni normalizzate. */
function diagnose(built: Built, highsSolve: (m: Model) => SolveResult): Conflict[] {
  // Prima si tiene fisso l'obiettivo kcal (altrimenti "zero cibo" annullerebbe ogni vincolo per 1000 kcal);
  // solo se il conflitto riguarda l'energia stessa la si rilassa.
  const fixed = diagnoseWith(built, highsSolve, false);
  return fixed ?? diagnoseWith(built, highsSolve, true) ?? [];
}

function diagnoseWith(built: Built, highsSolve: (m: Model) => SolveResult, relaxEnergy: boolean): Conflict[] | null {
  const rows: Row[] = [];
  const vars: VarDef[] = built.model.vars.map((v) => {
    if (relaxEnergy && (v.name === 'ep' || v.name === 'en')) return { ...v, ub: null };
    const it = built.items.find((i) => i.v === v.name);
    return it ? { ...v, lb: 0, ub: null } : v;
  });
  const objective: Term[] = [];
  const meta: { slack: string; info: ConstraintInfo; scale: number; direction: 'deficit' | 'excess' }[] = [];
  let n = 0;
  const addSlack = (info: ConstraintInfo, scale: number, direction: 'deficit' | 'excess') => {
    const s = `e${n++}`;
    vars.push({ name: s, lb: 0, ub: null, integer: false });
    objective.push({ v: s, c: 1 / Math.max(scale, 1e-9) });
    meta.push({ slack: s, info, scale, direction });
    return s;
  };
  for (const r of built.rows) {
    if (r.name === 'energy') {
      rows.push({ name: r.name, terms: r.terms, op: '=', rhs: r.rhs });
      if (!relaxEnergy) continue;
      const tol = built.model.vars.find((v) => v.name === 'ep')!.ub as number;
      const sp = addSlack({ ...r.info, label: `${r.info.label} (eccesso)` }, built.K, 'excess');
      const sn = addSlack({ ...r.info, label: `${r.info.label} (difetto)` }, built.K, 'deficit');
      rows.push({ name: 'epmax', terms: [{ v: 'ep', c: 1 }, { v: sp, c: -1 }], op: '<=', rhs: tol });
      rows.push({ name: 'enmax', terms: [{ v: 'en', c: 1 }, { v: sn, c: -1 }], op: '<=', rhs: tol });
      continue;
    }
    if (!r.dev) {
      const s = addSlack(r.info, r.scale, r.op === '>=' ? 'deficit' : 'excess');
      rows.push({ name: r.name, terms: [...r.terms, { v: s, c: r.op === '>=' ? 1 : -1 }], op: r.op, rhs: r.rhs });
    } else {
      rows.push({ name: r.name, terms: r.terms, op: r.op, rhs: r.rhs });
    }
  }
  for (const it of built.items) {
    const ub = [it.ub, it.productMax].filter((x): x is number => x !== null);
    if (it.lb > 0) {
      const s = addSlack({ name: `lb_${it.v}`, label: `Limite scelto: ${it.name} almeno ${fmt(it.minQty ?? it.lb * it.step)}`, kind: 'user_bound', hardness: 'hard' }, it.lb, 'excess');
      rows.push({ name: `lb_${it.v}`, terms: [{ v: it.v, c: 1 }, { v: s, c: 1 }], op: '>=', rhs: it.lb });
    }
    if (ub.length) {
      const u = Math.min(...ub);
      const isProduct = it.productMax !== null && u === it.productMax;
      const s = addSlack(
        {
          name: `ub_${it.v}`,
          label: isProduct ? `Dose massima del produttore: ${it.name} ${fmt(u * it.step)} (superarla richiede una valutazione veterinaria)` : `Limite scelto: ${it.name} non oltre ${fmt(it.maxQty ?? u * it.step)}`,
          kind: isProduct ? 'product_max' : 'user_bound',
          hardness: 'hard',
        },
        Math.max(u, 1),
        'deficit',
      );
      rows.push({ name: `ub_${it.v}`, terms: [{ v: it.v, c: 1 }, { v: s, c: -1 }], op: '<=', rhs: u });
    }
  }
  const res = highsSolve({ vars: vars.map((v) => ({ ...v, integer: false })), rows, objective });
  if (res.status !== 'optimal') return null;
  const out: Conflict[] = meta
    .filter((m) => (res.values[m.slack] ?? 0) / Math.max(m.scale, 1e-9) > 1e-6)
    .map((m) => ({ label: m.info.label, kind: m.info.kind, metric: m.info.metric, shortfall: res.values[m.slack], direction: m.direction }));
  // limiti di quantità rispettati ma "al massimo": contribuiscono al conflitto
  for (const it of built.items) {
    const ub = [it.ub, it.productMax].filter((x): x is number => x !== null);
    if (!ub.length || !out.some((c) => c.kind !== 'user_bound' && c.kind !== 'product_max')) continue;
    const u = Math.min(...ub);
    if ((res.values[it.v] ?? 0) >= u - 1e-6 && !out.some((c) => c.label.includes(it.name))) {
      const isProduct = it.productMax !== null && u === it.productMax;
      out.push({
        label: `${isProduct ? 'Dose massima del produttore' : 'Limite scelto'}: ${it.name} non oltre ${fmt(u * it.step)} — raggiunto, contribuisce al conflitto`,
        kind: isProduct ? 'product_max' : 'user_bound',
        shortfall: 0,
        direction: 'excess',
      });
    }
  }
  return out;
}

function suggestionsFor(conflicts: Conflict[], input: FormulationInput, items: ModelItem[]): string[] {
  const out: string[] = [];
  const label = new Map(input.nutrients.map((n) => [n.id, n.label]));
  const selected = new Set(items.map((i) => i.id));
  for (const c of conflicts) {
    if (!c.metric) continue;
    const metric = RATIO_PARTS[c.metric]?.[0] ?? c.metric;
    if (c.direction === 'deficit' && c.kind !== 'user_bound' && c.kind !== 'product_max') {
      const cat = input.catalogForSuggestions;
      if (!cat) continue;
      const foods = cat.foods
        .filter((f) => f.availableToFormulate && f.kcalMePer100g && !selected.has(f.id) && rawValue(f.nutrients, metric) !== null)
        .map((f) => ({ name: f.name, d: (rawValue(f.nutrients, metric) as number) / (f.kcalMePer100g as number) }))
        .filter((x) => x.d > 0)
        .sort((a, b) => b.d - a.d)
        .slice(0, 3)
        .map((x) => x.name);
      const supps = cat.supplements
        .filter((s) => s.usableForOptimization && !selected.has(s.id) && (rawValue(s.nutrients, metric) ?? 0) > 0)
        .map((s) => s.name)
        .slice(0, 3);
      const nm = label.get(metric) ?? metric;
      if (foods.length || supps.length) {
        out.push(
          `${nm}: in catalogo hanno dati verificati con ${nm.toLowerCase()} ${[...foods, ...supps].join(', ')}. Valuta se aggiungerne uno tra quelli disponibili.`,
        );
      } else {
        out.push(`${nm}: nessun alimento o integratore utilizzabile in catalogo ne riporta dati. Serve un prodotto caratterizzato (da inserire in catalogo).`);
      }
    } else if (c.direction === 'excess' && c.kind !== 'user_bound') {
      const contrib = items
        .map((it) => ({ name: it.name, v: it.value(metric) ?? 0 }))
        .filter((x) => x.v > 0)
        .sort((a, b) => b.v - a.v)
        .slice(0, 2)
        .map((x) => x.name);
      if (contrib.length) out.push(`${label.get(metric) ?? metric}: i maggiori apporti vengono da ${contrib.join(', ')}. Valuta di sostituirli o ridurli con un limite.`);
    }
  }
  return [...new Set(out)];
}

function toItems(built: Built, values: Record<string, number>): RecipeItem[] {
  return built.items.map((it) => {
    const k = Math.round(values[it.v] ?? 0);
    const qty = Number((k * it.step).toFixed(6));
    return { kind: it.kind, id: it.id, qty };
  });
}

export async function formulate(input: FormulationInput): Promise<FormulationResult> {
  const highs = await loadSolver();
  const runSolve = (m: Model) => solve(highs, m, input.settings.timeLimitSeconds);
  const notes: string[] = [];
  const phases: FormulationResult['phases'] = [];
  const { foods, supplements, excluded } = checkUsability(input);
  const base = {
    engineVersion: ENGINE_VERSION,
    excluded,
    notes,
    phases,
    conflicts: [] as Conflict[],
    suggestions: [] as string[],
    constraints: [] as ConstraintInfo[],
    items: [] as RecipeItem[],
    audit: null,
  };
  if (!input.dog.kcalTarget || !(input.dog.kcalTarget > 0)) {
    return { ...base, outcome: 'blocked', message: 'Imposta l’obiettivo kcal del cane prima di calcolare.' };
  }
  if (!foods.length) {
    return {
      ...base,
      outcome: 'blocked',
      message: 'Nessun alimento selezionato è utilizzabile: le composizioni devono essere inserite e verificate in catalogo.',
    };
  }
  const limits = applicableLimits(input.limits, input.dog, input.dietMoisture);
  if (input.dog.lifeStage !== 'adult_maintenance') {
    notes.push('Nessuno standard disponibile per questa fase di vita: il calcolo considera solo energia e target personali.');
  }
  const items = buildItems(input, foods, supplements, notes);
  const built = buildModel(input, items, limits, notes);
  const constraints = built.rows.map((r) => r.info);
  for (const it of items) {
    if (it.minQty) constraints.push({ name: `lb_${it.v}`, label: `${it.name}: almeno ${fmt(it.minQty)}`, kind: 'user_bound', hardness: 'hard' });
    if (it.maxQty !== null) constraints.push({ name: `ub_${it.v}`, label: `${it.name}: non oltre ${fmt(it.maxQty)}`, kind: 'user_bound', hardness: 'hard' });
    if (it.productMax !== null)
      constraints.push({ name: `pm_${it.v}`, label: `${it.name}: dose massima del produttore ${fmt(it.productMax * it.step)} — non superata in automatico: oltre serve una valutazione veterinaria`, kind: 'product_max', hardness: 'hard' });
    if (it.kind === 'supplement' && it.step === 1) constraints.push({ name: `int_${it.v}`, label: `${it.name}: solo dosi intere`, kind: 'product_max', hardness: 'hard' });
  }

  // Fase 1: copertura dei nutrienti con dati parziali (con tutti i vincoli rigidi)
  let model = built.model;
  const cover = devObjective(built.rows, 'coverage');
  const p1 = runSolve({ ...model, objective: cover });
  phases.push({ name: 'Vincoli rigidi e copertura', status: p1.rawStatus, objective: p1.status === 'optimal' ? p1.objective : null });
  if (p1.status === 'infeasible') {
    const conflicts = diagnose(built, runSolve);
    return {
      ...base,
      constraints,
      outcome: 'infeasible',
      conflicts,
      suggestions: suggestionsFor(conflicts, input, items),
      message: conflicts.length
        ? 'Nessuna soluzione valida: i vincoli elencati non possono essere rispettati insieme con questi componenti.'
        : 'Nessuna soluzione valida con i componenti selezionati (conflitto dovuto alle dosi intere o agli arrotondamenti).',
    };
  }
  if (p1.status !== 'optimal') {
    return { ...base, constraints, outcome: p1.status === 'timeout' ? 'timeout' : 'error', message: `Il calcolo non è terminato (${p1.rawStatus}). Nessuna quantità proposta.` };
  }
  model = fixObjective(model, cover, p1.objective, 'fix_cover');

  // Fase 2: avvicinarsi all'obiettivo kcal
  const energyObj: Term[] = [{ v: 'ep', c: 1 / built.K }, { v: 'en', c: 1 / built.K }];
  const p2 = runSolve({ ...model, objective: energyObj });
  phases.push({ name: 'Obiettivo kcal', status: p2.rawStatus, objective: p2.status === 'optimal' ? p2.objective : null });
  let last = p1;
  if (p2.status === 'optimal') {
    model = fixObjective(model, energyObj, p2.objective, 'fix_energy');
    last = p2;
  }

  // Fase 3: preferenze morbide (target personali, soglie non ufficiali, quote energetiche)
  const pref = devObjective(built.rows, 'preference');
  if (pref.length) {
    const p3 = runSolve({ ...model, objective: pref });
    phases.push({ name: 'Preferenze', status: p3.rawStatus, objective: p3.status === 'optimal' ? p3.objective : null });
    if (p3.status === 'optimal') {
      model = fixObjective(model, pref, p3.objective, 'fix_pref');
      last = p3;
    }
  }

  // Fase 4: praticità — meno integratori possibile; costo se tutti i prezzi sono noti
  const prices = input.unitPrices ?? {};
  const allPriced = items.every((it) => typeof prices[it.id] === 'number');
  const practical: Term[] = items
    .filter((it) => it.kind === 'supplement')
    .map((it) => ({ v: it.v, c: 1e-3 / Math.max((it.productMax ?? it.ub ?? 1000) * it.step, 1e-6) * it.step }));
  // porzione più compatta: a parità di tutto il resto, meno grammi totali di alimenti (criterio pratico, non nutrizionale)


  for (const it of items) if (it.kind === 'food') practical.push({ v: it.v, c: (1e-4 * it.step) / built.K });
  if (input.settings.preferLowerCost && allPriced) {
    for (const it of items) practical.push({ v: it.v, c: (prices[it.id] as number) * it.step });
    notes.push('A parità di nutrienti è stata scelta la combinazione meno costosa con i tuoi prezzi.');
  } else if (input.settings.preferLowerCost) {
    notes.push('Costo non usato come criterio: mancano prezzi per alcuni componenti.');
  }
  if (practical.length) {
    const p4 = runSolve({ ...model, objective: practical });
    phases.push({ name: 'Praticità e costo', status: p4.rawStatus, objective: p4.status === 'optimal' ? p4.objective : null });
    if (p4.status === 'optimal') last = p4;
  }

  const proposal = toItems(built, last.values);
  for (const it of proposal) {
    if (it.qty === 0) {
      const name = items.find((x) => x.id === it.id)?.name;
      notes.push(`${name}: quantità 0 — non necessario per rispettare i vincoli. Aggiungi un minimo se vuoi includerlo.`);
    }
  }

  const foodsById = Object.fromEntries(input.foods.map(({ food }) => [food.id, food]));
  const suppById = Object.fromEntries(input.supplements.map(({ supplement }) => [supplement.id, supplement]));
  const audit = auditRecipe({
    items: proposal,
    foods: foodsById,
    supplements: suppById,
    nutrients: input.nutrients,
    limits: input.limits,
    dog: input.dog,
    dietMoisture: input.dietMoisture,
    settings: input.settings,
    excluded: excluded.map((e) => ({ name: e.name, reason: e.reason })),
  });
  return {
    ...base,
    constraints,
    outcome: 'solved',
    items: proposal,
    audit,
    message: audit.statusLabel,
  };
}

export interface PreliminaryResult {
  provisional: true;
  excluded: FormulationResult['excluded'];
  potentialGaps: { metric: string; label: string; coveredBySelectable: string[] }[];
  dataGaps: { metric: string; label: string; missingIn: string[] }[];
  message: string;
}

/**
 * Analisi preliminare (§8, allegato F step_two): con i soli alimenti, quali minimi/rapporti
 * probabilmente non si possono raggiungere. È solo indicativa: i deficit precisi si conoscono dopo il calcolo dei grammi.
 */
export async function preliminaryAnalysis(input: FormulationInput): Promise<PreliminaryResult> {
  const highs = await loadSolver();
  const runSolve = (m: Model) => solve(highs, m, input.settings.timeLimitSeconds);
  const { foods, excluded } = checkUsability({ ...input, supplements: [] });
  const label = new Map(input.nutrients.map((n) => [n.id, n.label]));
  const dataGaps: PreliminaryResult['dataGaps'] = [];
  const core = input.nutrients.filter((n) => n.kind === 'core' || n.kind === 'advanced');
  for (const n of core) {
    const missing = foods.filter(({ food }) => rawValue(food.nutrients, n.id) === null).map(({ food }) => food.name);
    if (missing.length) dataGaps.push({ metric: n.id, label: n.label, missingIn: missing });
  }
  if (!foods.length || !input.dog.kcalTarget) {
    return { provisional: true, excluded, potentialGaps: [], dataGaps, message: 'Nessun alimento utilizzabile o obiettivo kcal mancante.' };
  }
  const notes: string[] = [];
  const items = buildItems(input, foods, [], notes);
  const limits = applicableLimits(input.limits, input.dog, input.dietMoisture);
  const built = buildModel(input, items, limits, notes);
  const p = runSolve({ ...built.model, objective: devObjective(built.rows, 'coverage') });
  const gaps = new Map<string, string>();
  if (p.status === 'infeasible') {
    for (const c of diagnose(built, runSolve)) {
      if (c.metric && c.direction === 'deficit' && c.kind !== 'user_bound') gaps.set(c.metric, label.get(c.metric) ?? c.metric);
      if (c.metric && c.kind === 'official_ratio') gaps.set(c.metric, label.get(c.metric) ?? c.metric);
    }
  } else if (p.status === 'optimal') {
    for (const r of built.rows) {
      if (r.dev?.group === 'coverage' && (p.values[r.dev.v] ?? 0) / r.scale > 1e-6 && r.info.metric) {
        gaps.set(r.info.metric, label.get(r.info.metric) ?? r.info.metric);
      }
    }
  }
  const selectable = [...input.supplements.map((s) => s.supplement), ...(input.catalogForSuggestions?.supplements ?? [])];
  const potentialGaps = [...gaps].map(([metric, lbl]) => {
    const parts = RATIO_PARTS[metric] ?? [metric];
    const covered = [
      ...new Set(
        selectable
          .filter((s) => s.usableForOptimization && parts.some((pp) => (rawValue(s.nutrients, pp) ?? 0) > 0))
          .map((s) => s.name),
      ),
    ];
    return { metric, label: lbl, coveredBySelectable: covered };
  });
  return {
    provisional: true,
    excluded,
    potentialGaps,
    dataGaps,
    message: potentialGaps.length
      ? 'Con i soli alimenti scelti alcuni requisiti probabilmente non sono raggiungibili: potrebbe servire un’integrazione. Il fabbisogno preciso si conosce solo dopo il calcolo dei grammi.'
      : 'Con i soli alimenti scelti non emergono carenze evidenti. La verifica completa avviene dopo il calcolo dei grammi.',
  };
}
