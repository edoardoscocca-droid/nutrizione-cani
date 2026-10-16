// Somma degli apporti di TUTTI gli alimenti e integratori, con tracciamento dei dati mancanti.
// Questo modulo è usato dalla verifica indipendente: non dipende dal modello dell'ottimizzatore.

import type { EnergyFactors, Food, Nutrient, RecipeItem, Supplement } from './types';

export interface ItemData {
  item: RecipeItem;
  name: string;
  /** apporto per unità di quantità (per 1 g di alimento, per 1 unità di integratore). */
  kcalPerQty: number | null;
  valuePerQty: (nutrientId: string) => number | null;
}

export interface Total {
  /** somma dei soli contributi noti. */
  known: number;
  /** true se tutti i componenti con quantità > 0 hanno il dato. */
  complete: boolean;
  /** nessun componente con quantità > 0 ha il dato. */
  noData: boolean;
  missingFrom: string[];
  contributions: { name: string; amount: number }[];
}

export function foodData(item: RecipeItem, food: Food): ItemData {
  return {
    item,
    name: food.name,
    kcalPerQty: food.kcalMePer100g === null ? null : food.kcalMePer100g / 100,
    valuePerQty: (id) => {
      const v = food.nutrients[id]?.value;
      return v === null || v === undefined ? null : v / 100;
    },
  };
}

export function supplementData(item: RecipeItem, s: Supplement): ItemData {
  return {
    item,
    name: s.name,
    kcalPerQty: s.kcalPerUnit,
    valuePerQty: (id) => {
      const v = s.nutrients[id]?.value;
      return v === null || v === undefined ? null : v;
    },
  };
}

function sum(items: ItemData[], get: (d: ItemData) => number | null): Total {
  const t: Total = { known: 0, complete: true, noData: true, missingFrom: [], contributions: [] };
  let anyPositive = false;
  for (const d of items) {
    if (!(d.item.qty > 0)) continue;
    anyPositive = true;
    const v = get(d);
    if (v === null) {
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

export function totalEnergy(items: ItemData[]): Total {
  return sum(items, (d) => d.kcalPerQty);
}

/**
 * Valore di un nutriente per unità di quantità, con le regole anti doppio conteggio (allegato F, ratios):
 * - epa_dha: riga composta se presente, altrimenti EPA + DHA se entrambi noti;
 * - methionine_cystine / phenylalanine_tyrosine: solo riga composta (cistina e tirosina non sono nel dizionario A).
 */
export function itemValue(d: ItemData, nutrientId: string): number | null {
  const direct = d.valuePerQty(nutrientId);
  if (direct !== null) return direct;
  if (nutrientId === 'epa_dha') {
    const e = d.valuePerQty('epa');
    const h = d.valuePerQty('dha');
    return e !== null && h !== null ? e + h : null;
  }
  return null;
}

export function totalNutrient(items: ItemData[], nutrientId: string): Total {
  return sum(items, (d) => itemValue(d, nutrientId));
}

export interface DerivedValue {
  value: number | null;
  complete: boolean;
  reason?: string;
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
  return { value: num.known / den.known, complete: true };
}

export function computeTotals(items: ItemData[], nutrients: Nutrient[], factors: EnergyFactors): RecipeTotals {
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
  const macro: [string, string, number | null][] = [
    ['protein_energy_pct', 'protein', factors.protein],
    ['fat_energy_pct', 'fat', factors.fat],
    ['carb_energy_pct', 'carbohydrate_available', factors.carbohydrate],
  ];
  for (const [id, nut, f] of macro) {
    const t = out[nut];
    if (f === null) derived[id] = { value: null, complete: false, reason: 'fattori energetici non approvati (decisione D4)' };
    else if (!t || !t.complete || t.noData) derived[id] = { value: null, complete: false, reason: 'dati dei macronutrienti incompleti' };
    else if (kcal === null) derived[id] = { value: null, complete: false, reason: 'energia della ricetta incompleta' };
    else derived[id] = { value: (100 * t.known * f) / kcal, complete: true };
  }
  return { energy, nutrients: out, derived };
}
