// Prove in memoria per la revisione del 21/10/2026: stesso caso con un solo macinato, con e senza preferenze, e Garmr.
// Nessuna scrittura. Uso: npx tsx scripts/collaudo/varianti-revisione.ts
import { applyPreset, presetFor } from '../../src/data/formulationPresets';
import { LocalRepository } from '../../src/data/localRepository';
import type { Dog } from '../../src/data/model';
import { buildInput, type Selection } from '../../src/data/recipeService';
import { newDog } from '../../src/engine/dogProfile';
import { diagnosisOf, formulate } from '../../src/engine/formulate';
import { DEFAULT_SETTINGS } from '../../src/engine/types';
const cat = await new LocalRepository(null).loadCatalog();
const fmt = (n: number | null | undefined, d = 1) => (n == null ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: d }));
async function run(label: string, dogArgs: Parameters<typeof newDog>[0], foods: string[], supps: string[], prefs: 'default' | 'none') {
  const copy = { ...cat, foods: cat.foods.map((f) => (foods.includes(f.id) ? { ...f, availableToFormulate: true } : f)), supplements: cat.supplements.map((s) => (supps.includes(s.id) ? { ...s, usableForOptimization: true } : s)) };
  let d: Dog = applyPreset(newDog(dogArgs, 'x'), presetFor('adult_maintenance')!);
  if (prefs === 'none') d = { ...d, macroPreferences: d.macroPreferences.map((m) => ({ ...m, enabled: false })), fiberTarget: d.fiberTarget ? { ...d.fiberTarget, enabled: false } : d.fiberTarget };
  const sel: Selection = { foods: foods.map((id) => ({ id })), supplements: supps.map((id) => ({ id })), dietMoisture: null, proteinDigestibility: null };
  const t0 = performance.now();
  const r = await formulate(buildInput(d, sel, copy, DEFAULT_SETTINGS, []));
  const a = r.audit;
  const q = (id: string) => fmt(r.items.find((x) => x.id === id)?.qty ?? 0, 1);
  const dv = a?.totals.derived;
  console.log(`\n### ${label}\nesito ${diagnosisOf(r)} (${r.outcome}, P1 ${r.stats?.p1Stage ?? '-'}) ${fmt((performance.now() - t0) / 1000, 1)} s`);
  console.log('quantità: ' + [...foods, ...supps].map((id) => `${id} ${q(id)}`).join(' · '));
  if (a) console.log(`kcal ${fmt(a.totals.energy.known)} · P/G/C ${fmt(dv?.protein_energy_pct?.value)}/${fmt(dv?.fat_energy_pct?.value)}/${fmt(dv?.carb_energy_pct?.value)} · fibra ${fmt(a.totals.nutrients.fiber.known)} g · P ${fmt(a.totals.nutrients.phosphorus.known * 1000 / a.totals.energy.known, 2)} g/1000 · Ca:P noti ${fmt(a.totals.nutrients.calcium.known / a.totals.nutrients.phosphorus.known, 2)} · LA ${fmt(a.totals.nutrients.linoleic_acid.known, 2)} · ALA ${fmt(a.totals.nutrients.ala.known, 1)} · stato ${a.status}`);
  if (r.conflicts.length) console.log('conflitti: ' + r.conflicts.map((c) => c.label.slice(0, 90)).join(' | '));
}
const KER = { name: 'Ker', weightCurrentKg: 30.2, weightIdealKg: 27.2, kcalTarget: 1340, kcalSource: 'user' as const, activityFactor: 1.6, sex: 'F' as const, sterilized: false, ageYears: 6, bcs: 6 };
const GARMR = { name: 'Garmr', weightCurrentKg: 72, weightIdealKg: 68.8, kcalTarget: 2700, kcalSource: 'user' as const, activityFactor: 1.6, sex: 'M' as const, sterilized: false, ageYears: 3, bcs: 6 };
const S = ['bone_meal', 'qdiet', 'omegor_vitality', 'psyllium_erbavoglio_husk_bio'];
const base = ['oat_dry', 'carrot_cooked', 'coconut_oil', 'flaxseed_oil'];
await run('Ker, tre macinati, preferenze default (stato attuale)', KER, ['beef_03', 'beef_05', 'beef_10', ...base], S, 'default');
await run('Ker, un solo macinato (5%), preferenze default', KER, ['beef_05', ...base], S, 'default');
await run('Ker, un solo macinato (5%), senza preferenze macro/fibra', KER, ['beef_05', ...base], S, 'none');
await run('Ker, un solo macinato (10%), senza preferenze macro/fibra', KER, ['beef_10', ...base], S, 'none');
await run('Garmr 2700 kcal, macinato 5%, preferenze default', GARMR, ['beef_05', 'oat_dry', 'carrot_cooked', 'flaxseed_oil'], ['bone_meal', 'qdiet', 'omegor_vitality'], 'default');
await run('Garmr 2700 kcal, macinato 5%, senza preferenze', GARMR, ['beef_05', 'oat_dry', 'carrot_cooked', 'flaxseed_oil'], ['bone_meal', 'qdiet', 'omegor_vitality'], 'none');
