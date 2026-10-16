// Somma degli apporti di TUTTI gli alimenti e integratori, con tracciamento dei dati mancanti.
// Questo modulo è usato dalla verifica indipendente: non dipende dal modello dell'ottimizzatore.
//
// Tre stati per ogni valore (decisione della nutrizionista sugli integratori):
//  - valore dichiarato o misurato (anche lo zero documentato, status analytical_zero) → entra nella somma;
//  - alimento senza il dato → «dato mancante»: il totale è incompleto;
//  - integratore che non dichiara il nutriente → «non dichiarato»: NON vale zero, ma il calcolo prosegue sulla
//    composizione dichiarata; il totale è un limite inferiore e la verifica lo segnala come incertezza.

import type { EnergyFactors, Food, Nutrient, RecipeItem, Supplement } from './types';

export interface ItemData {
  item: RecipeItem;
  kind: 'food' | 'supplement';
  name: string;
  /** apporto per unità di quantità (per 1 g di alimento, per 1 unità di integratore). */
  kcalPerQty: number | null;
  /** kcal/g di proteine, grassi e carboidrati disponibili del metodo energetico del componente (null = nessun metodo). */
  macroFactors: { protein: number; fat: number; carbohydrate: number } | null;
  valuePerQty: (nutrientId: string) => number | null;
}

export interface Total {
  /** somma dei soli contributi noti. */
  known: number;
  /** true se tutti gli ALIMENTI con quantità > 0 hanno il dato (gli integratori valgono per quanto dichiarano). */
  complete: boolean;
  /** nessun componente con quantità > 0 ha il dato. */
  noData: boolean;
  /** alimenti senza il dato. */
  missingFrom: string[];
  /** integratori che non dichiarano il nutriente: valore sconosciuto, non zero. */
  undeclaredFrom: string[];
  contributions: { name: string; amount: number }[];
}

export function foodData(item: RecipeItem, food: Food): ItemData {
  return {
    item,
    kind: 'food',
    name: food.name,
    kcalPerQty: food.kcalMePer100g === null ? null : food.kcalMePer100g / 100,
    macroFactors: food.energyMethod ?? null,
    valuePerQty: (id) => {
      const v = food.nutrients[id]?.value;
      return v === null || v === undefined ? null : v / 100;
    },
  };
}

export function supplementData(item: RecipeItem, s: Supplement): ItemData {
  return {
    item,
    kind: 'supplement',
    name: s.name,
    kcalPerQty: s.kcalPerUnit,
    macroFactors: s.energyMethod ?? null,
    valuePerQty: (id) => {
      const v = s.nutrients[id]?.value;
      return v === null || v === undefined ? null : v;
    },
  };
}

function sum(items: ItemData[], get: (d: ItemData) => number | null): Total {
  const t: Total = { known: 0, complete: true, noData: true, missingFrom: [], undeclaredFrom: [], contributions: [] };
  let anyPositive = false;
  for (const d of items) {
    if (!(d.item.qty > 0)) continue;
    anyPositive = true;
    const v = get(d);
    if (v === null && d.kind === 'supplement') {
      t.undeclaredFrom.push(d.name);
    } else if (v === null) {
      t.complete = false;
      t.missingFrom.push(d.name);
    } else {
      t.noData = false;
      const amount = v * d.item.qty;
      t.known += amount;
      t.contributions.push({ name: d.name, amount });
    }
  }
  if (!anyPositive) t.noData = false;
  return t;
}

/** Energia: gli integratori senza kcal (né dichiarate né stimabili con un metodo) sono «energia sconosciuta», non zero. */
export function totalEnergy(items: ItemData[]): Total {
  return sum(items, (d) => d.kcalPerQty);
}

/**
 * Valore di un nutriente per unità di quantità, con le regole anti doppio conteggio (allegato F, ratios):
 * - epa_dha: riga composta se presente, altrimenti EPA + DHA se entrambi noti;
 * - methionine_cystine / phenylalanine_tyrosine: riga composta, altrimenti metionina + cistina / fenilalanina + tirosina.
 */
/** Valori composti (allegato F): riga propria se presente, altrimenti somma delle due parti se entrambe note. */
export const COMPOUNDS: Record<string, [string, string]> = {
  epa_dha: ['epa', 'dha'],
  methionine_cystine: ['methionine', 'cystine'],
  phenylalanine_tyrosine: ['phenylalanine', 'tyrosine'],
};

export function itemValue(d: ItemData, nutrientId: string): number | null {
  const direct = d.valuePerQty(nutrientId);
  if (direct !== null) return direct;
  const pair = COMPOUNDS[nutrientId];
  if (pair) {
    const a = d.valuePerQty(pair[0]);
    const b = d.valuePerQty(pair[1]);
    return a !== null && b !== null ? a + b : null;
  }
  return null;
}

/**
 * Totali di gruppo che un integratore può non dichiarare ma che comprendono acidi grassi dichiarati:
 * in quel caso la somma delle parti dichiarate è un limite inferiore (mai sommata a un totale dichiarato).
 */
export const GROUP_PARTS: Record<string, string[]> = {
  omega3_total: ['ala', 'epa', 'dha'],
  omega6_total: ['linoleic_acid'],
};

export function totalNutrient(items: ItemData[], nutrientId: string): Total {
  const t = sum(items, (d) => itemValue(d, nutrientId));
  const parts = GROUP_PARTS[nutrientId];
  if (parts) {
    // integratore senza il totale di gruppo ma con le parti: le parti dichiarate contano come minimo noto
    for (const d of items) {
      if (!(d.item.qty > 0) || d.kind !== 'supplement' || itemValue(d, nutrientId) !== null) continue;
      const known = parts.map((p) => itemValue(d, p)).filter((v): v is number => v !== null);
      if (!known.length) continue;
      const amount = known.reduce((a, b) => a + b, 0) * d.item.qty;
      t.known += amount;
      t.noData = false;
      t.contributions.push({ name: `${d.name} (parti dichiarate, minimo)`, amount });
    }
  }
  return t;
}

export interface DerivedValue {
  value: number | null;
  complete: boolean;
  reason?: string;
  /** integratori che non dichiarano una delle parti: valore calcolato sulla composizione dichiarata. */
  undeclaredFrom?: string[];
}

export interface RecipeTotals {
  energy: Total;
  nutrients: Record<string, Total>;
  derived: Record<string, DerivedValue>;
}

function ratio(num: Total, den: Total, label: string): DerivedValue {
  if (!num.complete || !den.complete || num.noData || den.noData) {
    return { value: null, complete: false, reason: `dati incompleti per ${label}` };
  }
  if (!(den.known > 0)) return { value: null, complete: false, reason: 'denominatore zero: rapporto non definito' };
  return { value: num.known / den.known, complete: true, undeclaredFrom: [...new Set([...num.undeclaredFrom, ...den.undeclaredFrom])] };
}

/** legacyFactors: fattori unici delle istantanee salvate prima dei metodi per tipologia. */
export function computeTotals(items: ItemData[], nutrients: Nutrient[], legacyFactors?: EnergyFactors | null): RecipeTotals {
  const energy = totalEnergy(items);
  const out: Record<string, Total> = {};
  for (const n of nutrients) {
    if (n.kind === 'derived' || n.id === 'metabolizable_energy') continue;
    out[n.id] = totalNutrient(items, n.id);
  }
  const derived: Record<string, DerivedValue> = {};
  derived.ca_p_ratio = ratio(out.calcium, out.phosphorus, 'calcio/fosforo');
  // ω6/ω3 solo se entrambi i totali sono noti e > 0 (T05)
  const o3 = out.omega3_total;
  const o6 = out.omega6_total;
  if (o3 && o6) {
    const r = ratio(o6, o3, 'omega-6/omega-3');
    derived.omega6_omega3_ratio = r.complete && !(o6.known > 0) ? { value: null, complete: false, reason: 'omega-6 pari a zero' } : r;
  }
  const kcal = energy.complete && !energy.noData && energy.known > 0 ? energy.known : null;
  // Quote energetiche: ogni componente con i fattori del proprio metodo energetico (tipologia di alimento).
  const macro: [string, 'protein' | 'fat' | 'carbohydrate_available', 'protein' | 'fat' | 'carbohydrate'][] = [
    ['protein_energy_pct', 'protein', 'protein'],
    ['fat_energy_pct', 'fat', 'fat'],
    ['carb_energy_pct', 'carbohydrate_available', 'carbohydrate'],
  ];
  for (const [id, nut, key] of macro) {
    const t = out[nut];
    let macroKcal = 0;
    const noMethod: string[] = [];
    for (const d of items) {
      if (!(d.item.qty > 0)) continue;
      const g = itemValue(d, nut);
      if (g === null || g === 0) continue;
      const f = d.macroFactors?.[key] ?? legacyFactors?.[key] ?? null;
      if (f === null || f === undefined) noMethod.push(d.name);
      else macroKcal += g * d.item.qty * f;
    }
    if (noMethod.length) derived[id] = { value: null, complete: false, reason: `nessun metodo energetico per ${noMethod.join(', ')}` };
    else if (!t || !t.complete || t.noData) derived[id] = { value: null, complete: false, reason: 'dati dei macronutrienti incompleti' };
    else if (kcal === null) derived[id] = { value: null, complete: false, reason: 'energia della ricetta incompleta' };
    else derived[id] = { value: (100 * macroKcal) / kcal, complete: true, undeclaredFrom: [...new Set([...t.undeclaredFrom, ...energy.undeclaredFrom])] };
  }
  return { energy, nutrients: out, derived };
}
