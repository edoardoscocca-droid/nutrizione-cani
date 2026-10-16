// Tabella d'impiego del produttore (decisione della nutrizionista): intervalli consigliati per peso del cane.
// Non sono limiti tossicologici e non sostituiscono i controlli su minerali e vitamine.

import type { DoseGuide } from './types';

export interface DoseRange {
  min: number;
  max: number;
  /** true se il peso è tra due righe della tabella e l'intervallo è interpolato linearmente. */
  interpolated: boolean;
  text: string;
}

const fmt = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 });

/** Intervallo per il peso indicato; null se il peso è fuori dalla tabella (nessuna estrapolazione). */
export function doseRangeFor(guide: DoseGuide | null | undefined, weightKg: number): DoseRange | null {
  const pts = [...(guide?.points ?? [])].sort((a, b) => a.weightKg - b.weightKg);
  if (!pts.length || !(weightKg > 0)) return null;
  if (weightKg < pts[0].weightKg - 1e-9 || weightKg > pts[pts.length - 1].weightKg + 1e-9) return null;
  const exact = pts.find((p) => Math.abs(p.weightKg - weightKg) < 1e-9);
  if (exact) return { min: exact.min, max: exact.max, interpolated: false, text: `${fmt(exact.weightKg)} kg: ${fmt(exact.min)}–${fmt(exact.max)}` };
  const hi = pts.findIndex((p) => p.weightKg > weightKg);
  const a = pts[hi - 1];
  const b = pts[hi];
  const t = (weightKg - a.weightKg) / (b.weightKg - a.weightKg);
  const min = Math.round((a.min + t * (b.min - a.min)) * 100) / 100;
  const max = Math.round((a.max + t * (b.max - a.max)) * 100) / 100;
  return { min, max, interpolated: true, text: `${fmt(weightKg)} kg: ${fmt(min)}–${fmt(max)} (interpolato tra ${fmt(a.weightKg)} e ${fmt(b.weightKg)} kg)` };
}

export function weightSpan(guide: DoseGuide | null | undefined): string {
  const w = (guide?.points ?? []).map((p) => p.weightKg).sort((x, y) => x - y);
  return w.length ? `${fmt(w[0])}–${fmt(w[w.length - 1])} kg` : '';
}
