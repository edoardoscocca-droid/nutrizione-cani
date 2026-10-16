// Interfaccia unica per i dati: Supabase (uso reale) o archivio locale del browser (modalità prova).

import type { Food, Supplement, EnergyFactors, CustomThreshold } from '../engine/types';
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
}

export function uid(): string {
  return crypto.randomUUID();
}
