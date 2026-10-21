// Collaudi della specifica v2 del 21/10/2026 (§10) con le precisazioni 1–4 (diario a una ricetta al giorno, medie
// totale su totale, minimi di livello B morbidi, sostanza secca con umidità mancante).
// Dati: catalogo della modalità prova (dati reali dove ci sono) + dati FITTIZI [TEST] dove mancano (vedi casi-v2.ts).

import { describe, expect, test } from 'vitest';
import { LocalRepository } from '../src/data/localRepository';
import type { DiaryEntry, Recipe } from '../src/data/model';
import { analysisVersion, assertCanAddRecipe, snapshotOf, versionFromResult } from '../src/data/recipeService';
import { diaryToRow, rowToDiary } from '../src/data/supabaseRepository';
import { auditRecipeV2 } from '../src/engine/auditV2';
import { DEFAULT_CONFIG, ENGINE_VERSION_V2, resolveConfig } from '../src/engine/configV2';
import { dateRange, dayProfileOf, periodSummary, splitIntoMeals, type DayNutrient, type DayProfile, type DiaryDay } from '../src/engine/diary';
import { doseRangeFor } from '../src/engine/doseGuide';
import { formulateV2 } from '../src/engine/formulateV2';
import type { Food, RecipeItem, Supplement } from '../src/engine/types';
import {
  activated,
  catalogV2,
  CONFLICT_SET,
  ENERGY_PROFILES,
  garmrDog,
  GARMR_FOODS,
  GARMR_SUPPS,
  KER_FOODS,
  KER_PRESCRIPTION,
  KER_SUPPS,
  kerDog,
  levelBIssues,
  menuInput,
  MENU_SETS,
  practical,
  realInput,
} from '../scripts/collaudo/casi-v2';

const cat = await catalogV2();
const food = (id: string) => cat.foods.find((f) => f.id === id)!;
const supp = (id: string) => cat.supplements.find((s) => s.id === id)!;

function auditFixed(input: ReturnType<typeof realInput>, items: RecipeItem[]) {
  return auditRecipeV2({
    items,
    foods: Object.fromEntries(input.foods.map((f) => [f.food.id, f.food])),
    supplements: Object.fromEntries(input.supplements.map((s) => [s.supplement.id, s.supplement])),
    nutrients: input.nutrients,
    limits: input.limits,
    dog: input.dog,
    dietMoisture: input.dietMoisture,
    settings: input.settings,
    config: input.config,
  });
}

describe('A. menù positivi obbligatori (900, 1.340, 2.700 kcal)', () => {
  for (const p of ENERGY_PROFILES) {
    for (const set of MENU_SETS) {
      test(`${set.id} ${set.label} a ${p.kcal} kcal: pratico, livello A tutto verde`, async () => {
        const r = await formulateV2(menuInput(cat, p, set));
        const chk = practical(r);
        expect(chk.reasons).toEqual([]);
        expect(chk.ok).toBe(true);
        // arancione e grigio di livello B consentiti, ma elencati
        expect(Array.isArray(levelBIssues(chk.a))).toBe(true);
        expect(r.audit!.status).not.toBe('FAILS_OFFICIAL_LIMITS');
        expect(r.stats?.caPStep).not.toBeNull();
      });
    }
  }
  test('combinazione in conflitto con i valori [PROPOSTA] (riso pesato secco): l’app lo dice, non forza quantità', async () => {
    const r = await formulateV2(menuInput(cat, ENERGY_PROFILES[1], CONFLICT_SET));
    expect(r.outcome).toBe('infeasible');
    expect(r.items).toEqual([]);
    expect(r.conflicts.map((c) => c.label).join(' ')).toMatch(/Verdure: almeno 3% delle kcal/);
  });
});

describe('B. Ker e Garmr (dati reali)', () => {
  test('(4) Ker da zero: carote e olio entro i tetti, QDiet entro il gradino 2, niente lino imposto per il linoleico', async () => {
    const r = await formulateV2(realInput(cat, kerDog(), KER_FOODS, KER_SUPPS));
    expect(r.outcome).toBe('solved');
    const a = r.audit!;
    for (const c of a.v2!.caps) expect(c.color).toBe('green');
    for (const g of a.v2!.groups) expect(g.color === 'green' || g.foods.length === 0).toBe(true);
    const q = r.items.find((i) => i.id === 'qdiet')!.qty;
    const range = doseRangeFor(supp('qdiet').doseGuide, 30.2)!;
    expect(q).toBeLessThanOrEqual(range.max * 1.1 + 1e-9);
    // linoleico sconosciuto per carne, avena e carota: resta grigio, non diventa un vincolo da compensare
    expect(a.rows.find((x) => x.metric === 'linoleic_acid')!.color).toBe('grey');
    expect(r.notes.join(' ')).toMatch(/non usati dal generatore per dati mancanti[^.]*Acido linoleico/);
    const carrot = r.items.find((i) => i.id === 'carrot_cooked')!.qty;
    expect(carrot).toBeLessThanOrEqual(0.2 * a.v2!.totalWeightG! + 1e-6);
    expect(a.status).not.toBe('FAILS_OFFICIAL_LIMITS');
  });

  test('(5) Garmr 72 kg: QDiet con limite estrapolato 21,6 g (gradino 2 al più 23,76 g), mai 27,7 g', async () => {
    const r72 = doseRangeFor(supp('qdiet').doseGuide, 72, { extrapolate: true })!;
    expect(r72.max).toBeCloseTo(21.6, 6);
    expect(r72.extrapolated).toBe(true);
    expect(doseRangeFor(supp('qdiet').doseGuide, 72)).toBeNull(); // senza regola esplicita: nessuna estrapolazione
    expect(doseRangeFor(supp('qdiet').doseGuide, 3, { extrapolate: true })!.max).toBeCloseTo(0.9, 6); // sotto 5 kg: 0,3 g/kg
    const r = await formulateV2(realInput(cat, garmrDog(), GARMR_FOODS, GARMR_SUPPS));
    expect(r.outcome).toBe('solved');
    const q = r.items.find((i) => i.id === 'qdiet')!.qty;
    expect(q).toBeLessThanOrEqual(21.6 * 1.1 + 1e-9);
    expect(q).not.toBeCloseTo(27.7, 1);
    expect(r.audit!.doseChecks!.find((d) => d.name.startsWith('Q.Diet'))!.message).toMatch(/estrapolato, non indicato dal produttore/);
  });

  test('(6) analisi a grammi fissi: Ker 13 g di QDiet = 0,43 g/kg contro 0,3 → +44%, rosso; Garmr 20 g = 0,278 g/kg entro il limite', async () => {
    const ker = realInput(cat, kerDog(), KER_FOODS, KER_SUPPS);
    const a = auditFixed(ker, KER_PRESCRIPTION);
    const d = a.doseChecks!.find((x) => x.name.startsWith('Q.Diet'))!;
    expect(d.color).toBe('red');
    expect(d.message).toMatch(/0,43 g\/kg/);
    expect(d.message).toMatch(/\+43,5%/); // 13 / 9,06 g (tabella interpolata a 30,2 kg) = +43,5%; 0,43/0,30 = +44%
    expect(a.status).toBe('FAILS_OFFICIAL_LIMITS');
    // il rapporto elenca anche gli altri esiti (nessun giudizio sulla veterinaria): stesso formato del generatore
    expect(a.v2!.excess.length).toBeGreaterThan(0);
    expect(a.rows.length).toBeGreaterThan(30);
    // Garmr: le altre quantità sono quelle del menù v2 generato (la ricetta della veterinaria non è nei dati), conta il QDiet 20 g
    const gIn = realInput(cat, garmrDog(), GARMR_FOODS, GARMR_SUPPS);
    const g = await formulateV2(gIn);
    const items = g.items.map((i) => (i.id === 'qdiet' ? { ...i, qty: 20 } : i));
    const ga = auditFixed(gIn, items);
    const gd = ga.doseChecks!.find((x) => x.name.startsWith('Q.Diet'))!;
    expect(gd.color).toBe('yellow'); // entro il massimo, ma estrapolato: segnato
    expect(gd.message).toMatch(/0,278 g\/kg/);
    expect(gd.message).toMatch(/entro il massimo/);
  });

  test('modalità analisi salvata come versione: stesse regole del generatore, quantità invariate', () => {
    const ker = realInput(cat, kerDog(), KER_FOODS, KER_SUPPS);
    const v = analysisVersion({ id: 'v1', recipeId: 'r1', revision: 1, author: 'test' }, ker, KER_PRESCRIPTION, '2026-10-21T10:00:00Z');
    expect(v.origin).toBe('analysis');
    expect(v.chosenItems).toEqual(KER_PRESCRIPTION);
    expect(v.snapshot.formulationConfig?.version).toBe(DEFAULT_CONFIG.version);
    expect(v.audit.v2).toBeDefined();
  });
});

describe('C. casi limite', () => {
  test('(7) solo carota e zucca: dice cosa manca e cosa servirebbe, nessuna quantità estrema', async () => {
    const inp = realInput(cat, kerDog(), ['carrot_cooked', 'pumpkin_cooked'], []);
    const r = await formulateV2(inp);
    expect(r.outcome).toBe('infeasible');
    expect(r.items).toEqual([]);
    expect(r.message).toMatch(/Proteine animali/);
    expect(r.message).toMatch(/Amidacei/);
    expect(r.suggestions.join(' ')).toMatch(/Macinato di manzo/); // alimenti del catalogo con dati per il gruppo mancante
    expect(r.suggestions.join(' ')).toMatch(/Avena/);
  });

  test('(8) linoleico sconosciuto per carne e avena: grigio, senza olio extra', async () => {
    const withFlax = await formulateV2(realInput(cat, kerDog(), ['beef_10', 'oat_dry', 'carrot_cooked', 'flaxseed_oil'], ['bone_meal', 'qdiet']));
    expect(withFlax.outcome).toBe('solved');
    const la = withFlax.audit!.rows.find((x) => x.metric === 'linoleic_acid')!;
    expect(la.color).toBe('grey');
    expect(la.checks[0].message).toMatch(/minimo non dimostrato/);
    expect(la.checks[0].message).toMatch(/manca/);
    // il lino non viene spinto per dimostrare il minimo: nessun olio oltre il necessario (0 g qui)
    expect(withFlax.items.find((i) => i.id === 'flaxseed_oil')!.qty).toBe(0);
  });

  test('(9) umidità mancante: controllo legale con ipotesi prudente (verde con nota) oppure grigio, mai assunta', () => {
    const noMoist: Food = { ...food('test_beef'), id: 'beef_no_moisture', name: '[TEST] Manzo senza umidità', nutrients: { ...food('test_beef').nutrients, moisture: { value: null, status: 'unknown' } } };
    // premiscela di prova: iodio AGGIUNTO su supporto di maltodestrina dichiarato; la base non dichiarata è limitata dalla
    // massa della dose non attribuita (1 − 0,99 − 0,009 = 0,001 g = 1 mg per g)
    const premix: Supplement = {
      ...supp('test_multi'), id: 'premix', name: '[TEST] Premiscela iodio',
      nutrients: { carbohydrate_available: { value: 0.99, status: 'label', declared: 'total' }, moisture: { value: 0.009, status: 'label', declared: 'total' }, protein: { value: 0, status: 'label' }, fat: { value: 0, status: 'label' }, fiber: { value: 0, status: 'label' }, iodine: { value: 0.05, status: 'label', declared: 'added' } },
    };
    const dog = realInput(cat, kerDog(), ['test_beef'], []).dog;
    const run = (beefG: number, oatsG: number) =>
      auditRecipeV2({
        items: [{ kind: 'food', id: 'beef_no_moisture', qty: beefG }, { kind: 'food', id: 'test_oats', qty: oatsG }, { kind: 'supplement', id: 'premix', qty: 1 }],
        foods: { beef_no_moisture: noMoist, test_oats: food('test_oats') }, supplements: { premix }, nutrients: cat.nutrients, limits: cat.limits, dog, dietMoisture: null, settings: realInput(cat, kerDog(), [], []).settings, config: DEFAULT_CONFIG,
      }).v2!;
    // l'umidità del manzo non viene assunta: sostanza secca prudente = solo avena e premiscela
    const ok = run(400, 200);
    expect(ok.moistureMissing).toEqual(['[TEST] Manzo senza umidità']);
    expect(ok.dryMatterG[0]).toBeCloseTo(200 * 0.91 + 0.991, 6);
    const li = ok.legal.find((x) => x.metric === 'iodine')!;
    expect(li.color).toBe('green');
    expect(li.message).toMatch(/calcolato con ipotesi prudente: umidità mancante per \[TEST\] Manzo senza umidità/);
    // poca sostanza secca nota: con l'ipotesi prudente il limite non è dimostrato → grigio «umidità mancante», mai verde
    const heavy = run(900, 15).legal.find((x) => x.metric === 'iodine')!;
    expect(heavy.color).toBe('grey');
    expect(heavy.message).toMatch(/umidità mancante per \[TEST\] Manzo senza umidità/);
    // QDiet reale: additivi dichiarati solo come aggiunti, base non limitata in modo utile → grigio, mai verde
    const ker = realInput(cat, kerDog(), KER_FOODS, KER_SUPPS);
    for (const l of auditFixed(ker, KER_PRESCRIPTION).v2!.legal) expect(l.color === 'grey' || l.color === 'red').toBe(true);
  });

  test('(10) zinco dai soli alimenti: «nessun limite FEDIAF applicabile», non «sicuro»', async () => {
    const r = await formulateV2(menuInput(cat, ENERGY_PROFILES[1], { foods: ['test_lamb', 'test_potato', 'pumpkin_cooked'], supplements: ['test_bone_meal'] }));
    const a = r.audit!;
    const zn = a.rows.find((x) => x.metric === 'zinc')!;
    expect(zn.noLimitNote).toMatch(/Nessun limite FEDIAF applicabile/);
    expect(zn.noLimitNote).toMatch(/non significa che qualsiasi quantità sia sicura/);
    expect(a.v2!.legal.find((x) => x.metric === 'zinc')).toBeUndefined();
    for (const c of zn.checks) expect(c.message).not.toMatch(/\bsicur[oa]\b/);
    // sodio e cloruro: riferimento solo informativo (blu)
    expect(a.rows.find((x) => x.metric === 'sodium')!.checks.find((c) => c.limit.limitClass === 'INFORMATIONAL_REFERENCE')!.color).toBe('blue');
  });

  test('alimenti vietati: mai usati dal generatore, rossi in una ricetta analizzata', async () => {
    const onion: Food = { ...food('test_carrot'), id: 'onion_test', name: '[TEST] Cipolla', forbidden: true };
    const inp = menuInput(cat, ENERGY_PROFILES[1], MENU_SETS[0]);
    const r = await formulateV2({ ...inp, foods: [...inp.foods, { food: onion }] });
    expect(r.excluded.some((e) => e.id === 'onion_test' && /vietato/.test(e.reason))).toBe(true);
    expect(r.items.some((i) => i.id === 'onion_test')).toBe(false);
    const a = auditRecipeV2({ items: [...r.items, { kind: 'food', id: 'onion_test', qty: 10 }], foods: { ...Object.fromEntries(inp.foods.map((f) => [f.food.id, f.food])), onion_test: onion }, supplements: Object.fromEntries(inp.supplements.map((s) => [s.supplement.id, s.supplement])), nutrients: inp.nutrients, limits: inp.limits, dog: inp.dog, dietMoisture: null, settings: inp.settings, config: DEFAULT_CONFIG });
    expect(a.status).toBe('FAILS_OFFICIAL_LIMITS');
    expect(a.v2!.forbidden).toEqual(['[TEST] Cipolla']);
    // il catalogo ha le voci vietate della specifica, mai utilizzabili
    for (const id of ['onion', 'garlic', 'grapes_raisins', 'xylitol', 'chocolate', 'macadamia']) expect(food(id).forbidden && !food(id).availableToFormulate).toBe(true);
  });
});

// ── D. diario ──
function day(kcal: number, nutrients: Record<string, Partial<DayNutrient>>, alerts: string[] = []): DayProfile {
  const n: Record<string, DayNutrient> = {};
  for (const [k, v] of Object.entries(nutrients)) n[k] = { known: 0, estimated: 0, unknownFrom: [], unknownKcal: 0, lowerBoundFrom: [], ...v };
  return { kcal, kcalComplete: true, kcalUnknownFrom: [], items: [], nutrients: n, alerts, eaaMarginPct: 0, statusLabel: '' };
}
const dogProfile = () => ({ ...realInput(cat, kerDog(), [], []).dog, eaaMarginPct: 0 });
const summary = (entries: DiaryDay[], endDate: string, windowDays = 14) => periodSummary({ entries, endDate, windowDays, dog: dogProfile(), nutrients: cat.nutrients, limits: cat.limits });

describe('D. diario: una ricetta al giorno, totale su totale', () => {
  const recipes = async () => {
    const outs = [];
    for (const set of MENU_SETS.slice(0, 3)) {
      const inp = menuInput(cat, ENERGY_PROFILES[1], set);
      const r = await formulateV2(inp);
      outs.push(versionFromResult({ id: `v_${set.id}`, recipeId: `r_${set.id}`, revision: 1, origin: 'engine', parentVersionId: null, author: 'test' }, r, inp, '2026-10-21T10:00:00Z'));
    }
    return outs;
  };

  test('(11) sequenza 7×R1, 2×R2, 1×R3, 5×R1: totale su totale, «registrati X su 14», identico in Prova e con account', async () => {
    const [v1, v2, v3] = await recipes();
    const plan: [typeof v1, number][] = [[v1, 7], [v2, 2], [v3, 1], [v1, 5]];
    const repo = new LocalRepository(null);
    await repo.saveDog({ ...kerDog(), id: 'ker' });
    for (const v of [v1, v2, v3]) {
      const rec: Recipe = { id: v.recipeId, dogId: 'ker', name: v.recipeId, isPrimary: false, archived: false, currentVersionId: v.id, dietMoisture: null, createdAt: '' };
      await repo.createRecipe(rec);
      await repo.addVersion(v);
    }
    let start = '2026-10-01';
    for (const [v, n] of plan) {
      const dates = dateRange(start, n);
      const profile = dayProfileOf(v);
      await repo.saveDiaryEntries(dates.map((date) => ({ id: `${v.id}_${date}`, dogId: 'ker', date, recipeId: v.recipeId, versionId: v.id, recipeName: v.recipeId, revision: 1, day: profile, note: null, createdAt: '' })));
      start = dateRange(start, n + 1)[n];
    }
    const entries = await repo.listDiary('ker');
    expect(entries.length).toBe(15); // dal 01/10 al 15/10, una voce per data
    const days: DiaryDay[] = entries.map((e) => ({ date: e.date, recipeName: e.recipeName, revision: e.revision, day: e.day }));
    // finestra di 14 giorni che finisce il 15/10: 02/10–15/10, tutti registrati
    const s = summary(days, '2026-10-15');
    expect(s.registered).toBe(14);
    expect(s.missingDates).toEqual([]);
    expect(s.text).toMatch(/^Registrati 14 giorni su 14\./);
    // finestra che finisce il 16/10 (non registrato): 13 su 14, il giorno mancante è escluso e mostrato
    const sMiss = summary(days, '2026-10-16');
    expect(sMiss.registered).toBe(13);
    expect(sMiss.missingDates).toEqual(['2026-10-16']);
    expect(sMiss.text).toMatch(/Registrati 13 giorni su 14 \(mancano 1 giorni, esclusi dal calcolo\)/);
    // atteso a mano: R1 × 11 (6 + 5), R2 × 2, R3 × 1
    const p1 = dayProfileOf(v1), p2 = dayProfileOf(v2), p3 = dayProfileOf(v3);
    const E = 11 * p1.kcal + 2 * p2.kcal + p3.kcal;
    const zinc = ((11 * p1.nutrients.zinc.known + 2 * p2.nutrients.zinc.known + p3.nutrients.zinc.known) / E) * 1000;
    expect(s.kcal).toBeCloseTo(E, 6);
    const zc = s.checks.find((c) => c.metric === 'zinc' && c.kind === 'min')!;
    expect(zc.value).toBeCloseTo(zinc, 9);
    const simple = (11 * (p1.nutrients.zinc.known / p1.kcal) + 2 * (p2.nutrients.zinc.known / p2.kcal) + p3.nutrients.zinc.known / p3.kcal) / 14 * 1000;
    expect(Math.abs(zc.value! - simple)).toBeGreaterThan(1e-6); // non è la media semplice delle concentrazioni
    // con account: stessa struttura (riga della tabella diary_entries ↔ voce dell'app), stesso riepilogo
    const viaDb = entries.map((e) => rowToDiary(JSON.parse(JSON.stringify(diaryToRow(e, 'owner')))));
    expect(viaDb).toEqual(entries);
    const s2 = summary(viaDb.map((e) => ({ date: e.date, recipeName: e.recipeName, revision: e.revision, day: e.day })), '2026-10-15');
    expect(JSON.stringify(s2)).toBe(JSON.stringify(s));
    expect(JSON.stringify(summary(viaDb.map((e) => ({ date: e.date, recipeName: e.recipeName, revision: e.revision, day: e.day })), '2026-10-16'))).toBe(JSON.stringify(sMiss));
  });

  test('(12) la stessa ricetta divisa in 2–3 pasti conta una volta; registrare di nuovo la data sostituisce', async () => {
    const [v1, v2] = await recipes();
    const repo = new LocalRepository(null);
    await repo.saveDog({ ...kerDog(), id: 'ker' });
    for (const v of [v1, v2]) {
      await repo.createRecipe({ id: v.recipeId, dogId: 'ker', name: v.recipeId, isPrimary: false, archived: false, currentVersionId: v.id, dietMoisture: null, createdAt: '' });
      await repo.addVersion(v);
    }
    const entry = (v: typeof v1, id: string): DiaryEntry => ({ id, dogId: 'ker', date: '2026-10-20', recipeId: v.recipeId, versionId: v.id, recipeName: v.recipeId, revision: 1, day: dayProfileOf(v), note: null, createdAt: '' });
    await repo.saveDiaryEntries([entry(v1, 'a')]);
    // la razione divisa in tre pasti è solo una vista: la voce del giorno resta una
    const meals = splitIntoMeals(v1.chosenItems, 3);
    expect(meals.length).toBe(3);
    expect(meals[0].find((i) => i.qty > 0)!.qty * 3).toBeCloseTo(v1.chosenItems.find((i) => i.qty > 0)!.qty, 0);
    await repo.saveDiaryEntries([entry(v1, 'b')]); // stessa ricetta di nuovo sulla stessa data
    let list = await repo.listDiary('ker');
    expect(list.length).toBe(1);
    const s = summary(list.map((e) => ({ date: e.date, recipeName: e.recipeName, revision: e.revision, day: e.day })), '2026-10-20', 7);
    expect(s.registered).toBe(1);
    expect(s.kcal).toBeCloseTo(dayProfileOf(v1).kcal, 6); // una razione, non due o tre
    await repo.saveDiaryEntries([entry(v2, 'c')]); // cambiare la ricetta del giorno sostituisce la precedente
    list = await repo.listDiary('ker');
    expect(list.map((e) => e.recipeId)).toEqual([v2.recipeId]);
    // la voce conserva l'istantanea anche se la ricetta viene eliminata
    await repo.deleteRecipe(v2.recipeId);
    list = await repo.listDiary('ker');
    expect(list[0].recipeId).toBeNull();
    expect(list[0].day.kcal).toBeGreaterThan(0);
  });

  test('(13) esempio §7.2: 833 per 1000 kcal (totale su totale), non 750 (media semplice)', () => {
    const s = summary(
      [
        { date: '2026-10-01', recipeName: 'A', revision: 1, day: day(1000, { vitamin_b5: { known: 1000 } }) },
        { date: '2026-10-02', recipeName: 'B', revision: 1, day: day(500, { vitamin_b5: { known: 250 } }) },
      ],
      '2026-10-02',
    );
    const b5 = s.checks.find((c) => c.metric === 'vitamin_b5')!;
    expect(b5.value).toBeCloseTo(833.333333, 5);
    expect(b5.value).not.toBeCloseTo(750, 0);
  });

  test('(14) esempio B5 del §7.3: sette giorni al minimo e sette con B5 sconosciuta → grigio «non dimostrato», non verde', () => {
    const min = 4.11;
    const entries: DiaryDay[] = dateRange('2026-10-01', 14).map((date, i) => ({
      date, recipeName: i < 7 ? 'nota' : 'sconosciuta', revision: 1,
      day: day(1000, { vitamin_b5: i < 7 ? { known: min } : { known: 0, unknownFrom: ['[TEST] Pollo'], unknownKcal: 1000 } }),
    }));
    const b5 = summary(entries, '2026-10-14').checks.find((c) => c.metric === 'vitamin_b5')!;
    expect(b5.color).toBe('grey');
    expect(b5.pctOfMin).toBeCloseTo(50, 6);
    expect(b5.unknownShare).toBeCloseTo(0.5, 9);
    expect(b5.unknownTop).toEqual(['[TEST] Pollo, 7 giorni su 14']);
    expect(b5.message).toMatch(/non dimostrato: noto 50% del minimo/);
    // se i sette giorni noti da soli arrivano al minimo del periodo intero → verde, anche con la parte sconosciuta
    const enough = entries.map((e, i) => (i < 7 ? { ...e, day: day(1000, { vitamin_b5: { known: 2 * min } }) } : e));
    expect(summary(enough, '2026-10-14').checks.find((c) => c.metric === 'vitamin_b5')!.color).toBe('green');
  });

  test('(15) meno di 5 giorni: nessuna frase di tendenza, ma un massimo superato avvisa subito', async () => {
    // fegato di prova in quantità eccessiva: vitamina A oltre il massimo nutrizionale in quel giorno
    const inp = menuInput(cat, ENERGY_PROFILES[1], { foods: ['test_beef', 'test_beef_liver', 'test_oats', 'test_carrot'], supplements: ['test_bone_meal'] });
    const snapshot = snapshotOf(inp, ENGINE_VERSION_V2, '2026-10-21T10:00:00Z');
    const items: RecipeItem[] = [{ kind: 'food', id: 'test_beef', qty: 50 }, { kind: 'food', id: 'test_beef_liver', qty: 900 }, { kind: 'food', id: 'test_oats', qty: 50 }, { kind: 'food', id: 'test_carrot', qty: 100 }, { kind: 'supplement', id: 'test_bone_meal', qty: 10 }];
    const p = dayProfileOf({ snapshot, chosenItems: items });
    expect(p.alerts.join(' ')).toMatch(/Vitamina A/);
    const s = summary([{ date: '2026-10-20', recipeName: 'fegato', revision: 1, day: p }, { date: '2026-10-21', recipeName: 'base', revision: 1, day: day(1340, { zinc: { known: 1 } }) }], '2026-10-21');
    expect(s.registered).toBe(2);
    expect(s.fewDays).toBe(true);
    expect(s.checks.every((c) => c.trend === null)).toBe(true);
    expect(s.text).toMatch(/Ancora pochi giorni registrati/);
    expect(s.alerts.some((a) => a.date === '2026-10-20' && /Vitamina A/.test(a.text))).toBe(true);
    // con 5 giorni tutti noti e sotto il minimo → rosso e frase di tendenza
    const low = dateRange('2026-10-01', 5).map((date) => ({ date, recipeName: 'x', revision: 1, day: day(1000, { zinc: { known: 5 } }) }));
    const zl = summary(low, '2026-10-05').checks.find((c) => c.metric === 'zinc')!;
    expect(zl.color).toBe('red');
    expect(zl.trend).toMatch(/risulta basso/);
  });

  test('energia sconosciuta per un componente: risultato parziale, mai verde sul denominatore incompleto', () => {
    const partial: DayProfile = { ...day(1000, { zinc: { known: 30 } }), kcalComplete: false, kcalUnknownFrom: ['Farina d’ossa'] };
    const s = summary([{ date: '2026-10-01', recipeName: 'x', revision: 1, day: partial }], '2026-10-01', 7);
    expect(s.kcalPartial).toBe(true);
    const zn = s.checks.find((c) => c.metric === 'zinc')!;
    expect(zn.color).toBe('yellow');
    expect(zn.message).toMatch(/denominatore parziale/);
  });
});

describe('ricette, configurazione e dati', () => {
  test('limite 200 ricette per cane; le archiviate non contano (app e archivio di prova)', async () => {
    const repo = new LocalRepository(null);
    await repo.saveDog({ ...kerDog(), id: 'd' });
    const mk = (i: number, archived = false): Recipe => ({ id: `r${i}`, dogId: 'd', name: `R${i}`, isPrimary: false, archived, currentVersionId: null, dietMoisture: null, createdAt: '' });
    for (let i = 0; i < 200; i++) await repo.createRecipe(mk(i));
    await expect(repo.createRecipe(mk(200))).rejects.toThrow(/al massimo 200/);
    await repo.updateRecipe({ ...mk(0), archived: true });
    await repo.createRecipe(mk(201));
    await expect(repo.updateRecipe({ ...mk(0), archived: false })).rejects.toThrow(/al massimo 200/); // ripristino oltre il limite
    expect((await repo.listRecipes('d')).length).toBe(201);
    expect(() => assertCanAddRecipe(Array.from({ length: 300 }, (_, i) => mk(i, i >= 150)))).not.toThrow();
  });

  test('configurazione [PROPOSTA] da file, modificabile da Impostazioni e congelata nella ricetta', () => {
    expect(DEFAULT_CONFIG.groups.map((g) => [g.id, g.minPctKcal, g.maxPctKcal])).toEqual([['animal', 40, 65], ['starch', 20, 40], ['vegetable', 3, 15], ['fat', 0, 12]]);
    expect(DEFAULT_CONFIG.energyTolerancePct).toBe(5);
    expect(DEFAULT_CONFIG.maxRecipesPerDog).toBe(200);
    const c = resolveConfig({ energyTolerancePct: 3, groups: [{ id: 'starch', minPctKcal: 10, maxPctKcal: 30 }] });
    expect(c.energyTolerancePct).toBe(3);
    expect(c.groups.find((g) => g.id === 'starch')).toEqual(expect.objectContaining({ minPctKcal: 10, maxPctKcal: 30 }));
    expect(DEFAULT_CONFIG.groups.find((g) => g.id === 'starch')!.minPctKcal).toBe(20); // il predefinito non cambia
    expect(resolveConfig({ groups: [{ id: 'starch', minPctKcal: 50, maxPctKcal: 30 }] }).groups.find((g) => g.id === 'starch')!.minPctKcal).toBe(20); // incoerente: ignorato
  });

  test('B5 del QDiet dal calcio D-pantotenato: 450 mg/kg × 0,92 = 0,414 mg/g, conteggiata', () => {
    const b5 = supp('qdiet').nutrients.vitamin_b5;
    expect(b5.value).toBeCloseTo(0.414, 9);
    expect(b5.form).toBe('calcium_d_pantothenate');
    expect(b5.declared).toBe('added');
  });

  test('Ca:P a gradini: il generatore dichiara il gradino raggiunto (Ker reale: gradino 2)', async () => {
    const r = await formulateV2(realInput(cat, kerDog(), KER_FOODS, KER_SUPPS));
    expect(r.stats?.caPStep).toBe(2);
    const step = r.audit!.rows.find((x) => x.metric === 'ca_p_ratio')!.checks.find((c) => /gradino/.test(c.message))!;
    expect(step.color).toBe('yellow');
    expect(r.phases[0].status).toBe('Infeasible'); // gradino 1 provato per primo
  });

  test('stessi dati nel generatore e nella verifica: ogni minimo coperto dal modello risulta coperto anche nella verifica', async () => {
    const r = await formulateV2(menuInput(cat, ENERGY_PROFILES[1], MENU_SETS[1]));
    const a = r.audit!;
    // il modello copre il livello B dove i dati lo permettono: nessun arancione per i minimi con dati completi coperti
    const objective = r.phases.find((p) => /livello B/.test(p.name) && p.status === 'Optimal')!.objective!;
    const deficits = a.rows.flatMap((x) => x.checks.filter((c) => c.level === 'B' && c.gap && c.gap.deviation < 0));
    if (objective < 1e-6) expect(deficits.filter((c) => c.color === 'orange')).toEqual([]);
    expect(activated(cat, ['x']).foods.length).toBe(cat.foods.length);
  });
});
