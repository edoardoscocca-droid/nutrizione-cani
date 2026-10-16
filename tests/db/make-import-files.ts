// Crea i file per il test d'importazione sul database: un alimento completo nuovo (JSON) e una modifica (CSV lungo).
import { writeFileSync } from 'node:fs';
import { TEST_FOODS } from '../../src/data/testFixtures';
import { packageReferences } from '../../src/data/packageCatalog';

const dir = process.argv[2];
const lamb = TEST_FOODS.find((f) => f.id === 'test_lamb')!;
const units = new Map(packageReferences().nutrients.map((n) => [n.id, n.unit]));
const nutrients = Object.fromEntries(
  Object.entries(lamb.nutrients).map(([k, v]) => [k, { value: v.value, unit: units.get(k), status: v.value === 0 ? 'analytical_zero' : 'measured', source: 'TEST import' }]),
);
writeFileSync(
  `${dir}/full.json`,
  JSON.stringify({
    foods: [
      {
        id: 'imported_lamb', name_it: 'Agnello importato (prova)', category: 'animal', subcategory: 'muscle', processing_state: 'raw',
        edible_portion: 'muscolo senza osso', kcal_me_per_100g: 235, me_method: 'TEST', source_identifier: 'TEST-1', source_version: '2026-10',
        available_to_formulate: true, nutrients,
      },
    ],
  }),
);
writeFileSync(`${dir}/change.csv`, 'product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\nimported_lamb,Calcio,25,mg,raw,TEST import 2,\nimported_lamb,vitamin_d,,IU,raw,,\n');
writeFileSync(`${dir}/bad.csv`, 'product_id,nutrient_id,value_per_100g,unit,basis,source_id,status\ntest_lamb,calcium,5,IU,raw,x,\ntest_lamb,sconosciuto,1,g,raw,x,\nnon_esiste,protein,1,g,raw,x,\n');
