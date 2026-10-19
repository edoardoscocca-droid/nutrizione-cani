// Modello dei dati utente (cani, ricette, versioni, prezzi, impostazioni).

import type { AuditResult } from '../engine/audit';
import type { UserPrice } from '../engine/cost';
import type { ConstraintInfo, Conflict } from '../engine/formulate';
import type { RecipeSnapshot } from '../engine/snapshot';
import type { AttentionNote, EngineSettings, LifeStage, PersonalTarget, RecipeItem } from '../engine/types';

export type KcalSource = 'estimated' | 'veterinarian' | 'user';

export const KCAL_SOURCE_LABEL: Record<KcalSource, string> = {
  estimated: 'stimato dall’app',
  veterinarian: 'indicato dal veterinario',
  user: 'impostato dall’utente',
};

export interface MacroPreference {
  metric: 'protein_energy_pct' | 'fat_energy_pct' | 'carb_energy_pct';
  lower: number | null;
  upper: number | null;
  /** rigido solo se fissato da un professionista. */
  locked: boolean;
  /** false = preferenza disattivata (resta salvata ma non entra nel calcolo). */
  enabled?: boolean;
}

/** Fibra alimentare totale (non fibra grezza), mostrata in g/die. */
export interface FiberTarget {
  lower: number | null;
  upper: number | null;
  basis: 'per_day' | 'per_1000_kcal_me';
  enabled?: boolean;
  /** modalità automatica: g/die ricavati dall'obiettivo energetico (g per 1.000 kcal); si toglie quando l'utente modifica i valori. */
  auto?: { lowerPer1000: number; upperPer1000: number } | null;
}

export interface Dog {
  id: string;
  name: string;
  breed: string | null;
  birthDate: string | null;
  ageYears: number | null;
  sex: 'M' | 'F' | null;
  sterilized: boolean | null;
  lifeStage: LifeStage;
  weightCurrentKg: number;
  weightIdealKg: number;
  bcs: number | null;
  activity: string | null;
  activityFactor: number | null;
  kcalTarget: number | null;
  kcalSource: KcalSource;
  macroPreferences: MacroPreference[];
  fiberTarget: FiberTarget | null;
  ingredientPreferences: string | null;
  targets: PersonalTarget[];
  clinicalNotes: string | null;
  notes: AttentionNote[];
  formulationRevision: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeightEntry {
  id: string;
  dogId: string;
  date: string;
  weightKg: number;
}

export const MAX_RECIPES_PER_DOG = 10;

export interface Recipe {
  id: string;
  dogId: string;
  name: string;
  isPrimary: boolean;
  archived: boolean;
  currentVersionId: string | null;
  dietMoisture: 'wet' | 'dry' | null;
  createdAt: string;
}

export type VersionOrigin = 'engine' | 'user_edit' | 'recalculation' | 'duplicate';

export interface RecipeVersion {
  id: string;
  recipeId: string;
  revision: number;
  origin: VersionOrigin;
  parentVersionId: string | null;
  /** proposta del motore (immutabile). */
  suggestedItems: RecipeItem[];
  /** quantità in uso (uguali alla proposta o modificate dall'utente). */
  chosenItems: RecipeItem[];
  audit: AuditResult;
  snapshot: RecipeSnapshot;
  constraintsUsed: ConstraintInfo[];
  conflicts: Conflict[];
  engineNotes: string[];
  excluded: { name: string; reason: string }[];
  author: string;
  createdAt: string;
  note: string | null;
}

export interface AppSettings extends EngineSettings {
  disclaimerAccepted: boolean;
}

export type { UserPrice };
