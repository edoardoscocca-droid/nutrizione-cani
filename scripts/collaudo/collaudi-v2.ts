// Collaudi della specifica v2 del 21/10/2026: risultati concreti dei menù, di Ker e Garmr, dei casi limite.
// Uso: npx tsx scripts/collaudo/collaudi-v2.ts > docs/COLLAUDI_V2_2026-10-21.md
// Solo calcoli in memoria: nessuna ricetta, prescrizione o dato del catalogo viene salvato o modificato.
import { auditRecipeV2 } from '../../src/engine/auditV2';
import { requiredNutrients } from '../../src/engine/catalogStatus';
import { DEFAULT_CONFIG } from '../../src/engine/configV2';
import type { FormulationResult } from '../../src/engine/formulate';
import { formulateV2 } from '../../src/engine/formulateV2';
import type { RecipeItem } from '../../src/engine/types';
import { catalogV2, CONFLICT_SET, ENERGY_PROFILES, garmrDog, GARMR_FOODS, GARMR_SUPPS, KER_FOODS, KER_PRESCRIPTION, KER_SUPPS, kerDog, levelBIssues, menuInput, MENU_SETS, practical, realInput } from './casi-v2';

const cat = await catalogV2();
const out: string[] = [];
const p = (s = '') => out.push(s);
const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: d }));
const nameOf = (id: string) => (cat.foods.find((f) => f.id === id) ?? cat.supplements.find((s) => s.id === id))?.name ?? id;
const unitOf = (it: RecipeItem) => (it.kind === 'food' ? 'g' : cat.supplements.find((s) => s.id === it.id)!.doseUnit);
const itemsText = (items: RecipeItem[]) => items.filter((i) => i.qty > 0).map((i) => `${nameOf(i.id)} ${fmt(i.qty)} ${unitOf(i)}`).join('; ');

function block(title: string, r: FormulationResult) {
  const a = r.audit;
  p(`### ${title}`);
  p();
  p(`Esito \`${r.outcome}\` in ${fmt((r.stats?.durationMs ?? 0) / 1000, 2)} s · Ca:P gradino ${r.stats?.caPStep ?? '—'} · dose QDiet gradino ${r.stats?.doseStep ?? '—'}${a ? ` · stato: **${a.statusLabel}**` : ''}`);
  p();
  if (!a) {
    p(`Messaggio: ${r.message}`);
    for (const c of r.conflicts) p(`- vincolo: ${c.label}`);
    for (const s of r.suggestions) p(`- suggerimento: ${s}`);
    p();
    return;
  }
  p(`- Razione del giorno: ${itemsText(r.items)}`);
  p(`- Energia ${fmt(a.kcal, 0)} kcal su ${fmt(a.kcalTarget, 0)}; peso totale ${fmt(a.v2!.totalWeightG, 0)} g (${a.kcal && a.v2!.totalWeightG ? fmt((a.v2!.totalWeightG * 1000) / a.kcal, 0) : '—'} g per 1000 kcal)`);
  p(`- Gruppi: ${a.v2!.groups.map((g) => `${g.label} ${fmt(g.pct)}%`).join(' · ')}`);
  if (a.v2!.caps.length) p(`- Tetti: ${a.v2!.caps.map((c) => c.message).join(' ')}`);
  for (const d of a.doseChecks ?? []) p(`- Dose: ${d.message}`);
  const chk = practical(r);
  p(`- Pratico (criterio del §10 A): ${chk.ok ? 'sì' : `no — ${chk.reasons.join('; ')}`}`);
  const b = levelBIssues(a);
  p(`- Livello B non verde (consentito, elencato): ${b.length ? b.join(', ') : 'nessuno'}`);
  if (a.v2!.unknown.length) p(`- Sconosciuti: ${a.v2!.unknown.map((u) => u.split(':')[0]).join(', ')}`);
  for (const s of r.suggestions) p(`- Cosa servirebbe: ${s}`);
  p();
}

p('# Collaudi della specifica v2 — 21/10/2026');
p();
p('Generato con `npx tsx scripts/collaudo/collaudi-v2.ts`; gli stessi casi sono test automatici in `tests/spec-v2-2026-10-21.test.ts`. Configurazione: `dati/riferimenti/formulazione_v2.json` (valori [PROPOSTA]).');
p('Catalogo della modalità prova (dati reali importati fino al 21/10). **Dati [TEST] = fittizi**: agnello, pollo, merluzzo, sardine, patata, riso, olio vegetale e gli integratori di prova; zucca e carota sono i profili reali USDA. Nessun salvataggio.');
p();
p('## A. Menù positivi (900, 1.340, 2.700 kcal)');
p();
for (const pr of ENERGY_PROFILES) for (const set of MENU_SETS) block(`${set.id} ${set.label} — ${pr.kcal} kcal (${pr.weightKg} kg)`, await formulateV2(menuInput(cat, pr, set)));
block(`${CONFLICT_SET.id} ${CONFLICT_SET.label} — 1.340 kcal (in conflitto con i valori [PROPOSTA])`, await formulateV2(menuInput(cat, ENERGY_PROFILES[1], CONFLICT_SET)));
p('## B. Ker e Garmr (dati reali)');
p();
block('(4) Ker generato da zero, 1.340 kcal', await formulateV2(realInput(cat, kerDog(), KER_FOODS, KER_SUPPS, true)));
const garmr = await formulateV2(realInput(cat, garmrDog(), GARMR_FOODS, GARMR_SUPPS, true));
block('(5) Garmr generato da zero, 2.700 kcal, 72 kg', garmr);
const kIn = realInput(cat, kerDog(), KER_FOODS, KER_SUPPS);
const fixed = (inp: typeof kIn, items: RecipeItem[]) =>
  auditRecipeV2({ items, foods: Object.fromEntries(inp.foods.map((f) => [f.food.id, f.food])), supplements: Object.fromEntries(inp.supplements.map((s) => [s.supplement.id, s.supplement])), nutrients: inp.nutrients, limits: inp.limits, dog: inp.dog, dietMoisture: null, settings: inp.settings, config: DEFAULT_CONFIG });
const ka = fixed(kIn, KER_PRESCRIPTION);
p('### (6) Analisi della prescrizione di Ker a grammi fissi');
p();
p(`Ricetta: ${itemsText(KER_PRESCRIPTION)}. Stato: **${ka.statusLabel}**.`);
p();
p('Eccessivo o fuori dose:');
for (const e of ka.v2!.excess) p(`- ${e}`);
p();
p('Sotto riferimento:');
for (const e of ka.v2!.below) p(`- ${e}`);
p();
p(`Sconosciuti: ${ka.v2!.unknown.map((u) => u.split(':')[0]).join(', ')}.`);
p();
const gIn = realInput(cat, garmrDog(), GARMR_FOODS, GARMR_SUPPS);
const ga = fixed(gIn, garmr.items.map((i) => (i.id === 'qdiet' ? { ...i, qty: 20 } : i)));
p(`Garmr con QDiet 20 g (altre quantità = menù v2 qui sopra; la ricetta della veterinaria non è nei dati): ${ga.doseChecks!.find((d) => d.name.startsWith('Q.Diet'))!.message}`);
p();
p('## C. Casi limite');
p();
block('(7) Solo carota e zucca', await formulateV2(realInput(cat, kerDog(), ['carrot_cooked', 'pumpkin_cooked'], [])));
block('(8) Linoleico sconosciuto (manzo 10%, avena, carota, olio di lino, farina d’ossa, QDiet)', await formulateV2(realInput(cat, kerDog(), ['beef_10', 'oat_dry', 'carrot_cooked', 'flaxseed_oil'], ['bone_meal', 'qdiet'])));
p('(9) e (10): nei test automatici (umidità mancante con una premiscela di prova; zinco dai soli alimenti → «nessun limite FEDIAF applicabile»).');
p();
p('## Dati ancora mancanti nei prodotti reali usati (nutrienti richiesti senza valore)');
p();
for (const id of [...new Set([...KER_FOODS, ...GARMR_FOODS, 'pumpkin_cooked', ...KER_SUPPS])]) {
  const x = cat.foods.find((f) => f.id === id) ?? cat.supplements.find((s) => s.id === id)!;
  const has = (k: string) => x.nutrients[k]?.value !== null && x.nutrients[k]?.value !== undefined;
  const missing = requiredNutrients(cat.nutrients)
    .filter((n) => !has(n.id) && !(n.id === 'vitamin_a' && has('vitamin_a_retinol_ug')) && !(n.id === 'methionine_cystine' && has('methionine') && has('cystine')) && !(n.id === 'phenylalanine_tyrosine' && has('phenylalanine') && has('tyrosine')))
    .map((n) => n.label);
  p(`- **${x.name}** (\`${id}\`): ${missing.length ? missing.join(', ') : 'nessuno'}${'kcalPerUnit' in x && x.kcalPerUnit === null ? '; energia per dose' : ''}`);
}
console.log(out.join('\n'));
