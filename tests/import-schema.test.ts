// Schema definitivo dell'importazione (nutrizionista, 19/10/2026): modelli JSON, reimportazione, masse, stati,
// vitamina E, prodotti TEST, qualità dei dati degli integratori, base quantitativa.

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseImport, planImport, type ImportKind } from '../src/data/catalogImport';
import { LocalRepository } from '../src/data/localRepository';

const mem: Record<string, string> = {};
const fresh = () => {
  for (const k of Object.keys(mem)) delete mem[k];
  return new LocalRepository({ getItem: (k) => mem[k] ?? null, setItem: (k, v) => void (mem[k] = v) });
};

async function plan(repo: LocalRepository, kind: ImportKind, data: unknown) {
  const cat = await repo.loadCatalog();
  return planImport(parseImport(typeof data === 'string' ? data : JSON.stringify(data), kind, cat.nutrients), cat, 'prova.json');
}
const errs = (p: Awaited<ReturnType<typeof plan>>) => p.errors.map((e) => e.message).join('\n');

const supp = (over: Record<string, unknown>, nutrients: Record<string, unknown>) => ({
  supplements: [{ id: 'nuovo_integratore', name_it: 'Nuovo integratore', dose_unit: 'capsule', label_source: 'Etichetta', product_version: 'L1', ...over, nutrients }],
});
const food = (nutrients: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  foods: [{ id: 'nuovo_alimento', name_it: 'Nuovo alimento', category: 'animal', subcategory: 'muscle', processing_state: 'raw', source: 'Fonte', ...over, nutrients }],
});

describe('modelli JSON definitivi', () => {
  test('si importano senza errori; reimportati restano invariati (prodotto, versione, convalida)', async () => {
    const repo = fresh();
    for (const [kind, file] of [['foods', 'alimenti.json'], ['supplements', 'integratori.json']] as const) {
      const text = readFileSync(`docs/modelli-importazione/${file}`, 'utf8');
      const p = await plan(repo, kind, text);
      expect(errs(p)).toBe('');
      expect(p.canApply).toBe(true);
      await repo.applyCatalogImport(p);
      const again = await plan(repo, kind, text);
      expect(again.items.every((i) => i.action === 'unchanged')).toBe(true);
      expect(again.canApply).toBe(false);
    }
    const cat = await repo.loadCatalog();
    const f = cat.foods.find((x) => x.id === 'esempio_manzo_magro_crudo')!;
    expect(f.sourceUrl).toBe('https://esempio.org/scheda/0000');
    expect(f.notes).not.toContain('URL');
    expect(f.nutrients.zinc.value).toBeCloseTo(4.5, 9); // 45 mg/kg → 4,5 mg/100 g
    expect(f.nutrients.zinc.basis).toBe('per_kg');
    const oil = cat.supplements.find((x) => x.id === 'esempio_olio_pesce_capsule')!;
    expect(oil.massPerUnitG).toBe(1);
    expect(oil.grossMassPerUnitG ?? null).toBeNull();
    expect(oil.nutrients.omega3_total.value).toBeCloseTo(0.33, 9);
    const pw = cat.supplements.find((x) => x.id === 'esempio_integratore_polvere')!;
    expect(pw.nutrients.zinc.value).toBeCloseTo(2, 9); // 2000 mg/kg → 2 mg per 1 g
    expect(pw.nutrients.zinc.declared).toBe('added');
    expect(pw.nutrients.calcium.value).toBeCloseTo(0.18, 9); // 18 g/100 g → 0,18 g per 1 g
    expect(pw.nutrients.choline.value).toBeCloseTo(67.14, 6);
    expect(pw.nutrients.choline.sourceValue).toBe(90000);
    expect(pw.nutrients.choline.sourceUnit).toBe('mg');
    expect(pw.nutrients.choline.conversion).toMatch(/0,746.*per_kg/);
    expect(pw.dataStatus).toBe('unverified');
  });

  test('una modifica effettiva è un aggiornamento con nuova versione', async () => {
    const repo = fresh();
    const data = JSON.parse(readFileSync('docs/modelli-importazione/alimenti.json', 'utf8'));
    await repo.applyCatalogImport(await plan(repo, 'foods', data));
    data.foods[0].source_url = 'https://esempio.org/scheda/0001';
    data.foods[0].nutrients.protein.value = 22;
    const p = await plan(repo, 'foods', data);
    expect(p.items[0].action).toBe('update');
    expect(p.items[0].fieldChanges.map((c) => c.field)).toEqual(['sourceUrl']);
    expect(p.items[0].valueChanges.map((c) => c.nutrientId)).toEqual(['protein']);
    expect((p.items[0].next as { profileVersion: number }).profileVersion).toBe(2);
  });
});

describe('masse e componenti', () => {
  test('olio di pesce: EPA e DHA sono parte dei grassi, non si sommano di nuovo', async () => {
    const p = await plan(fresh(), 'supplements', supp({ content_mass_per_unit_g: 1 }, {
      fat: { value: 1, unit: 'g', status: 'label', declared_total_or_added: 'total' },
      epa: { value: 180, unit: 'mg', status: 'label', declared_total_or_added: 'total' },
      dha: { value: 120, unit: 'mg', status: 'label', declared_total_or_added: 'total' },
    }));
    expect(errs(p)).toBe('');
  });

  test('componenti oltre il proprio totale: errore distinto dal controllo della massa della dose', async () => {
    const p = await plan(fresh(), 'supplements', supp({ content_mass_per_unit_g: 1 }, {
      fat: { value: 0.2, unit: 'g', status: 'label', declared_total_or_added: 'total' },
      epa: { value: 180, unit: 'mg', status: 'label', declared_total_or_added: 'total' },
      dha: { value: 120, unit: 'mg', status: 'label', declared_total_or_added: 'total' },
    }));
    expect(errs(p)).toMatch(/più del totale dichiarato di Grassi totali/);
    expect(errs(p)).not.toMatch(/più del contenuto della dose/);
    const aa = await plan(fresh(), 'foods', food({
      protein: { value: 1, unit: 'g', status: 'measured' }, fat: { value: 1, unit: 'g', status: 'measured' },
      lysine: { value: 2, unit: 'g', status: 'measured' },
    }));
    expect(errs(aa)).toMatch(/Lisina = 2 g, più del totale dichiarato di Proteine/);
  });

  test('massa della dose: contenuto distinto dalla capsula intera; la massa lorda non si inventa', async () => {
    const tooHeavy = await plan(fresh(), 'supplements', supp({ content_mass_per_unit_g: 0.5 }, {
      fat: { value: 1, unit: 'g', status: 'label', declared_total_or_added: 'total' },
    }));
    expect(errs(tooHeavy)).toMatch(/più del contenuto della dose \(0.5 g\)/);
    const inverted = await plan(fresh(), 'supplements', supp({ content_mass_per_unit_g: 1.2, gross_mass_per_unit_g: 1 }, {
      fat: { value: 1, unit: 'g', status: 'label', declared_total_or_added: 'total' },
    }));
    expect(errs(inverted)).toMatch(/pesa più dell’unità intera/);
    const ok = await plan(fresh(), 'supplements', supp({ content_mass_per_unit_g: 1, gross_mass_per_unit_g: 1.4 }, {
      fat: { value: 1, unit: 'g', status: 'label', declared_total_or_added: 'total' },
    }));
    expect(errs(ok)).toBe('');
    expect(ok.items[0].next).toMatchObject({ massPerUnitG: 1, grossMassPerUnitG: 1.4 });
    const ambiguous = await plan(fresh(), 'supplements', supp({ mass_per_unit_g: 1 }, {}));
    expect(errs(ambiguous)).toMatch(/ambiguo/);
  });
});

describe('stati, dati mancanti, vitamina E', () => {
  test('stato obbligatorio; nessun «misurato» o «zero documentato» automatico', async () => {
    const p = await plan(fresh(), 'foods', food({ protein: { value: 20, unit: 'g' }, fat: { value: 0, unit: 'g' } }));
    expect(errs(p)).toMatch(/Proteine: stato del valore mancante/);
    expect(errs(p)).toMatch(/Grassi totali: stato del valore mancante/);
    const v = await plan(fresh(), 'foods', food({ protein: { value: 20, unit: 'g', status: 'verified' } }));
    expect(errs(v)).toMatch(/«verified» non valido/);
    const z = await plan(fresh(), 'foods', food({ protein: { value: 2, unit: 'g', status: 'analytical_zero' } }));
    expect(errs(z)).toMatch(/lo zero documentato vale solo per 0/);
    const ze = await plan(fresh(), 'foods', food({ protein: { value: 0, unit: 'g', status: 'estimated' } }));
    expect(errs(ze)).toMatch(/non una stima/);
  });

  test('vuoto = nessuna modifica; NA = non disponibile; null JSON rifiutato', async () => {
    const repo = fresh();
    await repo.applyCatalogImport(await plan(repo, 'foods', food({ protein: { value: 20, unit: 'g', status: 'measured' }, fat: { value: 5, unit: 'g', status: 'measured' } })));
    const empty = await plan(repo, 'foods', food({ protein: { value: '', unit: 'g' } }));
    expect(empty.items[0].action).toBe('unchanged');
    const na = await plan(repo, 'foods', food({ protein: { value: 'NA', unit: 'g' } }));
    expect(na.items[0].valueChanges[0]).toMatchObject({ nutrientId: 'protein', before: 20, after: null, status: 'unknown' });
    const nul = await plan(repo, 'foods', food({ protein: { value: null, unit: 'g' } }));
    expect(errs(nul)).toMatch(/valore null non ammesso/);
    const unknownKey = await plan(repo, 'foods', food({ protein: { value: 20, unit: 'g', status: 'measured', quality: 'x' } }));
    expect(errs(unknownKey)).toMatch(/proprietà non riconosciute «quality»/);
  });

  test('vitamina E in mg senza forma chimica: importazione bloccata, nessun valore omesso in silenzio', async () => {
    const p = await plan(fresh(), 'foods', food({ vitamin_e: { value: 10, unit: 'mg', status: 'measured' } }));
    expect(p.canApply).toBe(false);
    expect(errs(p)).toMatch(/Vitamina E: 10 mg non convertibile in IU — indicare la forma chimica/);
    const ok = await plan(fresh(), 'foods', food({ vitamin_e: { value: 10, unit: 'mg', status: 'measured', form: 'd_alpha_tocopheryl_acetate' } }));
    const v = ok.items[0].next.nutrients.vitamin_e;
    expect(v).toMatchObject({ value: 13.6, sourceValue: 10, sourceUnit: 'mg', form: 'd_alpha_tocopheryl_acetate' });
    expect(v.conversion).toMatch(/1,36/);
  });
});

describe('prodotti TEST, qualità e dichiarato', () => {
  test('id test_ e nomi «[TEST]» rifiutati; i prodotti TEST esistenti restano invariati', async () => {
    const repo = fresh();
    const p = await plan(repo, 'foods', { foods: [{ id: 'test_beef', name_it: 'Manzo vero' }] });
    expect(errs(p)).toMatch(/riservato ai prodotti di prova/);
    const n = await plan(repo, 'foods', food({}, { name_it: '[TEST] Qualcosa' }));
    expect(errs(n)).toMatch(/riservati ai prodotti di prova/);
    expect((await repo.loadCatalog()).foods.find((f) => f.id === 'test_beef')!.name).toBe('[TEST] Manzo (fittizio)');
  });

  test('integratori: qualità dei dati importabile; «verified» no; total/added obbligatorio e conservato', async () => {
    const q = await plan(fresh(), 'supplements', supp({ content_mass_per_unit_g: 1, data_status: 'estimated' }, { zinc: { value: 10, unit: 'mg', status: 'label', declared_total_or_added: 'added' } }));
    expect(errs(q)).toBe('');
    expect(q.items[0].next).toMatchObject({ dataStatus: 'estimated', usableForOptimization: false });
    expect(q.items[0].next.nutrients.zinc.declared).toBe('added');
    expect(q.items[0].statusAfter.reasons).toContain('profilo dichiarato come stima');
    const v = await plan(fresh(), 'supplements', supp({ data_status: 'verified' }, {}));
    expect(errs(v)).toMatch(/«verified» non si importa/);
    const d = await plan(fresh(), 'supplements', supp({ content_mass_per_unit_g: 1 }, { zinc: { value: 10, unit: 'mg', status: 'label' } }));
    expect(errs(d)).toMatch(/declared_total_or_added obbligatorio/);
  });
});

describe('base quantitativa', () => {
  test('per kg / per 100 g → dose: solo con base esplicita e massa documentata', async () => {
    const powder = await plan(fresh(), 'supplements', supp({ dose_unit: 'g' }, { zinc: { value: 2000, unit: 'mg', basis: 'per_kg', status: 'label', declared_total_or_added: 'added' } }));
    expect(errs(powder)).toBe('');
    expect(powder.items[0].next.nutrients.zinc).toMatchObject({ value: 2, sourceValue: 2000, sourceUnit: 'mg' });
    expect(powder.items[0].next.nutrients.zinc.basis).toMatch(/per_kg/);
    // capsula: serve dire a quale massa si riferisce la base, e quella massa deve essere documentata
    const noMass = await plan(fresh(), 'supplements', supp({}, { fat: { value: 90, unit: 'g', basis: 'per_100g', basis_mass: 'content', status: 'label', declared_total_or_added: 'total' } }));
    expect(errs(noMass)).toMatch(/content_mass_per_unit_g, che non è documentata/);
    const noRef = await plan(fresh(), 'supplements', supp({ content_mass_per_unit_g: 1 }, { fat: { value: 90, unit: 'g', basis: 'per_100g', status: 'label', declared_total_or_added: 'total' } }));
    expect(errs(noRef)).toMatch(/indicare basis_mass/);
    const gross = await plan(fresh(), 'supplements', supp({ gross_mass_per_unit_g: 1.5 }, { calcium: { value: 20, unit: 'g', basis: 'per_100g', basis_mass: 'gross', status: 'label', declared_total_or_added: 'total' } }));
    expect(errs(gross)).toBe('');
    expect(gross.items[0].next.nutrients.calcium.value).toBeCloseTo(0.3, 9);
    const bad = await plan(fresh(), 'supplements', supp({ dose_unit: 'g' }, { zinc: { value: 2, unit: 'mg', basis: 'per_confezione', status: 'label', declared_total_or_added: 'added' } }));
    expect(errs(bad)).toMatch(/base «per_confezione» non valida/);
  });
});
