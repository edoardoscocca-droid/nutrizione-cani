// Interfaccia unica per i dati: Supabase (uso reale) o archivio locale del browser (modalità prova).

import type { Food, Supplement, EnergyFactors, CustomThreshold } from '../engine/types';
import type { ImportPlan } from './catalogImport';
import type { Category } from './packageCatalog';
import type { AppSettings, Dog, Recipe, RecipeVersion, UserPrice, WeightEntry } from './model';
import type { CatalogState } from './recipeService';

export interface FullCatalog extends CatalogState {
  categories: Category[];
}

export interface Repository {
  mode: 'local' | 'supabase';
  userLabel(): string;
  isAdmin(): Promise<boolean>;
  loadCatalog(): Promise<FullCatalog>;

  listDogs(): Promise<Dog[]>;
  saveDog(dog: Dog): Promise<Dog>;
  deleteDog(id: string): Promise<void>;
  listWeights(dogId: string): Promise<WeightEntry[]>;
  addWeight(entry: WeightEntry): Promise<void>;

  listRecipes(dogId?: string): Promise<Recipe[]>;
  /** deve rifiutare l'11ª ricetta per cane senza toccare le altre. */
  createRecipe(recipe: Recipe): Promise<Recipe>;
  updateRecipe(recipe: Recipe): Promise<Recipe>;
  deleteRecipe(id: string): Promise<void>;
  listVersions(recipeId: string): Promise<RecipeVersion[]>;
  /** le versioni sono immutabili: si aggiungono soltanto. */
  addVersion(version: RecipeVersion): Promise<void>;

  listPrices(): Promise<UserPrice[]>;
  savePrice(price: UserPrice): Promise<void>;
  deletePrice(id: string): Promise<void>;

  getSettings(): Promise<AppSettings>;
  saveSettings(s: AppSettings): Promise<void>;

  // amministrazione del catalogo (in Supabase consentita solo agli amministratori dalle regole del database)
  saveFood(food: Food): Promise<void>;
  saveSupplement(s: Supplement): Promise<void>;
  saveThreshold(t: CustomThreshold): Promise<void>;
  saveEnergyFactors(f: EnergyFactors & { approvedBy: string }): Promise<void>;
  /** applica un piano d'importazione già verificato, tutto o niente. */
  applyCatalogImport(plan: ImportPlan): Promise<void>;
  /** convalida esplicita: riesce solo se i criteri di qualità sono soddisfatti. */
  validateCatalogItem(kind: 'food' | 'supplement', id: string): Promise<void>;
  listProfileHistory(kind: 'food' | 'supplement', id: string): Promise<ProfileHistoryEntry[]>;
  listImports(): Promise<ImportLogEntry[]>;
}

export interface ProfileHistoryEntry {
  version: number;
  changedAt: string;
  changedBy: string | null;
  /** profilo com'era PRIMA della modifica che ha creato la versione successiva. */
  profile: unknown;
}

export interface ImportLogEntry {
  id: string;
  kind: 'foods' | 'supplements';
  fileName: string | null;
  summary: ImportPlan['summary'];
  products: string[];
  createdAt: string;
}

export function uid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // UUID v4 (anche dove randomUUID non esiste, es. app iPhone)
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
