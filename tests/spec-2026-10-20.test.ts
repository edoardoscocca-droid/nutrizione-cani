// Casi di accettazione obbligatori della «Specifica del calcolo dei menù — cane adulto» del 20/10/2026 (§16).
// Profili SINTETICI completi per collaudare il motore; i prodotti reali sono usati solo come copie in memoria.

import { describe, expect, test } from 'vitest';
import { applicableLimits, auditRecipe } from '../src/engine/audit';
import { componentMismatches, topLevelMassG } from '../src/data/catalogImport';
import { LocalRepository } from '../src/data/localRepository';
import { buildInput, editedVersion, versionFromResult, type CatalogState } from '../src/data/recipeService';
import { BREED_NOTES, packageReferences } from '../src/data/packageCatalog';
import { TEST_FOODS, TEST_SUPPLEMENTS } from '../src/data/testFixtures';
import { newDog, toFormulationProfile } from '../src/engine/dogProfile';
import { doseRangeFor } from '../src/engine/doseGuide';
import { formulate } from '../src/engine/formulate';
import { recommendedFor } from '../src/engine/recommended';
import { compoundValue } from '../src/engine/totals';
import { DEFAULT_SETTINGS, type DogFormulationProfile, type Food, type NutrientLimit, type RecipeItem, type Supplement } from '../src/engine/types';

const refs = packageReferences();
const real = await new LocalRepository(null).loadCatalog({ bundledUpTo: '2026-10-16' });
const omegor = { ...real.supplements.find((s) => s.id === 'omegor_vitality')!, usableForOptimization: true };
const qdiet = { ...real.supplements.find((s) => s.id === 'qdiet')!, usableForOptimization: true };
const grau = { ...real.supplements.find((s) => s.id === 'bone_meal')!, usableForOptimization: true };

/** Alimento sintetico completo: 1,5 × ogni minimo FEDIAF per 1000 kcal, 150 kcal/100 g, EPA e DHA = 0 documentati. */
function syntheticBase(id = 'base_sintetica', over: Record<string, number | null> = {}): Food {
  const kcal = 150;
  const nutrients: Food['nutrients'] = {};
  for (const l of refs.limits) {
    if (l.limitClass !== 'OFFICIAL_MIN' || l.basis !== 'per_1000_kcal_me' || l.lower === null) continue;
    nutrients[l.metric] = { value: (l.lower * 1.5 * kcal) / 1000, status: 'measured', source: 'sintetico' };
  }
  const protein = nutrients.protein!.value as number;
  const fat = nutrients.fat!.value as number;
  Object.assign(nutrients, {
    carbohydrate_available: { value: (kcal - 4 * protein - 9 * fat) / 4, status: 'calculated', source: 'sintetico' },
    fiber: { value: 1.5, status: 'measured', source: 'sintetico' },
    moisture: { value: 60, status: 'measured', source: 'sintetico' },
    epa: { value: 0, status: 'analytical_zero', source: 'sintetico' },
    dha: { value: 0, status: 'analytical_zero', source: 'sintetico' },
  });
  for (const [k, v] of Object.entries(over)) nutrients[k] = { value: v, status: v === null ? 'unknown' : 'measured', source: 'sintetico' };
  return {
    id, name: `[SINTETICO] ${id}`, categoryId: 'animal', subcategoryId: 'muscle', processingState: 'raw', ediblePortion: '100%', kcalMePer100g: kcal, kcalMeOrigin: 'declared', meMethod: 'sintetico',
    source: 'sintetico', sourceVersion: '1', dataStatus: 'test_fixture', availableToFormulate: true, profileVersion: 1, nutrients,
  };
}

function catalogWith(foods: Food[], supplements: Supplement[]): CatalogState {
  return { ...refs, foods, supplements, breedNotes: BREED_NOTES };
}
const dog33 = (over: Record<string, unknown> = {}) =>
  newDog({ name: 'Prova', weightCurrentKg: 33, weightIdealKg: 33, kcalTarget: 1500, ...over }, 'd33');
const sel = (foods: string[], supps: string[], c: Record<string, object> = {}) => ({
  foods: foods.map((id) => ({ id, constraint: c[id] })),
  supplements: supps.map((id) => ({ id, constraint: c[id] })),
  dietMoisture: null,
  // profili sintetici: digeribilità proteica della dieta documentata (il margine +10% si prova a parte)
  proteinDigestibility: { atLeast80: true, reference: 'test: digeribilità documentata' },
});
const qty = (items: RecipeItem[], id: string) => items.find((i) => i.id === id)?.qty ?? 0;
const limit = (metric: string, lower: number | null, upper: number | null, basis: NutrientLimit['basis'] = 'per_day', cls: NutrientLimit['limitClass'] = 'OFFICIAL_MIN'): NutrientLimit => ({
  id: `t_${metric}_${lower}_${upper}`, referenceVersionId: 'T', metric, lifeStage: 'adult_maintenance', lower, upper, unit: 'g', basis, limitClass: cls, hardness: 'hard', severity: 'red', source: 'test', status: 'verified',
});

describe('§16 casi di accettazione', () => {
  test('energia 1.379 kcal ±2%: intervallo 1351,42–1406,58; i minimi non si abbassano con l’estremo basso', () => {
    const K = 1379;
    expect(K * 0.98).toBeCloseTo(1351.42, 2);
    expect(K * 1.02).toBeCloseTo(1406.58, 2);
    // ricetta all'estremo basso: 70 g di proteine = 51,8 g/1000 kcal su E_finale 1351,42 ma solo 50,76 su E_obiettivo
    const f: Food = { ...syntheticBase('p'), kcalMePer100g: 135.142, nutrients: { protein: { value: 7.0, status: 'measured', source: 's' } } };
    const dog = { ...toFormulationProfile(newDog({ name: 'x', weightCurrentKg: 20, kcalTarget: K }, 'x'), []), eaaMarginPct: 0 };
    const a = auditRecipe({ items: [{ kind: 'food', id: 'p', qty: 1000 }], foods: { p: f }, supplements: {}, nutrients: refs.nutrients, limits: [limit('protein', 51, null, 'per_1000_kcal_me')], dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    expect(a.kcal).toBeCloseTo(1351.42, 6);
    const c = a.rows.find((r) => r.metric === 'protein')!.checks[0];
    expect(c.color).toBe('red'); // 70/1379×1000 = 50,76 < 51: sull'estremo basso (51,8) sarebbe passato
  });

  test('33 kg, 30 mg/kg^0,75: circa 413,05 mg EPA+DHA/giorno', () => {
    const r = recommendedFor({ lifeStage: 'adult_maintenance', weightCurrentKg: 33 }, refs.recommendedTargets, refs.nutrients)[0];
    expect(r.amountPerDay * 1000).toBeCloseTo(413.05, 1);
  });

  test('Omegor 535 + 268 = 803 mg/capsula, senza doppio conteggio', () => {
    expect(compoundValue(omegor.nutrients, 'epa_dha')!.value * 1000).toBeCloseTo(803, 6);
    const dog = toFormulationProfile(dog33(), [], refs.recommendedTargets, refs.nutrients);
    const a = auditRecipe({ items: [{ kind: 'supplement', id: omegor.id, qty: 1 }], foods: {}, supplements: { [omegor.id]: omegor }, nutrients: refs.nutrients, limits: [], dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    expect(a.totals.nutrients.epa_dha.known * 1000).toBeCloseTo(803, 6);
  });

  test('33 kg, base sintetica EPA/DHA = 0 documentati, Omegor autorizzato: 1 capsula', async () => {
    const r = await formulate(buildInput(dog33(), sel(['base_sintetica'], [omegor.id]), catalogWith([syntheticBase()], [omegor]), DEFAULT_SETTINGS, []));
    expect(r.outcome).toBe('solved');
    expect(qty(r.items, omegor.id)).toBe(1);
    expect(r.constraints.some((c) => /limite operativo del generatore 1/.test(c.label))).toBe(true);
  });

  test('52 capsule: respinte nel generatore; l’analisi manuale mostra dose e apporti senza correggerli', async () => {
    const cat = catalogWith([syntheticBase()], [omegor]);
    const r = await formulate(buildInput(dog33(), sel(['base_sintetica'], [omegor.id], { [omegor.id]: { required: true, minQty: 52 } }), cat, DEFAULT_SETTINGS, []));
    expect(r.outcome).toBe('infeasible');
    expect(r.conflicts.map((c) => c.label).join(' | ')).toMatch(/Limite operativo|almeno 52/);
    const dog = toFormulationProfile(dog33(), [], refs.recommendedTargets, refs.nutrients);
    const items: RecipeItem[] = [{ kind: 'food', id: 'base_sintetica', qty: 1000 }, { kind: 'supplement', id: omegor.id, qty: 52 }];
    const a = auditRecipe({ items, foods: { base_sintetica: syntheticBase() }, supplements: { [omegor.id]: omegor }, nutrients: refs.nutrients, limits: refs.limits, dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    expect(a.totals.nutrients.epa_dha.known).toBeCloseTo(52 * 0.803, 6);
    expect(items[1].qty).toBe(52);
  });

  test('Ca/P: base 122,85 mg Ca e 1085 mg P; Grau 5 g; QDiet 13 g → Ca 3592,85; P 2815; rapporto ≈ 1,276323', () => {
    const base: Food = { ...syntheticBase('b'), nutrients: { calcium: { value: 0.12285, status: 'measured', source: 's' }, phosphorus: { value: 1.085, status: 'measured', source: 's' } } };
    const dog = toFormulationProfile(dog33(), []);
    const a = auditRecipe({
      items: [{ kind: 'food', id: 'b', qty: 100 }, { kind: 'supplement', id: grau.id, qty: 5 }, { kind: 'supplement', id: qdiet.id, qty: 13 }],
      foods: { b: base }, supplements: { [grau.id]: grau, [qdiet.id]: qdiet }, nutrients: refs.nutrients, limits: [], dog, dietMoisture: null, settings: DEFAULT_SETTINGS,
    });
    expect(a.totals.nutrients.calcium.known * 1000).toBeCloseTo(3592.85, 6);
    expect(a.totals.nutrients.phosphorus.known * 1000).toBeCloseTo(2815, 6);
    expect(a.totals.derived.ca_p_ratio.value!).toBeCloseTo(1.276323, 6);
  });

  // stessa equazione lineare per farina d'ossa e per un prodotto sintetico ricco di calcio (nessuna eccezione per nome)
  async function minForRatio(product: Supplement) {
    const base = syntheticBase('b', { calcium: 0.12285, phosphorus: 1.085 });
    const d = newDog({ name: 'x', weightCurrentKg: 1, kcalTarget: 150, targets: [{ id: 'r', metric: 'ca_p_ratio', lower: 1.2, upper: null, unit: 'ratio', basis: 'ratio', locked: true, setBy: 'test', setAt: '2026-10-20' }] }, 'x');
    const input = buildInput(d, sel(['b'], [product.id], { b: { required: true, minQty: 100, maxQty: 100 } }), catalogWith([base], [{ ...product, kcalPerUnit: 0, maxDailyUnits: null }]), { ...DEFAULT_SETTINGS }, []);
    input.limits = [];
    input.dog.recommended = [];
    return formulate(input);
  }
  test('solo Grau, rapporto 1,2 esatto: circa 86,7022 g teorici (passo 0,1 g → primo valore che rispetta il vincolo)', async () => {
    const r = await minForRatio(grau);
    expect(r.outcome).toBe('solved');
    const g = qty(r.items, grau.id);
    expect(g).toBeGreaterThanOrEqual(86.7022);
    expect(g).toBeLessThan(86.7022 + 0.1 + 1e-9);
  });
  test('prodotto X sintetico 380 mg Ca/g e P = 0: circa 3,10303 g teorici, stesso algoritmo', async () => {
    const x: Supplement = { ...grau, id: 'prodotto_x', name: 'Prodotto X (sintetico)', openGaps: [], nutrients: { calcium: { value: 0.38, status: 'label', source: 's', declared: 'total' }, phosphorus: { value: 0, status: 'analytical_zero', source: 's', declared: 'total' } } };
    const r = await minForRatio(x);
    const g = qty(r.items, 'prodotto_x');
    expect((1.2 * 1085 - 122.85) / 380).toBeCloseTo(3.10303, 5);
    expect(g).toBeGreaterThanOrEqual(3.10303);
    expect(g).toBeLessThan(3.10303 + 0.1 + 1e-9);
  });

  test('1 g di carote: non ammesso nella generazione a 1.400 kcal; in analisi manuale resta 1 g', async () => {
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1400 }, 'x');
    const cat = catalogWith(structuredClone(TEST_FOODS), structuredClone(TEST_SUPPLEMENTS));
    const input = buildInput(d, sel(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']), cat, DEFAULT_SETTINGS, []);
    const r = await formulate(input);
    expect(r.outcome).toBe('solved');
    const carrot = qty(r.items, 'test_carrot');
    const practical = Math.max(5, (0.005 * 1400) / 0.35); // 20 g: 0,5% delle kcal
    expect(carrot === 0 || carrot >= practical).toBe(true);
    const v = versionFromResult({ id: 'v1', recipeId: 'r', revision: 1, origin: 'engine', parentVersionId: null, author: 'u' }, r, input);
    const manual = r.items.map((i) => (i.id === 'test_carrot' ? { ...i, qty: 1 } : i));
    const e = editedVersion(v, manual, { id: 'v2', revision: 2, author: 'u' });
    expect(qty(e.chosenItems, 'test_carrot')).toBe(1);
    expect(e.audit.totals.nutrients.protein.contributions.some((c) => c.name.includes('Carote'))).toBe(true);
  });

  test('capsule intere nel generatore (mai 1,3); la verifica usa le quantità mostrate', async () => {
    const r = await formulate(buildInput(dog33(), sel(['base_sintetica'], [omegor.id]), catalogWith([syntheticBase()], [omegor]), DEFAULT_SETTINGS, []));
    expect(Number.isInteger(qty(r.items, omegor.id))).toBe(true);
    expect(r.audit!.totals.nutrients.epa_dha.known).toBeCloseTo(qty(r.items, omegor.id) * 0.803, 9);
  });

  test('QDiet a 33 kg con guida 30–40 kg: massimo operativo 9,9 g; una prescrizione maggiore è analizzabile e segnalata', () => {
    expect(doseRangeFor(qdiet.doseGuide!, 33)!.max).toBeCloseTo(9.9, 9);
    const dog = toFormulationProfile(dog33(), []);
    const a = auditRecipe({ items: [{ kind: 'supplement', id: qdiet.id, qty: 12 }], foods: {}, supplements: { [qdiet.id]: qdiet }, nutrients: refs.nutrients, limits: [], dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    const d = a.doseChecks!.find((x) => x.name === qdiet.name)!;
    expect(d.color).toBe('orange');
    expect(d.message).toMatch(/supera la dose massima consigliata.*valutazione veterinaria/);
  });

  test('linoleico NA: non zero, non verificabile; dimostrato se altre fonti coprono il minimo', () => {
    const dog = toFormulationProfile(dog33(), []);
    const noLa = syntheticBase('n', { linoleic_acid: null });
    const lim = [limit('linoleic_acid', 3, null)];
    const a = auditRecipe({ items: [{ kind: 'food', id: 'n', qty: 100 }], foods: { n: noLa }, supplements: {}, nutrients: refs.nutrients, limits: lim, dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    const c = a.rows.find((r) => r.metric === 'linoleic_acid')!;
    expect(c.missingFrom).toEqual(['[SINTETICO] n']);
    expect(c.checks[0].color).toBe('grey');
    const rich = syntheticBase('r', { linoleic_acid: 5 });
    const b = auditRecipe({ items: [{ kind: 'food', id: 'n', qty: 100 }, { kind: 'food', id: 'r', qty: 100 }], foods: { n: noLa, r: rich }, supplements: {}, nutrients: refs.nutrients, limits: lim, dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    expect(b.rows.find((r) => r.metric === 'linoleic_acid')!.checks[0].color).toBe('green');
  });

  test('iodio noto 0,419 mg, minimo 0,414, altri apporti NA: minimo dimostrato; massimo non automaticamente dimostrato', () => {
    const dog = toFormulationProfile(dog33(), []);
    const a1 = syntheticBase('a', { iodine: 0.419 });
    const a2 = syntheticBase('n', { iodine: null });
    const lims = [{ ...limit('iodine', 0.414, null), unit: 'mg' }, { ...limit('iodine', null, 5, 'per_day', 'OFFICIAL_NUTRITIONAL_MAX'), unit: 'mg' }];
    const a = auditRecipe({ items: [{ kind: 'food', id: 'a', qty: 100 }, { kind: 'food', id: 'n', qty: 100 }], foods: { a: a1, n: a2 }, supplements: {}, nutrients: refs.nutrients, limits: lims, dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    const checks = a.rows.find((r) => r.metric === 'iodine')!.checks;
    expect(checks.find((c) => c.limit.lower !== null)!.color).toBe('green');
    expect(checks.find((c) => c.limit.lower !== null)!.message).toMatch(/Minimo dimostrato dai dati disponibili/);
    expect(checks.find((c) => c.limit.upper !== null)!.color).toBe('grey');
    expect(checks.find((c) => c.limit.upper !== null)!.message).toMatch(/massimo non verificabile/);
  });

  test('olio: 1 g grassi, 900 mg omega-3, 803 mg EPA+DHA → massa 1 g, frazioni contenute nel totale', () => {
    const v = (x: number) => ({ value: x, status: 'label' as const });
    const n = { fat: v(1), omega3_total: v(0.9), epa: v(0.535), dha: v(0.268) };
    expect(topLevelMassG(n, refs.nutrients)).toBeCloseTo(1, 9);
    expect(componentMismatches(n, refs.nutrients)).toEqual([]);
  });

  test('avena «dried» senza metodo energetico: nessuna esclusione silenziosa dei vincoli', async () => {
    const oat = { ...structuredClone(TEST_FOODS.find((f) => f.id === 'test_oats')!), processingState: 'dried' as const, kcalMePer100g: null, kcalMeOrigin: 'calculated' as const, energyMethod: null };
    const cat = catalogWith([...structuredClone(TEST_FOODS).filter((f) => f.id !== 'test_oats'), oat], structuredClone(TEST_SUPPLEMENTS));
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1400, macroPreferences: [{ metric: 'protein_energy_pct', lower: 25, upper: 40, locked: false }] }, 'x');
    const r = await formulate(buildInput(d, sel(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']), cat, DEFAULT_SETTINGS, []));
    // l'avena senza energia è esclusa in modo esplicito (motivo indicato), le preferenze restano nel modello
    expect(r.excluded.find((e) => e.id === 'test_oats')!.reason).toMatch(/energia metabolizzabile/);
    expect(r.notes.join(' ')).not.toMatch(/non applicata/);
    expect(r.constraints.some((c) => c.metric === 'protein_energy_pct')).toBe(true);
  });

  test('Ca:P 1,05: dentro H, fuori dalla preferenza e dall’ampliamento: diagnostico, non preferenza rispettata', () => {
    const dog = toFormulationProfile(dog33(), []);
    const b: Food = { ...syntheticBase('b'), nutrients: { calcium: { value: 1.05, status: 'measured', source: 's' }, phosphorus: { value: 1, status: 'measured', source: 's' } } };
    const lims = [...refs.limits.filter((l) => l.metric === 'ca_p_ratio')];
    const a = auditRecipe({ items: [{ kind: 'food', id: 'b', qty: 100 }], foods: { b }, supplements: {}, nutrients: refs.nutrients, limits: lims, dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    const checks = a.rows.find((r) => r.metric === 'ca_p_ratio')!.checks;
    expect(checks.filter((c) => c.limit.limitClass.startsWith('OFFICIAL')).every((c) => c.color === 'green')).toBe(true);
    expect(checks.find((c) => c.limit.limitClass === 'NON_OFFICIAL_ATTENTION')!.color).toBe('orange');
    expect(a.status).not.toBe('VERIFIED_AVAILABLE_CHECKS');
  });

  test('due minimi incompatibili con un massimo: non fattibile con l’elenco dei vincoli, nessuna media', async () => {
    const s: Supplement = { ...grau, id: 'mix', name: 'Mix sintetico', openGaps: [], kcalPerUnit: 0, maxDailyUnits: null, doseGuide: null, nutrients: { copper: { value: 1, status: 'label', source: 's', declared: 'total' }, zinc: { value: 1, status: 'label', source: 's', declared: 'total' }, calcium: { value: 1, status: 'label', source: 's', declared: 'total' } } };
    const base = syntheticBase('b', { copper: 0, zinc: 0, calcium: 0 });
    const input = buildInput(newDog({ name: 'x', weightCurrentKg: 1, kcalTarget: 150 }, 'x'), sel(['b'], ['mix'], { b: { required: true, minQty: 100, maxQty: 100 } }), catalogWith([base], [s]), DEFAULT_SETTINGS, []);
    input.dog.recommended = [];
    input.limits = [{ ...limit('copper', 10, null), unit: 'mg' }, { ...limit('zinc', 12, null), unit: 'mg' }, limit('calcium', null, 0.005, 'per_day', 'OFFICIAL_NUTRITIONAL_MAX')];
    const r = await formulate(input);
    expect(r.outcome).toBe('infeasible');
    const labels = r.conflicts.map((c) => c.label).join(' | ');
    // la diagnosi elenca la violazione minima necessaria (qui i due minimi, incompatibili con il massimo di calcio)
    expect(labels).toMatch(/Rame|Zinco/);
    expect(r.items).toEqual([]);
  });

  test('dieta mista o ignota: selenio non disattivato, politica prudenziale dichiarata', () => {
    const dog = toFormulationProfile(dog33(), []);
    const se = (m: 'wet' | 'dry' | null) => applicableLimits(refs.limits, dog, m).filter((l) => l.metric === 'selenium_wet').map((l) => l.lower);
    expect(se(null)).toEqual([67.5]);
    expect(se('wet')).toEqual([67.5]);
    expect(se('dry')).toEqual([55]);
    const a = auditRecipe({ items: [{ kind: 'food', id: 'b', qty: 100 }], foods: { b: syntheticBase('b') }, supplements: {}, nutrients: refs.nutrients, limits: refs.limits, dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    expect(a.warnings.join(' ')).toMatch(/Selenio: .*prudenziale/);
    expect(a.blockers.join(' ')).not.toMatch(/selenio/i);
  });

  test('olio non aumentato per calorie o vitamina E: al massimo le capsule che coprono EPA+DHA; senza obiettivo, 0', async () => {
    // base povera di energia: il generatore non può usare l'olio per completare le calorie
    const r = await formulate(buildInput(dog33(), sel(['base_sintetica'], [omegor.id]), catalogWith([syntheticBase()], [{ ...omegor, kcalPerUnit: 9 }]), DEFAULT_SETTINGS, []));
    expect(qty(r.items, omegor.id)).toBeLessThanOrEqual(1);
    const d = dog33({ lifeStage: 'other' });
    const r2 = await formulate(buildInput(d, sel(['base_sintetica'], [omegor.id]), catalogWith([syntheticBase()], [{ ...omegor, kcalPerUnit: 9 }]), DEFAULT_SETTINGS, []));
    expect(qty(r2.items, omegor.id)).toBe(0);
    expect(r2.notes.join(' ')).toMatch(/nessun obiettivo EPA\+DHA attivo/);
  });

  test('energia della farina d’ossa ignota: totale parziale, nessuna attestazione della tolleranza energetica', () => {
    const dog = toFormulationProfile(dog33(), []);
    const a = auditRecipe({ items: [{ kind: 'food', id: 'b', qty: 1000 }, { kind: 'supplement', id: grau.id, qty: 10 }], foods: { b: syntheticBase('b') }, supplements: { [grau.id]: grau }, nutrients: refs.nutrients, limits: [], dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    expect(a.energyRow.color).toBe('grey');
    expect(a.energyRow.note).toMatch(/totale parziale/);
    expect(a.status).toBe('INSUFFICIENT_DATA');
  });

  test('tempo scaduto senza soluzione: «calcolo non completato», mai «nessuna soluzione esistente»', async () => {
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1400 }, 'x');
    const cat = catalogWith(structuredClone(TEST_FOODS), structuredClone(TEST_SUPPLEMENTS));
    const s = sel(['test_beef', 'test_beef_heart', 'test_beef_liver', 'test_oats', 'test_carrot', 'test_sardine'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']);
    const r = await formulate(buildInput(d, s, cat, { ...DEFAULT_SETTINGS, timeLimitSeconds: 1e-9 }, []));
    expect(r.outcome).toBe('timeout');
    expect(r.message).toMatch(/non completato.*non è stata determinata/);
    expect(r.message).not.toMatch(/Nessuna soluzione/);
    expect(r.items).toEqual([]);
  });

  test('modifica manuale di tutti i grammi: analisi dei grammi esatti, nessuna riformulazione', async () => {
    const input = buildInput(dog33(), sel(['base_sintetica'], [omegor.id]), catalogWith([syntheticBase()], [omegor]), DEFAULT_SETTINGS, []);
    const r = await formulate(input);
    const v = versionFromResult({ id: 'v1', recipeId: 'r', revision: 1, origin: 'engine', parentVersionId: null, author: 'u' }, r, input);
    const manual: RecipeItem[] = [{ kind: 'food', id: 'base_sintetica', qty: 777 }, { kind: 'supplement', id: omegor.id, qty: 3 }];
    const e = editedVersion(v, manual, { id: 'v2', revision: 2, author: 'u' });
    expect(e.chosenItems).toEqual(manual);
    expect(e.audit.totals.nutrients.epa_dha.known).toBeCloseTo(3 * 0.803, 9);
  });

  test('ricalcolo della stessa ricetta: risultato deterministico', async () => {
    const cat = catalogWith(structuredClone(TEST_FOODS), structuredClone(TEST_SUPPLEMENTS));
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1400 }, 'x');
    const s = sel(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']);
    const a = await formulate(buildInput(d, s, cat, DEFAULT_SETTINGS, []));
    const b = await formulate(buildInput(d, s, cat, DEFAULT_SETTINGS, []));
    expect(b.items).toEqual(a.items);
    expect(b.outcome).toBe(a.outcome);
  });
});

describe('altre regole della specifica', () => {
  test('lacune del catalogo reale visibili: la ricetta non risulta interamente verificata', () => {
    const beef = real.foods.find((f) => f.id === 'beef_03')!;
    expect(beef.openGaps!.length).toBeGreaterThan(0);
    const dog = toFormulationProfile(dog33(), []);
    const a = auditRecipe({ items: [{ kind: 'food', id: beef.id, qty: 500 }], foods: { [beef.id]: beef }, supplements: {}, nutrients: refs.nutrients, limits: [], dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    expect(a.blockers.some((b) => b.startsWith('Lacuna del catalogo non risolta'))).toBe(true);
    expect(a.status).not.toBe('VERIFIED_AVAILABLE_CHECKS');
  });

  test('aminoacidi essenziali +10% se la digeribilità proteica della dieta ≥ 80% non è documentata (nella ricetta, non nel cane)', () => {
    const cat = catalogWith(structuredClone(TEST_FOODS), []);
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1400 }, 'x');
    expect(buildInput(d, { foods: [{ id: 'test_beef' }], supplements: [], dietMoisture: null }, cat, DEFAULT_SETTINGS, []).dog.eaaMarginPct).toBe(10);
    // dichiarata ma senza riferimento documentale: il margine resta
    expect(buildInput(d, { foods: [{ id: 'test_beef' }], supplements: [], dietMoisture: null, proteinDigestibility: { atLeast80: true, reference: ' ' } }, cat, DEFAULT_SETTINGS, []).dog.eaaMarginPct).toBe(10);
    const doc = buildInput(d, { foods: [{ id: 'test_beef' }], supplements: [], dietMoisture: null, proteinDigestibility: { atLeast80: true, reference: 'Analisi XY 2026' } }, cat, DEFAULT_SETTINGS, []);
    expect(doc.dog.eaaMarginPct).toBe(0);
    expect(doc.dog.proteinDigestibilityRef).toBe('Analisi XY 2026');
    const noDig = toFormulationProfile(newDog({ name: 'x', weightCurrentKg: 30 }, 'x'), []);
    const dig = { ...toFormulationProfile(newDog({ name: 'x', weightCurrentKg: 30 }, 'x'), []), eaaMarginPct: 0 };
    const trp = (d: DogFormulationProfile) => applicableLimits(refs.limits, d, null).find((l) => l.metric === 'tryptophan')!.lower;
    expect(trp(noDig)).toBeCloseTo(0.49 * 1.1, 9);
    expect(trp(dig)).toBe(0.49);
    expect(applicableLimits(refs.limits, noDig, null).find((l) => l.metric === 'protein')!.lower).toBe(52.1); // non tutte le proteine
  });

  test('sotto 95 kcal/kg^0,75: nessuna generazione conforme senza profilo a bassa energia', async () => {
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1000 }, 'x');
    const r = await formulate(buildInput(d, sel(['test_beef'], []), catalogWith(structuredClone(TEST_FOODS), []), DEFAULT_SETTINGS, []));
    expect(r.outcome).toBe('blocked');
    expect(r.message).toMatch(/profilo a bassa energia/);
  });

  test('seconda ricerca: solo gli ampliamenti documentati, con la ricerca usata registrata', async () => {
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1400, macroPreferences: [{ metric: 'protein_energy_pct', lower: 45, upper: 60, locked: false }] }, 'x');
    const cat = catalogWith(structuredClone(TEST_FOODS), structuredClone(TEST_SUPPLEMENTS));
    const r = await formulate(buildInput(d, sel(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']), cat, DEFAULT_SETTINGS, []));
    if (r.outcome === 'solved') {
      const pct = r.audit!.totals.derived.protein_energy_pct.value!;
      if (r.stats!.p1Stage === 2) expect(pct).toBeGreaterThanOrEqual(40 - 1e-6);
      else expect(pct).toBeGreaterThanOrEqual(45 - 1e-6);
    } else expect(r.outcome).toBe('preferences_unreachable');
    expect(r.stats!.durationMs).toBeGreaterThan(0);
  });

  test('importazione: «NA» cancella esplicitamente un’energia errata (torna sconosciuta, non zero)', async () => {
    const { parseImport, planImport } = await import('../src/data/catalogImport');
    const cat = await new LocalRepository({ getItem: () => null, setItem: () => undefined }).loadCatalog();
    const p = planImport(parseImport('{"supplements":[{"id":"bone_meal","kcal_per_unit":"NA"}]}', 'supplements', cat.nutrients), cat, 'x');
    expect(p.items[0].fieldChanges.find((c) => c.field === 'kcalPerUnit')?.after ?? null).toBeNull();
    expect(p.warnings.some((w) => /cancellata/.test(w.message)) || p.items[0].action === 'unchanged').toBe(true);
  });
});

describe('correzioni della formulazione reale (20/10/2026)', () => {
  test('QDiet: solo i valori marcati «added» sono limiti inferiori; calcio e fosforo dichiarati restano analitici', () => {
    expect(qdiet.nutrients.calcium.declared ?? null).toBeNull(); // nel file: «reported_or_estimated», non «total»
    expect(qdiet.nutrients.vitamin_a.declared).toBe('added');
    const dog = toFormulationProfile(dog33(), []);
    const a = auditRecipe({ items: [{ kind: 'supplement', id: qdiet.id, qty: 9 }], foods: {}, supplements: { [qdiet.id]: qdiet }, nutrients: refs.nutrients, limits: [], dog, dietMoisture: null, settings: DEFAULT_SETTINGS });
    expect(a.totals.nutrients.calcium.lowerBoundFrom).toEqual([]);
    expect(a.totals.nutrients.phosphorus.lowerBoundFrom).toEqual([]);
    expect(a.totals.nutrients.vitamin_a.lowerBoundFrom).toEqual([qdiet.name]);
    expect(a.totals.nutrients.vitamin_d.lowerBoundFrom).toEqual([qdiet.name]);
  });

  test('tabella d’impiego sul peso attuale (33 kg → massimo 9,9 g), indicato esplicitamente', async () => {
    const d = newDog({ name: 'x', weightCurrentKg: 33, weightIdealKg: 31, kcalTarget: 1800 }, 'x');
    const r = await formulate(buildInput(d, sel(['base_sintetica'], [qdiet.id, omegor.id]), catalogWith([syntheticBase()], [qdiet, omegor]), DEFAULT_SETTINGS, []));
    const c = r.constraints.find((x) => x.label.startsWith(`${qdiet.name}: dose massima del produttore`))!;
    expect(c.label).toMatch(/9,9.*peso attuale di 33 kg/);
    expect(qty(r.items, qdiet.id)).toBeLessThanOrEqual(9.9 + 1e-9);
  });

  test('bozza diagnostica: si salva come bozza; esiti distinti', async () => {
    const { diagnosisOf } = await import('../src/engine/formulate');
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1400, macroPreferences: [{ metric: 'protein_energy_pct', lower: 60, upper: 85, locked: false }] }, 'x');
    const cat = catalogWith(structuredClone(TEST_FOODS), structuredClone(TEST_SUPPLEMENTS));
    const input = buildInput(d, sel(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']), cat, DEFAULT_SETTINGS, []);
    const r = await formulate(input);
    expect(r.outcome).toBe('preferences_unreachable');
    expect(diagnosisOf(r)).toBe('preferences_unreachable');
    expect(r.conflicts.length).toBeGreaterThan(0);
    const v = versionFromResult({ id: 'v1', recipeId: 'r', revision: 1, origin: 'engine', parentVersionId: null, author: 'u' }, r, input);
    expect(v.draft).toBe(true);
    expect(v.origin).toBe('diagnostic');
    const manual = v.chosenItems.map((i) => ({ ...i, qty: i.qty + 1 }));
    const e = editedVersion(v, manual, { id: 'v2', revision: 2, author: 'u' });
    expect(e.chosenItems).toEqual(manual);
    expect(diagnosisOf({ outcome: 'infeasible', audit: null })).toBe('constraints_incompatible');
  });

  test('seconda ricerca: Ca:P 1,2–1,4 passato al solver come 1,1–1,5', async () => {
    const { inspectModel } = await import('../src/engine/formulate');
    const d = newDog({ name: 'x', weightCurrentKg: 30, kcalTarget: 1400 }, 'x');
    const input = buildInput(d, sel(['test_beef', 'test_oats'], ['test_bone_meal']), catalogWith(structuredClone(TEST_FOODS), structuredClone(TEST_SUPPLEMENTS)), DEFAULT_SETTINGS, []);
    const m = inspectModel(input);
    const w = m.widened.filter((r) => /calcio\/fosforo/i.test(r.label));
    expect(w.map((r) => r.label).join(' | ')).toMatch(/minimo ampliato 1,1.*massimo ampliato 1,5/);
    // coefficienti: Ca − 1,1·P per ogni ingrediente
    const oats = TEST_FOODS.find((f) => f.id === 'test_oats')!;
    const lo = w.find((r) => r.op === '>=')!;
    const t = lo.terms.filter((x) => x.item.startsWith(oats.name));
    const sum = t.reduce((a, x) => a + x.coef, 0);
    expect(sum).toBeCloseTo((oats.nutrients.calcium.value! - 1.1 * oats.nutrients.phosphorus.value!) / 100, 9);
  });
});
