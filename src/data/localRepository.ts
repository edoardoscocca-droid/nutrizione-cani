// Archivio locale (modalità prova): tutto resta nel browser di questo dispositivo.
// Catalogo = riferimenti e nomi del pacchetto (non verificati) + dati di prova fittizi [TEST].

import type { CustomThreshold, EnergyFactors, Food, Supplement } from '../engine/types';
import { DEFAULT_SETTINGS } from '../engine/types';
import { MAX_RECIPES_PER_DOG, type AppSettings, type Dog, type Recipe, type RecipeVersion, type UserPrice, type WeightEntry } from './model';
import { BREED_NOTES, CATEGORIES, packageFoods, packageReferences, packageSupplements } from './packageCatalog';
import { RecipeLimitError } from './recipeService';
import type { FullCatalog, ImportLogEntry, ProfileHistoryEntry, Repository } from './repository';
import { foodStatus, supplementStatus } from '../engine/catalogStatus';
import { parseImport, planImport, toPayload, type ImportPlan } from './catalogImport';
import { BUNDLED_IMPORTS } from './bundledImports';
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
  history: { kind: 'food' | 'supplement'; id: string; entry: ProfileHistoryEntry }[];
  imports: ImportLogEntry[];
}

const KEY = 'nutrizione-cani:prova:v1';

function empty(): Store {
  return { dogs: [], weights: [], recipes: [], versions: [], prices: [], settings: null, foods: [], supplements: [], thresholds: null, factors: null, history: [], imports: [] };
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

  async loadCatalog(opts: { withBundledImports?: boolean } = {}): Promise<FullCatalog> {
    const refs = packageReferences();
    const override = <T extends { id: string }>(base: T[], edits: T[]) => {
      const m = new Map(base.map((x) => [x.id, x]));
      for (const e of edits) m.set(e.id, e);
      return [...m.values()];
    };
    const cat: FullCatalog = {
      ...refs,
      customThresholds: this.store.thresholds ?? refs.customThresholds,
      energyFactors: this.store.factors ?? refs.energyFactors,
      foods: [...packageFoods(), ...structuredClone(TEST_FOODS)],
      supplements: [...packageSupplements(), ...structuredClone(TEST_SUPPLEMENTS)],
      breedNotes: BREED_NOTES,
      categories: CATEGORIES,
    };
    if (opts.withBundledImports !== false) {
      for (const b of BUNDLED_IMPORTS) {
        const plan = planImport(parseImport(JSON.stringify(b.data), b.kind, cat.nutrients), cat, b.label);
        if (plan.errors.length) continue;
        const next = plan.items.filter((i) => i.action !== 'unchanged').map((i) => i.next);
        if (b.kind === 'foods') cat.foods = override(cat.foods, next as Food[]);
        else cat.supplements = override(cat.supplements, next as Supplement[]);
      }
    }
    cat.foods = override(cat.foods, this.store.foods);
    cat.supplements = override(cat.supplements, this.store.supplements);
    return cat;
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

  private remember(kind: 'food' | 'supplement', prev: Food | Supplement) {
    this.store.history.push({ kind, id: prev.id, entry: { version: prev.profileVersion, changedAt: new Date().toISOString(), changedBy: 'prova locale', profile: structuredClone(prev) } });
  }
  private profileKey(x: Food | Supplement) {
    return JSON.stringify({ ...x, profileVersion: 0, validatedAt: null, validatedBy: null, availableToFormulate: null, usableForOptimization: null });
  }
  async saveFood(f: Food) {
    const cat = await this.loadCatalog();
    const prev = cat.foods.find((x) => x.id === f.id);
    const changed = !prev || this.profileKey(prev) !== this.profileKey(f);
    const next: Food = { ...f, profileVersion: prev ? (changed ? prev.profileVersion + 1 : prev.profileVersion) : 1 };
    if (changed) Object.assign(next, { validatedAt: null, validatedBy: null });
    if (next.availableToFormulate && foodStatus(next, cat.nutrients).status === 'to_complete') {
      throw new Error('Un alimento «da completare» non si può attivare: servono almeno energia, proteine e grassi.');
    }
    if (prev && changed) this.remember('food', prev);
    this.store.foods = [...this.store.foods.filter((x) => x.id !== f.id), next];
    this.save();
  }
  async saveSupplement(s: Supplement) {
    const cat = await this.loadCatalog();
    const prev = cat.supplements.find((x) => x.id === s.id);
    const changed = !prev || this.profileKey(prev) !== this.profileKey(s);
    const next: Supplement = { ...s, profileVersion: prev ? (changed ? prev.profileVersion + 1 : prev.profileVersion) : 1 };
    if (changed) Object.assign(next, { validatedAt: null, validatedBy: null });
    if (next.usableForOptimization && (next.status === 'missing' || supplementStatus(next, cat.nutrients).status === 'to_complete')) {
      throw new Error('Un integratore «da completare» non si può attivare: servono etichetta e composizione per dose.');
    }
    if (prev && changed) this.remember('supplement', prev);
    this.store.supplements = [...this.store.supplements.filter((x) => x.id !== s.id), next];
    this.save();
  }
  async applyCatalogImport(plan: ImportPlan) {
    toPayload(plan); // rifiuta piani con errori
    const cat = await this.loadCatalog();
    for (const it of plan.items) {
      if (it.action === 'unchanged') continue;
      const list = plan.kind === 'foods' ? cat.foods : cat.supplements;
      const prev = list.find((x) => x.id === it.id);
      if (prev) this.remember(plan.kind === 'foods' ? 'food' : 'supplement', prev);
      const next = { ...structuredClone(it.next), profileVersion: (prev?.profileVersion ?? 0) + 1, validatedAt: null, validatedBy: null };
      if (plan.kind === 'foods') this.store.foods = [...this.store.foods.filter((x) => x.id !== it.id), next as Food];
      else this.store.supplements = [...this.store.supplements.filter((x) => x.id !== it.id), next as Supplement];
    }
    this.store.imports.unshift({ id: crypto.randomUUID(), kind: plan.kind, fileName: plan.fileName, summary: plan.summary, products: plan.items.filter((i) => i.action !== 'unchanged').map((i) => i.id), createdAt: new Date().toISOString() });
    this.save();
  }
  async validateCatalogItem(kind: 'food' | 'supplement', id: string) {
    const cat = await this.loadCatalog();
    if (kind === 'food') {
      const f = cat.foods.find((x) => x.id === id);
      if (!f) throw new Error('Prodotto inesistente');
      const st = foodStatus(f, cat.nutrients);
      if (!st.readyForValidation) throw new Error(`Non convalidabile: ${st.reasons.filter((r) => !r.startsWith('non ancora convalidato')).join('; ')}`);
      this.store.foods = [...this.store.foods.filter((x) => x.id !== id), { ...f, validatedAt: new Date().toISOString(), validatedBy: 'prova locale' }];
    } else {
      const s = cat.supplements.find((x) => x.id === id);
      if (!s) throw new Error('Prodotto inesistente');
      const st = supplementStatus(s, cat.nutrients);
      if (!st.readyForValidation) throw new Error(`Non convalidabile: ${st.reasons.filter((r) => !r.startsWith('non ancora convalidato')).join('; ')}`);
      this.store.supplements = [...this.store.supplements.filter((x) => x.id !== id), { ...s, validatedAt: new Date().toISOString(), validatedBy: 'prova locale' }];
    }
    this.save();
  }
  async listProfileHistory(kind: 'food' | 'supplement', id: string) {
    return this.store.history.filter((h) => h.kind === kind && h.id === id).map((h) => h.entry).sort((a, b) => b.version - a.version);
  }
  async listImports() {
    return [...this.store.imports];
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
