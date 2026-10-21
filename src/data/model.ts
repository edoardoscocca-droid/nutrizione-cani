// Modello dei dati utente (cani, ricette, versioni, prezzi, impostazioni).

import type { AuditResult } from '../engine/audit';
import type { UserPrice } from '../engine/cost';
import type { ConstraintInfo, Conflict } from '../engine/formulate';
import type { RecipeSnapshot } from '../engine/snapshot';
import type { AttentionNote, EngineSettings, LifeStage, PersonalTarget, RecipeItem } from '../engine/types';
import type { FormulationOverrides } from '../engine/configV2';
import type { DayProfile } from '../engine/diary';

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

/** [PROPOSTA] specifica v2 §8: 200 ricette attive per cane (le archiviate non contano); stesso valore nel trigger del database. */
export const MAX_RECIPES_PER_DOG = 200;

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

/** analysis = ricetta già fatta (es. della veterinaria) inserita a grammi fissi e solo verificata, senza generatore. */
export type VersionOrigin = 'engine' | 'user_edit' | 'recalculation' | 'duplicate' | 'diagnostic' | 'analysis';

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
  /** bozza diagnostica (preferenze non raggiungibili): conservata come bozza, non è un menù generato. */
  draft?: boolean;
}

export interface AppSettings extends EngineSettings {
  disclaimerAccepted: boolean;
  /** formulazione v2: intervalli dei gruppi e tolleranza energetica modificati dall'utente ([PROPOSTA]). */
  formulationV2?: FormulationOverrides | null;
}

/**
 * Diario (specifica v2 §7, precisazione 1): una ricetta = la razione dell'intero giorno, integratori compresi.
 * Una sola voce attiva per cane e data; registrare di nuovo la stessa data sostituisce la voce precedente.
 */
export interface DiaryEntry {
  id: string;
  dogId: string;
  /** AAAA-MM-GG */
  date: string;
  recipeId: string | null;
  versionId: string | null;
  recipeName: string;
  revision: number;
  /** apporti della versione registrata, congelati al momento della registrazione. */
  day: DayProfile;
  note: string | null;
  createdAt: string;
}

export type { UserPrice };
