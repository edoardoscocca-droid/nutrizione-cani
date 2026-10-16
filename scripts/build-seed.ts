// Genera i file SQL dei dati iniziali dai file del pacchetto:
//   supabase/seed.sql                — dizionario, FEDIAF, soglie C, categorie, nomi di alimenti (D) e integratori (E), note di razza
//   supabase/seed_test_fixtures.sql  — FACOLTATIVO, solo per prove: dati fittizi marcati [TEST]
// Uso: npm run seed:sql

import { writeFileSync } from 'node:fs';
import { BREED_NOTES, CATEGORIES, packageFoods, packageReferences, packageSupplements } from '../src/data/packageCatalog';
import { TEST_FOODS, TEST_SUPPLEMENTS } from '../src/data/testFixtures';
import type { Food, Supplement } from '../src/engine/types';

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return `array[${v.map(q).join(',')}]::text[]`;
  if (typeof v === 'object') return `${q(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
const row = (vals: unknown[]) => `(${vals.map(q).join(', ')})`;
function insert(table: string, cols: string[], rows: unknown[][], conflict = 'do nothing'): string {
  if (!rows.length) return '';
  return `insert into public.${table} (${cols.join(', ')}) values\n  ${rows.map(row).join(',\n  ')}\non conflict ${conflict};\n\n`;
}

const refs = packageReferences();
const units = new Map(refs.nutrients.map((n) => [n.id, n.unit]));
let sql = '-- Generato da scripts/build-seed.ts a partire da dati/pacchetto. Non modificare a mano.\n\n';
sql += insert('nutrients', ['id', 'label_it', 'canonical_unit', 'nutrient_group', 'kind', 'formula', 'notes'],
  refs.nutrients.map((n) => [n.id, n.label, n.unit, n.group, n.kind, n.formula, n.notes]), '(id) do nothing');
sql += insert('reference_versions', ['id', 'source', 'version_label', 'source_url', 'status'],
  refs.referenceVersions.map((r) => [r.id, r.source, r.label, r.url, r.status]), '(id) do nothing');
sql += insert('nutrient_limits',
  ['id', 'reference_version_id', 'metric', 'life_stage', 'lower_value', 'upper_value', 'unit', 'basis', 'limit_class', 'hardness', 'severity', 'applicability', 'source', 'status', 'notes'],
  refs.limits.filter((l) => l.limitClass !== 'NON_OFFICIAL_ATTENTION').map((l) => [
    l.id, l.referenceVersionId, l.metric, l.lifeStage, l.lower, l.upper, l.unit, l.basis, l.limitClass, l.hardness, l.severity, l.applicability ?? {}, l.source, l.status, l.notes,
  ]), '(id) do nothing');
sql += insert('custom_thresholds', ['id', 'metric', 'lower_value', 'upper_value', 'status', 'rationale', 'requires_review', 'enabled'],
  refs.customThresholds.map((t) => [t.id, t.metric, t.lower, t.upper, t.status, t.rationale, t.requiresReview, t.enabled]), '(id) do nothing');
const sorted = [...CATEGORIES].sort((a, b) => (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0));
sql += insert('food_categories', ['id', 'parent_id', 'label_it', 'secreting_offal', 'sort'],
  sorted.map((c) => [c.id, c.parentId, c.label, !!c.secretingOffal, CATEGORIES.indexOf(c)]), '(id) do nothing');

function foodRows(foods: Food[]) {
  return foods.map((f) => [f.id, f.name, f.categoryId, f.subcategoryId, f.processingState, f.ediblePortion ?? null, f.kcalMePer100g, f.meMethod ?? null, f.source ?? null, f.sourceVersion ?? null, f.dataStatus, f.availableToFormulate, f.notes ?? null]);
}
const foodCols = ['id', 'name_it', 'category_id', 'subcategory_id', 'processing_state', 'edible_portion', 'kcal_me_per_100g', 'me_method', 'source_identifier', 'source_version', 'data_status', 'available_to_formulate', 'notes'];
function suppRows(s: Supplement[]) {
  return s.map((x) => [x.id, x.name, x.brand ?? null, x.variant ?? null, x.supplementClass ?? null, x.doseUnit, x.massPerUnitG, x.kcalPerUnit, x.integerDose, x.maxDailyUnits, x.maxDailySource ?? null, x.labelSource ?? null, x.version ?? null, x.status, x.usableForOptimization, x.notes ?? null]);
}
const suppCols = ['id', 'name_it', 'brand', 'product_variant', 'class', 'dose_unit', 'mass_per_unit_g', 'kcal_per_unit', 'integer_dose', 'max_daily_units', 'max_daily_source', 'label_source', 'product_version', 'status', 'usable_for_optimization', 'notes'];

sql += insert('foods', foodCols, foodRows(packageFoods()), '(id) do nothing');
sql += insert('supplements', suppCols, suppRows(packageSupplements()), '(id) do nothing');
sql += insert('breed_notes', ['id', 'breed_match', 'note', 'source', 'metrics'],
  BREED_NOTES.map((b) => [b.id, b.breedMatch, b.text, b.source, b.metrics]), '(id) do nothing');
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);

let t = '-- DATI DI PROVA FITTIZI [TEST] — solo per collaudo. Non caricarli in un archivio usato per cani reali.\n';
t += '-- Generato da scripts/build-seed.ts. Si rimuovono con: delete from foods where data_status = \'test_fixture\'; delete from supplements where status = \'test_fixture\';\n\n';
t += insert('foods', foodCols, foodRows(TEST_FOODS), '(id) do nothing');
const fn: unknown[][] = [];
for (const f of TEST_FOODS) for (const [nid, v] of Object.entries(f.nutrients)) {
  fn.push([f.id, nid, v.value, units.get(nid), v.value === null ? 'unknown' : v.value === 0 ? 'analytical_zero' : 'measured', 'TEST fittizio']);
}
t += insert('food_nutrients', ['food_id', 'nutrient_id', 'amount_per_100g', 'unit', 'value_status', 'source_id'], fn, '(food_id, nutrient_id) do nothing');
t += insert('supplements', suppCols, suppRows(TEST_SUPPLEMENTS), '(id) do nothing');
const sn: unknown[][] = [];
for (const s of TEST_SUPPLEMENTS) for (const [nid, v] of Object.entries(s.nutrients)) {
  if (s.status === 'missing') continue;
  sn.push([s.id, nid, v.value, units.get(nid), v.value === null ? 'unknown' : v.value === 0 ? 'analytical_zero' : 'label', 'TEST fittizio']);
}
t += insert('supplement_nutrients', ['supplement_id', 'nutrient_id', 'amount_per_unit', 'unit', 'value_status', 'source_id'], sn, '(supplement_id, nutrient_id) do nothing');
writeFileSync(new URL('../supabase/seed_test_fixtures.sql', import.meta.url), t);
console.log('Scritti supabase/seed.sql e supabase/seed_test_fixtures.sql');
