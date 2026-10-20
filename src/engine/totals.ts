// Somma degli apporti di TUTTI gli alimenti e integratori, con tracciamento dei dati mancanti.
// Questo modulo è usato dalla verifica indipendente: non dipende dal modello dell'ottimizzatore.
//
// Tre stati per ogni valore (decisione della nutrizionista sugli integratori):
//  - valore dichiarato o misurato (anche lo zero documentato, status analytical_zero) → entra nella somma;
//  - alimento senza il dato → «dato mancante»: il totale è incompleto;
//  - integratore che non dichiara il nutriente → «non dichiarato»: NON vale zero, ma il calcolo prosegue sulla
//    composizione dichiarata; il totale è un limite inferiore e la verifica lo segnala come incertezza.

import type { EnergyFactors, Food, Nutrient, RecipeItem, Supplement } from './types';
import { vitaminAFrom } from './vitaminA';

export interface ItemData {
  item: RecipeItem;
  kind: 'food' | 'supplement';
  name: string;
  /** apporto per unità di quantità (per 1 g di alimento, per 1 unità di integratore). */
  kcalPerQty: number | null;
  /** kcal/g di proteine, grassi e carboidrati disponibili del metodo energetico del componente (null = nessun metodo). */
  macroFactors: { protein: number; fat: number; carbohydrate: number } | null;
  valuePerQty: (nutrientId: string) => number | null;
  /** integratori: valore dichiarato come quantità aggiunta (o etichetta di soli additivi): limite inferiore del totale. */
  lowerBound?: (nutrientId: string) => boolean;
  /** integratori: massa per unità non attribuita a proteine, grassi, carboidrati, fibra o umidità dichiarati (g); null = ignota. */
  macroResidual?: number | null;
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
  /** integratori con il solo valore aggiunto (additivo): il loro contributo è un limite inferiore. */
  lowerBoundFrom: string[];
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
  const content = s.doseUnit === 'g' ? 1 : s.massPerUnitG;
  const g = (k: string) => s.nutrients[k]?.value ?? 0;
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
    // «added» non è un'analisi totale (§10): conta come contributo noto, ma per i massimi è solo un limite inferiore.
    // Vale SOLO per i valori marcati «added»: l'indicazione di prodotto «etichetta con additivi» non si estende ai
    // componenti analitici dichiarati (es. calcio e fosforo di QDiet).
    lowerBound: (id) => {
      const v = s.nutrients[id];
      return !!v && v.value !== null && v.declared === 'added';
    },
    macroResidual: content ? Math.max(0, content - g('protein') - g('fat') - g('carbohydrate_available') - g('fiber') - g('moisture')) : null,
  };
}

function sum(items: ItemData[], get: (d: ItemData) => number | null): Total {
  const t: Total = { known: 0, complete: true, noData: true, missingFrom: [], undeclaredFrom: [], lowerBoundFrom: [], contributions: [] };
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

/**
 * Valore da mostrare in catalogo: riga dichiarata se presente; altrimenti, per i valori composti (EPA+DHA…),
 * la somma calcolata delle due parti se entrambe note. Una parte mancante non vale zero: il valore resta sconosciuto.
 */
export function compoundValue(nutrients: Record<string, { value: number | null } | undefined>, id: string): { value: number; calculated: boolean; parts?: [string, string] } | null {
  const v = nutrients[id]?.value;
  if (v !== null && v !== undefined) return { value: v, calculated: false };
  const pair = COMPOUNDS[id];
  if (!pair) return null;
  const a = nutrients[pair[0]]?.value;
  const b = nutrients[pair[1]]?.value;
  if (a === null || a === undefined || b === null || b === undefined) return null;
  return { value: a + b, calculated: true, parts: pair };
}

export function itemValue(d: ItemData, nutrientId: string): number | null {
  // vitamina A del cane: preformata + beta-carotene × fattore FEDIAF (src/engine/vitaminA.ts)
  if (nutrientId === 'vitamin_a') return vitaminAFrom(d.valuePerQty('vitamin_a'), d.valuePerQty('beta_carotene_ug')).known;
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
  const lb = (d: ItemData, id: string): boolean => !!d.lowerBound?.(id) || (d.valuePerQty(id) === null && !!COMPOUNDS[id] && COMPOUNDS[id].some((p) => lb(d, p)));
  t.lowerBoundFrom = items.filter((d) => d.item.qty > 0 && d.kind === 'supplement' && itemValue(d, nutrientId) !== null && lb(d, nutrientId)).map((d) => d.name);
  if (nutrientId === 'vitamin_a') {
    // una parte nota e l'altra sconosciuta: la parte nota conta, l'altra resta sconosciuta (non zero)
    for (const d of items) {
      if (!(d.item.qty > 0)) continue;
      const v = vitaminAFrom(d.valuePerQty('vitamin_a'), d.valuePerQty('beta_carotene_ug'));
      if (v.known === null || v.complete) continue;
      if (d.kind === 'food') {
        t.complete = false;
        t.missingFrom.push(d.name);
      } else t.undeclaredFrom.push(d.name);
    }
  }
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
  /** intervallo dimostrabile quando una parte è nota solo entro limiti (es. macronutrienti non dichiarati di un integratore). */
  range?: [number, number] | null;
  complete: boolean;
  reason?: string;
  /** integratori che non dichiarano una delle parti: valore calcolato sulla composizione dichiarata. */
  undeclaredFrom?: string[];
}

export interface RecipeTotals {
  energy: Total;
  nutrients: Record<string, Total>;
  derived: Record<string, DerivedValue>;
  /** come si forma la vitamina A del cane: preformata + beta-carotene convertito (UI/die), parti sconosciute. */
  vitaminA?: { preformed: number; fromBetaCarotene: number; betaCaroteneMg: number; preformedUnknown: string[]; betaCaroteneUnknown: string[] };
}

function ratio(num: Total, den: Total, label: string): DerivedValue {
  if (!num.complete || !den.complete || num.noData || den.noData) {
    return { value: null, complete: false, reason: `dati incompleti per ${label}` };
  }
  // §12: un rapporto non si ricava dai soli valori presenti per caso
  const unknown = [...new Set([...num.undeclaredFrom, ...den.undeclaredFrom])];
  const lower = [...new Set([...num.lowerBoundFrom, ...den.lowerBoundFrom])];
  if (unknown.length || lower.length) {
    const v = den.known > 0 ? num.known / den.known : null;
    return {
      value: v,
      complete: false,
      reason: `${label} non verificabile: ${[unknown.length ? `${unknown.join(', ')} non dichiara un termine (sconosciuto, non zero)` : '', lower.length ? `${lower.join(', ')} dichiara solo quantità aggiunte (totale incerto)` : ''].filter(Boolean).join('; ')}`,
    };
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
  // Ripartizione energetica stimata 4/9/4 (§7): Ep=4·proteine, Ef=9·grassi, Ec=4·carboidrati disponibili, denominatore Ep+Ef+Ec.
  // È separata dalla EM usata per i fabbisogni e non viene confrontata con essa. Macronutrienti non dichiarati da un
  // integratore: quote parziali, con un intervallo dimostrabile se la massa della dose non attribuita è nota.
  const F = { protein: 4, fat: 9, carbohydrate_available: 4 } as const;
  const keys = Object.keys(F) as (keyof typeof F)[];
  const known: Record<string, number> = { protein: 0, fat: 0, carbohydrate_available: 0 };
  const unk: Record<string, number> = { protein: 0, fat: 0, carbohydrate_available: 0 };
  let missingFood: string[] = [];
  let unbounded: string[] = [];
  const partial: string[] = [];
  for (const d of items) {
    if (!(d.item.qty > 0)) continue;
    const vals = keys.map((k) => itemValue(d, k));
    keys.forEach((k, i) => {
      const v = vals[i];
      if (v !== null) known[k] += v * d.item.qty * F[k];
    });
    const unknownKeys = keys.filter((_, i) => vals[i] === null);
    if (!unknownKeys.length) continue;
    if (d.kind === 'food') missingFood.push(d.name);
    else if (d.macroResidual === null || d.macroResidual === undefined) unbounded.push(d.name);
    else {
      partial.push(d.name);
      for (const k of unknownKeys) unk[k] += d.macroResidual * d.item.qty * F[k];
    }
  }
  missingFood = [...new Set(missingFood)];
  unbounded = [...new Set(unbounded)];
  const den = keys.reduce((a, k) => a + known[k], 0);
  const macro: [string, keyof typeof F][] = [
    ['protein_energy_pct', 'protein'],
    ['fat_energy_pct', 'fat'],
    ['carb_energy_pct', 'carbohydrate_available'],
  ];
  for (const [id, k] of macro) {
    if (missingFood.length) {
      derived[id] = { value: null, complete: false, reason: `macronutrienti mancanti per ${missingFood.join(', ')}` };
      continue;
    }
    if (!(den > 0)) {
      derived[id] = { value: null, complete: false, reason: 'energia dei macronutrienti nulla: quota non definita' };
      continue;
    }
    const value = (100 * known[k]) / den;
    if (unbounded.length) {
      derived[id] = { value, complete: false, reason: `quota parziale: ${unbounded.join(', ')} non dichiara tutti i macronutrienti e la massa della dose non è nota` };
      continue;
    }
    if (partial.length) {
      const others = keys.filter((x) => x !== k).reduce((a, x) => a + unk[x], 0);
      const lo = (100 * known[k]) / (den + others);
      const hi = (100 * (known[k] + unk[k])) / (den + unk[k]);
      derived[id] = { value, range: [lo, hi], complete: false, reason: `quota parziale: macronutrienti non dichiarati da ${partial.join(', ')} (intervallo dalla massa non attribuita della dose)` };
      continue;
    }
    derived[id] = { value, complete: true };
  }
  void legacyFactors;
  const vitaminA = { preformed: 0, fromBetaCarotene: 0, betaCaroteneMg: 0, preformedUnknown: [] as string[], betaCaroteneUnknown: [] as string[] };
  for (const d of items) {
    if (!(d.item.qty > 0)) continue;
    const pre = d.valuePerQty('vitamin_a');
    const bc = d.valuePerQty('beta_carotene_ug');
    if (pre === null) vitaminA.preformedUnknown.push(d.name);
    else vitaminA.preformed += pre * d.item.qty;
    if (bc === null) vitaminA.betaCaroteneUnknown.push(d.name);
    else {
      vitaminA.betaCaroteneMg += (bc * d.item.qty) / 1000;
      vitaminA.fromBetaCarotene += vitaminAFrom(null, bc).known! * d.item.qty;
    }
  }
  return { energy, nutrients: out, derived, vitaminA };
}
