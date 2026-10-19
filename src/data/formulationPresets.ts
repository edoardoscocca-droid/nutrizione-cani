// Preferenze iniziali del progetto e aiuto per il fattore energetico (dati/riferimenti).
// Le preferenze sono intervalli ampi e modificabili, non limiti ufficiali: si precompilano SOLO nei nuovi profili
// «adulto sano in mantenimento» e non sovrascrivono mai quelle già salvate.

import presetsJson from '../../dati/riferimenti/preferenze_iniziali.json';
import factorsJson from '../../dati/riferimenti/fattori_energetici.json';
import { syncAutoFiber } from '../engine/dogProfile';
import type { LifeStage } from '../engine/types';
import type { Dog, FiberTarget, MacroPreference } from './model';

export interface FormulationPreset {
  id: string;
  lifeStage: LifeStage;
  macros: Record<MacroPreference['metric'], [number, number]>;
  fiberPer1000Kcal: [number, number];
  fiberNote: string;
  text: string;
}

export const PRESETS = (presetsJson as unknown as { presets: FormulationPreset[] }).presets;

export function presetFor(lifeStage: LifeStage): FormulationPreset | null {
  return PRESETS.find((p) => p.lifeStage === lifeStage) ?? null;
}

export function presetMacros(p: FormulationPreset): MacroPreference[] {
  return (Object.keys(p.macros) as MacroPreference['metric'][]).map((metric) => ({ metric, lower: p.macros[metric][0], upper: p.macros[metric][1], locked: false, enabled: true }));
}

export function presetFiber(p: FormulationPreset): FiberTarget {
  return { lower: null, upper: null, basis: 'per_day', enabled: true, auto: { lowerPer1000: p.fiberPer1000Kcal[0], upperPer1000: p.fiberPer1000Kcal[1] } };
}

/** Applica i valori iniziali (nuovo profilo o «Ripristina i valori iniziali»). */
export function applyPreset(dog: Dog, p: FormulationPreset): Dog {
  return syncAutoFiber({ ...dog, macroPreferences: presetMacros(p), fiberTarget: presetFiber(p) });
}

/** true se le preferenze sono ancora quelle iniziali non toccate (servono per togliere il preset se cambia la fase di vita). */
export function isUntouchedPreset(dog: Dog, p: FormulationPreset): boolean {
  const m = presetMacros(p);
  const same = dog.macroPreferences.length === m.length && m.every((x) => dog.macroPreferences.some((y) => y.metric === x.metric && y.lower === x.lower && y.upper === x.upper && !y.locked && y.enabled !== false));
  return same && !!dog.fiberTarget?.auto && dog.fiberTarget.enabled !== false;
}

export interface EnergyFactorCategory {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const ENERGY_FACTOR_HELP = factorsJson as unknown as { text: string; categories: EnergyFactorCategory[] };
