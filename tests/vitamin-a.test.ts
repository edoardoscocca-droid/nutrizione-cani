// Vitamina A del cane (20/10/2026): preformata + beta-carotene × 833 UI/mg (FEDIAF 2025, tab. VII-14, p. 63).
// Controlli della conversione e dell'assenza di doppio conteggio, sui dati reali del catalogo (pacchetto del 20/10).

import { describe, expect, test } from 'vitest';
import { parseImport, planImport } from '../src/data/catalogImport';
import { LocalRepository } from '../src/data/localRepository';
import { computeTotals, foodData, itemValue } from '../src/engine/totals';
import { BETA_CAROTENE_TO_VITAMIN_A, vitaminAParts } from '../src/engine/vitaminA';

const cat = await new LocalRepository(null).loadCatalog();
const f = (id: string) => cat.foods.find((x) => x.id === id)!;

describe('vitamina A del cane da beta-carotene', () => {
  test('fattore FEDIAF per il cane: 1 mg = 833 UI', () => {
    expect(BETA_CAROTENE_TO_VITAMIN_A.iuPerMg).toBe(833);
    expect(BETA_CAROTENE_TO_VITAMIN_A.species).toBe('dog');
    expect(BETA_CAROTENE_TO_VITAMIN_A.source).toMatch(/FEDIAF 2025.*VII-14/);
  });

  test('carota e zucca: beta-carotene conservato come dato distinto, contributo = mg × 833, UI umane non sommate', () => {
    const carrot = f('carrot_cooked');
    const pumpkin = f('pumpkin_cooked');
    expect(carrot.nutrients.beta_carotene_ug.value).toBe(8332); // dato originario USDA FDC 170394, invariato
    expect(pumpkin.nutrients.beta_carotene_ug.value).toBe(2096); // FDC 168449
    expect(carrot.nutrients.vitamin_a?.value ?? null).toBeNull(); // preformata in UI non dichiarata
    const c = vitaminAParts(carrot.nutrients);
    expect(c.fromBetaCarotene).toBeCloseTo(8.332 * 833, 6); // 6940,556 UI/100 g
    expect(c.known).toBeCloseTo(8.332 * 833, 6);
    // aggiornato con la specifica v2 (§6): il retinolo 0 documentato dalla fonte vale come preformata 0 → dato completo
    expect(carrot.nutrients.vitamin_a_retinol_ug.value).toBe(0);
    expect(c.preformed).toBe(0);
    expect(c.complete).toBe(true);
    expect(vitaminAParts(pumpkin.nutrients).known).toBeCloseTo(2.096 * 833, 6);
    // le UI di etichettatura umana (17.033 per la carota) non entrano: il totale non le contiene
    expect(carrot.nutrients.vitamin_a_carotenoid_iu.value).toBe(17033);
    expect(c.known).not.toBeCloseTo(17033 + 8.332 * 833, 0);
  });

  test('manzo: preformata 13,33 UI + beta-carotene 0 documentato = 13,33 UI, completa', () => {
    const b = vitaminAParts(f('beef_03').nutrients);
    expect(b.preformed).toBeCloseTo(13.333333, 5);
    expect(b.fromBetaCarotene).toBe(0);
    expect(b.complete).toBe(true);
  });

  test('ricetta: il totale è preformata + beta-carotene, una sola volta; parte sconosciuta dichiarata', () => {
    const items = [
      foodData({ kind: 'food', id: 'carrot_cooked', qty: 90 }, f('carrot_cooked')),
      foodData({ kind: 'food', id: 'beef_03', qty: 560 }, f('beef_03')),
    ];
    const t = computeTotals(items, cat.nutrients);
    const expected = 0.9 * 8.332 * 833 + 5.6 * 13.333333333333;
    expect(t.nutrients.vitamin_a.known).toBeCloseTo(expected, 3);
    expect(itemValue(items[0], 'vitamin_a')! * 90).toBeCloseTo(0.9 * 8.332 * 833, 6);
    // aggiornato con la specifica v2 (§6): retinolo 0 documentato → nessuna parte sconosciuta per la carota
    expect(t.nutrients.vitamin_a.missingFrom).toEqual([]);
    expect(t.vitaminA!.fromBetaCarotene).toBeCloseTo(0.9 * 8.332 * 833, 6);
    expect(t.vitaminA!.betaCaroteneMg).toBeCloseTo(0.9 * 8.332, 9);
    expect(t.vitaminA!.preformed).toBeCloseTo(5.6 * 13.333333333333, 6);
    expect(t.vitaminA!.preformed + t.vitaminA!.fromBetaCarotene).toBeCloseTo(t.nutrients.vitamin_a.known, 6);
  });

  test('importazione: vitamina A dichiarata come carotene rifiutata (eviterebbe il doppio conteggio)', () => {
    const file = {
      foods: [{ id: 'x_veg', name_it: 'Verdura di prova', category: 'vegetable', subcategory: 'vegetable_generic', processing_state: 'raw', source: 'Fonte', nutrients: { vitamin_a: { value: 1000, unit: 'IU', status: 'calculated', form: 'beta-carotene' } } }],
    };
    const p = planImport(parseImport(JSON.stringify(file), 'foods', cat.nutrients, { mode: 'strict' }), cat, 'x.json');
    expect([...p.errors, ...p.items.flatMap((i) => i.errors)].map((e) => e.message).join()).toMatch(/beta_carotene_ug/);
  });
});
