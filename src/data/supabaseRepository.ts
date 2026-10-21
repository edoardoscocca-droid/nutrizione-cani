// Archivio Supabase. Tutti i permessi sono applicati dal database (RLS): l'app usa solo la chiave pubblica "anon".

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomThreshold, EnergyAssignment, EnergyMethod, Food, NutrientKind, NutrientLimit, NutrientValue, Supplement, UnitConversion } from '../engine/types';
import { applyEnergyMethods } from '../engine/energy';
import { DEFAULT_SETTINGS } from '../engine/types';
import type { AppSettings, DiaryEntry, Dog, Recipe, RecipeVersion, UserPrice, WeightEntry } from './model';
import type { Category } from './packageCatalog';
import { packageRecommendedTargets, withCatalogGaps } from './packageCatalog';
import { RecipeLimitError } from './recipeService';
import type { FullCatalog, ImportLogEntry, ProfileHistoryEntry, Repository } from './repository';
import { toPayload, type ImportPlan } from './catalogImport';

type Row = Record<string, unknown>;

async function all(client: SupabaseClient, table: string, order = 'id'): Promise<Row[]> {
  const out: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await client.from(table).select('*').order(order).range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as Row[]));
    if (!data || data.length < page) break;
  }
  return out;
}

function check<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) {
    if (r.error.code === 'P0010' || /al massimo \d+ ricette/.test(r.error.message)) throw new RecipeLimitError();
    throw new Error(r.error.message);
  }
  return r.data;
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** conversioni del diario tra l'app e la tabella diary_entries (stessa struttura in prova e con account). */
export function diaryToRow(e: DiaryEntry, ownerId: string): Row {
  return { id: e.id, owner_id: ownerId, dog_id: e.dogId, date: e.date, recipe_id: e.recipeId, version_id: e.versionId, recipe_name: e.recipeName, revision: e.revision, day: e.day, note: e.note, created_at: e.createdAt };
}
export function rowToDiary(r: Row): DiaryEntry {
  return {
    id: r.id as string, dogId: r.dog_id as string, date: String(r.date).slice(0, 10), recipeId: (r.recipe_id as string) ?? null, versionId: (r.version_id as string) ?? null,
    recipeName: r.recipe_name as string, revision: Number(r.revision), day: r.day as DiaryEntry['day'], note: (r.note as string) ?? null, createdAt: r.created_at as string,
  };
}

export class SupabaseRepository implements Repository {
  mode = 'supabase' as const;
  constructor(private client: SupabaseClient, private userId: string, private email: string) {}

  userLabel() {
    return this.email;
  }

  async isAdmin() {
    const { data, error } = await this.client.rpc('is_admin');
    return !error && data === true;
  }

  async loadCatalog(): Promise<FullCatalog> {
    const [nutrients, refs, limits, thresholds, methods, assignments, conversions, cats, foods, fn, supps, sn, breed] = await Promise.all([
      all(this.client, 'nutrients'),
      all(this.client, 'reference_versions'),
      all(this.client, 'nutrient_limits'),
      all(this.client, 'custom_thresholds'),
      all(this.client, 'energy_methods'),
      all(this.client, 'energy_method_assignments', 'category_id'),
      all(this.client, 'unit_conversions'),
      all(this.client, 'food_categories', 'sort'),
      all(this.client, 'foods'),
      all(this.client, 'food_nutrients', 'food_id'),
      all(this.client, 'supplements'),
      all(this.client, 'supplement_nutrients', 'supplement_id'),
      all(this.client, 'breed_notes'),
    ]);
    const val = (r: Row, col: string): NutrientValue => ({
      value: n(r[col]),
      status: r.value_status as NutrientValue['status'],
      source: (r.source_id as string) ?? null,
      method: (r.method as string) ?? null,
      sourceValue: n(r.source_value),
      sourceUnit: (r.source_unit as string) ?? null,
      form: (r.chemical_form as string) ?? null,
      basis: (r.source_basis as string) ?? null,
      conversion: (r.conversion_rule as string) ?? null,
      declared: (r.declared_total_or_added as NutrientValue['declared']) ?? null,
    });
    const foodNut = new Map<string, Record<string, NutrientValue>>();
    for (const r of fn) {
      const m = foodNut.get(r.food_id as string) ?? {};
      m[r.nutrient_id as string] = val(r, 'amount_per_100g');
      foodNut.set(r.food_id as string, m);
    }
    const suppNut = new Map<string, Record<string, NutrientValue>>();
    for (const r of sn) {
      const m = suppNut.get(r.supplement_id as string) ?? {};
      m[r.nutrient_id as string] = val(r, 'amount_per_unit');
      suppNut.set(r.supplement_id as string, m);
    }
    const customThresholds: CustomThreshold[] = thresholds.map((t) => ({
      id: t.id as string,
      metric: t.metric as string,
      lower: n(t.lower_value),
      upper: n(t.upper_value),
      status: t.status as string,
      severity: 'orange',
      solverPriority: 'soft',
      rationale: t.rationale as string,
      requiresReview: t.requires_review as boolean,
      enabled: t.enabled as boolean,
    }));
    return withCatalogGaps(applyEnergyMethods({
      nutrients: nutrients.map((r) => ({
        id: r.id as string,
        label: r.label_it as string,
        unit: r.canonical_unit as string,
        group: r.nutrient_group as string,
        kind: r.kind as NutrientKind,
        formula: (r.formula as string) ?? null,
        notes: (r.notes as string) ?? null,
      })),
      referenceVersions: refs.map((r) => ({ id: r.id as string, source: r.source as string, label: r.version_label as string, url: (r.source_url as string) ?? null, status: r.status as string })),
      limits: limits
        .filter((l) => l.active !== false)
        .map(
          (l): NutrientLimit => ({
            id: l.id as string,
            referenceVersionId: l.reference_version_id as string,
            metric: l.metric as string,
            lifeStage: l.life_stage as string,
            lower: n(l.lower_value),
            upper: n(l.upper_value),
            unit: l.unit as string,
            basis: l.basis as NutrientLimit['basis'],
            limitClass: l.limit_class as NutrientLimit['limitClass'],
            hardness: l.hardness as NutrientLimit['hardness'],
            severity: l.severity as NutrientLimit['severity'],
            applicability: (l.applicability as NutrientLimit['applicability']) ?? {},
            source: l.source as string,
            status: l.status as NutrientLimit['status'],
            notes: (l.notes as string) ?? null,
          }),
        ),
      customThresholds,
      energyMethods: methods.map((m): EnergyMethod => ({
        id: m.id as string, version: m.version as string, label: m.label as string,
        protein: Number(m.protein), fat: Number(m.fat), carbohydrate: Number(m.carbohydrate),
        source: m.source as string, approvedBy: m.approved_by as string, approvedAt: (m.approved_at as string) ?? null,
        notes: (m.notes as string) ?? null, active: m.active as boolean,
      })),
      energyAssignments: assignments.map((a): EnergyAssignment => ({
        categoryId: a.category_id as string, processing: a.processing as EnergyAssignment['processing'], methodId: a.method_id as string, caution: (a.caution as string) ?? null,
      })),
      unitConversions: conversions.map((c): UnitConversion => ({
        id: c.id as string, nutrientId: c.nutrient_id as string, fromUnit: c.from_unit as string, toUnit: c.to_unit as string,
        form: (c.form as string) ?? null, formLabel: c.form_label as string, factor: Number(c.factor), source: c.source as string,
      })),
      // obiettivi aggiuntivi approvati: dal pacchetto (nessuna tabella dedicata per ora)
      recommendedTargets: packageRecommendedTargets(),
      categories: cats.map((c): Category => ({ id: c.id as string, parentId: (c.parent_id as string) ?? null, label: c.label_it as string, secretingOffal: c.secreting_offal as boolean })),
      foods: foods.map(
        (f): Food => ({
          id: f.id as string,
          name: f.name_it as string,
          categoryId: f.category_id as string,
          subcategoryId: f.subcategory_id as string,
          speciesCut: (f.species_cut as string) ?? null,
          processingState: f.processing_state as Food['processingState'],
          preparation: (f.preparation as string) ?? null,
          ediblePortion: (f.edible_portion as string) ?? null,
          kcalMePer100g: n(f.kcal_me_per_100g),
          // nel database c'è solo l'EM inserita; quella calcolata si ricava dal metodo energetico al caricamento
          kcalMeOrigin: f.kcal_me_per_100g === null ? null : 'declared',
          energyMethodId: (f.energy_method_id as string) ?? null,
          meMethod: (f.me_method as string) ?? null,
          source: (f.source_identifier as string) ?? null,
          sourceUrl: (f.source_url as string) ?? null,
          sourceVersion: (f.source_version as string) ?? null,
          dataStatus: f.data_status as Food['dataStatus'],
          availableToFormulate: f.available_to_formulate as boolean,
          profileVersion: f.profile_version as number,
          uncertainty: (f.uncertainty as string) ?? null,
          notes: (f.notes as string) ?? null,
          validatedBy: (f.validated_by as string) ?? null,
          validatedAt: (f.validated_at as string) ?? null,
          // colonne della migrazione 11 (assenti prima: valori predefiniti)
          maxFreshWeightPct: n(f.max_fresh_weight_pct),
          maxGPer1000Kcal: n(f.max_g_per_1000_kcal),
          forbidden: (f.forbidden as boolean) ?? false,
          preparationWarning: (f.preparation_warning as string) ?? null,
          nutrients: foodNut.get(f.id as string) ?? {},
        }),
      ),
      supplements: supps.map(
        (s): Supplement => ({
          id: s.id as string,
          name: s.name_it as string,
          brand: (s.brand as string) ?? null,
          variant: (s.product_variant as string) ?? null,
          supplementClass: (s.class as string) ?? null,
          doseUnit: s.dose_unit as Supplement['doseUnit'],
          massPerUnitG: n(s.mass_per_unit_g),
          grossMassPerUnitG: n(s.gross_mass_per_unit_g),
          sourceUrl: (s.source_url as string) ?? null,
          dataStatus: (s.data_status as Supplement['dataStatus']) ?? null,
          kcalPerUnit: n(s.kcal_per_unit),
          kcalOrigin: s.kcal_per_unit === null ? null : 'declared',
          doseGuide: (s.dose_guide as Supplement['doseGuide']) ?? null,
          integerDose: s.integer_dose as boolean,
          maxDailyUnits: n(s.max_daily_units),
          maxDailySource: (s.max_daily_source as string) ?? null,
          labelSource: (s.label_source as string) ?? null,
          labelAddedOnly: s.label_added_only as boolean,
          version: (s.product_version as string) ?? null,
          status: s.status as Supplement['status'],
          usableForOptimization: s.usable_for_optimization as boolean,
          profileVersion: s.profile_version as number,
          notes: (s.notes as string) ?? null,
          validatedBy: (s.validated_by as string) ?? null,
          validatedAt: (s.validated_at as string) ?? null,
          nutrients: suppNut.get(s.id as string) ?? {},
        }),
      ),
      breedNotes: breed.map((b) => ({ id: b.id as string, breedMatch: b.breed_match as string[], text: b.note as string, source: b.source as string, metrics: b.metrics as string[] })),
    }));
  }

  // ── cani ──
  private dogToRow(d: Dog): Row {
    return {
      id: d.id, owner_id: this.userId, name: d.name, breed: d.breed, birth_date: d.birthDate, age_years: d.ageYears, sex: d.sex,
      sterilized: d.sterilized, life_stage: d.lifeStage, weight_current_kg: d.weightCurrentKg, weight_ideal_kg: d.weightIdealKg,
      bcs: d.bcs, activity: d.activity, activity_factor: d.activityFactor, kcal_target: d.kcalTarget, kcal_source: d.kcalSource,
      macro_preferences: d.macroPreferences, fiber_target: d.fiberTarget, ingredient_preferences: d.ingredientPreferences,
      targets: d.targets, clinical_notes: d.clinicalNotes, notes: d.notes, formulation_revision: d.formulationRevision,
      created_at: d.createdAt, updated_at: d.updatedAt,
    };
  }
  private rowToDog(r: Row): Dog {
    return {
      id: r.id as string, name: r.name as string, breed: (r.breed as string) ?? null, birthDate: (r.birth_date as string) ?? null,
      ageYears: n(r.age_years), sex: (r.sex as Dog['sex']) ?? null, sterilized: (r.sterilized as boolean) ?? null,
      lifeStage: r.life_stage as Dog['lifeStage'], weightCurrentKg: Number(r.weight_current_kg), weightIdealKg: Number(r.weight_ideal_kg),
      bcs: n(r.bcs), activity: (r.activity as string) ?? null, activityFactor: n(r.activity_factor), kcalTarget: n(r.kcal_target),
      kcalSource: r.kcal_source as Dog['kcalSource'], macroPreferences: (r.macro_preferences as Dog['macroPreferences']) ?? [],
      fiberTarget: (r.fiber_target as Dog['fiberTarget']) ?? null, ingredientPreferences: (r.ingredient_preferences as string) ?? null,
      targets: (r.targets as Dog['targets']) ?? [], clinicalNotes: (r.clinical_notes as string) ?? null, notes: (r.notes as Dog['notes']) ?? [],
      formulationRevision: r.formulation_revision as number, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    };
  }
  async listDogs() {
    return (await all(this.client, 'dogs', 'created_at')).map((r) => this.rowToDog(r));
  }
  async saveDog(d: Dog) {
    check(await this.client.from('dogs').upsert(this.dogToRow(d)));
    return d;
  }
  async deleteDog(id: string) {
    check(await this.client.from('dogs').delete().eq('id', id));
  }
  async listWeights(dogId: string) {
    const rows = check(await this.client.from('dog_weight_log').select('*').eq('dog_id', dogId).order('date')) as Row[];
    return rows.map((r) => ({ id: r.id as string, dogId: r.dog_id as string, date: r.date as string, weightKg: Number(r.weight_kg) }));
  }
  async addWeight(e: WeightEntry) {
    check(await this.client.from('dog_weight_log').insert({ id: e.id, dog_id: e.dogId, date: e.date, weight_kg: e.weightKg }));
  }

  // ── ricette ──
  private rowToRecipe(r: Row): Recipe {
    return {
      id: r.id as string, dogId: r.dog_id as string, name: r.name as string, isPrimary: r.is_primary as boolean, archived: r.archived as boolean,
      currentVersionId: (r.current_version_id as string) ?? null, dietMoisture: (r.diet_moisture as Recipe['dietMoisture']) ?? null, createdAt: r.created_at as string,
    };
  }
  private recipeRow(r: Recipe): Row {
    return { id: r.id, owner_id: this.userId, dog_id: r.dogId, name: r.name, is_primary: r.isPrimary, archived: r.archived, current_version_id: r.currentVersionId, diet_moisture: r.dietMoisture, created_at: r.createdAt };
  }
  async listRecipes(dogId?: string) {
    let q = this.client.from('recipes').select('*').order('created_at');
    if (dogId) q = q.eq('dog_id', dogId);
    return (check(await q) as Row[]).map((r) => this.rowToRecipe(r));
  }
  private async clearPrimary(r: Recipe) {
    if (r.isPrimary) check(await this.client.from('recipes').update({ is_primary: false }).eq('dog_id', r.dogId).neq('id', r.id));
  }
  async createRecipe(r: Recipe) {
    await this.clearPrimary(r);
    check(await this.client.from('recipes').insert(this.recipeRow(r)));
    return r;
  }
  async updateRecipe(r: Recipe) {
    await this.clearPrimary(r);
    check(await this.client.from('recipes').update(this.recipeRow(r)).eq('id', r.id));
    return r;
  }
  async deleteRecipe(id: string) {
    check(await this.client.from('recipes').delete().eq('id', id));
  }
  async listVersions(recipeId: string) {
    const rows = check(await this.client.from('recipe_versions').select('*').eq('recipe_id', recipeId).order('revision')) as Row[];
    return rows.map(
      (r): RecipeVersion => ({
        id: r.id as string, recipeId: r.recipe_id as string, revision: r.revision as number, origin: r.origin as RecipeVersion['origin'],
        parentVersionId: (r.parent_version_id as string) ?? null, suggestedItems: r.suggested_items as RecipeVersion['suggestedItems'],
        chosenItems: r.chosen_items as RecipeVersion['chosenItems'], audit: r.audit as RecipeVersion['audit'], snapshot: r.snapshot as RecipeVersion['snapshot'],
        constraintsUsed: r.constraints_used as RecipeVersion['constraintsUsed'], conflicts: r.conflicts as RecipeVersion['conflicts'],
        engineNotes: r.engine_notes as string[], excluded: r.excluded as RecipeVersion['excluded'], author: r.author as string,
        createdAt: r.created_at as string, note: (r.note as string) ?? null, draft: (r.draft as boolean) ?? false,
      }),
    );
  }
  async addVersion(v: RecipeVersion) {
    check(
      await this.client.from('recipe_versions').insert({
        id: v.id, recipe_id: v.recipeId, owner_id: this.userId, revision: v.revision, origin: v.origin, parent_version_id: v.parentVersionId,
        suggested_items: v.suggestedItems, chosen_items: v.chosenItems, audit: v.audit, snapshot: v.snapshot, constraints_used: v.constraintsUsed,
        conflicts: v.conflicts, engine_notes: v.engineNotes, excluded: v.excluded, author: v.author, note: v.note, created_at: v.createdAt,
        // solo per le bozze: le versioni normali si salvano anche prima della migrazione 9
        ...(v.draft ? { draft: true } : {}),
      }),
    );
  }

  // ── diario (tabella della migrazione 11) ──
  async listDiary(dogId: string) {
    const rows = check(await this.client.from('diary_entries').select('*').eq('dog_id', dogId).order('date')) as Row[];
    return rows.map(rowToDiary);
  }
  async saveDiaryEntries(entries: DiaryEntry[]) {
    if (!entries.length) return;
    // una sola voce per cane e data: la nuova sostituisce la precedente (vincolo unique(dog_id, date))
    check(await this.client.from('diary_entries').upsert(entries.map((e) => diaryToRow(e, this.userId)), { onConflict: 'dog_id,date' }));
  }
  async deleteDiaryEntry(id: string) {
    check(await this.client.from('diary_entries').delete().eq('id', id));
  }

  // ── prezzi e impostazioni ──
  async listPrices() {
    return (await all(this.client, 'user_prices', 'created_at')).map(
      (r): UserPrice => ({
        id: r.id as string, productKind: r.product_kind as UserPrice['productKind'], productId: r.product_id as string, supplier: (r.supplier as string) ?? null,
        mode: r.mode as UserPrice['mode'], price: Number(r.price), packageGrams: n(r.package_grams), packageUnits: n(r.package_units), active: r.active as boolean,
        createdAt: r.created_at as string,
      }),
    );
  }
  async savePrice(p: UserPrice) {
    check(
      await this.client.from('user_prices').upsert({
        id: p.id, owner_id: this.userId, product_kind: p.productKind, product_id: p.productId, supplier: p.supplier, mode: p.mode, price: p.price,
        package_grams: p.packageGrams ?? null, package_units: p.packageUnits ?? null, active: p.active, created_at: p.createdAt,
      }),
    );
  }
  async deletePrice(id: string) {
    check(await this.client.from('user_prices').delete().eq('id', id));
  }
  async getSettings(): Promise<AppSettings> {
    const { data } = await this.client.from('user_settings').select('settings').maybeSingle();
    return { ...DEFAULT_SETTINGS, disclaimerAccepted: false, ...((data?.settings as Partial<AppSettings>) ?? {}) };
  }
  async saveSettings(s: AppSettings) {
    check(await this.client.from('user_settings').upsert({ owner_id: this.userId, settings: s, updated_at: new Date().toISOString() }));
  }

  // ── amministrazione (il database rifiuta chi non è in app_admins) ──
  async saveFood(f: Food) {
    check(
      await this.client.from('foods').upsert({
        id: f.id, name_it: f.name, category_id: f.categoryId, subcategory_id: f.subcategoryId, species_cut: f.speciesCut ?? null,
        processing_state: f.processingState, preparation: f.preparation ?? null, edible_portion: f.ediblePortion ?? null,
        // l'EM calcolata non si salva: il database la ricalcola dal metodo energetico
        kcal_me_per_100g: f.kcalMeOrigin === 'calculated' ? null : f.kcalMePer100g,
        me_method: f.kcalMeOrigin === 'calculated' ? null : (f.meMethod ?? null),
        energy_method_id: f.energyMethodId ?? null, source_identifier: f.source ?? null, source_url: f.sourceUrl ?? null, source_version: f.sourceVersion ?? null,
        data_status: f.dataStatus, uncertainty: f.uncertainty ?? null, notes: f.notes ?? null,
      }),
    );
    const units = await this.units();
    const rows = Object.entries(f.nutrients).map(([nid, v]) => ({
      food_id: f.id, nutrient_id: nid, amount_per_100g: v.value, unit: units.get(nid), value_status: v.value === null ? 'unknown' : (v.status ?? 'measured'),
      source_id: v.source ?? null, method: v.method ?? null, chemical_form: v.form ?? null,
    }));
    if (rows.length) check(await this.client.from('food_nutrients').upsert(rows));
    // attivazione per ultima: il database la rifiuta se mancano energia o stato dei dati
    check(await this.client.from('foods').update({ available_to_formulate: f.availableToFormulate }).eq('id', f.id));
  }
  async saveSupplement(s: Supplement) {
    check(
      await this.client.from('supplements').upsert({
        id: s.id, name_it: s.name, brand: s.brand ?? null, product_variant: s.variant ?? null, class: s.supplementClass ?? null, dose_unit: s.doseUnit,
        mass_per_unit_g: s.massPerUnitG, gross_mass_per_unit_g: s.grossMassPerUnitG ?? null, kcal_per_unit: s.kcalOrigin === 'calculated' ? null : s.kcalPerUnit, integer_dose: s.integerDose, max_daily_units: s.maxDailyUnits,
        max_daily_source: s.maxDailySource ?? null, label_source: s.labelSource ?? null, source_url: s.sourceUrl ?? null, data_status: s.dataStatus ?? null, label_added_only: !!s.labelAddedOnly,
        product_version: s.version ?? null, status: s.status, notes: s.notes ?? null, dose_guide: s.doseGuide ?? null,
      }),
    );
    const units = await this.units();
    const rows = Object.entries(s.nutrients).map(([nid, v]) => ({
      supplement_id: s.id, nutrient_id: nid, amount_per_unit: v.value, unit: units.get(nid), value_status: v.value === null ? 'unknown' : (v.status ?? 'label'),
      source_id: v.source ?? null, method: v.method ?? null, chemical_form: v.form ?? null,
    }));
    if (rows.length) check(await this.client.from('supplement_nutrients').upsert(rows));
    check(await this.client.from('supplements').update({ usable_for_optimization: s.usableForOptimization }).eq('id', s.id));
  }
  async saveThreshold(t: CustomThreshold) {
    check(await this.client.from('custom_thresholds').update({ enabled: t.enabled, lower_value: t.lower, upper_value: t.upper }).eq('id', t.id));
  }
  async saveEnergyMethod(m: EnergyMethod) {
    check(
      await this.client.from('energy_methods').upsert({
        id: m.id, version: m.version, label: m.label, protein: m.protein, fat: m.fat, carbohydrate: m.carbohydrate,
        source: m.source, approved_by: m.approvedBy, approved_at: m.approvedAt ?? null, notes: m.notes ?? null, active: m.active,
      }),
    );
  }
  async saveEnergyAssignments(a: EnergyAssignment[]) {
    check(await this.client.rpc('admin_set_energy_assignments', { rows: a.map((x) => ({ category_id: x.categoryId, processing: x.processing, method_id: x.methodId, caution: x.caution ?? null })) }));
  }
  async applyCatalogImport(plan: ImportPlan) {
    check(await this.client.rpc('admin_import_catalog', { payload: toPayload(plan) }));
  }
  async validateCatalogItem(kind: 'food' | 'supplement', id: string) {
    check(await this.client.rpc('validate_catalog_item', { item_kind: kind, item_id: id }));
  }
  async listProfileHistory(kind: 'food' | 'supplement', id: string): Promise<ProfileHistoryEntry[]> {
    const table = kind === 'food' ? 'food_profile_history' : 'supplement_profile_history';
    const col = kind === 'food' ? 'food_id' : 'supplement_id';
    const rows = check(await this.client.from(table).select('*').eq(col, id).order('profile_version', { ascending: false })) as Row[];
    return rows.map((r) => ({ version: r.profile_version as number, changedAt: r.changed_at as string, changedBy: (r.changed_by as string) ?? null, profile: r.profile }));
  }
  async listImports(): Promise<ImportLogEntry[]> {
    const rows = check(await this.client.from('catalog_imports').select('*').order('created_at', { ascending: false }).limit(30)) as Row[];
    return rows.map((r) => ({ id: r.id as string, kind: r.kind as ImportLogEntry['kind'], fileName: (r.file_name as string) ?? null, summary: r.summary as ImportLogEntry['summary'], products: r.products as string[], createdAt: r.created_at as string }));
  }
  private unitCache: Map<string, string> | null = null;
  private async units() {
    if (!this.unitCache) this.unitCache = new Map((await all(this.client, 'nutrients')).map((r) => [r.id as string, r.canonical_unit as string]));
    return this.unitCache;
  }
}

