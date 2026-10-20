// Richieste della nutrizionista del 19/10/2026: EPA+DHA (NRC), preferenze iniziali, porzioni minime, origine dell'energia.

import { describe, expect, test } from 'vitest';
import { fiberPerDay, newDog, syncAutoFiber, toFormulationProfile } from '../src/engine/dogProfile';
import { applyEnergyMethods } from '../src/engine/energy';
import { formulate } from '../src/engine/formulate';
import { recommendedFor } from '../src/engine/recommended';
import { compoundValue } from '../src/engine/totals';
import { DEFAULT_SETTINGS } from '../src/engine/types';
import { applyPreset, isUntouchedPreset, presetFor } from '../src/data/formulationPresets';
import type { Dog } from '../src/data/model';
import { BREED_NOTES, packageReferences } from '../src/data/packageCatalog';
import { buildInput, type CatalogState, type Selection } from '../src/data/recipeService';
import { TEST_FOODS, TEST_SUPPLEMENTS } from '../src/data/testFixtures';

const refs = packageReferences();
const cat: CatalogState = applyEnergyMethods({ ...refs, foods: structuredClone(TEST_FOODS), supplements: structuredClone(TEST_SUPPLEMENTS), breedNotes: BREED_NOTES });

function testDog(over: Partial<Dog> = {}): Dog {
  const d = newDog({ name: 'Prova', weightCurrentKg: 33, weightIdealKg: 31, kcalTarget: 1800, activityFactor: 2 }, 'd1', '2026-10-19T00:00:00Z');
  return { ...applyPreset(d, presetFor('adult_maintenance')!), ...over };
}

function sel(foods: string[], supps: string[], constraints: Record<string, Selection['foods'][number]['constraint']> = {}): Selection {
  return { foods: foods.map((id) => ({ id, constraint: constraints[id] })), supplements: supps.map((id) => ({ id, constraint: constraints[id] })), dietMoisture: 'wet' };
}

const qty = (r: Awaited<ReturnType<typeof formulate>>, id: string) => r.items.find((i) => i.id === id)?.qty ?? 0;

describe('EPA+DHA: apporto raccomandato NRC (adulto in mantenimento)', () => {
  test('30 × peso attuale^0,75: 33 kg → circa 413 mg/die, nell’unità del nutriente (g)', () => {
    const r = recommendedFor({ lifeStage: 'adult_maintenance', weightCurrentKg: 33 }, refs.recommendedTargets, refs.nutrients);
    expect(r).toHaveLength(1);
    expect(r[0].metric).toBe('epa_dha');
    expect(r[0].label).toBe('Apporto raccomandato NRC');
    expect(r[0].amountPerDay * 1000).toBeCloseTo(30 * 33 ** 0.75, 6);
    expect(Math.round(r[0].amountPerDay * 1000)).toBe(413);
    expect(r[0].formula).toContain('peso attuale');
  });

  test('non si estende a crescita, riproduzione o condizioni cliniche', () => {
    for (const ls of ['growth', 'gestation', 'lactation', 'other'] as const) {
      expect(recommendedFor({ lifeStage: ls, weightCurrentKg: 33 }, refs.recommendedTargets, refs.nutrients)).toEqual([]);
    }
  });

  test('somma EPA+DHA: calcolata se mancano la riga combinata ma ci sono le parti; parte mancante = sconosciuta; riga dichiarata senza doppio conteggio', () => {
    const oil = TEST_SUPPLEMENTS.find((s) => s.id === 'test_fish_oil_caps')!;
    const c = compoundValue(oil.nutrients, 'epa_dha')!;
    expect(c.calculated).toBe(true);
    expect(c.value * 1000).toBeCloseTo(300, 6);
    expect(compoundValue({ epa: { value: 0.18 }, dha: { value: null } }, 'epa_dha')).toBeNull();
    expect(compoundValue({ epa: { value: 0.18 }, dha: { value: 0.12 }, epa_dha: { value: 0.25 } }, 'epa_dha')).toEqual({ value: 0.25, calculated: false });
    // gli omega-3 totali non entrano nella somma
    expect(compoundValue({ epa: { value: 0.18 }, dha: { value: 0.12 }, omega3_total: { value: 0.33 } }, 'epa_dha')!.value).toBeCloseTo(0.3, 9);
  });

  test('con l’olio di pesce: 1 capsula non basta, ne servono 2; formulazione ricontrollata (energia compresa)', async () => {
    const input = buildInput(testDog(), sel(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']), cat, DEFAULT_SETTINGS, []);
    const r = await formulate(input);
    expect(r.outcome).toBe('solved');
    expect(qty(r, 'test_fish_oil_caps')).toBe(2);
    const a = r.audit!;
    expect(a.additional).toHaveLength(1);
    expect(a.additional![0].color).toBe('green');
    expect(a.status).not.toBe('TARGETS_NOT_MET');
    expect(Math.abs((a.kcal as number) - 1800)).toBeLessThanOrEqual(36);
    // non è un fabbisogno FEDIAF: resta fuori dalla sintesi dei requisiti
    expect(a.summary!.satisfied.some((l) => l.includes('EPA'))).toBe(false);
  });

  test('senza fonti di EPA+DHA: obiettivo attivo = vincolo necessario (specifica 20/10), non fattibile con il vincolo indicato', async () => {
    const input = buildInput(testDog(), sel(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal']), cat, DEFAULT_SETTINGS, []);
    const r = await formulate(input);
    expect(r.outcome).toBe('infeasible');
    expect(r.conflicts.some((c) => c.metric === 'epa_dha' && c.kind === 'recommended')).toBe(true);
  });

  test('nessun olio imposto se EPA+DHA arrivano già da un alimento', async () => {
    const input = buildInput(testDog(), sel(['test_beef', 'test_oats', 'test_sardine'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'], { test_sardine: { required: true, minIfUsed: 100 } }), cat, DEFAULT_SETTINGS, []);
    const r = await formulate(input);
    expect(r.outcome).toBe('solved');
    expect(qty(r, 'test_sardine')).toBeGreaterThanOrEqual(100);
    expect(qty(r, 'test_fish_oil_caps')).toBe(0);
    expect(r.audit!.additional![0].color).toBe('green');
  });
});

describe('Preferenze iniziali dell’adulto sano', () => {
  test('valori precompilati e fibra in g/die dall’obiettivo energetico (1.800 kcal → 9–27 g)', () => {
    const d = testDog();
    expect(d.macroPreferences.map((m) => [m.metric, m.lower, m.upper])).toEqual([
      ['protein_energy_pct', 25, 40],
      ['fat_energy_pct', 25, 45],
      ['carb_energy_pct', 20, 50],
    ]);
    expect(fiberPerDay(d)).toEqual({ lower: 9, upper: 27 });
    expect(presetFor('growth')).toBeNull();
    expect(presetFor('other')).toBeNull();
  });

  test('cambiano le calorie: la fibra automatica si aggiorna, quella personalizzata no', () => {
    const auto = syncAutoFiber({ ...testDog(), kcalTarget: 2000 });
    expect([auto.fiberTarget!.lower, auto.fiberTarget!.upper]).toEqual([10, 30]);
    const custom = syncAutoFiber({ ...testDog(), fiberTarget: { lower: 12, upper: 20, basis: 'per_day', auto: null }, kcalTarget: 2000 });
    expect([custom.fiberTarget!.lower, custom.fiberTarget!.upper]).toEqual([12, 20]);
  });

  test('una preferenza disattivata non entra nel calcolo; il preset riconosce le modifiche', () => {
    const d = testDog();
    expect(isUntouchedPreset(d, presetFor('adult_maintenance')!)).toBe(true);
    const off: Dog = { ...d, macroPreferences: d.macroPreferences.map((m) => (m.metric === 'carb_energy_pct' ? { ...m, enabled: false } : m)) };
    expect(isUntouchedPreset(off, presetFor('adult_maintenance')!)).toBe(false);
    const p = toFormulationProfile(off, []);
    expect(p.targets.map((t) => t.metric).sort()).toEqual(['fat_energy_pct', 'fiber', 'protein_energy_pct']);
  });

  test('preferenza non rispettata: intervallo richiesto, risultato e scostamento; vincoli che la impediscono solo se individuati', async () => {
    const dog = testDog({ macroPreferences: [{ metric: 'protein_energy_pct', lower: 60, upper: 85, locked: false }, { metric: 'fat_energy_pct', lower: 10, upper: 15, locked: false }] });
    const r = await formulate(buildInput(dog, sel(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']), cat, DEFAULT_SETTINGS, []));
    // oltre gli ampliamenti documentati: diagnostico, non menù generato (specifica 20/10, §5)
    expect(r.outcome).toBe('preferences_unreachable');
    const row = r.audit!.rows.find((x) => x.metric === 'protein_energy_pct')!;
    const c = row.checks.find((x) => x.color === 'orange')!;
    expect(c.message).toMatch(/richiesto 60–85 % energia macro \(4\/9\/4\), risultato [\d,]+ % energia macro \(4\/9\/4\), scostamento -/);
    expect(c.gap!.deviation).toBeLessThan(0);
    const gaps = r.audit!.softGaps!;
    // 60% di proteine: impossibile con questi ingredienti in qualunque quantità
    const pg = gaps.find((g) => g.metric === 'protein_energy_pct')!;
    expect(pg.unreachable || pg.blockedBy.length > 0).toBe(true);
    // grassi ≤ 15%: lo impediscono i minimi ufficiali (individuati dal modello)
    const fat = gaps.find((g) => g.metric === 'fat_energy_pct')!;
    expect(fat.unreachable).toBe(false);
    expect(fat.blockedBy.length).toBeGreaterThan(0);
    expect(fat.blockedBy.every((b) => /minimo|massimo|Dose|Limite/.test(b))).toBe(true);
  });
});

describe('Porzioni: selezionato = disponibile, non obbligatorio', () => {
  test('porzione minima se usato: 0 oppure almeno la porzione', async () => {
    for (const min of [40, 150]) {
      const r = await formulate(buildInput(testDog(), sel(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'], { test_carrot: { minIfUsed: min } }), cat, DEFAULT_SETTINGS, []));
      const q = qty(r, 'test_carrot');
      expect(q === 0 || q >= min).toBe(true);
    }
  });

  test('includi sempre: quantità positiva, almeno la porzione minima', async () => {
    const r = await formulate(buildInput(testDog(), sel(['test_beef', 'test_oats', 'test_carrot'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'], { test_carrot: { required: true, minIfUsed: 60 } }), cat, DEFAULT_SETTINGS, []));
    expect(qty(r, 'test_carrot')).toBeGreaterThanOrEqual(60);
    expect(r.constraints.some((c) => c.label.includes('sempre incluso'))).toBe(true);
  });
});

describe('Energia inserita ed energia calcolata', () => {
  test('origine riconoscibile, scostamento dai macronutrienti; quote = ripartizione stimata 4/9/4 separata dalla EM', async () => {
    const r = await formulate(buildInput(testDog(), sel(['test_beef', 'test_oats'], ['test_multi', 'test_bone_meal', 'test_fish_oil_caps']), cat, DEFAULT_SETTINGS, []));
    const a = r.audit!;
    const beef = a.energySources!.find((e) => e.name.includes('Manzo'))!;
    expect(beef.origin).toBe('declared');
    expect(beef.kcal).toBe(195);
    expect(beef.fromMacros).toBe(184);
    const oats = a.energySources!.find((e) => e.name.includes('Avena'))!;
    expect(oats.fromMacros).toBe(342.5);
    // specifica 20/10, §7: denominatore Ep+Ef+Ec (somma 100% per costruzione), EM totale separata
    expect(a.macroEnergySumPct!).toBeCloseTo(100, 6);
    const w = a.warnings.find((x) => x.startsWith('Energia inserita diversa'))!;
    expect(w).toContain('195 contro 184');
    expect(w).toContain('stima separata');
  });
});
