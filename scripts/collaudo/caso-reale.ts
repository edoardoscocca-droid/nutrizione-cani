// Caso reale (20/10/2026): 6 alimenti reali + QDiet + Omegor + farina d'ossa, cane 33 kg (ideale 31), 1.800 kcal.
// Due scenari separati: preferenze salvate nella ricetta di prova del 19/10 e nuovi default; nessuna sovrascrittura.
// Usa COPIE in memoria dei prodotti reali (autorizzate solo qui per il calcolo): il catalogo non viene modificato.
// Uso: npx tsx scripts/collaudo/caso-reale.ts > docs/CASO_REALE_2026-10-20.md
import { LocalRepository } from '../../src/data/localRepository';
import { applyPreset, presetFor } from '../../src/data/formulationPresets';
import type { Dog } from '../../src/data/model';
import { buildInput, type Selection } from '../../src/data/recipeService';
import type { CheckRow } from '../../src/engine/audit';
import { newDog } from '../../src/engine/dogProfile';
import { DIAGNOSIS_LABEL, diagnosisOf, formulate, inspectModel } from '../../src/engine/formulate';
import { DEFAULT_SETTINGS, type Food, type Supplement } from '../../src/engine/types';

const cat = await new LocalRepository(null).loadCatalog();
const SUPPS = ['qdiet', 'omegor_vitality', 'bone_meal'];
const FOODS = ['beef_03', 'beef_15', 'beef_30', 'oat_dry', 'carrot_cooked', 'pumpkin_cooked'];
const copy = { ...cat, supplements: cat.supplements.map((s) => (SUPPS.includes(s.id) ? { ...s, usableForOptimization: true } : s)) };
const sel: Selection = { foods: FOODS.map((id) => ({ id })), supplements: SUPPS.map((id) => ({ id })), dietMoisture: null, proteinDigestibility: null };
const fmt = (n: number | null | undefined, d = 3) => (n === null || n === undefined ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: d }));

const base = newDog({ name: 'Cane di prova', weightCurrentKg: 33, weightIdealKg: 31, kcalTarget: 1800, kcalSource: 'user', activityFactor: 2, sex: 'F', sterilized: false, ageYears: 5, bcs: 5 }, 'reale');
// A: preferenze salvate nella ricetta di prova del 19/10 (inserite manualmente dall'utente), invariate
const saved: Dog = {
  ...base,
  macroPreferences: [
    { metric: 'protein_energy_pct', lower: 60, upper: 85, locked: false },
    { metric: 'fat_energy_pct', lower: 10, upper: 15, locked: false },
    { metric: 'carb_energy_pct', lower: 15, upper: 30, locked: false },
  ],
  fiberTarget: { lower: 1, upper: 10, basis: 'per_day' },
};
// B: nuovi default dell'adulto sano (preferenze iniziali del progetto)
const defaults = applyPreset(base, presetFor('adult_maintenance')!);

const out: string[] = [];
// coefficienti per componente sommati (una riga di rapporto contiene i termini di Ca e quelli di −k·P)
const netTerms = (row: { terms: { item: string; coef: number }[] }) => {
  const m = new Map<string, number>();
  for (const t of row.terms) m.set(t.item, (m.get(t.item) ?? 0) + t.coef);
  return [...m];
};
const unitOf = (label: string) =>
  /energia macro/.test(label) ? 'kcal' : /calcio\/fosforo/i.test(label) ? 'g di calcio/die' : /Fibra/.test(label) ? 'g/die' : /Dose massima|non oltre/.test(label) ? 'g di prodotto' : (/ (\S+)\/1000 kcal/.exec(label)?.[1] ?? '') + (/\/1000 kcal/.test(label) ? '/die' : '');
const p = (s = '') => out.push(s);

p('# Caso reale — formulazione del 20/10/2026');
p();
p('Generato con `npx tsx scripts/collaudo/caso-reale.ts` sul motore `motore-2.0.0`. Prodotti reali usati come **copie in memoria**: gli integratori');
p('sono autorizzati solo per questa prova (nel catalogo restano non attivi); nessun prodotto, ricetta o preferenza salvata è stato modificato.');
p();
p('## Cane e impostazioni');
p();
p('Femmina, 5 anni, non sterilizzata; peso **attuale 33 kg** (tabella d’impiego QDiet ed EPA+DHA), ideale 31 kg; BCS 5/9; obiettivo **1.800 kcal/die** impostato manualmente.');
p('Dieta casalinga (selenio: riferimento più alto, 67,5 µg/1000 kcal). Digeribilità proteica della dieta **non documentata** → minimi degli aminoacidi essenziali +10%.');
p('EPA+DHA: apporto raccomandato 30 × 33^0,75 = 413,05 mg/die (vincolo necessario).');
p();
p('## Prodotti e versioni');
p();
p('| id | Prodotto | Versione profilo | Stato / preparazione | Energia | Qualità dati |');
p('|---|---|---:|---|---|---|');
for (const id of FOODS) {
  const f = copy.foods.find((x) => x.id === id) as Food;
  p(`| ${f.id} | ${f.name} | v${f.profileVersion} | ${f.processingState}${f.preparation ? ` — ${f.preparation}` : ''} | ${fmt(f.kcalMePer100g, 1)} kcal/100 g (${f.kcalMeOrigin === 'calculated' ? `calcolata: ${f.energyMethod?.label ?? '?'}` : 'inserita'}) | ${f.dataStatus} |`);
}
for (const id of SUPPS) {
  const s = copy.supplements.find((x) => x.id === id) as Supplement;
  p(`| ${s.id} | ${s.name} | v${s.profileVersion} | dose in ${s.doseUnit}${s.massPerUnitG ? `, contenuto ${s.massPerUnitG} g/unità` : ', contenuto per unità non indicato'} | ${s.kcalPerUnit === null ? 'sconosciuta' : `${fmt(s.kcalPerUnit)} kcal/${s.doseUnit}`} | ${s.status}${s.labelAddedOnly ? ', etichetta con additivi' : ''} |`);
}
p();
p('Dichiarazioni total/added di QDiet nei dati caricati: ' + ['calcium', 'phosphorus', 'protein', 'vitamin_a', 'vitamin_d', 'zinc', 'choline'].map((k) => `${k} = ${copy.supplements.find((s) => s.id === 'qdiet')!.nutrients[k]?.declared ?? 'non marcato'}`).join('; ') + '.');
p('Nel file consegnato calcio e fosforo sono «reported_or_estimated» con stato ANALYTICAL_DECLARED (non «total»): il motore li tratta come componenti analitici dichiarati; solo i valori marcati «added» sono limiti inferiori.');
p();

const problemRows = (rows: CheckRow[]) => rows.flatMap((r) => r.checks.filter((c) => c.color !== 'green' && c.color !== 'blue').map((c) => ({ r, c })));

for (const [title, dog] of [['A — preferenze salvate nella ricetta di prova (19/10)', saved], ['B — nuovi default dell’adulto sano', defaults]] as const) {
  const input = buildInput(dog, sel, copy, DEFAULT_SETTINGS, []);
  const t0 = performance.now();
  const r = await formulate(input);
  const ms = performance.now() - t0;
  const a = r.audit;
  p(`## Scenario ${title}`);
  p();
  p('Preferenze effettive passate al calcolo (prima ricerca → seconda ricerca con gli ampliamenti documentati):');
  p();
  const m = inspectModel(input);
  const pref = input.dog.targets.filter((t) => ['protein_energy_pct', 'fat_energy_pct', 'carb_energy_pct', 'fiber'].includes(t.metric));
  for (const t of pref) {
    const w = m.widened.filter((x) => x.label.startsWith(t.metric === 'fiber' ? 'Fibra' : t.metric === 'protein_energy_pct' ? 'Quota energia da proteine' : t.metric === 'fat_energy_pct' ? 'Quota energia da grassi' : 'Quota energia da carboidrati'));
    p(`- ${t.metric}: ${fmt(t.lower)}–${fmt(t.upper)} ${t.basis === 'energy_pct' ? '% energia macro (4/9/4)' : t.basis === 'per_day' ? 'g/die' : 'g/1000 kcal'} → ${w.map((x) => x.label.replace(/^.*?: /, '')).join('; ') || 'nessun ampliamento'}`);
  }
  const caP = m.widened.filter((x) => /calcio\/fosforo/i.test(x.label));
  p(`- Rapporto Ca:P (preferenza 1,2–1,4) → ${caP.map((x) => x.label.replace(/^.*?: /, '')).join('; ')}; vincolo necessario 1–2. Coefficienti netti passati al solver per il minimo ampliato (riga «Ca − 1,1·P ≥ 0», g per passo): ${netTerms(caP.find((x) => x.op === '>=')!).map(([item, c]) => `${item} ${fmt(c, 6)}`).join('; ')}.`);
  const caMinOrig = m.rows.filter((x) => /calcio\/fosforo: minimo/i.test(x.label)).map((x) => `${x.label.split(' (')[0]} → ${fmt(netTerms(x).find(([i]) => i.startsWith('Q.Diet'))?.[1], 6)} per QDiet`);
  p(`  Righe originarie del rapporto (prima ricerca e vincolo necessario): ${caMinOrig.join('; ')}.`);
  p();
  p(`**Esito: ${DIAGNOSIS_LABEL[diagnosisOf(r)]}** (\`${r.outcome}\`, ${fmt(ms / 1000, 2)} s, ricerca P1: ${r.stats?.p1Stage ?? 'nessuna riuscita'}).`);
  p();
  if (r.items.length) {
    p(`Quantità ${r.outcome === 'solved' ? 'proposte' : 'diagnostiche (vincoli necessari rispettati; non è un menù)'}:`);
    p();
    p('| Componente | Quantità |');
    p('|---|---:|');
    for (const it of r.items) {
      const name = it.kind === 'food' ? copy.foods.find((f) => f.id === it.id)!.name : copy.supplements.find((s) => s.id === it.id)!.name;
      const unit = it.kind === 'food' ? 'g' : copy.supplements.find((s) => s.id === it.id)!.doseUnit;
      p(`| ${name} | ${fmt(it.qty, 1)} ${unit} |`);
    }
    p();
  }
  if (a) {
    p(`Energia: ${fmt(a.totals.energy.known, 1)} kcal${a.kcalComplete && !a.dataQuality?.unknownEnergy.length ? '' : ' (totale parziale: energia sconosciuta per ' + (a.dataQuality?.unknownEnergy.join(', ') || '—') + ')'} su 1.800 kcal (tolleranza ±2%: 1.764–1.836).`);
    const d = a.totals.derived;
    p(`Ripartizione energetica stimata 4/9/4: proteine ${fmt(d.protein_energy_pct?.value, 1)}%, grassi ${fmt(d.fat_energy_pct?.value, 1)}%, carboidrati disponibili ${fmt(d.carb_energy_pct?.value, 1)}%; fibra ${fmt(a.totals.nutrients.fiber.known, 1)} g/die (${fmt((a.totals.nutrients.fiber.known / Math.max(a.totals.energy.known, 1)) * 1000, 1)} g/1000 kcal); Ca:P con i soli valori noti ${fmt(d.ca_p_ratio?.value, 3)}; EPA+DHA ${fmt(a.totals.nutrients.epa_dha.known * 1000, 0)} mg/die.`);
    p();
    p('### Vincoli problematici nella soluzione mostrata');
    p();
    p('| Nutriente | Controllo | Esito | Dettaglio (soglia, apporto, scostamento o motivo) |');
    p('|---|---|---|---|');
    for (const { r: row, c } of problemRows(a.rows)) {
      p(`| ${row.label} | ${c.limit.limitClass} ${c.limit.lower !== null ? `min ${fmt(c.limit.lower)}` : ''}${c.limit.upper !== null ? ` max ${fmt(c.limit.upper)}` : ''} ${c.limit.basis} | ${c.color === 'grey' ? 'non verificabile' : c.color === 'orange' ? 'preferenza non rispettata' : 'non rispettato'} | ${c.message.replace(/\|/g, '/')} |`);
    }
    if (a.energyRow.color !== 'green') p(`| Energia | ±2% | ${a.energyRow.color === 'grey' ? 'non verificabile' : 'fuori tolleranza'} | ${a.energyRow.note} |`);
    p();
  }
  if (r.items.length) {
    // vincoli necessari saturi nella soluzione mostrata (attività della riga del modello = limite)
    const qty = new Map(r.items.map((it) => [it.id, it.qty]));
    const tight = m.rows.filter((row) => (row.hard || row.label.includes('dati parziali')) && row.terms.length).flatMap((row) => {
      const parts = row.terms.map((t) => (t.coef * (qty.get(t.id) ?? 0)) / t.step);
      const act = parts.reduce((x, y) => x + y, 0);
      const size = Math.max(parts.reduce((x, y) => x + Math.abs(y), 0), Math.abs(row.rhs), 1e-9);
      return Math.abs(act - row.rhs) <= 0.003 * size ? [row.label.replace(' — dati parziali', ' (coperto con i dati noti)')] : [];
    });
    const atMax = m.items.filter((it) => it.ub.length && r.items.some((x) => (copy.foods.find((f) => f.id === x.id)?.name ?? copy.supplements.find((s) => s.id === x.id)?.name) === it.name && x.qty >= Math.min(...it.ub) - 1e-6));
    p('### Vincoli necessari al limite nella soluzione mostrata');
    p();
    for (const t of [...new Set(tight)]) p(`- ${t}`);
    for (const it of atMax) p(`- ${it.name}: al massimo consentito (${fmt(Math.min(...it.ub))})`);
    p();
  }
  if (r.conflicts.length) {
    p('### Incompatibilità matematiche (diagnosi del modello)');
    p();
    p(r.outcome === 'preferences_unreachable'
      ? 'Violazione minima necessaria se le preferenze **ampliate** fossero vincoli, insieme ai vincoli necessari (scarto nell’unità della riga del modello; per le quote, kcal di «Ep − quota·(Ep+Ef+Ec)», circa 18 kcal per punto percentuale su 1.800 kcal):'
      : 'Violazione minima necessaria dei vincoli:');
    p();
    for (const c of r.conflicts) p(`- ${c.label}${c.shortfall > 0 ? ` — scarto minimo ${fmt(c.shortfall, 3)} ${unitOf(c.label)}` : ''}`);
    p();
  }
  if (a?.softGaps?.length) {
    p('### Preferenze iniziali non raggiunte: cosa le impedisce (una alla volta)');
    p();
    for (const g of a.softGaps) p(`- ${g.label}: ${g.unreachable ? 'non raggiungibile con questi ingredienti in nessuna quantità' : g.blockedBy.length ? `impedita da ${g.blockedBy.join('; ')}` : 'raggiungibile da sola: il conflitto nasce solo insieme alle altre preferenze o vincoli'}`);
    p();
  }
  if (a) {
    p('### Dati mancanti (separati dalle incompatibilità)');
    p();
    const missing = new Map<string, Set<string>>();
    for (const row of a.rows) {
      for (const n of [...row.missingFrom, ...row.undeclaredFrom]) (missing.get(n) ?? missing.set(n, new Set()).get(n)!).add(row.label);
    }
    for (const [n, labels] of missing) p(`- ${n}: ${[...labels].join(', ')}`);
    const lower = [...new Set(a.rows.flatMap((row) => (a.totals.nutrients[row.metric]?.lowerBoundFrom ?? []).map((x) => `${x}: ${row.label}`)))];
    if (lower.length) p(`- Valori solo «aggiunti» (limite inferiore, totale incerto): ${lower.join('; ')}`);
    if (a.dataQuality?.unknownEnergy.length) p(`- Energia sconosciuta: ${a.dataQuality.unknownEnergy.join(', ')}`);
    const gaps = a.blockers.filter((b) => b.startsWith('Lacuna'));
    for (const g of gaps) p(`- ${g}`);
    p();
  }
}
p('## Motivo preciso della mancata formulazione');
p();
p('Le due prove danno lo stesso esito: **preferenze non raggiungibili**, non «vincoli necessari incompatibili»: esiste sempre una soluzione che rispetta tutti i vincoli necessari');
p('(livello H) e i dati mancanti sono elencati a parte. Le cause sono diverse.');
p();
p('**Vincolo comune che guida entrambi gli esiti: vitamina D minima (livello H).** Minimo 159 UI/1000 kcal su 1.800 kcal = 286,2 UI/die.');
p('Con i dati noti la vitamina D viene solo da QDiet (25 UI/g, dichiarata «added», quindi limite inferiore) e dal manzo (4 UI/100 g, tutti e tre i tagli);');
p('avena e carota hanno 0, zucca, Omegor e farina d’ossa sono sconosciuti e non vengono contati. Con QDiet al massimo (9,9 g → 247,5 UI) mancano 38,7 UI:');
p('servono quindi **almeno ~968 g di manzo** al giorno (nelle due soluzioni: 1.037 g e 968 g). Il minimo è dimostrato con i dati noti, quindi resta un vincolo necessario.');
p();
p('**Scenario A (preferenze salvate 19/10): incompatibilità matematica.** Oltre alla vitamina D sono saturi il fosforo massimo FEDIAF (4 g/1000 kcal), Ca:P ≥ 1,');
p('il rame minimo e la dose massima di QDiet. Il calcio può venire quasi solo da QDiet (coefficiente netto nella riga Ca − 1,1·P: +0,01085 per 0,1 g) e dalla farina d’ossa');
p('(+0,00313 per 0,1 g: porta quasi altrettanto fosforo). Con ~1 kg di manzo il fosforo «libero» è quasi esaurito: l’avena (−0,00399 per g) non può fornire i carboidrati,');
p('le verdure sono limitate dalla fibra (10 g/die, 12 ampliata) e anche il manzo 3% ha il 23,5% dell’energia dai grassi. Risultato: grassi ≤ 20% e proteine ≥ 55% non stanno insieme.');
p('Violazione minima con le preferenze ampliate (vedi sopra): Ca:P 1,1, quota proteica, quota grassi e dose massima di QDiet.');
p();
p('**Scenario B (nuovi default): incompatibilità matematica più piccola.** Con le stesse ~968 g di manzo, i carboidrati ≥ 15% (ampliato) richiedono verdure');
p('(limitate dalla fibra, al massimo 15 g/1000 kcal → 18 ampliata) o avena (troppo fosforo per Ca:P e fosforo massimo). La diagnosi indica vitamina D e dose massima di QDiet');
p('come vincoli necessari in conflitto con le preferenze ampliate (scarto minimo 3,4 UI/die di vitamina D).');
p();
p('**Peso dei dati mancanti.** Gli esiti non derivano da valori sconosciuti trattati come zero (nessuno lo è): derivano dal fatto che la vitamina D è dimostrabile solo con QDiet e manzo.');
p('Un valore documentato di vitamina D per zucca, farina d’ossa e Omegor, o un totale analitico di QDiet superiore al solo «added», può cambiare l’esito; senza dati non si assume nulla.');
p();
p('**Cosa chiudere nei dati (per l’IA che prepara i dati)**, senza trasformare gli sconosciuti in zero:');
p('- QDiet: nel file calcio e fosforo sono «reported_or_estimated»/ANALYTICAL_DECLARED; se sono valori totali da analisi, marcarli esplicitamente «total». Per A, D, rame, iodio, zinco e gli altri additivi indicare se esiste un totale analitico.');
p('- Omegor Vitality 1000: valori documentati (anche zero) di calcio, fosforo, fibra, proteine, carboidrati; massa del contenuto della capsula; energia per capsula.');
p('- Farina d’ossa: confermare la confezione reale (Ca 22,6%, P 17,7% trascritti) ed energia.');
p('- Alimenti: iodio, cloruro, vitamina A (attività per il cane), acido linoleico 18:2 n-6 da fonti compatibili.');
p('- Avena: confermare la pesata da secca e la preparazione; l’energia attuale è calcolata 4/9/4 sui fiocchi secchi.');
console.log(out.join('\n'));
