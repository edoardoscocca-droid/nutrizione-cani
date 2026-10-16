import type { Color, DoseUnit } from '../engine/types';

export function num(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('it-IT', { maximumFractionDigits: digits });
}

/** numero leggibile con cifre adeguate alla grandezza. */
export function smart(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.01 ? 3 : 4;
  return n.toLocaleString('it-IT', { maximumFractionDigits: d });
}

export function euro(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export const DOSE_LABEL: Record<DoseUnit, [string, string]> = {
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  capsule: ['capsula', 'capsule'],
  tablet: ['compressa', 'compresse'],
  scoop: ['misurino', 'misurini'],
};

export function dose(qty: number, unit: DoseUnit): string {
  const [one, many] = DOSE_LABEL[unit];
  return `${num(qty, unit === 'g' || unit === 'ml' ? 1 : 0)} ${qty === 1 ? one : many}`;
}

export const COLOR_LABEL: Record<Color, string> = {
  red: 'Rosso — limite ufficiale non rispettato',
  orange: 'Arancione — soglia non ufficiale o preferenza',
  green: 'Verde — entro gli obiettivi controllabili',
  blue: 'Blu — monitorato, senza limite numerico',
  grey: 'Grigio — dato insufficiente, non verificabile',
  purple: 'Viola — nota di attenzione individuale o di razza',
};

export const GROUP_LABEL: Record<string, string> = {
  macros: 'Macronutrienti',
  composition: 'Composizione',
  fatty_acids: 'Acidi grassi',
  minerals: 'Minerali',
  derived: 'Rapporti e quote energetiche',
  vitamins_and_choline: 'Vitamine e colina',
  informational_vitamins: 'Altre vitamine (informative)',
  essential_amino_acids: 'Aminoacidi essenziali',
  individual_monitoring: 'Monitoraggio individuale',
  source_reference: 'Dati di fonte (solo informativi)',
};

export const DISCLAIMER =
  'Le quantità proposte sono stime informative e non sostituiscono una dieta formulata o verificata da un veterinario nutrizionista. Patologie, crescita, gravidanza, terapie e condizioni individuali richiedono valutazione professionale.';
