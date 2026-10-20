// Misura dei tempi del motore (specifica del 20/10/2026, §14): 6 alimenti + 3 integratori, due ricerche e verificatore.
// Usa COPIE in memoria dei prodotti reali (attivati solo qui per la prova): il catalogo non viene modificato.
// Uso: npx tsx scripts/collaudo/tempi.ts [ripetizioni]
import { cpus } from 'node:os';
import { LocalRepository } from '../../src/data/localRepository';
import { buildInput } from '../../src/data/recipeService';
import { applyPreset, presetFor } from '../../src/data/formulationPresets';
import { newDog } from '../../src/engine/dogProfile';
import { formulate } from '../../src/engine/formulate';
import { DEFAULT_SETTINGS } from '../../src/engine/types';

const runs = Number(process.argv[2] ?? 20);
const cat = await new LocalRepository(null).loadCatalog();
const copy = { ...cat, supplements: cat.supplements.map((s) => (['qdiet', 'omegor_vitality', 'bone_meal'].includes(s.id) ? { ...s, usableForOptimization: true } : s)) };
const base = newDog({ name: 'Prova', weightCurrentKg: 33, weightIdealKg: 31, kcalTarget: 1800, activityFactor: 2 }, 'bench');
const dog = applyPreset(base, presetFor('adult_maintenance')!);
// SCENARIO=prova: prodotti TEST (profili completi di prova); altrimenti copie dei prodotti reali
const prova = process.env.SCENARIO === 'prova';
const sel = prova
  ? {
      foods: ['test_beef', 'test_beef_heart', 'test_beef_liver', 'test_oats', 'test_carrot', 'test_sardine'].map((id) => ({ id })),
      supplements: ['test_multi', 'test_bone_meal', 'test_fish_oil_caps'].map((id) => ({ id })),
      dietMoisture: null,
    }
  : {
      foods: ['beef_03', 'beef_15', 'beef_30', 'oat_dry', 'carrot_cooked', 'pumpkin_cooked'].map((id) => ({ id })),
      supplements: ['qdiet', 'omegor_vitality', 'bone_meal'].map((id) => ({ id })),
      dietMoisture: null,
    };
const times: number[] = [];
let last;
for (let i = 0; i < runs; i++) {
  const input = buildInput(dog, sel, copy, DEFAULT_SETTINGS, []);
  const t = performance.now();
  last = await formulate(input);
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
const pct = (p: number) => times[Math.min(times.length - 1, Math.ceil((p / 100) * times.length) - 1)];
console.log(JSON.stringify({
  macchina: `${cpus()[0]?.model ?? '?'} × ${cpus().length}, Node ${process.version}`,
  scenario: prova ? 'prodotti TEST (6 alimenti + 3 integratori)' : 'copie dei prodotti reali (6 alimenti + 3 integratori)',
  ripetizioni: runs,
  ms: { min: Math.round(times[0]), p50: Math.round(pct(50)), p95: Math.round(pct(95)), max: Math.round(times[times.length - 1]) },
  esito: last!.outcome,
  ricercaP1: last!.stats?.p1Stage,
  risoluzioni: last!.stats?.solves,
  stato: last!.audit?.statusLabel,
  quantita: last!.items.map((i) => `${i.id} ${i.qty}`),
  messaggio: last!.message,
}, null, 1));
if (process.env.DETTAGLI) {
  for (const r of last!.audit?.rows ?? []) for (const c of r.checks) if (['ca_p_ratio', 'protein_energy_pct', 'fat_energy_pct', 'carb_energy_pct', 'fiber'].includes(r.metric)) console.log(r.metric, c.color, c.message);
  console.log(JSON.stringify(last!.audit?.softGaps, null, 1));
}
