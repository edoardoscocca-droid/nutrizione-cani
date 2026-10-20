// Motore di formulazione (§9, allegato F).
// Tutti gli alimenti e gli integratori selezionati sono variabili di UN SOLO modello di ottimizzazione:
// nessuna correzione in sequenza "aggiungi calcio → aggiungi fosforo" (T04).
// Ordine delle priorità: vincoli rigidi (limiti ufficiali, target professionali, bounds) →
// copertura dei nutrienti con dati parziali → obiettivo kcal → preferenze → praticità/costo.

import { foodStatus, supplementStatus } from './catalogStatus';
import { COMPOUNDS } from './totals';
import { doseRangeFor, weightSpan } from './doseGuide';
import { fediafReferenceKcal } from './energy';
import { applicableLimits, auditRecipe, type AuditResult, type DietMoisture, type SoftGap } from './audit';
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

export const ENGINE_VERSION = 'motore-2.0.0';

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
  | 'product_range'
  | 'recommended';

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

export type Outcome = 'solved' | 'infeasible' | 'blocked' | 'timeout' | 'error' | 'preferences_unreachable';

/**
 * Esito per l'utente, tenuto separato: vincoli necessari incompatibili; preferenze non raggiungibili (vincoli rispettati);
 * dati insufficienti per verificare la soluzione; soluzione verificata (con o senza scostamenti dichiarati).
 */
export { DIAGNOSIS_LABEL, diagnosisOf, type Diagnosis } from './diagnosis';

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
  /** tempi e ricerche: durata totale, numero di risoluzioni, ricerca P1 che ha avuto successo (1 = intervalli richiesti, 2 = ampliati). */
  stats?: { durationMs: number; solves: number; p1Stage: 1 | 2 | null };
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
  /** porzione minima se usato (in passi): 0 oppure almeno questa quantità. */
  semiMin: number | null;
  required: boolean;
  minQty: number | null;
  maxQty: number | null;
  productMax: number | null;
  /** dose minima consigliata dal produttore per il peso del cane (unità di dose), preferenza morbida. */
  guideMin: number | null;
  /** testo dell'intervallo consigliato (per le etichette dei vincoli). */
  guideText: string | null;
  /** minimo pratico del generatore (g) per gli alimenti; null per gli integratori. */
  practicalMin: number | null;
  /** prodotto con EPA+DHA documentati (olio): limite operativo ceil(T/u) e al più un prodotto equivalente. */
  omega: boolean;
  /** limite operativo del generatore per EPA+DHA, in passi (non è un massimo clinico). */
  omegaMax: number | null;
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

/**
 * Quantità minime (§6 della specifica del 20/10/2026). Selezionare un ingrediente lo rende disponibile (quantità ≥ 0):
 * - «includi sempre» (o un minimo obbligatorio) → almeno la porzione minima;
 * - «porzione minima se usato» dell'utente, oppure il minimo pratico del generatore → 0 oppure almeno quella porzione.
 */
function portionBounds(c: ItemConstraint | undefined, step: number, practical: number | null): Pick<ModelItem, 'lb' | 'semiMin' | 'required' | 'minQty'> {
  const userMin = c?.minIfUsed && c.minIfUsed > 0 ? c.minIfUsed : null;
  const minIfUsed = userMin ?? practical;
  const required = !!c?.required || (c?.minQty ?? 0) > 0;
  const minQty = required ? Math.max(c?.minQty ?? 0, minIfUsed ?? 0) || null : null;
  return {
    lb: required ? Math.max(1, Math.ceil((minQty ?? step) / step - 1e-9)) : 0,
    semiMin: !required && minIfUsed ? Math.max(1, Math.ceil(minIfUsed / step - 1e-9)) : null,
    required,
    minQty,
  };
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
  const K = input.dog.kcalTarget ?? 0;
  // obiettivo EPA+DHA attivo (g/die): limite operativo degli oli = ceil(T / EPA+DHA per unità)
  // (obiettivo aggiuntivo attivo o target EPA+DHA del professionista/utente, il maggiore)
  const epaTargets = [
    ...(input.dog.recommended ?? []).filter((r) => r.metric === 'epa_dha').map((r) => r.amountPerDay),
    ...input.dog.targets.filter((t) => t.metric === 'epa_dha' && t.lower !== null).map((t) => (t.basis === 'per_1000_kcal_me' ? ((t.lower as number) * K) / 1000 : (t.lower as number))),
  ];
  const epaTarget = epaTargets.length ? Math.max(...epaTargets) : null;
  foods.forEach(({ food, constraint }, i) => {
    const step = st.roundingFoodG;
    const kcalPerG = (food.kcalMePer100g as number) / 100;
    // politica del generatore (§6): un alimento attivo vale almeno max(5 g, 0,5% delle kcal obiettivo); niente grammi simbolici
    const practical = K > 0 && kcalPerG > 0 ? Math.max(5, (0.005 * K) / kcalPerG) : 5;
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
      ...portionBounds(constraint, step, practical),
      ub: constraint?.maxQty !== null && constraint?.maxQty !== undefined ? Math.floor(constraint.maxQty / step + 1e-9) : null,
      maxQty: constraint?.maxQty ?? null,
      productMax: null,
      guideMin: null,
      guideText: null,
      practicalMin: practical,
      omega: false,
      omegaMax: null,
    });
  });
  supplements.forEach(({ supplement: s, constraint }, i) => {
    const step = supplementStep(s, st);
    // tabella d'impiego del produttore: il massimo consigliato non si supera in automatico (serve una valutazione veterinaria)
    // tabella d'impiego del produttore sul PESO ATTUALE del cane, indicato esplicitamente (mai il peso ideale in modo implicito)
    const range = doseRangeFor(s.doseGuide, input.dog.weightCurrentKg);
    if (s.doseGuide && !range) notes.push(`${s.name}: la tabella d’impiego del produttore copre ${weightSpan(s.doseGuide)}; per il peso attuale di ${fmt(input.dog.weightCurrentKg)} kg nessun intervallo applicato.`);
    const declaredMax = s.maxDailyUnits !== null && s.maxDailySource ? s.maxDailyUnits : null;
    const productMax = range ? (declaredMax === null ? range.max : Math.min(declaredMax, range.max)) : declaredMax;
    // olio con EPA+DHA documentati: corregge solo il deficit di EPA+DHA, non completa calorie o vitamine (§9)
    const u = rawValue(s.nutrients, 'epa_dha');
    const omega = u !== null && u > 0;
    let omegaUnits: number | null = null;
    if (omega) {
      omegaUnits = epaTarget ? Math.ceil(epaTarget / (u as number) - 1e-9) : 0;
      if (!epaTarget && !constraint?.required && !constraint?.minQty) notes.push(`${s.name}: nessun obiettivo EPA+DHA attivo, quindi non viene usato (l’olio non serve a completare calorie o altri nutrienti).`);
    }
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
      ...portionBounds(constraint, step, null),
      ub: constraint?.maxQty !== null && constraint?.maxQty !== undefined ? Math.floor(constraint.maxQty / step + 1e-9) : null,
      maxQty: constraint?.maxQty ?? null,
      productMax: productMax !== null ? Math.floor(productMax / step + 1e-9) : null,
      guideMin: range ? range.min : null,
      guideText: range ? `${range.text} ${s.doseUnit}/die per il peso attuale di ${fmt(input.dog.weightCurrentKg)} kg — ${s.doseGuide!.source}` : null,
      practicalMin: null,
      omega,
      omegaMax: omegaUnits !== null ? Math.floor(omegaUnits / step + 1e-9) : null,
    });
  });
  return items;
}

/** coverage = minimi con dati parziali (H non dimostrabile); p1 = preferenze prioritarie (§3); preference = altre preferenze. */
type DevGroup = 'coverage' | 'p1' | 'preference';

interface BuiltRow extends Row {
  info: ConstraintInfo;
  /** scala per normalizzare scarti/violazioni. */
  scale: number;
  /** per righe morbide: nome della variabile di scarto e gruppo di priorità. */
  dev?: { v: string; group: DevGroup };
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
/** ripartizione energetica stimata dei macronutrienti (§7): fattori fissi 4/9/4, denominatore Ep+Ef+Ec. */
export const MACRO_SPLIT = { protein: 4, fat: 9, carbohydrate_available: 4 } as const;

/**
 * Ampliamento della seconda ricerca (§5), solo per le preferenze P1 non fissate da un professionista:
 * quote macro ±5 punti percentuali; fibra ±20% di ciascun estremo; Ca:P 1,2–1,4 → 1,1–1,5 (±0,1).
 */
export function p1Widening(l: NutrientLimit): { lower: number | null; upper: number | null } | null {
  if (l.hardness === 'hard') return null;
  if (l.basis === 'energy_pct' && MACRO_PARTS[l.metric] && l.limitClass === 'PERSONAL_TARGET') {
    return { lower: l.lower === null ? null : Math.max(0, l.lower - 5), upper: l.upper === null ? null : Math.min(100, l.upper + 5) };
  }
  if (l.metric === 'fiber' && l.limitClass === 'PERSONAL_TARGET') {
    return { lower: l.lower === null ? null : l.lower * 0.8, upper: l.upper === null ? null : l.upper * 1.2 };
  }
  if (l.metric === 'ca_p_ratio' && (l.limitClass === 'NON_OFFICIAL_ATTENTION' || l.limitClass === 'PERSONAL_TARGET')) {
    return { lower: l.lower === null ? null : l.lower - 0.1, upper: l.upper === null ? null : l.upper + 0.1 };
  }
  return null;
}

function buildRows(
  input: FormulationInput,
  items: ModelItem[],
  limits: NutrientLimit[],
  notes: string[],
): { rows: BuiltRow[]; widened: BuiltRow[]; extraVars: VarDef[] } {
  const K = input.dog.kcalTarget as number;
  const label = new Map(input.nutrients.map((n) => [n.id, n.label]));
  const unit = new Map(input.nutrients.map((n) => [n.id, n.unit]));
  const rows: BuiltRow[] = [];
  const widened: BuiltRow[] = [];
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

  const kindOf = (l: NutrientLimit): ConstraintKind => {
    if (l.limitClass === 'OFFICIAL_MIN') return l.basis === 'ratio' ? 'official_ratio' : 'official_min';
    if (l.limitClass === 'OFFICIAL_NUTRITIONAL_MAX') return l.basis === 'ratio' ? 'official_ratio' : 'official_max';
    if (l.limitClass === 'LEGAL_MAX') return 'legal_max';
    if (l.limitClass === 'PERSONAL_TARGET') return l.hardness === 'hard' ? 'personal_locked' : 'personal_soft';
    if (l.limitClass === 'RECOMMENDED_ALLOWANCE') return 'recommended';
    return 'non_official';
  };

  /** termini (≥/≤ 0 dopo aver spostato il limite) di un lato del limite; null = base non utilizzabile nel calcolo. */
  const termsFor = (l: NutrientLimit, bound: number): { terms: Term[]; rhs: number; scale: number; unitLabel: string; dataComplete: boolean } | null => {
    if (l.basis === 'per_1000_kcal_me' || l.basis === 'per_day') {
      if (!label.has(l.metric)) return null;
      const terms = coef(l.metric);
      if (l.basis === 'per_1000_kcal_me') {
        for (const it of items) terms.push({ v: it.v, c: (-bound / 1000) * it.kcal });
        return { terms, rhs: 0, scale: Math.max((bound * K) / 1000, 1e-9), unitLabel: `${unit.get(l.metric)}/1000 kcal`, dataComplete: complete(l.metric) };
      }
      return { terms, rhs: bound, scale: Math.max(bound, 1e-9), unitLabel: `${unit.get(l.metric)}/die`, dataComplete: complete(l.metric) };
    }
    if (l.basis === 'ratio') {
      const parts = RATIO_PARTS[l.metric];
      if (!parts) return null;
      const [a, b] = parts;
      return { terms: [...coef(a), ...coef(b).map((t) => ({ v: t.v, c: -bound * t.c }))], rhs: 0, scale: minDaily(a), unitLabel: '', dataComplete: complete(a) && complete(b) };
    }
    if (l.basis === 'energy_pct') {
      const part = MACRO_PARTS[l.metric];
      if (!part) return null;
      // quota sulla ripartizione energetica stimata 4/9/4 (Ep+Ef+Ec), separata dalla EM usata per i fabbisogni
      const den = (it: ModelItem) => (Object.keys(MACRO_SPLIT) as (keyof typeof MACRO_SPLIT)[]).reduce((a, k) => a + (it.value(k) ?? 0) * MACRO_SPLIT[k], 0);
      const terms = items.map((it) => ({ v: it.v, c: (it.value(part) ?? 0) * MACRO_SPLIT[part] - (bound / 100) * den(it) }));
      const dataComplete = (['protein', 'fat', 'carbohydrate_available'] as const).every((k) => complete(k));
      return { terms, rhs: 0, scale: K, unitLabel: '% energia macro stimata (4/9/4)', dataComplete };
    }
    return null;
  };

  for (const l of limits) {
    if (l.limitClass === 'INFORMATIONAL_REFERENCE') continue;
    const sides: ['lower' | 'upper', number][] = [];
    if (l.lower !== null) sides.push(['lower', l.lower]);
    if (l.upper !== null) sides.push(['upper', l.upper]);
    const wide = p1Widening(l);
    for (const [side, bound] of sides) {
      const t = termsFor(l, bound);
      if (!t) {
        notes.push(`${label.get(l.metric) ?? l.metric}: limite su base ${l.basis} non usato nel calcolo (nessuna conversione verificata).`);
        continue;
      }
      const op: '>=' | '<=' = side === 'lower' ? '>=' : '<=';
      const kind = kindOf(l);
      const what = l.limitClass === 'RECOMMENDED_ALLOWANCE' ? (l.displayLabel ?? 'apporto raccomandato') : side === 'lower' ? 'minimo' : 'massimo';
      const desc = `${label.get(l.metric) ?? l.metric}: ${what} ${fmt(bound)} ${t.unitLabel} (${l.source})`.replace('  ', ' ');
      // Livello H (§3): limiti ufficiali, target professionali, obiettivo EPA+DHA attivo. Con dati parziali un minimo o un
      // rapporto non è dimostrabile: copertura dei contributi noti (la verifica lo segnala come non verificabile).
      const isH = l.hardness === 'hard' || l.limitClass === 'RECOMMENDED_ALLOWANCE';
      let hard = isH;
      let group: DevGroup = wide ? 'p1' : 'preference';
      if (hard && !t.dataComplete && !(side === 'upper' && l.basis !== 'ratio')) {
        hard = false;
        group = 'coverage';
      }
      const push = (bnd: number, terms: Term[], rhs: number, extraLabel = '') => {
        const name = `r${rows.length}`;
        const row: BuiltRow = {
          name,
          terms,
          op,
          rhs,
          scale: t.scale,
          info: { name, label: desc + extraLabel + (group === 'coverage' ? ' — dati parziali' : ''), kind: group === 'coverage' ? 'coverage_partial' : kind, hardness: hard ? 'hard' : 'soft', metric: l.metric },
        };
        void bnd;
        if (!hard) {
          const dv = `d${devCount++}`;
          extraVars.push({ name: dv, lb: 0, ub: null, integer: false });
          row.terms = [...row.terms, { v: dv, c: op === '>=' ? 1 : -1 }];
          row.dev = { v: dv, group };
        }
        rows.push(row);
      };
      push(bound, t.terms, t.rhs);
      // minimi per 1000 kcal su E_controllo = max(E_target, E_finale) (§4): non si abbassano con la tolleranza calorica
      if (side === 'lower' && l.basis === 'per_1000_kcal_me' && K > 0) push(bound, coef(l.metric), (bound * K) / 1000, ` — anche su ${fmt(K)} kcal obiettivo`);
      // seconda ricerca: stesso vincolo con l'ampliamento documentato, rigido (aggiunto solo se serve)
      if (wide) {
        const wb = side === 'lower' ? wide.lower : wide.upper;
        const wt = wb === null ? null : termsFor(l, wb);
        if (wt) {
          const name = `w${widened.length}`;
          widened.push({ name, terms: wt.terms, op, rhs: wt.rhs, scale: wt.scale, info: { name, label: `${label.get(l.metric) ?? l.metric}: ${side === 'lower' ? 'minimo' : 'massimo'} ampliato ${fmt(wb as number)} ${wt.unitLabel}`, kind, hardness: 'hard', metric: l.metric } });
        }
      }
    }
  }
  return { rows, widened, extraVars };
}

interface Built {
  model: Model;
  rows: BuiltRow[];
  /** righe della seconda ricerca (preferenze P1 ampliate). */
  widened: BuiltRow[];
  items: ModelItem[];
  energyDev: string[];
  K: number;
  /** livelli già fissati dalle fasi precedenti (copertura H, unità EPA+DHA): la diagnosi li tratta come vincoli. */
  locks?: { row: Row; info: ConstraintInfo }[];
}

function buildModel(input: FormulationInput, items: ModelItem[], limits: NutrientLimit[], notes: string[]): Built {
  const K = input.dog.kcalTarget as number;
  const tol = input.settings.energyTolerancePct / 100;
  const { rows, widened, extraVars } = buildRows(input, items, limits, notes);
  const vars: VarDef[] = items.map((it) => {
    let ub = it.ub;
    for (const m of [it.productMax, it.omegaMax]) if (m !== null) ub = ub === null ? m : Math.min(ub, m);
    if (ub === null) {
      // limite tecnico per evitare modelli illimitati (un componente senza energia): 10 kg o 10.000 dosi
      ub = Math.ceil(10000 / it.step);
    }
    return { name: it.v, lb: it.lb, ub, integer: it.integerUnits };
  });
  const extraRows: Row[] = [];
  // porzione minima se usato: x = 0 oppure x ≥ porzione (variabile binaria y: x ≤ U·y, x ≥ m·y)
  const usedVar = new Map<string, string>();
  const used = (it: ModelItem) => {
    let y = usedVar.get(it.v);
    if (y) return y;
    y = `y_${it.v}`;
    usedVar.set(it.v, y);
    const U = vars.find((x) => x.name === it.v)!.ub as number;
    vars.push({ name: y, lb: 0, ub: 1, integer: true });
    extraRows.push({ name: `use_${it.v}`, terms: [{ v: it.v, c: 1 }, { v: y, c: -U }], op: '<=', rhs: 0 });
    return y;
  };
  for (const it of items) {
    if (it.semiMin === null) continue;
    const v = vars.find((x) => x.name === it.v)!;
    if (it.semiMin > (v.ub as number)) {
      v.ub = 0;
      notes.push(`${it.name}: la porzione minima supera la quantità massima consentita, quindi non viene usato.`);
      continue;
    }
    if ((v.ub as number) === 0) continue;
    const y = used(it);
    extraRows.push({ name: `semi_lo_${it.v}`, terms: [{ v: it.v, c: 1 }, { v: y, c: -it.semiMin }], op: '>=', rhs: 0 });
  }
  // più oli con EPA+DHA equivalenti non si accumulano: al massimo uno, salvo quelli resi obbligatori dall'utente (§9)
  const omegas = items.filter((it) => it.omega && (vars.find((x) => x.name === it.v)!.ub as number) > 0);
  if (omegas.length > 1 && omegas.filter((it) => it.required).length <= 1) {
    extraRows.push({ name: 'omega_one', terms: omegas.map((it) => ({ v: used(it), c: 1 })), op: '<=', rhs: 1 });
  }
  // dose minima della tabella del produttore: preferenza solo SE il prodotto viene usato (non ne forza l'uso, §10)
  let gd = 0;
  for (const it of items) {
    if (it.guideMin === null || !(it.guideMin > 0) || (vars.find((x) => x.name === it.v)!.ub as number) === 0) continue;
    const y = used(it);
    const dv = `g${gd++}`;
    vars.push({ name: dv, lb: 0, ub: null, integer: false });
    const name = `r${rows.length}`;
    rows.push({
      name,
      terms: [{ v: it.v, c: it.step }, { v: dv, c: 1 }, { v: y, c: -it.guideMin }],
      op: '>=',
      rhs: 0,
      scale: Math.max(it.guideMin, 1e-9),
      dev: { v: dv, group: 'preference' },
      info: { name, label: `${it.name}: dose consigliata dal produttore ${it.guideText} (se usato)`, kind: 'product_range', hardness: 'soft' },
    });
  }
  const energyRow: BuiltRow = {
    name: 'energy',
    terms: [...items.map((it) => ({ v: it.v, c: it.kcal })), { v: 'ep', c: -1 }, { v: 'en', c: 1 }],
    op: '=',
    rhs: K,
    scale: K,
    info: { name: 'energy', label: `Energia: ${fmt(K)} kcal ±${input.settings.energyTolerancePct}%`, kind: 'energy', hardness: 'hard' },
  };
  vars.push({ name: 'ep', lb: 0, ub: tol * K, integer: false }, { name: 'en', lb: 0, ub: tol * K, integer: false }, ...extraVars);
  return { model: { vars, rows: [energyRow, ...rows, ...extraRows], objective: [] }, rows: [energyRow, ...rows], widened, items, energyDev: ['ep', 'en'], K };
}

function devObjective(rows: BuiltRow[], group: DevGroup): Term[] {
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

/**
 * @param forced riga morbida da rendere rigida (senza scarto): serve a capire quali vincoli rigidi impediscono
 *        di rispettare una preferenza o un obiettivo aggiuntivo.
 */
function diagnoseWith(built: Built, highsSolve: (m: Model) => SolveResult, relaxEnergy: boolean, forced?: BuiltRow): Conflict[] | null {
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
    if (forced && r.name === forced.name) {
      rows.push({ name: r.name, terms: r.terms.filter((t) => t.v !== r.dev?.v), op: r.op, rhs: r.rhs });
    } else if (!r.dev) {
      const s = addSlack(r.info, r.scale, r.op === '>=' ? 'deficit' : 'excess');
      rows.push({ name: r.name, terms: [...r.terms, { v: s, c: r.op === '>=' ? 1 : -1 }], op: r.op, rhs: r.rhs });
    } else {
      rows.push({ name: r.name, terms: r.terms, op: r.op, rhs: r.rhs });
    }
  }
  for (const l of built.locks ?? []) {
    const cov = built.rows.find((r) => r.dev && l.row.terms.length === 1 && r.dev.v === l.row.terms[0].v);
    const s = addSlack(l.info, cov ? cov.scale : Math.max(Math.abs(l.row.rhs), 1e-3), cov ? 'deficit' : 'excess');
    rows.push({ name: l.row.name, terms: [...l.row.terms, { v: s, c: -1 }], op: l.row.op, rhs: l.row.rhs });
  }
  for (const it of built.items) {
    const ub = [it.ub, it.productMax, it.omegaMax].filter((x): x is number => x !== null);
    if (it.lb > 0) {
      const s = addSlack({ name: `lb_${it.v}`, label: `Limite scelto: ${it.name} sempre incluso, almeno ${fmt(it.minQty ?? it.lb * it.step)}`, kind: 'user_bound', hardness: 'hard' }, it.lb, 'excess');
      rows.push({ name: `lb_${it.v}`, terms: [{ v: it.v, c: 1 }, { v: s, c: 1 }], op: '>=', rhs: it.lb });
    }
    if (ub.length) {
      const u = Math.min(...ub);
      const isProduct = it.productMax !== null && u === it.productMax;
      const isOmega = it.omegaMax !== null && u === it.omegaMax;
      const s = addSlack(
        {
          name: `ub_${it.v}`,
          label: isOmega
            ? `Limite operativo del generatore per EPA+DHA: ${it.name} non oltre ${fmt(u * it.step)} (copre l’obiettivo; non è un massimo clinico)`
            : isProduct
              ? `Dose massima del produttore: ${it.name} ${fmt(u * it.step)} (superarla richiede una valutazione veterinaria)`
              : `Limite scelto: ${it.name} non oltre ${fmt(it.maxQty ?? u * it.step)}`,
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
    const ub = [it.ub, it.productMax, it.omegaMax].filter((x): x is number => x !== null);
    if (!ub.length || !out.some((c) => c.kind !== 'user_bound' && c.kind !== 'product_max')) continue;
    const u = Math.min(...ub);
    if ((res.values[it.v] ?? 0) >= u - 1e-6 && !out.some((c) => c.label.includes(it.name))) {
      const isProduct = it.productMax !== null && u === it.productMax;
      const isOmega = it.omegaMax !== null && u === it.omegaMax;
      out.push({
        label: `${isOmega ? 'Limite operativo EPA+DHA' : isProduct ? 'Dose massima del produttore' : 'Limite scelto'}: ${it.name} non oltre ${fmt(u * it.step)} — raggiunto, contribuisce al conflitto`,
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
  const t0 = Date.now();
  const highs = await loadSolver();
  let solves = 0;
  const runSolve = (m: Model) => {
    solves++;
    return solve(highs, m, input.settings.timeLimitSeconds);
  };
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
  const done = <T extends Omit<FormulationResult, 'stats'>>(r: T): FormulationResult => ({ ...r, stats: { durationMs: Date.now() - t0, solves, p1Stage: null, ...(r as { stats?: object }).stats } });
  if (!input.dog.kcalTarget || !(input.dog.kcalTarget > 0)) {
    return done({ ...base, outcome: 'blocked', message: 'Imposta l’obiettivo kcal del cane prima di calcolare.' });
  }
  // §4: sotto 95 kcal/kg^0,75 del peso di riferimento la generazione conforme richiede un profilo a bassa energia validato
  const refKcal = fediafReferenceKcal(input.dog.weightIdealKg);
  if (input.dog.lifeStage === 'adult_maintenance' && input.dog.kcalTarget < refKcal - 1e-6) {
    return done({
      ...base,
      outcome: 'blocked',
      message: `Obiettivo di ${fmt(input.dog.kcalTarget)} kcal sotto il riferimento FEDIAF di 95 kcal/kg^0,75 del peso ideale (${fmt(input.dog.weightIdealKg)} kg → ${fmt(Math.round(refKcal))} kcal): i minimi per 1000 kcal non coprirebbero il fabbisogno. Serve un profilo a bassa energia validato prima di generare una ricetta; le ricette esistenti restano analizzabili.`,
    });
  }
  if (!foods.length) {
    return done({
      ...base,
      outcome: 'blocked',
      message: 'Nessun alimento selezionato è utilizzabile: le composizioni devono essere inserite e verificate in catalogo.',
    });
  }
  const limits = applicableLimits(input.limits, input.dog, input.dietMoisture);
  if (input.dog.lifeStage !== 'adult_maintenance') {
    notes.push('Nessuno standard disponibile per questa fase di vita: il calcolo considera solo energia e target personali.');
  }
  // §14.3: infattibilità evidente prima del calcolo (nessuna ricerca inutile)
  const trivial = trivialConflicts(input, limits);
  if (trivial.length) {
    return done({ ...base, outcome: 'preferences_unreachable', conflicts: trivial, message: 'Preferenze incompatibili tra loro: nessun menù può rispettarle. Rivedi gli intervalli indicati.' });
  }
  const items = buildItems(input, foods, supplements, notes);
  const built = buildModel(input, items, limits, notes);
  const constraints = built.rows.map((r) => r.info);
  for (const it of items) {
    if (it.required) constraints.push({ name: `lb_${it.v}`, label: `${it.name}: sempre incluso${it.minQty ? `, almeno ${fmt(it.minQty)}` : ''}`, kind: 'user_bound', hardness: 'hard' });
    if (it.semiMin !== null)
      constraints.push({ name: `semi_${it.v}`, label: `${it.name}: se usato, almeno ${fmt(it.semiMin * it.step)}${it.practicalMin !== null ? ' (minimo pratico del generatore: 5 g o 0,5% delle kcal)' : ''} — altrimenti 0`, kind: 'user_bound', hardness: 'hard' });
    if (it.maxQty !== null) constraints.push({ name: `ub_${it.v}`, label: `${it.name}: non oltre ${fmt(it.maxQty)}`, kind: 'user_bound', hardness: 'hard' });
    if (it.productMax !== null)
      constraints.push({ name: `pm_${it.v}`, label: `${it.name}: dose massima del produttore ${fmt(it.productMax * it.step)}${it.guideText ? ` (tabella d’impiego: ${it.guideText})` : ''} — non superata in automatico: oltre serve una valutazione veterinaria`, kind: 'product_max', hardness: 'hard' });
    if (it.omegaMax !== null)
      constraints.push({ name: `om_${it.v}`, label: `${it.name}: limite operativo del generatore ${fmt(it.omegaMax * it.step)} (copre l’obiettivo EPA+DHA; non è un massimo clinico)`, kind: 'product_max', hardness: 'hard' });
    if (it.kind === 'supplement' && it.step === 1) constraints.push({ name: `int_${it.v}`, label: `${it.name}: solo dosi intere`, kind: 'product_max', hardness: 'hard' });
  }
  const timeout = (r: SolveResult) =>
    done({ ...base, constraints, outcome: r.status === 'timeout' ? 'timeout' : 'error', message: `Calcolo non completato (${r.rawStatus}): la fattibilità non è stata determinata. Nessuna quantità proposta.` });

  // H: vincoli necessari e copertura dei minimi con dati parziali (preferenze libere)
  let model = built.model;
  const cover = devObjective(built.rows, 'coverage');
  const h = runSolve({ ...model, objective: cover });
  phases.push({ name: 'H: vincoli necessari e copertura', status: h.rawStatus, objective: h.status === 'optimal' ? h.objective : null });
  if (h.status === 'infeasible') {
    const conflicts = diagnose(built, runSolve);
    return done({
      ...base,
      constraints,
      outcome: 'infeasible',
      conflicts,
      suggestions: suggestionsFor(conflicts, input, items),
      message: conflicts.length
        ? 'Nessuna soluzione valida: i vincoli elencati non possono essere rispettati insieme con questi componenti.'
        : 'Nessuna soluzione valida con i componenti selezionati (conflitto dovuto alle dosi intere o agli arrotondamenti).',
    });
  }
  if (h.status !== 'optimal') return timeout(h);
  model = fixObjective(model, cover, h.objective, 'fix_cover');
  const locks: NonNullable<Built['locks']> = [];
  const lockOf = (name: string, label: string, kind: ConstraintKind) => {
    const row = model.rows.find((r) => r.name === name);
    if (row) locks.push({ row, info: { name, label, kind, hardness: 'hard' } });
  };
  // per la diagnosi: ogni minimo con dati incompleti al livello di copertura raggiunto in H (coperto = vincolo; parziale = deficit fissato)
  for (const r of built.rows) {
    if (r.dev?.group !== 'coverage') continue;
    const d = h.values[r.dev.v] ?? 0;
    const covered = d / r.scale <= 1e-6;
    locks.push({
      row: { name: `lock_${r.name}`, terms: [{ v: r.dev.v, c: 1 }], op: '<=', rhs: covered ? 0 : d * (1 + 1e-6) + 1e-9 },
      info: {
        name: `lock_${r.name}`,
        label: `${r.info.label.replace(' — dati parziali', '')} — ${covered ? 'coperto con i soli dati noti (livello H)' : 'copertura parziale massima con i dati noti, fissata in H'}`,
        kind: 'coverage_partial',
        hardness: 'hard',
        metric: r.info.metric,
      },
    });
  }
  let last = h;

  // oli EPA+DHA: il minor numero di unità che copre l'obiettivo, prima di qualunque preferenza (§9)
  const omegaObj: Term[] = items.filter((it) => it.omega).map((it) => ({ v: it.v, c: it.step }));
  if (omegaObj.length) {
    const o = runSolve({ ...model, objective: omegaObj });
    phases.push({ name: 'EPA+DHA: minimo indispensabile', status: o.rawStatus, objective: o.status === 'optimal' ? o.objective : null });
    if (o.status !== 'optimal') return timeout(o);
    model = fixObjective(model, omegaObj, o.objective, 'fix_omega');
    lockOf('fix_omega', `Livello H — EPA+DHA con il minor numero di unità di olio (${fmt(o.objective)})`, 'recommended');
    last = o;
  }

  // P1, prima ricerca: tutti gli intervalli richiesti
  const p1Rows = built.rows.filter((r) => r.dev?.group === 'p1');
  let p1Stage: 1 | 2 | null = null;
  if (p1Rows.length) {
    const zero = new Set(p1Rows.map((r) => r.dev!.v));
    const strict = { ...model, vars: model.vars.map((v) => (zero.has(v.name) ? { ...v, ub: 0 } : v)) };
    const a = runSolve({ ...strict, objective: [] });
    phases.push({ name: 'P1: prima ricerca (intervalli richiesti)', status: a.rawStatus, objective: a.status === 'optimal' ? 0 : null });
    if (a.status === 'optimal') {
      model = strict;
      last = a;
      p1Stage = 1;
    } else if (a.status === 'infeasible') {
      // seconda ricerca: solo gli ampliamenti documentati, avvicinandosi il più possibile agli intervalli richiesti
      const p1Obj = devObjective(built.rows, 'p1');
      const wide = { ...model, rows: [...model.rows, ...built.widened] };
      const b = runSolve({ ...wide, objective: p1Obj });
      phases.push({ name: 'P1: seconda ricerca (ampliamenti documentati)', status: b.rawStatus, objective: b.status === 'optimal' ? b.objective : null });
      if (b.status === 'optimal') {
        model = fixObjective(wide, p1Obj, b.objective, 'fix_p1');
        last = b;
        p1Stage = 2;
        notes.push('Preferenze raggiunte solo con la seconda ricerca (ampliamenti documentati): vedi gli scostamenti.');
      } else if (b.status === 'infeasible') {
        // diagnostico: il candidato più vicino (H rispettati) si mostra, ma non è un menù riuscito
        const c = runSolve({ ...model, objective: p1Obj });
        phases.push({ name: 'P1: diagnosi', status: c.rawStatus, objective: c.status === 'optimal' ? c.objective : null });
        if (c.status !== 'optimal') return timeout(c);
        const proposal = toItems(built, c.values);
        const audit = finalAudit(input, proposal, excluded);
        const softGaps = softGapAnalysis({ ...built, locks }, c.values, runSolve);
        if (softGaps.length) audit.softGaps = softGaps;
        // motivo: violazione minima necessaria con le preferenze AMPLIATE trattate come vincoli (insieme ai vincoli H)
        const p1Conflicts = diagnoseWith({ ...built, locks, rows: [...built.rows, ...built.widened] }, runSolve, false) ?? [];
        return done({
          ...base,
          constraints: [...constraints, ...built.widened.map((w) => w.info)],
          conflicts: p1Conflicts,
          outcome: 'preferences_unreachable',
          items: proposal,
          audit,
          message: 'Preferenze non raggiungibili nemmeno con gli ampliamenti documentati. Le quantità mostrate sono solo diagnostiche (vincoli necessari rispettati): non è un menù generato.',
        });
      } else return timeout(b);
    } else return timeout(a);
  }

  // altre preferenze (target personali, soglie non ufficiali, dosi consigliate dal produttore se usato)
  const pref = devObjective(built.rows, 'preference');
  if (pref.length) {
    const p = runSolve({ ...model, objective: pref });
    phases.push({ name: 'Altre preferenze', status: p.rawStatus, objective: p.status === 'optimal' ? p.objective : null });
    if (p.status !== 'optimal') return timeout(p);
    model = fixObjective(model, pref, p.objective, 'fix_pref');
    last = p;
  }

  // P2: praticità — energia vicina all'obiettivo, meno integratori, porzione compatta
  const practical: Term[] = [{ v: 'ep', c: 1 / built.K }, { v: 'en', c: 1 / built.K }];
  for (const it of items) {
    if (it.kind === 'supplement') practical.push({ v: it.v, c: (1e-2 * it.step) / Math.max((it.productMax ?? it.omegaMax ?? it.ub ?? 1000) * it.step, 1e-6) });
    else practical.push({ v: it.v, c: (1e-4 * it.step) / built.K });
  }
  const p2 = runSolve({ ...model, objective: practical });
  phases.push({ name: 'P2: praticità', status: p2.rawStatus, objective: p2.status === 'optimal' ? p2.objective : null });
  if (p2.status !== 'optimal') return timeout(p2);
  last = p2;

  // P3: costo, solo con tutti i prezzi noti; non sostituisce P1 o P2
  const prices = input.unitPrices ?? {};
  const allPriced = items.every((it) => typeof prices[it.id] === 'number');
  if (input.settings.preferLowerCost && allPriced) {
    model = fixObjective(model, practical, p2.objective, 'fix_p2');
    const cost: Term[] = items.map((it) => ({ v: it.v, c: (prices[it.id] as number) * it.step }));
    const p3 = runSolve({ ...model, objective: cost });
    phases.push({ name: 'P3: costo', status: p3.rawStatus, objective: p3.status === 'optimal' ? p3.objective : null });
    if (p3.status === 'optimal') {
      last = p3;
      notes.push('A parità di vincoli, preferenze e praticità è stata scelta la combinazione meno costosa con i tuoi prezzi.');
    }
  } else if (input.settings.preferLowerCost) {
    notes.push('Costo non usato come criterio: mancano prezzi per alcuni componenti.');
  }

  const proposal = toItems(built, last.values);
  for (const it of proposal) {
    if (it.qty === 0) {
      const name = items.find((x) => x.id === it.id)?.name;
      notes.push(`${name}: non usato (quantità 0) — non necessario per rispettare i vincoli. Attiva «includi sempre» se vuoi usarlo.`);
    }
  }
  // verifica indipendente sulle quantità mostrate (già intere/arrotondate ai passi)
  const audit = finalAudit(input, proposal, excluded);
  const softGaps = softGapAnalysis({ ...built, locks }, last.values, runSolve);
  if (softGaps.length) audit.softGaps = softGaps;
  return done({
    ...base,
    constraints,
    outcome: 'solved',
    items: proposal,
    audit,
    message: audit.statusLabel,
    stats: { p1Stage },
  } as Omit<FormulationResult, 'stats'>);
}

/** Righe del modello come passate al solver (per il collaudo e i resoconti): coefficienti per ingrediente. */
export function inspectModel(input: FormulationInput) {
  const notes: string[] = [];
  const { foods, supplements } = checkUsability(input);
  const limits = applicableLimits(input.limits, input.dog, input.dietMoisture);
  const items = buildItems(input, foods, supplements, notes);
  const built = buildModel(input, items, limits, notes);
  const names = new Map(items.map((it) => [it.v, `${it.name} (per ${fmt(it.step)} ${it.kind === 'food' ? 'g' : 'unità'})`]));
  const byVar = new Map(items.map((it) => [it.v, it]));
  const show = (r: Row & { info?: ConstraintInfo; dev?: unknown }) => ({
    label: r.info?.label ?? r.name,
    op: r.op,
    rhs: r.rhs,
    hard: !r.dev,
    terms: r.terms.filter((t) => names.has(t.v)).map((t) => ({ item: names.get(t.v)!, id: byVar.get(t.v)!.id, step: byVar.get(t.v)!.step, coef: t.c })),
  });
  return { rows: built.rows.map(show), widened: built.widened.map(show), items: items.map((it) => ({ name: it.name, lb: it.lb * it.step, ub: [it.ub, it.productMax, it.omegaMax].filter((x): x is number => x !== null).map((x) => x * it.step), semiMin: it.semiMin === null ? null : it.semiMin * it.step })), notes };
}

function finalAudit(input: FormulationInput, proposal: RecipeItem[], excluded: FormulationResult['excluded']) {
  return auditRecipe({
    items: proposal,
    foods: Object.fromEntries(input.foods.map(({ food }) => [food.id, food])),
    supplements: Object.fromEntries(input.supplements.map(({ supplement }) => [supplement.id, supplement])),
    nutrients: input.nutrients,
    limits: input.limits,
    dog: input.dog,
    dietMoisture: input.dietMoisture,
    settings: input.settings,
    excluded: excluded.map((e) => ({ name: e.name, reason: e.reason })),
  });
}

/** Incompatibilità evidenti tra preferenze sulle quote macro (la somma delle quote stimate è 100%). */
function trivialConflicts(input: FormulationInput, limits: NutrientLimit[]): Conflict[] {
  const macro = limits.filter((l) => l.basis === 'energy_pct' && MACRO_PARTS[l.metric]);
  const out: Conflict[] = [];
  // per le preferenze ampliabili vale l'ampliamento massimo; per quelle fissate dal professionista il valore richiesto
  const lo = (l: NutrientLimit) => (l.lower === null ? 0 : (p1Widening(l)?.lower ?? l.lower));
  const hi = (l: NutrientLimit) => (l.upper === null ? 100 : (p1Widening(l)?.upper ?? l.upper));
  const metrics = Object.keys(MACRO_PARTS);
  const minFor = (m: string) => Math.max(0, ...macro.filter((l) => l.metric === m).map(lo));
  const maxFor = (m: string) => Math.min(100, ...macro.filter((l) => l.metric === m).map(hi));
  const sumMin = metrics.reduce((a, m) => a + minFor(m), 0);
  const sumMax = metrics.reduce((a, m) => a + maxFor(m), 0);
  if (sumMin > 100 + 1e-9) out.push({ label: `Quote energetiche: i minimi richiesti (anche ampliati) sommano a ${fmt(sumMin)}%, oltre il 100%`, kind: 'personal_soft', shortfall: sumMin - 100, direction: 'excess' });
  if (sumMax < 100 - 1e-9) out.push({ label: `Quote energetiche: i massimi richiesti (anche ampliati) sommano a ${fmt(sumMax)}%, meno del 100%`, kind: 'personal_soft', shortfall: 100 - sumMax, direction: 'deficit' });
  for (const m of metrics) if (minFor(m) > maxFor(m) + 1e-9) out.push({ label: `${m}: minimo oltre il massimo`, kind: 'personal_soft', metric: m, shortfall: minFor(m) - maxFor(m), direction: 'excess' });
  void input;
  return out;
}

/**
 * Per ogni preferenza od obiettivo aggiuntivo non rispettato nella proposta: quali vincoli rigidi lo impediscono.
 * Si rende rigida quella sola riga e si cerca la violazione minima degli altri vincoli rigidi (modello elastico).
 * Se nemmeno rilassando tutti gli altri vincoli (energia all'obiettivo) è raggiungibile, la composizione degli ingredienti selezionati non lo consente.
 * Se il modello non individua vincoli, non si inventano spiegazioni.
 */
function softGapAnalysis(built: Built, values: Record<string, number>, runSolve: (m: Model) => SolveResult): SoftGap[] {
  const out: SoftGap[] = [];
  const missed = built.rows.filter((r) => r.dev && r.dev.group !== 'coverage' && (values[r.dev.v] ?? 0) / r.scale > 1e-4).slice(0, 8);
  for (const r of missed) {
    // energia fissata all'obiettivo: senza quantità limitate, l'infattibilità dipende solo dalla composizione degli ingredienti
    const conflicts = diagnoseWith(built, runSolve, false, r);
    out.push({
      label: r.info.label,
      metric: r.info.metric,
      kind: r.info.kind,
      blockedBy: conflicts ? [...new Set(conflicts.map((c) => c.label))] : [],
      unreachable: conflicts === null,
    });
  }
  return out;
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
