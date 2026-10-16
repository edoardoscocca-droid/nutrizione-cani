// Archivio locale (modalità prova): tutto resta nel browser di questo dispositivo.
// Catalogo = riferimenti e nomi del pacchetto (non verificati) + dati di prova fittizi [TEST].

import type { CustomThreshold, EnergyFactors, Food, Supplement } from '../engine/types';
import { DEFAULT_SETTINGS } from '../engine/types';
import { MAX_RECIPES_PER_DOG, type AppSettings, type Dog, type Recipe, type RecipeVersion, type UserPrice, type WeightEntry } from './model';
import { BREED_NOTES, CATEGORIES, packageFoods, packageReferences, packageSupplements } from './packageCatalog';
import { RecipeLimitError } from './recipeService';
import type { FullCatalog, Repository } from './repository';
import { TEST_FOODS, TEST_SUPPLEMENTS } from './testFixtures';

interface Store {
  dogs: Dog[];
  weights: WeightEntry[];
  recipes: Recipe[];
  versions: RecipeVersion[];
  prices: UserPrice[];
  settings: AppSettings | null;
  foods: Food[];
  supplements: Supplement[];
  thresholds: CustomThreshold[] | null;
  factors: EnergyFactors | null;
}

const KEY = 'nutrizione-cani:prova:v1';

function empty(): Store {
  return { dogs: [], weights: [], recipes: [], versions: [], prices: [], settings: null, foods: [], supplements: [], thresholds: null, factors: null };
}

export class LocalRepository implements Repository {
  mode = 'local' as const;
  private store: Store;
  private memoryOnly = false;

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null) {
    let s = empty();
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) s = { ...empty(), ...JSON.parse(raw) };
    } catch {
      this.memoryOnly = true;
    }
    this.store = s;
  }

  private save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.store));
    } catch {
      this.memoryOnly = true;
    }
  }

  userLabel() {
    return this.memoryOnly ? 'Prova (dati non salvati su questo dispositivo)' : 'Prova su questo dispositivo';
  }

  async isAdmin() {
    return true; // in prova locale l'utente gestisce il proprio catalogo di prova
  }

  async loadCatalog(): Promise<FullCatalog> {
    const refs = packageReferences();
    const override = <T extends { id: string }>(base: T[], edits: T[]) => {
      const m = new Map(base.map((x) => [x.id, x]));
      for (const e of edits) m.set(e.id, e);
      return [...m.values()];
    };
    return {
      ...refs,
      customThresholds: this.store.thresholds ?? refs.customThresholds,
      energyFactors: this.store.factors ?? refs.energyFactors,
      foods: override([...packageFoods(), ...structuredClone(TEST_FOODS)], this.store.foods),
      supplements: override([...packageSupplements(), ...structuredClone(TEST_SUPPLEMENTS)], this.store.supplements),
      breedNotes: BREED_NOTES,
      categories: CATEGORIES,
    };
  }

  async listDogs() {
    return [...this.store.dogs];
  }
  async saveDog(dog: Dog) {
    this.store.dogs = [...this.store.dogs.filter((d) => d.id !== dog.id), dog];
    this.save();
    return dog;
  }
  async deleteDog(id: string) {
    const recipeIds = this.store.recipes.filter((r) => r.dogId === id).map((r) => r.id);
    this.store.dogs = this.store.dogs.filter((d) => d.id !== id);
    this.store.recipes = this.store.recipes.filter((r) => r.dogId !== id);
    this.store.versions = this.store.versions.filter((v) => !recipeIds.includes(v.recipeId));
    this.store.weights = this.store.weights.filter((w) => w.dogId !== id);
    this.save();
  }
  async listWeights(dogId: string) {
    return this.store.weights.filter((w) => w.dogId === dogId).sort((a, b) => a.date.localeCompare(b.date));
  }
  async addWeight(e: WeightEntry) {
    this.store.weights.push(e);
    this.save();
  }

  async listRecipes(dogId?: string) {
    return this.store.recipes.filter((r) => !dogId || r.dogId === dogId);
  }
  async createRecipe(r: Recipe) {
    if (this.store.recipes.filter((x) => x.dogId === r.dogId).length >= MAX_RECIPES_PER_DOG) throw new RecipeLimitError();
    if (r.isPrimary) this.store.recipes = this.store.recipes.map((x) => (x.dogId === r.dogId ? { ...x, isPrimary: false } : x));
    this.store.recipes.push(r);
    this.save();
    return r;
  }
  async updateRecipe(r: Recipe) {
    if (r.isPrimary) this.store.recipes = this.store.recipes.map((x) => (x.dogId === r.dogId && x.id !== r.id ? { ...x, isPrimary: false } : x));
    this.store.recipes = this.store.recipes.map((x) => (x.id === r.id ? r : x));
    this.save();
    return r;
  }
  async deleteRecipe(id: string) {
    this.store.recipes = this.store.recipes.filter((r) => r.id !== id);
    this.store.versions = this.store.versions.filter((v) => v.recipeId !== id);
    this.save();
  }
  async listVersions(recipeId: string) {
    return this.store.versions.filter((v) => v.recipeId === recipeId).sort((a, b) => a.revision - b.revision);
  }
  async addVersion(v: RecipeVersion) {
    if (this.store.versions.some((x) => x.id === v.id || (x.recipeId === v.recipeId && x.revision === v.revision))) {
      throw new Error('Versione già esistente: le versioni sono immutabili');
    }
    this.store.versions.push(structuredClone(v));
    this.save();
  }

  async listPrices() {
    return [...this.store.prices];
  }
  async savePrice(p: UserPrice) {
    this.store.prices = [...this.store.prices.filter((x) => x.id !== p.id), p];
    this.save();
  }
  async deletePrice(id: string) {
    this.store.prices = this.store.prices.filter((x) => x.id !== id);
    this.save();
  }

  async getSettings(): Promise<AppSettings> {
    return this.store.settings ?? { ...DEFAULT_SETTINGS, disclaimerAccepted: false };
  }
  async saveSettings(s: AppSettings) {
    this.store.settings = s;
    this.save();
  }

  async saveFood(f: Food) {
    const cat = await this.loadCatalog();
    const prev = cat.foods.find((x) => x.id === f.id);
    const changed = prev && JSON.stringify({ ...prev, profileVersion: 0 }) !== JSON.stringify({ ...f, profileVersion: 0 });
    const next = { ...f, profileVersion: prev ? (changed ? prev.profileVersion + 1 : prev.profileVersion) : 1 };
    if (next.availableToFormulate && (next.kcalMePer100g === null || !['verified', 'estimated', 'test_fixture'].includes(next.dataStatus))) {
      throw new Error('Per attivare un alimento servono energia metabolizzabile e dati verificati o stimati dichiarati.');
    }
    this.store.foods = [...this.store.foods.filter((x) => x.id !== f.id), next];
    this.save();
  }
  async saveSupplement(s: Supplement) {
    const cat = await this.loadCatalog();
    const prev = cat.supplements.find((x) => x.id === s.id);
    const changed = prev && JSON.stringify({ ...prev, profileVersion: 0 }) !== JSON.stringify({ ...s, profileVersion: 0 });
    const next = { ...s, profileVersion: prev ? (changed ? prev.profileVersion + 1 : prev.profileVersion) : 1 };
    if (next.usableForOptimization && !['verified', 'test_fixture'].includes(next.status)) {
      throw new Error('Un integratore si attiva solo con etichetta verificata.');
    }
    this.store.supplements = [...this.store.supplements.filter((x) => x.id !== s.id), next];
    this.save();
  }
  async saveThreshold(t: CustomThreshold) {
    const cat = await this.loadCatalog();
    this.store.thresholds = cat.customThresholds.map((x) => (x.id === t.id ? t : x));
    this.save();
  }
  async saveEnergyFactors(f: EnergyFactors & { approvedBy: string }) {
    this.store.factors = { version: f.version, protein: f.protein, fat: f.fat, carbohydrate: f.carbohydrate, source: `${f.source} — approvato da ${f.approvedBy}` };
    this.save();
  }
}
