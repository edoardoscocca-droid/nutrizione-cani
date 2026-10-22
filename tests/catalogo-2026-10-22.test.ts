// Catalogo unico corretto del 22/10/2026 (dati/importazioni/2026-10-22): incluso nell'app con lo stesso importatore
// rigoroso delle importazioni manuali. Controlli: niente doppioni, nessun valore perso, sconosciuti lasciati vuoti,
// vitamina A delle verdure contata una volta, prodotti di prova e voci con il solo nome nascosti dagli elenchi.

import { describe, expect, test } from 'vitest';
import data from '../dati/importazioni/2026-10-22/catalogo_cani_corretto.json';
import { parseImport, planImport } from '../src/data/catalogImport';
import { isNameOnly, isTestFixture, listedInApp } from '../src/data/catalogVisibility';
import { LocalRepository } from '../src/data/localRepository';
import { formulateV2 } from '../src/engine/formulateV2';
import { ENERGY_PROFILES, garmrDog, GARMR_FOODS, GARMR_SUPPS, kerDog, KER_FOODS, KER_SUPPS, menuInput, realInput, REAL_MENU_SETS } from '../scripts/collaudo/casi-v2';
import { vitaminAParts } from '../src/engine/vitaminA';

const before = await new LocalRepository(null).loadCatalog({ bundledUpTo: '2026-10-21' });
const cat = await new LocalRepository(null).loadCatalog();
const file = (data as { foods: { id: string; available_to_formulate: boolean; category: string; nutrients: Record<string, { value: number | null }> }[] }).foods;

describe('catalogo unico del 22/10/2026', () => {
  test('importazione rigorosa senza errori: 87 nuovi, 8 aggiornati', () => {
    const plan = planImport(parseImport(JSON.stringify(data), 'foods', before.nutrients, { mode: 'strict' }), before, 'test');
    expect(plan.canApply).toBe(true);
    expect(plan.errors).toHaveLength(0);
    expect(plan.items.flatMap((i) => i.errors)).toHaveLength(0);
    expect(plan.summary.create).toBe(87);
    expect(plan.summary.update).toBe(8);
  });

  test('tutti i 95 prodotti presenti, id e nomi senza doppioni', () => {
    const ids = cat.foods.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = cat.foods.map((f) => f.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const f of file) expect(ids).toContain(f.id);
  });

  test('nessun valore già noto perso, nessun prodotto perso', () => {
    for (const b of before.foods) {
      const a = cat.foods.find((x) => x.id === b.id);
      expect(a, b.id).toBeDefined();
      for (const [k, v] of Object.entries(b.nutrients)) if (v.value !== null) expect(a!.nutrients[k]?.value ?? null, `${b.id}.${k}`).not.toBeNull();
    }
  });

  test('gli abilitati nel file sono utilizzabili; l’olio di colza incompleto resta escluso', () => {
    for (const f of file) expect(cat.foods.find((x) => x.id === f.id)!.availableToFormulate, f.id).toBe(f.available_to_formulate);
    expect(cat.foods.find((x) => x.id === 'rapeseed_oil')!.availableToFormulate).toBe(false);
  });

  test('i nutrienti assenti nel file restano sconosciuti (mai zero)', () => {
    const sunflower = cat.foods.find((x) => x.id === 'sunflower_oil')!;
    expect(sunflower.nutrients.linoleic_acid?.value ?? null).toBeNull();
    expect(sunflower.nutrients.iodine?.value ?? null).toBeNull();
    expect(cat.foods.find((x) => x.id === 'pollock_raw')!.nutrients.selenium?.value ?? null).toBeNull();
  });

  test('verdure: vitamina A preformata 0, solo il beta-carotene contribuisce (nessun doppio conteggio)', () => {
    for (const f of file.filter((x) => x.category === 'vegetable')) {
      const food = cat.foods.find((x) => x.id === f.id)!;
      const va = vitaminAParts(food.nutrients);
      if (va.preformed !== null) expect(va.preformed, f.id).toBe(0);
    }
    const carrot = vitaminAParts(cat.foods.find((x) => x.id === 'carrot_cooked')!.nutrients);
    expect(carrot.known).toBeCloseTo(8.33 * 833, 6);
  });

  test('elenchi dell’app: nascosti i prodotti [TEST] e le voci con il solo nome, visibili i vietati', () => {
    const shown = cat.foods.filter((f) => listedInApp(f));
    expect(shown.some(isTestFixture)).toBe(false);
    expect(shown.some(isNameOnly)).toBe(false);
    expect(shown.some((f) => f.id === 'lamb_meat')).toBe(false);
    expect(shown.some((f) => f.id === 'onion' && f.forbidden)).toBe(true);
    for (const f of file) expect(shown.some((x) => x.id === f.id), f.id).toBe(true);
    // un prodotto nascosto già scelto in una ricetta resta visibile
    expect(listedInApp(cat.foods.find((f) => f.id === 'test_lamb')!, new Set(['test_lamb']))).toBe(true);
    expect(cat.supplements.filter((s) => listedInApp(s)).some(isTestFixture)).toBe(false);
  });
});

describe('collaudi v2 con i dati reali del 22/10', () => {
  test('menù reali a 900, 1.340 e 2.700 kcal: agnello, pollo e sardine risolti nell’energia; merluzzo + farina d’ossa impossibile (Ca:P contro massimo del fosforo)', async () => {
    for (const pr of ENERGY_PROFILES)
      for (const set of REAL_MENU_SETS) {
        const r = await formulateV2(menuInput(cat, pr, set));
        if (set.id === 'R3') {
          expect(r.outcome, `${set.id} ${pr.kcal}`).toBe('infeasible');
          continue;
        }
        expect(r.outcome, `${set.id} ${pr.kcal}`).toBe('solved');
        expect(Math.abs(r.audit!.kcal! - pr.kcal) / pr.kcal).toBeLessThan(0.05);
        expect(r.audit!.rows.flatMap((x) => x.checks).filter((c) => c.color === 'red')).toHaveLength(0);
      }
  });

  test('Ker e Garmr generati da zero con il catalogo aggiornato', async () => {
    const ker = await formulateV2(realInput(cat, kerDog(), KER_FOODS, KER_SUPPS));
    const garmr = await formulateV2(realInput(cat, garmrDog(), GARMR_FOODS, GARMR_SUPPS));
    expect(ker.outcome).toBe('solved');
    expect(garmr.outcome).toBe('solved');
  });
});
