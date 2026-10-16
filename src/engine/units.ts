// Conversioni di unità. Solo massa↔massa è automatica. IU↔mg dipende dalla forma chimica
// e richiede un fattore documentato: senza fattore la conversione è rifiutata.

const MASS_IN_G: Record<string, number> = { kg: 1000, g: 1, mg: 1e-3, 'µg': 1e-6, ug: 1e-6, mcg: 1e-6 };

export function normalizeUnit(u: string): string {
  const s = u.trim();
  if (s === 'ug' || s === 'mcg' || s === 'μg') return 'µg';
  if (s.toUpperCase() === 'IU' || s.toUpperCase() === 'UI') return 'IU';
  return s;
}

export function isMassUnit(u: string): boolean {
  return normalizeUnit(u) in MASS_IN_G;
}

export interface ConversionResult {
  value: number;
  rule: string;
}

/**
 * Converte un valore nell'unità canonica.
 * @param documentedFactor fattore per conversioni non di massa (es. IU per mg di una forma chimica precisa).
 */
export function toCanonical(
  value: number,
  fromUnit: string,
  canonicalUnit: string,
  documentedFactor?: { factor: number; rule: string },
): ConversionResult {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(canonicalUnit);
  if (from === to) return { value, rule: 'identity' };
  if (isMassUnit(from) && isMassUnit(to)) {
    return { value: (value * MASS_IN_G[from]) / MASS_IN_G[to], rule: `${from}->${to}` };
  }
  if (documentedFactor && documentedFactor.factor > 0) {
    return { value: value * documentedFactor.factor, rule: documentedFactor.rule };
  }
  throw new Error(`Conversione ${from} → ${to} non consentita senza fattore documentato (forma chimica)`);
}

/** Valore per 100 g a partire da un valore riferito a un'altra quantità (es. per kg o per 1 g). */
export function per100g(value: number, basisGrams: number): number {
  if (!(basisGrams > 0)) throw new Error('Base in grammi non valida');
  return (value * 100) / basisGrams;
}
