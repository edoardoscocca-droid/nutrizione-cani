// Decisioni della nutrizionista del 16/10/2026: energia per tipologia (D4), integratori sulla composizione dichiarata (D20).

import { describe, expect, test } from 'vitest';
import { auditRecipe } from '../src/engine/audit';
import { supplementStatus } from '../src/engine/catalogStatus';
import { applyEnergyMethods, findAssignment, resolveFoodEnergy } from '../src/engine/energy';
import { formulate } from '../src/engine/formulate';
import { staleDependencies } from '../src/engine/snapshot';
import type { EnergyMethod, Food, NutrientLimit, Supplement } from '../src/engine/types';
import { DEFAULT_SETTINGS } from '../src/engine/types';
import { snapshotOf } from '../src/data/recipeService';
import { dog, input, refs } from './helpers';

const M = refs.energyMethods;
const A = refs.energyAssignments;

function food(over: Partial<Food>): Food {
  return {
    id: 'f', name: 'Alimento', categoryId: 'animal', subcategoryId: 'muscle', processingState: 'raw', kcalMePer100g: null,
    dataStatus: 'test_fixture', availableToFormulate: true, profileVersion: 1,
    nutrients: { protein: { value: 20 }, fat: { value: 10 }, carbohydrate_available: { value: 0 } },
    ...over,
  };
}

describe('D4 — metodo energetico per tipologia di alimento', () => {
  test('EM calcolata con FEDIAF 2025 4/9/4 sui carboidrati disponibili; l’energia «umana» non conta', () => {
    const f = resolveFoodEnergy(food({ nutrients: { protein: { value: 20 }, fat: { value: 10 }, carbohydrate_available: { value: 2 }, energy_food_kcal: { value: 999 } } }), M, A);
    expect(f.kcalMePer100g).toBe(20 * 4 + 10 * 9 + 2 * 4);
    expect(f.kcalMeOrigin).toBe('calculated');
    expect(f.meMethod).toMatch(/FEDIAF 2025/);
  });
  test('l’EM inserita da un amministratore (misurata o da fonte) resta quella', () => {
    const f = resolveFoodEnergy(food({ kcalMePer100g: 150, meMethod: 'analisi di laboratorio' }), M, A);
    expect(f.kcalMePer100g).toBe(150);
    expect(f.kcalMeOrigin).toBe('declared');
    expect(f.energyMethod?.id).toBe('fediaf_2025_ingredienti_naturali'); // serve comunque per le quote energetiche
  });
  test('stato crudo/cotto non indicato o carboidrati mancanti: nessuna EM (mai zero)', () => {
    expect(resolveFoodEnergy(food({ processingState: 'raw_or_unspecified' }), M, A).kcalMePer100g).toBeNull();
    expect(resolveFoodEnergy(food({ nutrients: { protein: { value: 20 }, fat: { value: 10 } } }), M, A).kcalMePer100g).toBeNull();
  });
  test('preparazione e digeribilità: amido crudo e verdura cruda hanno un’avvertenza, i cotti no', () => {
    const at = (categoryId: string, subcategoryId: string, processingState: Food['processingState']) => findAssignment({ categoryId, subcategoryId, processingState }, A);
    expect(at('starch', 'cereal', 'raw')?.caution).toMatch(/Amido non cotto/);
    expect(at('starch', 'cereal', 'cooked_boiled')?.caution).toBeNull();
    expect(at('vegetable', 'vegetable_generic', 'raw')?.caution).toMatch(/Verdura cruda/);
    expect(at('animal', 'heart', 'cooked_other')?.methodId).toBe('fediaf_2025_ingredienti_naturali');
    expect(at('other', 'other', 'raw')).toBeNull(); // tipologia senza metodo: l'amministratore deve sceglierlo
  });
  test('un metodo scelto per il singolo alimento prevale su quello della tipologia', () => {
    const extra: EnergyMethod = { id: 'altro', version: '1', label: 'Altro metodo', protein: 3.5, fat: 8.5, carbohydrate: 3.5, source: 'TEST', approvedBy: 'TEST', active: true };
    const f = resolveFoodEnergy(food({ energyMethodId: 'altro' }), [...M, extra], A);
    expect(f.kcalMePer100g).toBe(20 * 3.5 + 10 * 8.5);
  });
  test('cambiare i fattori (nuova versione) segnala le ricette da ricalcolare', () => {
    const cat = applyEnergyMethods({ foods: [food({})], supplements: [], energyMethods: M, energyAssignments: A });
    const inp = input([], []);
    inp.foods = [{ food: cat.foods[0] }];
    const snap = snapshotOf(inp, 'test');
    const changed = M.map((m) => ({ ...m, version: '2026.2', fat: 8.5 }));
    const now = applyEnergyMethods({ foods: [food({})], supplements: [], energyMethods: changed, energyAssignments: A });
    const deps = staleDependencies(snap, { foods: now.foods, supplements: [], limits: inp.limits, dog: inp.dog });
    expect(deps).toEqual([expect.objectContaining({ kind: 'energy_method', frozen: 'fediaf_2025_ingredienti_naturali@2025.1', current: 'fediaf_2025_ingredienti_naturali@2026.2' })]);
    expect(staleDependencies(snap, { foods: cat.foods, supplements: [], limits: inp.limits, dog: inp.dog })).toEqual([]);
  });
  test('quote energetiche con i fattori del metodo di ciascun alimento', () => {
    const f = resolveFoodEnergy(food({}), M, A);
    const a = auditRecipe({ items: [{ kind: 'food', id: 'f', qty: 100 }], foods: { f }, supplements: {}, nutrients: refs.nutrients, limits: [], dog: dog(), dietMoisture: 'wet', settings: DEFAULT_SETTINGS });
    expect(a.totals.derived.protein_energy_pct.value).toBeCloseTo((100 * 20 * 4) / 170, 9);
    expect(a.totals.derived.fat_energy_pct.value).toBeCloseTo((100 * 10 * 9) / 170, 9);
  });
});

// ── D20: integratori ──
const limit = (metric: string, lower: number | null, upper: number | null, basis: NutrientLimit['basis'] = 'per_day'): NutrientLimit => ({
  id: `l_${metric}_${basis}`, referenceVersionId: 'TEST', metric, lifeStage: 'adult_maintenance', lower, upper, unit: 'mg', basis,
  limitClass: lower !== null ? 'OFFICIAL_MIN' : 'OFFICIAL_NUTRITIONAL_MAX', hardness: 'hard', severity: 'red', source: 'TEST', status: 'verified',
});
const supp = (over: Partial<Supplement>): Supplement => ({
  id: 's', name: 'Integratore', doseUnit: 'g', massPerUnitG: null, kcalPerUnit: 0, integerDose: false, maxDailyUnits: null,
  status: 'test_fixture', usableForOptimization: true, profileVersion: 1, labelSource: 'etichetta', nutrients: { zinc: { value: 5, status: 'label', source: 'etichetta' } },
  ...over,
});
const meat = food({ kcalMePer100g: 200, nutrients: { protein: { value: 20 }, fat: { value: 10 }, carbohydrate_available: { value: 0 }, zinc: { value: 4 }, copper: { value: 1 } } });
function audit(s: Supplement, limits: NutrientLimit[], sQty = 1, foodQty = 500) {
  return auditRecipe({
    items: [{ kind: 'food', id: 'f', qty: foodQty }, { kind: 'supplement', id: 's', qty: sQty }],
    foods: { f: meat }, supplements: { s }, nutrients: refs.nutrients, limits, dog: dog({ kcalTarget: 1000 }), dietMoisture: 'wet', settings: DEFAULT_SETTINGS,
  });
}
const check = (a: ReturnType<typeof audit>, metric: string) => a.rows.find((r) => r.metric === metric)!.checks[0];

describe('D20 — integratori: composizione dichiarata, non dichiarato ≠ zero', () => {
  test('rame non dichiarato: massimo rispettato sui valori dichiarati, con incertezza; la ricetta lo dice', () => {
    const a = audit(supp({}), [limit('copper', null, 10)]);
    const c = check(a, 'copper');
    expect(c.color).toBe('green');
    expect(c.uncertain).toMatch(/Integratore non dichiara/);
    expect(a.rows.find((r) => r.metric === 'copper')!.undeclaredFrom).toEqual(['Integratore']);
    expect(a.declaredCompositionOnly).toBe(true);
    expect(a.warnings.join(' ')).toMatch(/non dichiarati sono sconosciuti, non zero/);
  });
  test('minimo raggiunto con i soli valori dichiarati: certo (il non dichiarato può solo aggiungere)', () => {
    const c = check(audit(supp({}), [limit('copper', 2, null)]), 'copper');
    expect(c.color).toBe('green');
    expect(c.uncertain).toBeUndefined();
  });
  test('minimo NON raggiunto ma un integratore tace sul nutriente: non dimostrato (grigio), mai «zero»', () => {
    const a = audit(supp({}), [limit('copper', 50, null)]);
    expect(check(a, 'copper').color).toBe('grey');
    expect(check(a, 'copper').message).toMatch(/non dimostrato/);
    expect(a.status).toBe('INSUFFICIENT_DATA');
  });
  test('massimo superato già con i valori dichiarati: rosso', () => {
    expect(check(audit(supp({}), [limit('zinc', null, 22)]), 'zinc').color).toBe('red'); // 20 + 5 = 25
  });
  test('un alimento senza il dato resta «dato mancante» (grigio), anche con integratori', () => {
    const a = audit(supp({}), [limit('iodine', 0.1, null)]);
    expect(check(a, 'iodine').color).toBe('grey');
    expect(a.rows.find((r) => r.metric === 'iodine')!.missingFrom).toEqual(['Alimento']);
  });
  test('energia non dichiarata ma peso noto: intervallo prudente (9 kcal/g) per i minimi per 1000 kcal', () => {
    // 500 g di carne = 1000 kcal; 10 g di integratore senza kcal → fino a 1090 kcal
    const s = supp({ kcalPerUnit: null, nutrients: { zinc: { value: 0, status: 'analytical_zero', source: 'etichetta' } } });
    const a = audit(s, [limit('zinc', 19, null, 'per_1000_kcal_me')], 10);
    expect(a.kcal).toBe(1000);
    expect(a.energyRow.note).toMatch(/fino a 1\.?090 kcal/);
    const c = check(a, 'zinc'); // 20 mg / 1000 kcal ≥ 19, ma 20 / 1090 × 1000 < 19
    expect(c.color).toBe('grey');
    expect(c.message).toMatch(/energia di Integratore non è dichiarata/);
  });
  test('energia non dichiarata e peso della dose ignoto: energia incompleta (dato essenziale)', () => {
    const s = supp({ doseUnit: 'capsule', massPerUnitG: null, kcalPerUnit: null });
    const a = audit(s, [], 1);
    expect(a.kcalComplete).toBe(false);
    expect(a.blockers.join(' ')).toMatch(/Energia incompleta/);
  });
  test('omega-3 totali non dichiarati ma EPA e DHA sì: le parti contano come minimo, senza doppio conteggio', () => {
    const fish = supp({ nutrients: { epa: { value: 0.5 }, dha: { value: 0.25 } } });
    const a = audit(fish, [], 2);
    expect(a.totals.nutrients.omega3_total.known).toBeCloseTo(1.5, 9);
    expect(a.totals.nutrients.epa_dha.known).toBeCloseTo(1.5, 9);
    const withTotal = supp({ nutrients: { epa: { value: 0.5 }, dha: { value: 0.25 }, omega3_total: { value: 0.9 } } });
    expect(audit(withTotal, [], 2).totals.nutrients.omega3_total.known).toBeCloseTo(1.8, 9); // il totale dichiarato, non la somma
  });
  test('stato del catalogo: i nutrienti non dichiarati non sono un motivo di «dati parziali»', () => {
    const st = supplementStatus(supp({ status: 'review_required', version: 'lotto 1', validatedAt: '2026-10-16' }), refs.nutrients);
    expect(st.status).toBe('verified');
    expect(st.info.join(' ')).toMatch(/non dichiarati in etichetta: sconosciuti, non zero/);
  });
  test('il calcolo usa la composizione dichiarata: con un integratore che tace, i minimi restano vincoli rigidi', async () => {
    const r = await formulate(input(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal']));
    expect(r.outcome).toBe('solved');
    expect(r.constraints.some((c) => c.kind === 'coverage_partial' && /Calcio/.test(c.label))).toBe(false);
  });
});
