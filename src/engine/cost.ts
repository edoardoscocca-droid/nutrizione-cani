// Costi personali (§7). I prezzi non toccano mai grammi o nutrienti.

import type { RecipeItem } from './types';

export type PriceMode = 'per_kg' | 'package_mass' | 'package_units';

export interface UserPrice {
  id: string;
  productKind: 'food' | 'supplement';
  productId: string;
  supplier: string | null;
  mode: PriceMode;
  price: number; // €
  /** per package_mass: grammi netti della confezione. */
  packageGrams?: number | null;
  /** per package_units: numero di unità (capsule, compresse…). */
  packageUnits?: number | null;
  active: boolean;
  createdAt: string;
}

export const DAYS_PER_MONTH = 30;

/**
 * Prezzo normalizzato per unità di quantità della ricetta: €/g per alimenti e integratori dosati in g/ml,
 * €/dose per capsule e simili. Restituisce null se il prezzo non è convertibile nell'unità richiesta.
 */
export function unitPrice(p: UserPrice, doseUnit: 'g' | 'ml' | 'capsule' | 'tablet' | 'scoop', massPerUnitG: number | null): number | null {
  const byGram = (): number | null => {
    if (p.mode === 'per_kg') return p.price / 1000;
    if (p.mode === 'package_mass' && p.packageGrams && p.packageGrams > 0) return p.price / p.packageGrams;
    return null;
  };
  if (doseUnit === 'g') {
    if (p.mode === 'package_units' && p.packageUnits && massPerUnitG) return p.price / (p.packageUnits * massPerUnitG);
    return byGram();
  }
  if (doseUnit === 'ml') {
    // confezione in ml registrata come "package_mass" con quantità in ml
    return byGram();
  }
  if (p.mode === 'package_units' && p.packageUnits && p.packageUnits > 0) return p.price / p.packageUnits;
  const g = byGram();
  return g !== null && massPerUnitG ? g * massPerUnitG : null;
}

export interface CostLine {
  id: string;
  name: string;
  qty: number;
  unitPrice: number | null;
  cost: number | null;
  supplier: string | null;
}

export interface CostSummary {
  lines: CostLine[];
  daily: number;
  weekly: number;
  monthly: number;
  partial: boolean;
  missing: string[];
}

export function recipeCost(
  items: RecipeItem[],
  info: Record<string, { name: string; doseUnit: 'g' | 'ml' | 'capsule' | 'tablet' | 'scoop'; massPerUnitG: number | null }>,
  prices: UserPrice[],
): CostSummary {
  const lines: CostLine[] = [];
  const missing: string[] = [];
  let daily = 0;
  for (const it of items) {
    if (!(it.qty > 0)) continue;
    const meta = info[it.id];
    const p = prices.find((x) => x.active && x.productId === it.id && x.productKind === it.kind);
    const up = p ? unitPrice(p, meta.doseUnit, meta.massPerUnitG) : null;
    const cost = up === null ? null : up * it.qty;
    if (cost === null) missing.push(meta.name);
    else daily += cost;
    lines.push({ id: it.id, name: meta.name, qty: it.qty, unitPrice: up, cost, supplier: p?.supplier ?? null });
  }
  return { lines, daily, weekly: daily * 7, monthly: daily * DAYS_PER_MONTH, partial: missing.length > 0, missing };
}
