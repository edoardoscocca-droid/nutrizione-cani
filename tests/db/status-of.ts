// Stampa "id:stato" per ogni alimento di un'esportazione del database, calcolato con le regole dell'app.
import { readFileSync } from 'node:fs';
import { foodStatus } from '../../src/engine/catalogStatus';
import { packageReferences } from '../../src/data/packageCatalog';
import type { Food } from '../../src/engine/types';

const { foods } = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { foods: Food[] };
const nutrients = packageReferences().nutrients;
for (const f of foods.sort((a, b) => a.id.localeCompare(b.id))) {
  for (const v of Object.values(f.nutrients)) if (v.value !== null) v.value = Number(v.value);
  console.log(`${f.id}:${foodStatus({ ...f, kcalMePer100g: f.kcalMePer100g === null ? null : Number(f.kcalMePer100g) }, nutrients).status}`);
}
