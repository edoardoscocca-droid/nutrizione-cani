// Stati del catalogo (Verificato / Dati parziali / Da completare) e importazione massiva.

const LEGACY = { mode: 'legacy' as const };
import { describe, expect, test } from 'vitest';
import { auditRecipe } from '../src/engine/audit';
import { foodStatus, supplementStatus } from '../src/engine/catalogStatus';
import { formulate } from '../src/engine/formulate';
import type { Food } from '../src/engine/types';
import { DEFAULT_SETTINGS } from '../src/engine/types';
import { parseImport, planImport } from '../src/data/catalogImport';
import { LocalRepository } from '../src/data/localRepository';
import { buildInput, staleFor, versionFromResult } from '../src/data/recipeService';
import { newDog } from '../src/engine/dogProfile';
import { packageFoods, packageSupplements } from '../src/data/packageCatalog';
import { TEST_FOODS } from '../src/data/testFixtures';
import { dog, food, input, refs, supplement } from './helpers';

const N = refs.nutrients;

/** profilo completo NON di prova (stesse cifre del manzo di prova, fonte e metodo dichiarati). */
function realFood(over: Partial<Food> = {}): Food {
  const f = structuredClone(food('test_beef'));
  return { ...f, id: 'real_beef', name: 'Manzo reale', dataStatus: 'unverified', source: 'FDC 123', sourceVersion: '2026-04', ...over };
}

describe('Stato del catalogo', () => {
  test('nomi del pacchetto senza dati: da completare', () => {
    for (const f of packageFoods()) expect(foodStatus(f, N).status).toBe('to_complete');
    for (const s of packageSupplements()) expect(supplementStatus(s, N).status).toBe('to_complete');
  });
  test('profilo completo e documentato: dati parziali finché un amministratore non convalida', () => {
    const st = foodStatus(realFood(), N);
    expect(st.status).toBe('partial');
    expect(st.readyForValidation).toBe(true);
    expect(st.reasons).toEqual(['non ancora convalidato da un amministratore']);
    expect(foodStatus(realFood({ validatedAt: '2026-10-17', validatedBy: 'admin' }), N).status).toBe('verified');
  });
  test('qualità, non numero di campi: tutti i valori presenti ma uno stimato → parziale', () => {
    const f = realFood({ validatedAt: '2026-10-17' });
    f.nutrients.zinc = { ...f.nutrients.zinc, status: 'estimated' };
    const st = foodStatus(f, N);
    expect(st.status).toBe('partial');
    expect(st.readyForValidation).toBe(false);
    expect(st.reasons.join()).toMatch(/stimati/);
  });
  test('valore senza fonte, stato crudo/cotto non specificato, fonte assente → parziale con motivi', () => {
    const f = realFood({ validatedAt: '2026-10-17', processingState: 'raw_or_unspecified', source: null });
    f.nutrients.iron = { value: 2, status: 'measured', source: null };
    const r = foodStatus(f, N).reasons.join(' | ');
    expect(r).toMatch(/senza fonte/);
    expect(r).toMatch(/crudo\/cotto/);
    expect(r).toMatch(/fonte del profilo/);
  });
  test('un nutriente richiesto mancante → parziale; energia o proteine mancanti → da completare', () => {
    const f = realFood({ validatedAt: '2026-10-17' });
    f.nutrients.vitamin_d = { value: null };
    expect(foodStatus(f, N).status).toBe('partial');
    expect(foodStatus(realFood({ kcalMePer100g: null }), N).status).toBe('to_complete');
    const g = realFood();
    g.nutrients.protein = { value: null };
    expect(foodStatus(g, N).status).toBe('to_complete');
  });
  test('integratore con etichetta solo «aggiunti»: si verificano i dati dichiarati, la composizione completa resta non nota', () => {
    const s = { ...structuredClone(supplement('test_multi')), status: 'review_required' as const, labelAddedOnly: true, kcalPerUnit: null, version: 'lotto 1', validatedAt: '2026-10-16' };
    const st = supplementStatus(s, N);
    expect(st.status).toBe('verified'); // né «solo additivi» né energia non dichiarata impediscono la verifica
    expect(st.info.join(' ')).toMatch(/additivi aggiunti/);
    expect(st.info.join(' ')).toMatch(/Energia per dose non dichiarata/);
  });
});

describe('Stato e motore', () => {
  test('alimento con dati parziali: entra nel calcolo; la ricetta dichiara la qualità dei dati', async () => {
    const partial = realFood({ availableToFormulate: true });
    const inp = input(['test_oats'], ['test_multi', 'test_bone_meal']);
    inp.foods = [{ food: partial }, ...inp.foods];
    const r = await formulate(inp);
    expect(r.outcome).toBe('solved');
    expect(r.items.find((i) => i.id === 'real_beef')!.qty).toBeGreaterThan(0);
    // utilizzabilità ≠ qualità: i controlli si fanno, e il risultato dice su quali dati
    expect(r.audit!.status).toBe('VERIFIED_AVAILABLE_CHECKS');
    expect(r.audit!.statusLabel).toMatch(/dati di composizione stimati o non convalidati \(Manzo reale\)/);
    expect(r.audit!.warnings.join()).toMatch(/Manzo reale: dati parziali/);
    expect(r.audit!.dataQuality!.lowQuality).toEqual(['Manzo reale']);
    // convalidato → stesso calcolo, nessuna riserva sulla qualità
    const inp2 = input(['test_oats'], ['test_multi', 'test_bone_meal']);
    inp2.foods = [{ food: { ...partial, validatedAt: '2026-10-17', validatedBy: 'admin' } }, ...inp2.foods];
    const a2 = (await formulate(inp2)).audit!;
    expect(a2.status).toBe('VERIFIED_AVAILABLE_CHECKS');
    expect(a2.statusLabel).not.toMatch(/stimati/);
  });
  test('alimento da completare: escluso anche se qualcuno lo avesse attivato', async () => {
    const f = { ...packageFoods()[0], availableToFormulate: true };
    const inp = input(['test_oats'], []);
    inp.foods = [{ food: f }, ...inp.foods];
    const r = await formulate(inp);
    expect(r.excluded.find((e) => e.id === f.id)!.reason).toMatch(/da completare/);
  });
  test('la verifica della ricetta usa lo stato congelato nell’istantanea', () => {
    const a = auditRecipe({
      items: [{ kind: 'food', id: 'real_beef', qty: 500 }],
      foods: { real_beef: realFood() },
      supplements: {},
      nutrients: N,
      limits: refs.limits,
        dog: dog(),
      dietMoisture: 'wet',
      settings: DEFAULT_SETTINGS,
    });
    expect(a.warnings.join()).toMatch(/dati parziali/);
  });
});

const catalogFor = async () => new LocalRepository(null).loadCatalog({ withBundledImports: false });

describe('Importazione: lettura e associazione dei nutrienti', () => {
  test('modello lungo D del pacchetto: ID, mg→g, celle vuote ignorate', async () => {
    const cat = await catalogFor();
    const csv = 'product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\nanchovies,protein,20,g,as_purchased_edible_raw,FDC 1,UNVERIFIED\nanchovies,calcium,147,mg,as_purchased_edible_raw,FDC 1,UNVERIFIED\nanchovies,vitamin_d,,IU,as_purchased_edible_raw,,UNVERIFIED\n';
    const plan = planImport(parseImport(csv, 'foods', N, LEGACY), cat, 'd.csv');
    expect(plan.errors).toEqual([]);
    expect(plan.format).toBe('csv-long');
    const it = plan.items[0];
    expect(it.action).toBe('update');
    expect(it.valueChanges.map((v) => [v.nutrientId, v.after])).toEqual([['protein', 20], ['calcium', 0.147]]);
    expect(it.next.nutrients.vitamin_d).toBeUndefined();
    expect(it.next.profileVersion).toBe(2);
  });
  test('formato largo: anagrafica + nutrienti riconosciuti dal nome («Calcio (mg)», «Vit D [IU]», «zinc_mg»)', async () => {
    const cat = await catalogFor();
    const csv = 'id;nome;categoria;sottocategoria;stato;kcal;fonte;Proteine (g);Calcio (mg);Vit D [IU];zinc_mg\nnew_tuna;Tonno (nuovo);animal;fish;crudo;130;FDC 9;23,5;10;80;0,6\n';
    const plan = planImport(parseImport(csv, 'foods', N, LEGACY), cat, 'w.csv');
    expect(plan.errors).toEqual([]);
    expect(plan.format).toBe('csv-wide');
    const f = plan.items[0].next as Food;
    expect(plan.items[0].action).toBe('create');
    expect(f.processingState).toBe('raw');
    expect(f.kcalMePer100g).toBe(130);
    expect(f.nutrients.protein.value).toBe(23.5);
    expect(f.nutrients.calcium.value).toBeCloseTo(0.01, 9);
    expect(f.nutrients.vitamin_d.value).toBe(80);
    expect(f.nutrients.zinc.value).toBe(0.6);
    // senza grassi resta «da completare» anche con altri valori presenti
    expect(plan.items[0].statusAfter.status).toBe('to_complete');
    expect(plan.items[0].statusAfter.reasons[0]).toMatch(/grassi/);
  });
  test('JSON con nutrienti come oggetto; l’attivazione indicata nel file si applica (non è una nuova versione)', async () => {
    const cat = await catalogFor();
    const json = JSON.stringify({ foods: [{ id: 'anchovies', kcal_me_per_100g: 131, available_to_formulate: true, nutrients: { Proteine: { value: 20.3, unit: 'g', source: 'FDC 2' }, fat: { value: 4.8, unit: 'g', source: 'FDC 2' } } }] });
    const plan = planImport(parseImport(json, 'foods', N, LEGACY), cat, 'a.json');
    expect(plan.errors).toEqual([]);
    expect((plan.items[0].next as Food).availableToFormulate).toBe(true);
    expect(plan.items[0].statusAfter.status).toBe('partial');
  });
  test('integratore: per_dose convertito per 1 dose, «added» rende l’etichetta non completa', async () => {
    const cat = await catalogFor();
    const csv = 'supplement_id,nutrient_id,declared_amount,unit,per_dose,source_id,declared_total_or_added\nqdiet,calcium,500,mg,5,Etichetta Q-Diet lotto 1,added\n';
    const plan = planImport(parseImport(csv, 'supplements', N, LEGACY), cat, 'q.csv');
    expect(plan.errors).toEqual([]);
    const s = plan.items[0].next;
    expect(s.nutrients.calcium.value).toBeCloseTo(0.1, 9);
    expect(plan.items[0].fieldChanges.some((c) => c.field === 'labelAddedOnly')).toBe(true);
  });
});

describe('Importazione: conversioni non approvate', () => {
  test('vitamina E mg → UI senza forma chimica: valore non importato, segnalato, resto importabile', async () => {
    const plan = planImport(parseImport('product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\nanchovies,vitamin_e,0.5,mg,,F,\nanchovies,protein,20,g,,F,REPORTED_USDA_PROXY\n', 'foods', N, LEGACY), await catalogFor(), 'x');
    expect(plan.errors).toEqual([]);
    expect(plan.items[0].pendingConversions).toEqual([expect.objectContaining({ nutrientId: 'vitamin_e', unit: 'mg', targetUnit: 'IU' })]);
    expect(plan.items[0].warnings.map((w) => w.message).join(' ')).toMatch(/indicare la forma chimica/);
    expect(plan.items[0].next.nutrients.vitamin_e).toBeUndefined();
    expect(plan.items[0].next.nutrients.protein).toEqual(expect.objectContaining({ value: 20, status: 'estimated', method: 'REPORTED_USDA_PROXY' }));
  });
  test('D19: vitamina D 1 µg = 40 UI; vitamina E con il fattore della sua forma chimica, mai uno unico', async () => {
    const csv =
      'product_id,nutrient_id,value_per_100g,unit,source_id,status,form\n' +
      'anchovies,vitamin_d,0.5,µg,F,measured,\n' +
      'anchovies,vitamin_e,10,mg,F,measured,d-alfa-tocoferolo\n' +
      'sardines,vitamin_e,10,mg,F,measured,dl-alfa-tocoferil acetato\n' +
      'beef_lean,vitamin_e,10,mg,F,measured,d-alpha-tocopheryl acetate\n' +
      'lamb_meat,vitamin_e,10,mg,F,measured,tocoferoli misti\n';
    const plan = planImport(parseImport(csv, 'foods', N, LEGACY), await catalogFor(), 'x');
    const v = (id: string, n: string) => plan.items.find((i) => i.id === id)!.next.nutrients[n];
    expect(v('anchovies', 'vitamin_d')).toEqual(expect.objectContaining({ value: 20, status: 'measured' }));
    expect(v('anchovies', 'vitamin_e')?.value).toBeCloseTo(14.9, 9);
    expect(v('anchovies', 'vitamin_e')?.method).toMatch(/d-alfa-tocoferolo naturale/);
    expect(v('sardines', 'vitamin_e')?.value).toBe(10);
    expect(v('beef_lean', 'vitamin_e')?.value).toBeCloseTo(13.6, 9);
    expect(v('lamb_meat', 'vitamin_e')).toBeUndefined(); // forma non approvata: nessuna conversione
    const ch = plan.items.find((i) => i.id === 'anchovies')!.valueChanges.find((c) => c.nutrientId === 'vitamin_e')!;
    expect([ch.sourceValue, ch.sourceUnit]).toEqual([10, 'mg']); // valore originale conservato
  });
});

describe('Importazione: errori mostrati prima di confermare', () => {
  const bad = async (csv: string, kind: 'foods' | 'supplements' = 'foods') => {
    const plan = planImport(parseImport(csv, kind, N, LEGACY), await catalogFor(), 'x');
    expect(plan.canApply).toBe(false);
    return plan.errors.map((e) => e.message).join(' | ');
  };
  const H = 'product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\n';
  test('nutriente sconosciuto, unità non convertibile, unità mancante, valore non valido', async () => {
    expect(await bad(H + 'anchovies,sconosciuto,1,g,,F,\n')).toMatch(/non riconosciuto/);
    expect(await bad(H + 'anchovies,vitamin_a,1,mgg,,F,\n')).toMatch(/non riconosciuta/);
    expect(await bad(H + 'anchovies,protein,1,,,F,\n')).toMatch(/unità mancante/);
    expect(await bad(H + 'anchovies,protein,-3,g,,F,\n')).toMatch(/non valido/);
    expect(await bad(H + 'anchovies,protein,abc,g,,F,\n')).toMatch(/non valido/);
  });
  test('fonte mancante, zero stimato, valori impossibili, nutriente ripetuto', async () => {
    expect(await bad(H + 'anchovies,protein,20,g,,,\n')).toMatch(/fonte mancante/);
    expect(await bad(H + 'anchovies,iron,0,mg,,F,estimated\n')).toMatch(/zero/);
    expect(await bad(H + 'anchovies,protein,120,g,,F,\n')).toMatch(/impossibile/);
    expect(await bad(H + 'anchovies,protein,60,g,,F,\nanchovies,moisture,60,g,,F,\n')).toMatch(/incoerenti/);
    expect(await bad(H + 'anchovies,protein,20,g,,F,\nanchovies,Proteine,21,g,,F,\n')).toMatch(/più volte/);
  });
  test('prodotto inesistente, ID non valido, nome duplicato con altro ID, categoria non valida, campi obbligatori', async () => {
    expect(await bad(H + 'non_esiste,protein,20,g,,F,\n')).toMatch(/inesistente/);
    expect(await bad('id,name_it,subcategory\nManzo Magro!,X,muscle\n')).toMatch(/non valido/);
    expect(await bad('id,name_it,subcategory\nbeef_lean_2,Manzo magro,muscle\n')).toMatch(/già usato da «beef_lean»/);
    expect(await bad('id,name_it,subcategory\nnuovo_x,Nuovo,pianeti\n')).toMatch(/Categoria/);
    expect(await bad('id,name_it\nnuovo_y,Nuovo Y\n')).toMatch(/Sottocategoria obbligatoria/);
    expect(await bad('id,name_it,subcategory\nnuovo_z,,muscle\n')).toMatch(/Nome obbligatorio/);
    expect(await bad('id,name_it,dose_unit\nnuovo_s,Nuovo S,bustina\n', 'supplements')).toMatch(/Unità di dose/);
    expect(await bad('id,name_it,colonna_strana\nanchovies,Acciughe,1\n')).toMatch(/non riconosciuta/);
  });
});

describe('Importazione: applicazione, storico, ricalcoli', () => {
  test('aggiornamento senza duplicati, versione precedente nello storico, convalida decaduta, ricette da ricalcolare', async () => {
    const repo = new LocalRepository(null);
    let cat = await repo.loadCatalog();
    // ricetta salvata con il manzo di prova v1
    const d = newDog({ name: 'Fido', weightCurrentKg: 30, kcalTarget: 1400 }, 'd1');
    const inp = buildInput(d, { foods: [{ id: 'test_beef' }, { id: 'test_oats' }], supplements: [{ id: 'test_multi' }, { id: 'test_bone_meal' }, { id: 'test_fish_oil_caps' }], dietMoisture: 'wet', proteinDigestibility: { atLeast80: true, reference: 'test: digeribilità documentata' } }, cat, DEFAULT_SETTINGS, []);
    const v = versionFromResult({ id: 'v1', recipeId: 'r1', revision: 1, origin: 'engine', parentVersionId: null, author: 'u' }, await formulate(inp), inp);
    expect(staleFor(v, d, cat)).toEqual([]);

    const csv = 'product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\ntest_beef,Calcio,15,mg,raw,TEST nuova analisi,\n';
    const plan = planImport(parseImport(csv, 'foods', cat.nutrients, LEGACY), cat, 'agg.csv');
    expect(plan.canApply).toBe(true);
    await repo.applyCatalogImport(plan);
    cat = await repo.loadCatalog();
    expect(cat.foods.filter((f) => f.id === 'test_beef')).toHaveLength(1);
    const beef = cat.foods.find((f) => f.id === 'test_beef')!;
    expect(beef.profileVersion).toBe(2);
    expect(beef.nutrients.calcium.value).toBeCloseTo(0.015, 9);
    const hist = await repo.listProfileHistory('food', 'test_beef');
    expect(hist[0].version).toBe(1);
    expect((hist[0].profile as Food).nutrients.calcium.value).toBe(TEST_FOODS.find((f) => f.id === 'test_beef')!.nutrients.calcium.value);
    expect((await repo.listImports())[0].products).toEqual(['test_beef']);
    const stale = staleFor(v, d, cat);
    expect(stale).toEqual([expect.objectContaining({ kind: 'food', id: 'test_beef', frozen: 'v1', current: 'v2' })]);
    // la ricetta salvata resta com'era
    expect(v.snapshot.foods.test_beef.nutrients.calcium.value).toBe(0.011);

    // stesso file di nuovo: niente da applicare, nessuna versione nuova
    const again = planImport(parseImport(csv, 'foods', cat.nutrients, LEGACY), cat, 'agg.csv');
    expect(again.summary.unchanged).toBe(1);
    expect(again.canApply).toBe(false);
  });
  test('un piano con errori non si applica', async () => {
    const repo = new LocalRepository(null);
    const cat = await repo.loadCatalog();
    const plan = planImport(parseImport('product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\nanchovies,xyz,1,g,,F,\n', 'foods', cat.nutrients, LEGACY), cat, 'x');
    await expect(repo.applyCatalogImport(plan)).rejects.toThrow(/errori/);
  });
  test('convalida: rifiutata con criteri mancanti, accettata su profilo pronto; decade alla modifica', async () => {
    const repo = new LocalRepository(null);
    await expect(repo.validateCatalogItem('food', 'beef_lean')).rejects.toThrow(/Non convalidabile/);
    await repo.saveFood(realFood({ id: 'real_beef' }));
    await repo.validateCatalogItem('food', 'real_beef');
    let cat = await repo.loadCatalog();
    expect(foodStatus(cat.foods.find((f) => f.id === 'real_beef')!, cat.nutrients).status).toBe('verified');
    const f = structuredClone(cat.foods.find((x) => x.id === 'real_beef')!);
    f.nutrients.zinc = { value: 5, status: 'measured', source: 'FDC 123' };
    await repo.saveFood(f);
    cat = await repo.loadCatalog();
    expect(foodStatus(cat.foods.find((x) => x.id === 'real_beef')!, cat.nutrients).status).toBe('partial');
  });
  test('un alimento da completare non si attiva', async () => {
    const repo = new LocalRepository(null);
    const cat = await repo.loadCatalog();
    await expect(repo.saveFood({ ...cat.foods.find((f) => f.id === 'beef_lean')!, availableToFormulate: true })).rejects.toThrow(/da completare/);
  });
});

describe('Dati reali del 16/10/2026', () => {
  test('i file convertiti passano le verifiche e arrivano nel catalogo con lo stato corretto', async () => {
    const cat = await new LocalRepository(null).loadCatalog();
    const f = (id: string) => cat.foods.find((x) => x.id === id)!;
    // D4: EM calcolata con FEDIAF 2025 4/9/4 (proteine, grassi, carboidrati disponibili) → dati parziali, non più «da completare»
    const me: Record<string, number> = { beef_03: 114.9, beef_15: 209.4, beef_30: 327.4, oat_dry: 341.7, carrot_cooked: 25.5, pumpkin_cooked: 18.7 };
    for (const [id, kcal] of Object.entries(me)) {
      const st = foodStatus(f(id), cat.nutrients);
      expect(st.status).toBe('partial');
      expect(f(id).kcalMePer100g).toBe(kcal);
      expect(f(id).kcalMeOrigin).toBe('calculated');
      expect(f(id).energyMethod?.id).toBe('fediaf_2025_ingredienti_naturali');
    }
    expect(f('beef_15').kcalMePer100g).toBeCloseTo(18.59 * 4 + 15 * 9, 1);
    expect(f('oat_dry').energyMethod?.caution).toMatch(/Amido non cotto/); // crudo: avvertenza di digeribilità
    expect(f('carrot_cooked').energyMethod?.caution).toBeNull();
    expect(f('beef_15').nutrients.calcium).toEqual(expect.objectContaining({ value: 0.015, status: 'estimated', method: 'REPORTED_USDA_PROXY' }));
    expect(f('beef_15').nutrients.carbohydrate_available).toEqual(expect.objectContaining({ value: 0, status: 'analytical_zero' }));
    // D19: vitamina D 1 µg = 40 UI; vitamina E degli alimenti (alfa-tocoferolo naturale) 1,49 UI/mg
    expect(f('beef_15').nutrients.vitamin_d?.value).toBe(4);
    expect(f('beef_15').nutrients.vitamin_e?.value).toBeCloseTo(0.17 * 1.49, 9);
    expect(f('oat_dry').nutrients.vitamin_d?.value).toBe(0); // zero: uguale in ogni unità
    expect(f('beef_15').nutrients.energy_food_kcal?.value).toBe(215); // solo informativo
    const q = cat.supplements.find((s) => s.id === 'qdiet')!;
    expect(q.labelAddedOnly).toBe(true);
    expect(q.nutrients.vitamin_a.value).toBe(250);
    expect(q.nutrients.vitamin_e?.value).toBe(2); // 2000 mg/kg tutto-rac acetato × 1 UI/mg → 2 UI per g (per kg da confermare: stima)
    expect(q.nutrients.vitamin_e?.status).toBe('label'); // base «per kg» confermata dalla nutrizionista (catalogo Q.Diet 2024)
    expect(q.nutrients.zinc).toEqual(expect.objectContaining({ value: 2, status: 'label' })); // 2000 mg/kg ÷ 1000
    expect(supplementStatus(q, cat.nutrients).reasons.join()).not.toMatch(/base quantitativa/);
    expect(q.nutrients.potassium?.value).toBe(0.075); // potassio 7,5 % dal catalogo Q.Diet 2024 (approvato)
    const o = cat.supplements.find((s) => s.id === 'omegor_vitality')!;
    expect(o.massPerUnitG).toBeNull();
    expect(o.nutrients.epa_dha).toBeUndefined();
    expect(o.nutrients.vitamin_e?.value).toBeCloseTo(14.9, 9); // 10 mg d-alfa-tocoferolo × 1,49
    expect(supplementStatus(o, cat.nutrients).status).toBe('partial');
  });
  test('Met+Cys dalla somma di metionina e cistina (allegato F)', async () => {
    const cat = await new LocalRepository(null).loadCatalog();
    const beef = cat.foods.find((x) => x.id === 'beef_15')!;
    const a = auditRecipe({
      items: [{ kind: 'food', id: 'beef_15', qty: 100 }],
      foods: { beef_15: { ...beef, kcalMePer100g: 100 } },
      supplements: {}, nutrients: cat.nutrients, limits: refs.limits, dog: dog(), dietMoisture: 'wet', settings: DEFAULT_SETTINGS,
    });
    expect(a.totals.nutrients.methionine_cystine.known).toBeCloseTo(0.478 + 0.191, 9);
    expect(a.totals.nutrients.methionine_cystine.complete).toBe(true);
  });
});
