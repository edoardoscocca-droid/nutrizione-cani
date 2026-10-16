// Stampa "id:stato" per ogni alimento di un'esportazione del database, calcolato con le regole dell'app.
import { readFileSync } from 'node:fs';
import { foodStatus } from '../../src/engine/catalogStatus';
import { packageReferences } from '../../src/data/packageCatalog';
import { resolveFoodEnergy } from '../../src/engine/energy';
import type { Food } from '../../src/engine/types';

const { foods } = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { foods: Food[] };
const refs = packageReferences();
const nutrients = refs.nutrients;
for (const f of foods.sort((a, b) => a.id.localeCompare(b.id))) {
  for (const v of Object.values(f.nutrients)) if (v.value !== null) v.value = Number(v.value);
  const kcal = f.kcalMePer100g === null ? null : Number(f.kcalMePer100g);
  const resolved = resolveFoodEnergy({ ...f, kcalMePer100g: kcal, kcalMeOrigin: kcal === null ? null : 'declared' }, refs.energyMethods, refs.energyAssignments);
  console.log(`${f.id}:${foodStatus(resolved, nutrients).status}`);
}
