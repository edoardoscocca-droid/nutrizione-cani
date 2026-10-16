// Test di accettazione del pacchetto (TEST_accettazione.csv), parte motore e logica.
// I test di permessi e vincoli del database (T11, T12 lato server, immutabilità) sono in tests/db/.

import { describe, expect, test } from 'vitest';
import { auditRecipe } from '../src/engine/audit';
import { recipeCost, type UserPrice } from '../src/engine/cost';
import { applyDogChange, newDog, planDogChange } from '../src/engine/dogProfile';
import { formulate } from '../src/engine/formulate';
import type { Food, NutrientLimit, Supplement } from '../src/engine/types';
import { DEFAULT_SETTINGS } from '../src/engine/types';
import { assertCanAddRecipe, auditOnSnapshot, buildInput, costOf, editedVersion, previewRecalculation, staleFor, versionFromResult, type CatalogState } from '../src/data/recipeService';
import type { Recipe } from '../src/data/model';
import { BREED_NOTES } from '../src/data/packageCatalog';
import { TEST_FOODS, TEST_SUPPLEMENTS } from '../src/data/testFixtures';
import { dog, food, input, refs, supplement } from './helpers';

function catalog(over: Partial<CatalogState> = {}): CatalogState {
  return {
    nutrients: refs.nutrients,
    limits: refs.limits,
    referenceVersions: refs.referenceVersions,
    energyFactors: refs.energyFactors,
    customThresholds: refs.customThresholds,
    foods: structuredClone(TEST_FOODS),
    supplements: structuredClone(TEST_SUPPLEMENTS),
    breedNotes: BREED_NOTES,
    ...over,
  };
}

function simpleFood(id: string, nutrients: Record<string, number | null>, kcal = 100): Food {
  return {
    id, name: id, categoryId: 'animal', subcategoryId: 'muscle', processingState: 'raw', kcalMePer100g: kcal,
    dataStatus: 'test_fixture', availableToFormulate: true, profileVersion: 1,
    nutrients: Object.fromEntries(Object.entries(nutrients).map(([k, v]) => [k, { value: v }])),
  };
}

function auditOf(foods: Food[], qty: number[], d = dog()) {
  return auditRecipe({
    items: foods.map((f, i) => ({ kind: 'food', id: f.id, qty: qty[i] })),
    foods: Object.fromEntries(foods.map((f) => [f.id, f])),
    supplements: {},
    nutrients: refs.nutrients,
    limits: refs.limits,
    factors: refs.energyFactors,
    dog: d,
    dietMoisture: 'wet',
    settings: DEFAULT_SETTINGS,
  });
}

describe('T01 peso', () => {
  test('ideale = attuale alla creazione; solo peso attuale non cambia kcal né ricette; avviso > 5 kg', () => {
    const d0 = newDog({ name: 'Fido', weightCurrentKg: 30, activityFactor: 1.6, kcalTarget: 1400, kcalSource: 'user' }, 'd1');
    expect(d0.weightIdealKg).toBe(30);
    // ideale 35 → nuova stima e richiesta di conferma
    const p1 = planDogChange(d0, { ...d0, weightIdealKg: 35 });
    expect(p1.formulationChanged).toBe(true);
    expect(p1.proposeKcalUpdate).toBe(true);
    expect(p1.newEstimate).toBeCloseTo(70 * 35 ** 0.75 * 1.6, 6);
    expect(p1.weightGapWarning).toBe(false); // 5 kg esatti: non strettamente maggiore
    const d1 = applyDogChange(d0, { ...d0, weightIdealKg: 35 }, false);
    expect(d1.kcalTarget).toBe(1400); // senza conferma le kcal non cambiano
    expect(d1.formulationRevision).toBe(2);
    // solo peso attuale 30 → 32: kcal e revisione invariate
    const d2 = applyDogChange(d1, { ...d1, weightCurrentKg: 32 }, false);
    expect(d2.kcalTarget).toBe(1400);
    expect(d2.formulationRevision).toBe(d1.formulationRevision);
    expect(planDogChange(d1, { ...d1, weightCurrentKg: 32 }).formulationChanged).toBe(false);
    // ideale 40 con attuale 32 → avviso > 5 kg e ricette da ricalcolare
    const p3 = planDogChange(d2, { ...d2, weightIdealKg: 40 });
    expect(p3.weightGapWarning).toBe(true);
    expect(p3.formulationChanged).toBe(true);
    expect(planDogChange(d2, { ...d2, weightIdealKg: 37.01 }).weightGapWarning).toBe(true);
    expect(planDogChange(d2, { ...d2, weightIdealKg: 37 }).weightGapWarning).toBe(false);
  });
});

describe('T02 dato mancante', () => {
  test('vitamina D mancante in un ingrediente: non zero, non verificabile, mai verificata', async () => {
    const r = await formulate(input(['test_beef', 'test_oats', 'test_pumpkin_no_vitd'], ['test_multi', 'test_bone_meal'], {}, { test_pumpkin_no_vitd: { minQty: 50 } }));
    expect(r.outcome).toBe('solved');
    const row = r.audit!.rows.find((x) => x.metric === 'vitamin_d')!;
    expect(row.complete).toBe(false);
    expect(row.missingFrom).toContain('[TEST] Zucca senza vitamina D (fittizio)');
    expect(row.color).toBe('grey');
    expect(r.audit!.status).toBe('INSUFFICIENT_DATA');
  });
});

describe('T03 calcio/fosforo', () => {
  test('Ca 1 g e P 1 g: rapporto 1 ma minimo assoluto di calcio non raggiunto', () => {
    const f = simpleFood('cap', { calcium: 1, phosphorus: 1 }, 1400 / 1);
    const a = auditOf([f], [100]); // 1400 kcal, Ca 1 g, P 1 g
    const ratio = a.rows.find((r) => r.metric === 'ca_p_ratio')!;
    expect(ratio.amount).toBeCloseTo(1, 9);
    expect(ratio.checks.find((c) => c.limit.limitClass === 'OFFICIAL_MIN')!.color).toBe('green');
    const ca = a.rows.find((r) => r.metric === 'calcium')!;
    expect(ca.color).toBe('red');
    expect(a.status).toBe('FAILS_OFFICIAL_LIMITS');
  });
});

describe('T04 farina d’ossa', () => {
  test('Ca e P insieme: ottimizzazione congiunta che converge', async () => {
    const r = await formulate(input(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal']));
    expect(r.outcome).toBe('solved');
    expect(r.phases.length).toBeLessThanOrEqual(4);
    const bone = r.items.find((i) => i.id === 'test_bone_meal')!;
    expect(bone.qty).toBeGreaterThan(0);
    const ca = r.audit!.rows.find((x) => x.metric === 'calcium')!;
    const ratio = r.audit!.rows.find((x) => x.metric === 'ca_p_ratio')!;
    expect(ca.color).toBe('green');
    expect(ratio.amount!).toBeGreaterThanOrEqual(1);
    expect(ratio.amount!).toBeLessThanOrEqual(2);
  });
  test('combinazione impossibile: dichiara i vincoli in conflitto, nessun ciclo', async () => {
    const r = await formulate(input(['test_beef'], ['test_bone_meal'], {}, { test_bone_meal: { maxQty: 1 } }));
    expect(r.outcome).toBe('infeasible');
    expect(r.items).toEqual([]);
    expect(r.conflicts.length).toBeGreaterThan(0);
    expect(r.conflicts.some((c) => c.metric === 'calcium' || c.metric === 'ca_p_ratio')).toBe(true);
  });
});

describe('T05 omega', () => {
  test('ω6 4 g e ω3 1 g → 4; ω3 mancante → non verificabile', () => {
    const f = simpleFood('o', { omega6_total: 4, omega3_total: 1 });
    expect(auditOf([f], [100]).totals.derived.omega6_omega3_ratio.value).toBeCloseTo(4, 9);
    const g = simpleFood('o2', { omega6_total: 4, omega3_total: null });
    const d = auditOf([g], [100]).totals.derived.omega6_omega3_ratio;
    expect(d.value).toBeNull();
    expect(d.complete).toBe(false);
  });
  test('EPA+DHA senza doppio conteggio', () => {
    const f = simpleFood('e', { epa: 0.2, dha: 0.1, omega3_total: 0.5 });
    const a = auditOf([f], [100]);
    expect(a.totals.nutrients.epa_dha.known).toBeCloseTo(0.3, 9);
    expect(a.totals.nutrients.omega3_total.known).toBeCloseTo(0.5, 9);
  });
});

describe('T06 cambio alimento', () => {
  test('manzo → agnello: tutto ricalcolato, originale immutato', async () => {
    const cat = catalog();
    const d = newDog({ name: 'Fido', weightCurrentKg: 30, kcalTarget: 1400 }, 'd1');
    const sel = { foods: [{ id: 'test_beef' }, { id: 'test_oats' }], supplements: [{ id: 'test_multi' }, { id: 'test_bone_meal' }], dietMoisture: 'wet' as const };
    const in1 = buildInput(d, sel, cat, DEFAULT_SETTINGS, []);
    const r1 = await formulate(in1);
    const v1 = versionFromResult({ id: 'v1', recipeId: 'r1', revision: 1, origin: 'engine', parentVersionId: null, author: 'u' }, r1, in1);
    const frozen = JSON.stringify(v1);
    const in2 = buildInput(d, { ...sel, foods: [{ id: 'test_lamb' }, { id: 'test_oats' }] }, cat, DEFAULT_SETTINGS, []);
    const r2 = await formulate(in2);
    expect(r2.outcome).toBe('solved');
    const beef = r1.items.find((i) => i.id === 'test_beef')!.qty;
    const lamb = r2.items.find((i) => i.id === 'test_lamb')!.qty;
    expect(lamb).not.toBe(beef);
    // anche gli integratori sono ricalcolati
    expect(r2.items.find((i) => i.id === 'test_bone_meal')!.qty).not.toBe(r1.items.find((i) => i.id === 'test_bone_meal')!.qty);
    expect(JSON.stringify(v1)).toBe(frozen);
  });
});

describe('T07 integratore sconosciuto', () => {
  test('selezionato senza etichetta: escluso, dati richiesti, nessuna integrazione validata', async () => {
    const r = await formulate(input(['test_beef', 'test_oats'], ['test_no_label', 'test_multi', 'test_bone_meal']));
    expect(r.excluded.map((e) => e.id)).toContain('test_no_label');
    expect(r.excluded[0].reason).toMatch(/servono i dati del prodotto/);
    expect(r.items.find((i) => i.id === 'test_no_label')).toBeUndefined();
    expect(r.audit!.status).toBe('INSUFFICIENT_DATA');
  });
});

describe('T08 capsule', () => {
  test('dose intera e massimo verificato del produttore', async () => {
    const d = dog({
      targets: [{ id: 't', metric: 'epa_dha', lower: 0.5, upper: null, unit: 'g', basis: 'per_day', locked: true, setBy: 'Dott.ssa Test', setAt: '2026-10-16' }],
    });
    const r = await formulate(input(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'], { dog: d }));
    expect(r.outcome).toBe('solved');
    const caps = r.items.find((i) => i.id === 'test_fish_oil_caps')!.qty;
    expect(Number.isInteger(caps)).toBe(true);
    expect(caps).toBeGreaterThanOrEqual(2); // 0,3 g EPA+DHA per capsula
    expect(caps).toBeLessThanOrEqual(4);
    // con un target oltre la dose massima: impossibile, e lo dice
    const d2 = dog({ targets: [{ ...d.targets[0], lower: 2 }] });
    const r2 = await formulate(input(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'], { dog: d2 }));
    expect(r2.outcome).toBe('infeasible');
    expect(r2.conflicts.some((c) => c.kind === 'product_max' || c.metric === 'epa_dha')).toBe(true);
  });
  test('capsula senza peso dell’unità: dosi intere ancora calcolabili, ma ricetta non dichiarata completa', async () => {
    const caps = { ...supplement('test_fish_oil_caps'), massPerUnitG: null } as Supplement;
    const d = dog({ targets: [{ id: 't', metric: 'epa_dha', lower: 0.5, upper: null, unit: 'g', basis: 'per_day', locked: true, setBy: 'Dott.ssa Test', setAt: '2026-10-16' }] });
    const inp = input(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal'], { dog: d });
    inp.supplements = [...inp.supplements, { supplement: caps }];
    const r = await formulate(inp);
    expect(r.outcome).toBe('solved');
    expect(Number.isInteger(r.items.find((i) => i.id === 'test_fish_oil_caps')!.qty)).toBe(true);
    expect(r.audit!.blockers.join()).toMatch(/peso della singola unità/);
  });
});

describe('T09 prezzo', () => {
  test('scatola 120 g a 24 €, uso 6 g → 1,20 €; il prezzo non ricalcola la ricetta', () => {
    const p: UserPrice = { id: 'p', productKind: 'supplement', productId: 'qd', supplier: 'Negozio', mode: 'package_mass', price: 24, packageGrams: 120, active: true, createdAt: '' };
    const items = [{ kind: 'supplement' as const, id: 'qd', qty: 6 }, { kind: 'food' as const, id: 'meat', qty: 300 }];
    const info = { qd: { name: 'Q', doseUnit: 'g' as const, massPerUnitG: null }, meat: { name: 'Carne', doseUnit: 'g' as const, massPerUnitG: null } };
    const c = recipeCost(items, info, [p]);
    expect(c.lines.find((l) => l.id === 'qd')!.cost).toBeCloseTo(1.2, 9);
    expect(c.partial).toBe(true);
    expect(c.missing).toEqual(['Carne']);
    const c2 = recipeCost(items, info, [{ ...p, price: 30 }]);
    expect(c2.lines.find((l) => l.id === 'qd')!.cost).toBeCloseTo(1.5, 9);
    expect(items[0].qty).toBe(6);
    expect(c.monthly).toBeCloseTo(c.daily * 30, 9);
  });
});

describe('T10 / T16 istantanee e provenienza', () => {
  test('aggiornare FEDIAF o un profilo: valori vecchi congelati, avviso, anteprima senza salvataggio', async () => {
    const cat = catalog();
    const d = newDog({ name: 'Fido', weightCurrentKg: 30, kcalTarget: 1400 }, 'd1');
    const sel = { foods: [{ id: 'test_beef' }, { id: 'test_oats' }], supplements: [{ id: 'test_multi' }, { id: 'test_bone_meal' }], dietMoisture: 'wet' as const };
    const inp = buildInput(d, sel, cat, DEFAULT_SETTINGS, []);
    const r = await formulate(inp);
    const v = versionFromResult({ id: 'v1', recipeId: 'r1', revision: 1, origin: 'engine', parentVersionId: null, author: 'u' }, r, inp);
    const before = JSON.stringify(v.audit);
    // nuovo standard: minimo calcio cambiato
    const newLimits: NutrientLimit[] = cat.limits.map((l) => (l.id === 'fediaf_min_calcium' ? { ...l, lower: 3, referenceVersionId: 'FEDIAF_2026_test' } : l));
    const cat2 = { ...cat, limits: newLimits };
    cat2.foods = cat2.foods.map((f) => (f.id === 'test_beef' ? { ...f, profileVersion: 2, nutrients: { ...f.nutrients, fat: { value: 20 } } } : f));
    expect(JSON.stringify(auditOnSnapshot(v.snapshot, v.chosenItems))).toBe(before);
    const stale = staleFor(v, d, cat2);
    expect(stale.some((s) => s.kind === 'reference')).toBe(true);
    expect(stale.some((s) => s.kind === 'food' && s.id === 'test_beef' && s.frozen === 'v1' && s.current === 'v2')).toBe(true);
    const prev = await previewRecalculation(v, d, cat2, DEFAULT_SETTINGS, [], formulate);
    expect(prev.diff.length).toBe(4);
    expect(JSON.stringify(v.audit)).toBe(before);
    expect(v.snapshot.foods.test_beef.sourceVersion).toBe('test-1');
    expect(v.snapshot.referenceVersionIds).toContain('FEDIAF_2025_adult_95_v1.0');
  });
  test('peso attuale non rende la ricetta obsoleta', async () => {
    const cat = catalog();
    const d = newDog({ name: 'Fido', weightCurrentKg: 30, kcalTarget: 1400 }, 'd1');
    const inp = buildInput(d, { foods: [{ id: 'test_beef' }, { id: 'test_oats' }], supplements: [{ id: 'test_multi' }, { id: 'test_bone_meal' }], dietMoisture: 'wet' }, cat, DEFAULT_SETTINGS, []);
    const v = versionFromResult({ id: 'v1', recipeId: 'r1', revision: 1, origin: 'engine', parentVersionId: null, author: 'u' }, await formulate(inp), inp);
    const d2 = applyDogChange(d, { ...d, weightCurrentKg: 32 }, false);
    expect(staleFor(v, d2, cat)).toEqual([]);
    const d3 = applyDogChange(d, { ...d, weightIdealKg: 40 }, false);
    expect(staleFor(v, d3, cat).some((s) => s.kind === 'dog')).toBe(true);
  });
});

describe('T12 ricette', () => {
  test('11ª ricetta rifiutata senza eliminare le precedenti', () => {
    const recipes: Recipe[] = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, dogId: 'd', name: `R${i}`, isPrimary: i === 0, archived: false, currentVersionId: null, dietMoisture: 'wet', createdAt: '' }));
    expect(() => assertCanAddRecipe(recipes.slice(0, 9))).not.toThrow();
    expect(() => assertCanAddRecipe(recipes)).toThrow(/al massimo 10/);
    expect(recipes.length).toBe(10);
  });
});

describe('T13 macro', () => {
  test('70% proteine è quota di energia, non 70% di carne; nessuna etichetta BARF', async () => {
    const factors = { version: 'test', protein: 3.5, fat: 8.5, carbohydrate: 3.5, source: 'fattori di TEST' };
    const d = dog({ targets: [{ id: 'p', metric: 'protein_energy_pct', lower: 70, upper: null, unit: '%', basis: 'energy_pct', locked: false, setBy: 'utente', setAt: '2026-10-16' }] });
    const r = await formulate(input(['test_beef', 'test_oats', 'test_beef_heart'], ['test_multi', 'test_bone_meal'], { dog: d, factors }));
    expect(r.outcome).toBe('solved');
    const pct = r.audit!.totals.derived.protein_energy_pct;
    const protein = r.audit!.totals.nutrients.protein.known;
    expect(pct.value).toBeCloseTo((100 * protein * 3.5) / r.audit!.kcal!, 6);
    const meatG = r.items.filter((i) => i.id !== 'test_oats' && i.kind === 'food').reduce((a, i) => a + i.qty, 0);
    const totalG = r.items.filter((i) => i.kind === 'food').reduce((a, i) => a + i.qty, 0);
    expect(Math.abs((100 * meatG) / totalG - pct.value!)).toBeGreaterThan(1);
    expect(JSON.stringify(r)).not.toMatch(/BARF/i);
  });
  test('senza fattori approvati le preferenze macro non sono applicate e lo si dice', async () => {
    const d = dog({ targets: [{ id: 'p', metric: 'protein_energy_pct', lower: 70, upper: null, unit: '%', basis: 'energy_pct', locked: false, setBy: 'utente', setAt: '2026-10-16' }] });
    const r = await formulate(input(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal'], { dog: d }));
    expect(r.notes.join(' ')).toMatch(/fattori energetici/);
  });
});

describe('T14 sostanza secca', () => {
  test('limite legale in mg/kg sostanza secca: nessun confronto con mg/1000 kcal', async () => {
    const legal: NutrientLimit = {
      id: 'legal_cu', referenceVersionId: 'UE_test', metric: 'copper', lifeStage: 'adult_maintenance', lower: null, upper: 0.0001,
      unit: 'mg', basis: 'per_kg_dry_matter', limitClass: 'LEGAL_MAX', hardness: 'hard', severity: 'red', source: 'test', status: 'verified',
    };
    const r = await formulate(input(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal'], { limits: [...refs.limits, legal] }));
    expect(r.outcome).toBe('solved');
    const cu = r.audit!.rows.find((x) => x.metric === 'copper')!;
    const chk = cu.checks.find((c) => c.limit.id === 'legal_cu')!;
    expect(chk.color).toBe('grey');
    expect(chk.message).toMatch(/sostanza secca/);
    expect(r.notes.join(' ')).toMatch(/per_kg_dry_matter/);
  });
});

describe('T15 riuso', () => {
  test('3 alimenti e 2 integratori risolti insieme con vincoli documentati', async () => {
    const r = await formulate(input(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal']));
    expect(r.outcome).toBe('solved');
    expect(r.items.length).toBe(5);
    expect(r.constraints.some((c) => c.kind === 'official_min' && c.metric === 'calcium')).toBe(true);
    expect(r.constraints.some((c) => c.kind === 'official_ratio')).toBe(true);
    expect(r.constraints.some((c) => c.kind === 'energy')).toBe(true);
    expect(r.audit!.kcal!).toBeCloseTo(1400, -1);
  });
});

describe('T17 attenzione di razza', () => {
  test('Irish Wolfhound: nota viola sulla taurina, nessun target inventato, nessun integratore automatico', async () => {
    const cat = catalog();
    const d = newDog({ name: 'Finn', breed: 'Irish Wolfhound', weightCurrentKg: 60, kcalTarget: 2500 }, 'd2');
    const inp = buildInput(d, { foods: [{ id: 'test_beef' }, { id: 'test_oats' }], supplements: [{ id: 'test_multi' }, { id: 'test_bone_meal' }], dietMoisture: 'wet' }, cat, DEFAULT_SETTINGS, []);
    const r = await formulate(inp);
    const tau = r.audit!.rows.find((x) => x.metric === 'taurine')!;
    expect(tau.purple.length).toBe(1);
    expect(tau.checks).toEqual([]);
    expect(r.items.map((i) => i.id).sort()).toEqual(['test_beef', 'test_bone_meal', 'test_multi', 'test_oats']);
    expect(r.audit!.warnings.join(' ')).toMatch(/taurina/);
  });
});

describe('T18 stato di cottura', () => {
  test('crudo e cotto restano profili distinti; il cotto senza dati non eredita il crudo', async () => {
    const raw = food('test_beef');
    const cooked: Food = { ...raw, id: 'test_beef_cooked', name: '[TEST] Manzo cotto', processingState: 'cooked_boiled', availableToFormulate: false, kcalMePer100g: null, nutrients: {} };
    const inp = input(['test_oats'], ['test_multi', 'test_bone_meal']);
    inp.foods = [{ food: cooked }, { food: raw }, ...inp.foods];
    const r = await formulate(inp);
    expect(r.excluded.some((e) => e.id === 'test_beef_cooked')).toBe(true);
    expect(r.items.some((i) => i.id === 'test_beef_cooked')).toBe(false);
    expect(raw.processingState).toBe('raw');
  });
});

describe('Modifica consapevole (§11)', () => {
  test('proposta conservata, versione utente separata, verifica rifatta', async () => {
    const cat = catalog();
    const d = newDog({ name: 'Fido', weightCurrentKg: 30, kcalTarget: 1400 }, 'd1');
    const inp = buildInput(d, { foods: [{ id: 'test_beef' }, { id: 'test_oats' }], supplements: [{ id: 'test_multi' }, { id: 'test_bone_meal' }], dietMoisture: 'wet' }, cat, DEFAULT_SETTINGS, []);
    const v1 = versionFromResult({ id: 'v1', recipeId: 'r1', revision: 1, origin: 'engine', parentVersionId: null, author: 'u' }, await formulate(inp), inp);
    const edited = v1.chosenItems.map((i) => (i.id === 'test_bone_meal' ? { ...i, qty: 0 } : i));
    const v2 = editedVersion(v1, edited, { id: 'v2', revision: 2, author: 'u' });
    expect(v2.suggestedItems).toEqual(v1.suggestedItems);
    expect(v2.origin).toBe('user_edit');
    expect(v2.audit.status).toBe('FAILS_OFFICIAL_LIMITS');
    expect(v1.audit.status).toBe('VERIFIED_AVAILABLE_CHECKS');
    expect(costOf(v2, []).partial).toBe(true);
  });
});

describe('Dati reali del pacchetto', () => {
  test('con il catalogo del pacchetto (NOT_VERIFIED) nessuna ricetta viene formulata', async () => {
    const { packageFoods, packageSupplements } = await import('../src/data/packageCatalog');
    const foods = packageFoods();
    const supps = packageSupplements();
    const inp = input([], []);
    inp.foods = foods.filter((f) => ['beef_lean', 'oats', 'carrot'].includes(f.id)).map((f) => ({ food: f }));
    inp.supplements = supps.filter((s) => ['qdiet', 'omegor_vitality', 'bone_meal'].includes(s.id)).map((s) => ({ supplement: s }));
    const r = await formulate(inp);
    expect(r.outcome).toBe('blocked');
    expect(r.excluded.length).toBe(6);
    expect(r.items).toEqual([]);
  });
  test('il riferimento FEDIAF è caricato fedelmente', () => {
    const ca = refs.limits.filter((l) => l.metric === 'calcium');
    expect(ca.find((l) => l.limitClass === 'OFFICIAL_MIN')!.lower).toBe(1.45);
    expect(ca.find((l) => l.limitClass === 'OFFICIAL_NUTRITIONAL_MAX')!.upper).toBe(6.25);
    expect(refs.limits.some((l) => l.metric === 'taurine')).toBe(false);
    expect(refs.limits.find((l) => l.id === 'custom_preferred_ca_p')!.limitClass).toBe('NON_OFFICIAL_ATTENTION');
    expect(refs.energyFactors.protein).toBeNull();
  });
});
