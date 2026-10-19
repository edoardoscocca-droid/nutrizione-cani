// Obiettivi aggiuntivi approvati (es. apporto raccomandato NRC di EPA+DHA per l'adulto in mantenimento).
// Sono distinti dai limiti FEDIAF: nel calcolo vengono prima delle preferenze, nella verifica hanno una sezione propria.

import { toCanonical } from './units';
import type { AppliedRecommendedTarget, LifeStage, Nutrient, NutrientLimit, RecommendedTarget } from './types';

function fmt(n: number, digits = 0) {
  return n.toLocaleString('it-IT', { maximumFractionDigits: digits });
}

/** Obiettivi che valgono per il cane: solo per le fasi di vita previste, sul peso attuale registrato. */
export function recommendedFor(
  dog: { lifeStage: LifeStage; weightCurrentKg: number },
  targets: RecommendedTarget[] | undefined,
  nutrients: Nutrient[],
): AppliedRecommendedTarget[] {
  const out: AppliedRecommendedTarget[] = [];
  if (!(dog.weightCurrentKg > 0)) return out;
  for (const t of targets ?? []) {
    if (!t.lifeStages.includes(dog.lifeStage)) continue;
    const n = nutrients.find((x) => x.id === t.metric);
    if (!n) continue;
    const amount = t.coefficient * dog.weightCurrentKg ** t.exponent;
    let canonical: number;
    try {
      canonical = toCanonical(amount, t.unit, n.unit).value;
    } catch {
      continue; // unità non convertibile: nessun obiettivo inventato
    }
    out.push({
      id: t.id,
      metric: t.metric,
      label: t.label,
      amountPerDay: canonical,
      unit: n.unit,
      formula: `${fmt(t.coefficient, 3)} × ${fmt(dog.weightCurrentKg, 1)} kg^${fmt(t.exponent, 3)} = ${fmt(amount)} ${t.unit}/die (peso attuale)`,
      source: t.url ? `${t.source} — ${t.url}` : t.source,
    });
  }
  return out;
}

/** Limiti flessibili «obiettivo aggiuntivo» per il motore e la verifica. */
export function recommendedAsLimits(dog: { lifeStage: string; recommended?: AppliedRecommendedTarget[] }): NutrientLimit[] {
  return (dog.recommended ?? []).map((r) => ({
    id: `recommended_${r.id}`,
    referenceVersionId: `RECOMMENDED_${r.id}`,
    metric: r.metric,
    lifeStage: dog.lifeStage,
    lower: r.amountPerDay,
    upper: null,
    unit: r.unit,
    basis: 'per_day',
    limitClass: 'RECOMMENDED_ALLOWANCE',
    hardness: 'soft',
    severity: 'orange',
    source: `${r.label}: ${r.formula} — ${r.source}`,
    status: 'verified',
    displayLabel: r.label,
  }));
}
