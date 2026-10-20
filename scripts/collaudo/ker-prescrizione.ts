// Verifica della prescrizione veterinaria di Ker (menù 1, visita del 01/10/2025) a QUANTITÀ BLOCCATE, con l'analisi dell'app
// (auditRecipe, la stessa di una ricetta modificata a mano). Nessun generatore, nessun salvataggio: catalogo in COPIA in memoria,
// caricato con il normale importatore (strict) dai file del pacchetto «Verifica_menu_Ker_2026-10-20».
// Uso: npx tsx scripts/collaudo/ker-prescrizione.ts <cartella del pacchetto> > docs/VERIFICA_KER_2026-10-20.md
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseImport, planImport, type ImportKind } from '../../src/data/catalogImport';
import { LocalRepository } from '../../src/data/localRepository';
import type { Dog } from '../../src/data/model';
import { withCatalogGaps } from '../../src/data/packageCatalog';
import { buildInput, type Selection } from '../../src/data/recipeService';
import { applyPreset, presetFor } from '../../src/data/formulationPresets';
import { auditRecipe, type CheckRow } from '../../src/engine/audit';
import { newDog } from '../../src/engine/dogProfile';
import { applyEnergyMethods } from '../../src/engine/energy';
import { DEFAULT_SETTINGS, type Food, type RecipeItem, type Supplement } from '../../src/engine/types';
import { toCanonical } from '../../src/engine/units';

const dir = process.argv[2];
if (!dir) throw new Error('Indicare la cartella del pacchetto');
const FILES: [string, ImportKind][] = [
  ['alimenti_esistenti_aggiornati.json', 'foods'],
  ['alimenti_nuovi_confronto.json', 'foods'],
  ['psillio_confronto.json', 'supplements'],
  ['integratori_riferimento_19ott.json', 'supplements'],
];
const fmt = (n: number | null | undefined, d = 4) => (n === null || n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: d }));
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

// catalogo: copia della modalità prova + importazioni del pacchetto (stesso importatore della scheda Catalogo → Importa)
const base = await new LocalRepository(null).loadCatalog();
let foods = [...base.foods];
let supplements = [...base.supplements];
const importLog: string[] = [];
const catalogChanges: string[] = [];
for (const [f, kind] of FILES) {
  const path = resolve(dir, f);
  const text = readFileSync(path, 'utf8');
  const parsed = parseImport(text, kind, base.nutrients, { mode: 'strict' });
  const plan = planImport(parsed, { ...base, foods, supplements }, f);
  const errs = parsed.errors.length + plan.errors.length + plan.items.reduce((a, i) => a + i.errors.length, 0);
  importLog.push(`\`${f}\` (sha256 ${sha(text).slice(0, 16)}…): ${parsed.format}/${parsed.mode}, ${plan.summary.create} nuovi, ${plan.summary.update} aggiornati, ${plan.summary.values} valori, errori ${errs}, conversioni in sospeso ${plan.items.reduce((a, i) => a + i.pendingConversions.length, 0)}`);
  if (!plan.canApply) throw new Error(`Importazione non applicabile: ${f}`);
  // per i prodotti già in catalogo: valori che l'importazione cambierebbe (prima → dopo, valori canonici)
  for (const it of plan.items.filter((i) => i.action === 'update')) {
    const ch = it.valueChanges.filter((v) => !(v.before === v.after || (v.before !== null && v.after !== null && Math.abs(v.before - v.after) <= 1e-6 * Math.max(Math.abs(v.before), 1e-12))));
    const fields = it.fieldChanges.filter((c) => ['processingState', 'kcalMePer100g', 'massPerUnitG', 'kcalPerUnit', 'name'].includes(c.field));
    if (ch.length || fields.length)
      catalogChanges.push(
        `| ${it.id} | ${[...fields.map((c) => `${c.field}: ${fmt(c.before as number)} → ${fmt(c.after as number)}`), ...ch.map((v) => `${v.label}: ${fmt(v.before)} → ${fmt(v.after)} ${v.unit}`)].join('; ')} |`,
      );
  }
  const next = plan.items.filter((i) => i.action !== 'unchanged').map((i) => i.next);
  const merge = <T extends { id: string }>(list: T[], add: T[]) => [...list.filter((x) => !add.some((a) => a.id === x.id)), ...add];
  if (kind === 'foods') foods = merge(foods, next as Food[]);
  else supplements = merge(supplements, next as Supplement[]);
}
const cat = withCatalogGaps(applyEnergyMethods({ ...base, foods, supplements }));
const caseFile = JSON.parse(readFileSync(resolve(dir, 'caso_prescritto_non_importare_come_catalogo.json'), 'utf8'));
const expected = JSON.parse(readFileSync(resolve(dir, 'risultati_dettagliati.json'), 'utf8')) as Expected[];
interface Expected {
  scenario: string;
  energy_model_partial_kcal: number;
  energy_unknown_sources: string[];
  known_totals: Record<string, number>;
  macro_shares_partial_4_9_4: Record<string, number>;
  cap_known_ratio: number;
  controls: { nutrient: string; unit: string; known_daily: number; min95_1340: number; result95: string; max_result?: string }[];
}

// Ker alla visita del 01/10/2025 (dalla prescrizione): 30,2 kg, riferimento 27,2 kg, BCS 6/9, 6 anni, 1.340 kcal scritte dalla veterinaria
const p = caseFile.patient_at_prescription;
const ker: Dog = applyPreset(
  newDog({ name: 'Ker (prescrizione 01/10/2025)', weightCurrentKg: p.weight_current_kg, weightIdealKg: p.weight_reference_kg, kcalTarget: caseFile.target_prescribed_kcal, kcalSource: 'user', activityFactor: 1.6, sex: 'F', sterilized: false, ageYears: p.age_years, bcs: p.bcs_9 }, 'ker'),
  presetFor('adult_maintenance')!,
);

const out: string[] = [];
const o = (s = '') => out.push(s);
const nutLabel = new Map(cat.nutrients.map((n) => [n.id, n]));

o('# Verifica della prescrizione di Ker nel motore dell’app — 20/10/2026');
o();
o('Analisi a **quantità bloccate** (la stessa analisi di una ricetta modificata a mano: `auditRecipe`), **non** il generatore e non il collaudo da 1.800 kcal.');
o('Catalogo in copia in memoria; nessuna modifica a catalogo, database, ricette o prescrizione; nessun prodotto marcato come convalidato.');
o(`Generato con \`npx tsx scripts/collaudo/ker-prescrizione.ts <pacchetto>\`. Fonte della prescrizione: ${caseFile.source_document.filename}, pagina ${caseFile.source_document.page}, sha256 ${caseFile.source_document.sha256.slice(0, 16)}… (il PDF non è nel pacchetto).`);
o();
o('## Importazione (importatore normale, schema definitivo JSON, modalità strict)');
o();
for (const l of importLog) o(`- ${l}`);
o('- `non_importare_automaticamente/qdiet_b5_condizionale.json`: **non importato** (stima condizionale, come indicato).');
o();
o(`Cane: femmina, ${p.age_years} anni, ${p.weight_current_kg} kg (riferimento ${p.weight_reference_kg} kg), BCS ${p.bcs_9}/9; richiesta energetica scritta **${caseFile.target_prescribed_kcal} kcal/die**.`);
o('Limiti applicati: FEDIAF 2025 tab. III-3b, adulto **95 kcal/kg^0,75** (l’app non contiene la colonna 110: i confronti «110» del pacchetto non sono riproducibili nel motore). Minimi per 1000 kcal su max(1.340, energia calcolata).');
o('Digeribilità proteica della dieta non documentata → minimi degli aminoacidi essenziali +10% (come nel pacchetto). Preferenze: quelle iniziali dell’adulto sano (solo per mostrare gli scostamenti, nessun effetto sulle quantità).');
o();

const ids = (sc: string) => {
  const [beef, veg] = [sc.slice(0, 7), sc.slice(8)];
  return { beef, veg };
};
const summary: string[] = [];
for (const exp of expected) {
  const { beef, veg } = ids(exp.scenario);
  const items: RecipeItem[] = caseFile.fixed_quantities.map((q: { id: string; quantity: number }) => {
    const id = q.id === 'beef_05' ? beef : q.id === 'carrot_cooked' ? veg : q.id;
    const kind = cat.foods.some((f) => f.id === id) ? 'food' : 'supplement';
    return { kind, id, qty: q.quantity };
  });
  const sel: Selection = {
    foods: items.filter((i) => i.kind === 'food').map((i) => ({ id: i.id })),
    supplements: items.filter((i) => i.kind === 'supplement').map((i) => ({ id: i.id })),
    dietMoisture: null,
    proteinDigestibility: null,
  };
  const input = buildInput(ker, sel, cat, DEFAULT_SETTINGS, []);
  const a = auditRecipe({
    items,
    foods: Object.fromEntries(input.foods.map(({ food }) => [food.id, food])),
    supplements: Object.fromEntries(input.supplements.map(({ supplement }) => [supplement.id, supplement])),
    nutrients: input.nutrients,
    limits: input.limits,
    dog: input.dog,
    dietMoisture: input.dietMoisture,
    settings: input.settings,
  });
  const main = exp.scenario === 'beef_05_carrot_cooked';
  o(`## Scenario ${exp.scenario}${main ? ' (confronto numerico principale)' : ' (sensibilità)'}`);
  o();
  o('Quantità bloccate: ' + items.map((i) => `${(cat.foods.find((f) => f.id === i.id) ?? cat.supplements.find((s) => s.id === i.id))!.name} ${fmt(i.qty)} ${i.kind === 'food' ? 'g' : (cat.supplements.find((s) => s.id === i.id)!.doseUnit)}`).join('; ') + '.');
  o();
  o(`**Stato dell’analisi: ${a.statusLabel}** — vincoli sui contributi noti; verifica nutrizionale ${a.status === 'INSUFFICIENT_DATA' || a.summary?.unverifiable.length ? 'incompleta' : 'completa'}.`);
  o();
  // apporti: app contro pacchetto, valori canonici (unità diverse ma equivalenti convertite)
  const diffs: string[] = [];
  const rows: string[] = [];
  const eKnown = a.totals.energy.known;
  const dE = eKnown - exp.energy_model_partial_kcal;
  rows.push(`| Energia parziale del modello (kcal) | ${fmt(exp.energy_model_partial_kcal, 3)} | ${fmt(eKnown, 3)} | ${fmt(dE, 3)} | sconosciuta: ${a.dataQuality?.unknownEnergy.join(', ') || '—'} |`);
  if (Math.abs(dE) > 0.01) diffs.push(`energia ${fmt(dE, 3)} kcal`);
  for (const [n, v] of Object.entries(exp.known_totals)) {
    const t = a.totals.nutrients[n];
    const nut = nutLabel.get(n);
    if (!nut) {
      rows.push(`| ${n} | ${fmt(v)} | — | — | nutriente non nel dizionario dell’app |`);
      continue;
    }
    const unitExp = exp.controls.find((c) => c.nutrient === n)?.unit ?? nut.unit;
    // il pacchetto scrive «g» per lo iodio con valori in mg (0,585 = mg; minimo 0,402 = 0,3 mg × 1,34): si confronta in mg
    const expCanon = n === 'iodine' ? v : (() => { try { return toCanonical(v, unitExp, nut.unit).value; } catch { return v; } })();
    const appV = t?.known ?? null;
    const d = appV === null ? null : appV - expCanon;
    const rel = appV === null ? null : Math.abs(d!) / Math.max(Math.abs(expCanon), 1e-9);
    const note = [t?.missingFrom.length ? `mancante in ${t.missingFrom.join(', ')}` : '', t?.undeclaredFrom.length ? `non dichiarato da ${t.undeclaredFrom.join(', ')}` : '', t?.lowerBoundFrom.length ? `solo «added»: ${t.lowerBoundFrom.join(', ')}` : ''].filter(Boolean).join('; ');
    const ok = rel !== null && (rel <= 1e-4 || Math.abs(d!) <= 1e-6);
    if (!ok) diffs.push(`${nut.label} ${fmt(d)} ${nut.unit}`);
    rows.push(`| ${ok ? '' : '**'}${nut.label} (${nut.unit})${ok ? '' : '**'} | ${fmt(expCanon)} | ${fmt(appV)} | ${fmt(d)} | ${note || '—'} |`);
  }
  o('### Apporti noti giornalieri: pacchetto contro app');
  o();
  o('| Grandezza | Pacchetto | App | Differenza | Dati sconosciuti o parziali (app) |');
  o('|---|---:|---:|---:|---|');
  for (const r of rows) o(r);
  o();
  const d = a.totals.derived;
  o(`Rapporto Ca/P sui valori noti: pacchetto ${fmt(exp.cap_known_ratio, 8)}, app ${fmt(a.totals.nutrients.calcium.known / a.totals.nutrients.phosphorus.known, 8)}; giudizio dell’app sul rapporto: ${d.ca_p_ratio?.complete === false ? `non verificabile (${d.ca_p_ratio?.reason ?? ''})` : 'verificabile'}.`);
  o(`Quote 4/9/4 parziali: pacchetto P ${fmt(exp.macro_shares_partial_4_9_4.protein, 2)}% · G ${fmt(exp.macro_shares_partial_4_9_4.fat, 2)}% · C ${fmt(exp.macro_shares_partial_4_9_4.carbohydrate_available, 2)}%; app P ${fmt(d.protein_energy_pct?.value, 2)}% · G ${fmt(d.fat_energy_pct?.value, 2)}% · C ${fmt(d.carb_energy_pct?.value, 2)}%${d.protein_energy_pct?.range ? ` (intervalli possibili dell’app: P ${fmt(d.protein_energy_pct.range[0], 2)}–${fmt(d.protein_energy_pct.range[1], 2)}, G ${fmt(d.fat_energy_pct?.range?.[0], 2)}–${fmt(d.fat_energy_pct?.range?.[1], 2)}, C ${fmt(d.carb_energy_pct?.range?.[0], 2)}–${fmt(d.carb_energy_pct?.range?.[1], 2)})` : ''}.`);
  o();
  // esiti dei minimi FEDIAF 95: pacchetto contro app
  const mins: string[] = [];
  let minDiff = 0;
  for (const c of exp.controls) {
    const row = a.rows.find((r: CheckRow) => r.metric === c.nutrient);
    const chk = row?.checks.find((k) => k.limit.lower !== null && k.limit.limitClass === 'OFFICIAL_MIN');
    const appRes = !chk ? 'nessun minimo nell’app' : chk.color === 'green' ? 'minimo coperto dal contributo noto' : chk.color === 'grey' ? 'copertura non verificabile' : chk.color === 'red' ? 'non rispettato' : chk.color;
    const same = appRes === c.result95;
    if (!same) minDiff++;
    const reqApp = chk?.dailyReference ?? null;
    const reqExp = c.nutrient === 'iodine' ? c.min95_1340 : (() => { try { return toCanonical(c.min95_1340, c.unit, row?.unit ?? c.unit).value; } catch { return c.min95_1340; } })();
    mins.push(`| ${same ? '' : '**'}${row?.label ?? c.nutrient}${same ? '' : '**'} | ${fmt(reqExp)} | ${fmt(reqApp)} | ${c.result95} | ${appRes}${chk && chk.color !== 'green' ? ` — ${chk.message.replace(/\|/g, '/').slice(0, 160)}` : ''} |`);
  }
  o('### Minimi FEDIAF 95 sulla richiesta di 1.340 kcal');
  o();
  o(`Esiti coincidenti: ${exp.controls.length - minDiff} su ${exp.controls.length}.`);
  o();
  o('| Nutriente | Minimo pacchetto | Minimo app | Esito pacchetto | Esito app |');
  o('|---|---:|---:|---|---|');
  for (const m of mins) o(m);
  o();
  // massimi, energia, dose QDiet, preferenze: come li mostra l'app
  const maxNV = a.rows.flatMap((r) => r.checks.filter((k) => k.limit.upper !== null && k.limit.limitClass !== 'PERSONAL_TARGET' && k.color === 'grey').map(() => r.label));
  const maxRed = a.rows.flatMap((r) => r.checks.filter((k) => k.limit.upper !== null && k.limit.limitClass !== 'PERSONAL_TARGET' && k.color === 'red').map((k) => `${r.label}: ${k.message}`));
  o(`Massimi non verificabili nell’app: ${[...new Set(maxNV)].join(', ') || 'nessuno'}. Massimi superati in modo dimostrato: ${maxRed.join('; ') || 'nessuno'}.`);
  o(`Energia rispetto a 1.340 kcal: ${a.energyRow.note} (controllo mostrato, non requisito per analizzare o conservare la prescrizione).`);
  for (const dc of a.doseChecks ?? []) o(`Tabella d’impiego — ${dc.name}: ${fmt(dc.qty)} ${dc.unit}; ${dc.message} (avviso; dose prescritta non modificata).`);
  const prefs = a.rows.flatMap((r) => r.checks.filter((k) => k.limit.limitClass === 'PERSONAL_TARGET' || k.limit.limitClass === 'NON_OFFICIAL_ATTENTION').filter((k) => k.color !== 'green').map((k) => `${r.label}: ${k.message.replace(/\|/g, '/').slice(0, 170)}`));
  o(`Preferenze e soglie non ufficiali non rispettate o non verificabili (non sono carenze): ${prefs.length ? '' : 'nessuna'}`);
  for (const x of prefs) o(`- ${x}`);
  const gaps = a.blockers.filter((b) => b.startsWith('Lacuna'));
  o(`Lacune del catalogo segnalate per questi prodotti: ${gaps.length}.`);
  o();
  summary.push(`| ${exp.scenario} | ${fmt(eKnown, 2)} | ${fmt(dE, 3)} | ${diffs.length ? diffs.join('; ') : 'nessuna'} | ${exp.controls.length - minDiff}/${exp.controls.length} | ${a.statusLabel} |`);
}
o('## Cosa cambierebbe nel catalogo importando questi file (non fatto)');
o();
o('Valori canonici dei prodotti già presenti, prima (catalogo attuale della prova = dati 16/10, o 19/10 per gli integratori già confrontati) → dopo:');
o();
o('| Prodotto | Cambiamenti |');
o('|---|---|');
for (const c of catalogChanges) o(c);
o();
o('## Riepilogo dei sei scenari');
o();
o('| Scenario | Energia app (kcal) | Δ energia | Differenze negli apporti noti (app − pacchetto) | Esiti dei minimi coincidenti | Stato dell’analisi |');
o('|---|---:|---:|---|---:|---|');
for (const s of summary) o(s);
console.log(out.join('\n'));
