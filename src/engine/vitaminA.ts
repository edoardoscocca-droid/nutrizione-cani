// Vitamina A per il CANE: preformata (dato «vitamin_a»: retinolo ed esteri, in UI) + contributo del beta-carotene
// convertito con il fattore FEDIAF. Unico punto usato sia dalla verifica (totals.ts) sia dal generatore (formulate.ts).
// - Le UI «per uso umano» da carotenoidi (vitamin_a_carotenoid_iu) restano un dato di fonte: mai sommate.
// - Gli altri carotenoidi (es. alfa-carotene) non hanno un fattore documentato: nessun contributo attribuito.
// - Il fattore vale per il cane, non per il gatto.

export const BETA_CAROTENE_TO_VITAMIN_A = {
  /** UI di vitamina A per 1 mg di beta-carotene (cane). */
  iuPerMg: 833,
  species: 'dog' as const,
  source: 'FEDIAF 2025, tabella VII-14, p. 63: 1 mg di beta-carotene = 833 UI di vitamina A (cane)',
  url: 'https://www.europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025.pdf',
};

/** Retinolo in µg → vitamina A preformata in UI, usato solo se la vitamina A preformata in UI manca (es. verdure con
 *  retinolo 0 documentato dalla fonte). Specifica v2 §6: «registrare il retinolo 0 documentato». */
export const RETINOL_UG_PER_IU = {
  ugPerIu: 0.3,
  source: 'FEDIAF 2025, tabella VII-14: 1 UI di vitamina A = 0,3 µg di retinolo',
};

export interface VitaminAParts {
  /** vitamina A preformata dichiarata (UI); null = sconosciuta. */
  preformed: number | null;
  /** beta-carotene del dato di fonte (µg); null = sconosciuto. */
  betaCaroteneUg: number | null;
  /** contributo del beta-carotene in UI (µg / 1000 × 833); null = sconosciuto. */
  fromBetaCarotene: number | null;
  /** somma delle parti note; null se nessuna parte è nota. */
  known: number | null;
  /** true solo se entrambe le parti sono note (anche zero documentato). */
  complete: boolean;
}

type Values = Record<string, { value: number | null } | undefined>;

function preformedFrom(vitaminA: number | null, retinolUg: number | null): number | null {
  if (vitaminA !== null) return vitaminA;
  return retinolUg === null ? null : retinolUg / RETINOL_UG_PER_IU.ugPerIu;
}

export function vitaminAParts(nutrients: Values): VitaminAParts {
  const pre = preformedFrom(nutrients.vitamin_a?.value ?? null, nutrients.vitamin_a_retinol_ug?.value ?? null);
  const bc = nutrients.beta_carotene_ug?.value ?? null;
  const fromBc = bc === null ? null : (bc / 1000) * BETA_CAROTENE_TO_VITAMIN_A.iuPerMg;
  return {
    preformed: pre,
    betaCaroteneUg: bc,
    fromBetaCarotene: fromBc,
    known: pre === null && fromBc === null ? null : (pre ?? 0) + (fromBc ?? 0),
    complete: pre !== null && fromBc !== null,
  };
}

/** Stessa regola su valori per unità di quantità già scalati (vitamina A in UI, beta-carotene in µg). */
export function vitaminAFrom(preformed: number | null, betaCaroteneUg: number | null, retinolUg: number | null = null): { known: number | null; complete: boolean } {
  const p = vitaminAParts({ vitamin_a: { value: preformed }, beta_carotene_ug: { value: betaCaroteneUg }, vitamin_a_retinol_ug: { value: retinolUg } });
  return { known: p.known, complete: p.complete };
}

/** Valore per 100 g o per unità come lo usa il calcolo (vitamina A del cane, valori composti EPA+DHA ecc.). */
export function rawValueOf(nutrients: Values, id: string): number | null {
  if (id === 'vitamin_a') return vitaminAParts(nutrients).known;
  const v = nutrients[id]?.value;
  if (v !== null && v !== undefined) return v;
  const pair = ({ epa_dha: ['epa', 'dha'], methionine_cystine: ['methionine', 'cystine'], phenylalanine_tyrosine: ['phenylalanine', 'tyrosine'] } as Record<string, [string, string]>)[id];
  if (!pair) return null;
  const a = nutrients[pair[0]]?.value;
  const b = nutrients[pair[1]]?.value;
  return a !== null && a !== undefined && b !== null && b !== undefined ? a + b : null;
}
