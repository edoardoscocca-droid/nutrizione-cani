// Collaudo del GENERATORE sul caso di Ker (prescrizione del 01/10/2025, richiesta 1.340 kcal), 20/10/2026.
// Ingredienti pertinenti alla prescrizione, regole del generatore invariate (tabella d'impiego di QDiet come limite).
// Catalogo = modalità prova con il pacchetto del 20/10 (stessi file da importare in Supabase); i profili di confronto e i
// tre integratori sono resi utilizzabili SOLO nella copia in memoria. Nessuna ricetta o prescrizione viene salvata o modificata.
// Uso: npx tsx scripts/collaudo/ker-generatore.ts > docs/GENERATORE_KER_2026-10-20.md
import { applyPreset, presetFor } from '../../src/data/formulationPresets';
import { LocalRepository } from '../../src/data/localRepository';
import type { Dog } from '../../src/data/model';
import { buildInput, type Selection } from '../../src/data/recipeService';
import type { CheckRow } from '../../src/engine/audit';
import { newDog } from '../../src/engine/dogProfile';
import { DIAGNOSIS_LABEL, diagnosisOf, formulate, inspectModel } from '../../src/engine/formulate';
import { DEFAULT_SETTINGS } from '../../src/engine/types';

const fmt = (n: number | null | undefined, d = 3) => (n === null || n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString('it-IT', { maximumFractionDigits: d }));
// bovino: la prescrizione dice «grasso massimo 10%» → i tre proxy 3%, 5%, 10% (nessuno è «la carne della veterinaria»)
const FOODS = ['beef_03', 'beef_05', 'beef_10', 'oat_dry', 'carrot_cooked', 'coconut_oil', 'flaxseed_oil'];
const SUPPS = ['bone_meal', 'qdiet', 'omegor_vitality', 'psyllium_erbavoglio_husk_bio'];
const PRESCRIPTION: Record<string, string> = {
  beef: '560 g (grasso massimo 10%)',
  oat_dry: '100 g',
  carrot_cooked: '90 g',
  coconut_oil: '10 g',
  flaxseed_oil: '10 g',
  bone_meal: '5 g',
  qdiet: '13 g',
  omegor_vitality: '1 capsula',
  psyllium_erbavoglio_husk_bio: '5 g',
};

const cat = await new LocalRepository(null).loadCatalog();
const copy = {
  ...cat,
  foods: cat.foods.map((f) => (FOODS.includes(f.id) ? { ...f, availableToFormulate: true } : f)),
  supplements: cat.supplements.map((s) => (SUPPS.includes(s.id) ? { ...s, usableForOptimization: true } : s)),
};
const sel: Selection = { foods: FOODS.map((id) => ({ id })), supplements: SUPPS.map((id) => ({ id })), dietMoisture: null, proteinDigestibility: null };
const ker: Dog = applyPreset(
  newDog({ name: 'Ker (prescrizione 01/10/2025)', weightCurrentKg: 30.2, weightIdealKg: 27.2, kcalTarget: 1340, kcalSource: 'user', activityFactor: 1.6, sex: 'F', sterilized: false, ageYears: 6, bcs: 6 }, 'ker'),
  presetFor('adult_maintenance')!,
);
const nameOf = (id: string) => (copy.foods.find((f) => f.id === id) ?? copy.supplements.find((s) => s.id === id))!.name;
const unitOf = (label: string) =>
  /energia macro/.test(label) ? 'kcal' : /calcio\/fosforo/i.test(label) ? 'g di calcio/die' : /Fibra/.test(label) ? 'g/die' : /Dose massima|non oltre/.test(label) ? 'unità di dose' : (/ (\S+)\/1000 kcal/.exec(label)?.[1] ?? '') + (/\/1000 kcal/.test(label) ? '/die' : '');

const out: string[] = [];
const p = (s = '') => out.push(s);
const input = buildInput(ker, sel, copy, DEFAULT_SETTINGS, []);
const t0 = performance.now();
const r = await formulate(input);
const ms = performance.now() - t0;
const a = r.audit;
const m = inspectModel(input);

p('# Generatore automatico sul caso di Ker — 20/10/2026');
p();
p('Generato con `npx tsx scripts/collaudo/ker-generatore.ts`, motore `' + r.engineVersion + '`. Nessuna ricetta, prescrizione o preferenza salvata è stata modificata.');
p('Catalogo: modalità prova con il pacchetto del 20/10 (gli stessi file preparati per Supabase). Nella sola copia in memoria sono resi utilizzabili');
p('i profili di confronto (bovino 5% e 10%, olio di cocco, olio di lino), lo psillio e i tre integratori; nel catalogo restano come sono.');
p();
p('## Impostazioni');
p();
p('- Cane alla visita: femmina, 6 anni, **30,2 kg** (riferimento 27,2 kg), BCS 6/9; obiettivo **1.340 kcal/die** (richiesta della veterinaria); tolleranza ±2%.');
p('- Profilo FEDIAF 2025 adulto **95 kcal/kg^0,75** (il 110 non è usato). Minimi per 1000 kcal su max(1.340, calorie calcolate).');
p('- Dieta casalinga: selenio sul riferimento più alto. Digeribilità proteica non documentata → aminoacidi essenziali +10%.');
p(`- EPA+DHA: apporto raccomandato NRC su peso attuale (vincolo necessario). Limite QDiet dalla tabella d’impiego al peso attuale: ${fmt(m.items.find((i) => i.name.startsWith('Q.Diet'))?.ub[0], 2)} g (i 13 g prescritti **non** aumentano il limite del generatore).`);
p('- Psillio: profilo Erbavoglio Cuticola Bio **assunto per il confronto** (la prescrizione non identifica la variante); EM completa sconosciuta, 0,1404 kcal/g dai macronutrienti mostrati solo come contributo parziale.');
p('- Preferenze: quelle iniziali dell’adulto sano (nessuna preferenza salvata per Ker è stata usata o modificata):');
for (const t of input.dog.targets.filter((t) => ['protein_energy_pct', 'fat_energy_pct', 'carb_energy_pct', 'fiber'].includes(t.metric))) {
  const w = m.widened.filter((x) => x.label.startsWith(t.metric === 'fiber' ? 'Fibra' : t.metric === 'protein_energy_pct' ? 'Quota energia da proteine' : t.metric === 'fat_energy_pct' ? 'Quota energia da grassi' : 'Quota energia da carboidrati'));
  p(`  - ${t.metric}: ${fmt(t.lower)}–${fmt(t.upper)} ${t.basis === 'energy_pct' ? '% energia 4/9/4' : t.basis === 'per_day' ? 'g/die' : 'g/1000 kcal'} (seconda ricerca: ${w.map((x) => x.label.replace(/^.*?: /, '')).join('; ') || '—'})`);
}
p('  - Ca:P 1,2–1,4 (seconda ricerca 1,1–1,5); vincolo necessario 1–2.');
p('- Componenti disponibili: ' + [...FOODS, ...SUPPS].map(nameOf).join('; ') + '. Nessuna quantità bloccata, nessun minimo obbligatorio.');
p();
p(`## Esito: ${DIAGNOSIS_LABEL[diagnosisOf(r)]}`);
p();
p(`\`${r.outcome}\` · ${fmt(ms / 1000, 2)} s · ricerca P1: ${r.stats?.p1Stage === 1 ? 'prima ricerca (intervalli richiesti)' : r.stats?.p1Stage === 2 ? 'seconda ricerca (ampliamenti documentati)' : 'nessuna riuscita'}${a ? ` · stato della verifica: ${a.statusLabel}` : ''}.`);
if (r.message) p(`Messaggio del motore: ${r.message}`);
p();
if (r.items.length) {
  p(`### Quantità ${r.outcome === 'solved' ? 'proposte' : 'diagnostiche (non è un menù)'} e confronto con la prescrizione`);
  p();
  p('| Componente | Generatore | Prescrizione |');
  p('|---|---:|---:|');
  for (const id of [...FOODS, ...SUPPS]) {
    const it = r.items.find((x) => x.id === id);
    const unit = FOODS.includes(id) ? 'g' : copy.supplements.find((s) => s.id === id)!.doseUnit;
    p(`| ${nameOf(id)} | ${it ? `${fmt(it.qty, 1)} ${unit}` : '0'} | ${id.startsWith('beef_') ? (id === 'beef_05' ? PRESCRIPTION.beef + ' (un solo bovino)' : '—') : (PRESCRIPTION[id] ?? '—')} |`);
  }
  p();
}
if (a) {
  const d = a.totals.derived;
  p('### Apporti');
  p();
  p(`- Energia: ${fmt(a.totals.energy.known, 1)} kcal su 1.340 (±2%: 1.313,2–1.366,8); ${a.energyRow.note}`);
  p(`- ${a.minimaBasis?.text ?? ''}`);
  p(`- Quote 4/9/4: proteine ${fmt(d.protein_energy_pct?.value, 1)}%, grassi ${fmt(d.fat_energy_pct?.value, 1)}%, carboidrati ${fmt(d.carb_energy_pct?.value, 1)}%${d.protein_energy_pct?.range ? ` (intervalli possibili: P ${fmt(d.protein_energy_pct.range[0], 1)}–${fmt(d.protein_energy_pct.range[1], 1)}, G ${fmt(d.fat_energy_pct?.range?.[0], 1)}–${fmt(d.fat_energy_pct?.range?.[1], 1)}, C ${fmt(d.carb_energy_pct?.range?.[0], 1)}–${fmt(d.carb_energy_pct?.range?.[1], 1)})` : ''}.`);
  const n = a.totals.nutrients;
  p(`- Noti: proteine ${fmt(n.protein.known, 1)} g; grassi ${fmt(n.fat.known, 1)} g; fibra ${fmt(n.fiber.known, 1)} g; calcio ${fmt(n.calcium.known, 3)} g; fosforo ${fmt(n.phosphorus.known, 3)} g (Ca/P sui noti ${fmt(n.calcium.known / n.phosphorus.known, 3)}; ${d.ca_p_ratio?.complete === false ? 'rapporto non verificabile' : 'rapporto verificabile'}); vitamina D ${fmt(n.vitamin_d.known, 1)} UI; iodio ${fmt(n.iodine.known, 3)} mg; EPA+DHA ${fmt(n.epa_dha.known * 1000, 0)} mg; linoleico identificato ${fmt(n.linoleic_acid.known, 2)} g; ALA ${fmt(n.ala.known, 2)} g.`);
  for (const e of a.energySources ?? []) if (e.partial !== null && e.partial !== undefined) p(`- ${e.name}: EM completa sconosciuta; dai macronutrienti dichiarati ${fmt(e.partial, 4)} ${e.basis} (contributo parziale escluso dal totale).`);
  for (const dc of a.doseChecks ?? []) p(`- Tabella d’impiego — ${dc.message}`);
  const va = a.totals.vitaminA!;
  p(`- **Vitamina A (cane)**: preformata ${fmt(va.preformed, 1)} UI${va.preformedUnknown.length ? ` (sconosciuta per ${va.preformedUnknown.join(', ')})` : ''} + beta-carotene ${fmt(va.betaCaroteneMg, 3)} mg × 833 = ${fmt(va.fromBetaCarotene, 1)} UI${va.betaCaroteneUnknown.length ? ` (sconosciuto per ${va.betaCaroteneUnknown.join(', ')})` : ''} → totale noto ${fmt(n.vitamin_a.known, 1)} UI; minimo ${fmt(1754 * Math.max(1340, a.totals.energy.known) / 1000, 1)} UI.`);
  p();
  // linoleico: chi lo apporta, chi è sconosciuto, quanto lino è dettato dal minimo
  const la = n.linoleic_acid;
  const req = (3.82 * Math.max(1340, a.totals.energy.known)) / 1000;
  const flax = copy.foods.find((f) => f.id === 'flaxseed_oil')!;
  const flaxLa = (flax.nutrients.linoleic_acid?.value ?? 0) / 100;
  const flaxAla = (flax.nutrients.ala?.value ?? 0) / 100;
  const flaxQty = r.items.find((x) => x.id === 'flaxseed_oil')?.qty ?? 0;
  const others = la.contributions.filter((c) => c.name !== flax.name).reduce((x, c) => x + c.amount, 0);
  p('### Linoleico (18:2 n-6 identificato)');
  p();
  p(`Minimo FEDIAF 3,82 g/1000 kcal su ${fmt(Math.max(1340, a.totals.energy.known), 1)} kcal = **${fmt(req, 3)} g/die**. Il 18:2 non differenziato delle fonti non è equiparato al linoleico.`);
  p();
  p('| Ingrediente | Linoleico noto (g/die) |');
  p('|---|---:|');
  for (const c of [...la.contributions].sort((x, y) => y.amount - x.amount)) p(`| ${c.name} | ${fmt(c.amount, 3)} |`);
  p();
  p(`Sconosciuto (non zero) in: ${[...la.missingFrom, ...la.undeclaredFrom].join(', ') || 'nessuno'}.`);
  p(`Olio di lino: ${fmt(flaxLa * 100, 2)} g di linoleico e ${fmt(flaxAla * 100, 2)} g di ALA per 100 g. Linoleico noto dagli altri ingredienti usati: ${fmt(others, 3)} g → lino necessario per dimostrare il minimo con i soli dati noti: (${fmt(req, 3)} − ${fmt(others, 3)}) / ${fmt(flaxLa, 4)} = **${fmt(Math.max(0, req - others) / flaxLa, 1)} g**; quantità nella soluzione ${fmt(flaxQty, 1)} g (ALA ${fmt(flaxQty * flaxAla, 2)} g). ${Math.abs(flaxQty - Math.max(0, req - others) / flaxLa) <= 1.01 ? 'La quantità di lino è determinata da questo vincolo' : 'La quantità di lino non è determinata solo da questo vincolo'}: non è una dose consigliata, ma il minimo dimostrabile finché il linoleico di carne, avena e verdure resta sconosciuto.`);
  p();
  p();
  p('### Controlli: preferenze, non verificabili, non rispettati');
  p();
  p('| Nutriente | Controllo | Esito | Dettaglio |');
  p('|---|---|---|---|');
  const rows = (rs: CheckRow[]) => rs.flatMap((row) => row.checks.filter((c) => c.color !== 'green' && c.color !== 'blue').map((c) => ({ row, c })));
  for (const { row, c } of rows(a.rows)) p(`| ${row.label} | ${c.limit.limitClass} | ${c.color === 'grey' ? 'non verificabile' : c.color === 'orange' ? 'preferenza non rispettata' : c.color === 'red' ? 'NON RISPETTATO' : c.color} | ${c.message.replace(/\|/g, '/')} |`);
  const ok = a.rows.flatMap((row) => row.checks.filter((c) => c.color === 'green' && (c.limit.limitClass === 'PERSONAL_TARGET' || c.limit.limitClass === 'NON_OFFICIAL_ATTENTION')).map(() => row.label));
  p();
  p(`Preferenze rispettate (dimostrate sui dati noti): ${[...new Set(ok)].join(', ') || 'nessuna'}.`);
  p(`Minimi e massimi ufficiali: ${a.summary?.satisfied.length ?? 0} dimostrati, ${a.summary?.notMet.length ?? 0} non rispettati, ${a.summary?.unverifiable.length ?? 0} non verificabili (${a.summary?.unverifiable.join(', ') || '—'}).`);
  p();
  if (r.items.length) {
    const qty = new Map(r.items.map((it) => [it.id, it.qty]));
    const tight = m.rows.filter((row) => (row.hard || row.label.includes('dati parziali')) && row.terms.length).flatMap((row) => {
      const parts = row.terms.map((t) => (t.coef * (qty.get(t.id) ?? 0)) / t.step);
      const act = parts.reduce((x, y) => x + y, 0);
      const size = Math.max(parts.reduce((x, y) => x + Math.abs(y), 0), Math.abs(row.rhs), 1e-9);
      return Math.abs(act - row.rhs) <= 0.003 * size ? [row.label.replace(' — dati parziali', ' (coperto con i dati noti)')] : [];
    });
    const atMax = m.items.filter((it) => it.ub.length && r.items.some((x) => nameOf(x.id) === it.name && x.qty >= Math.min(...it.ub) - 1e-6));
    p('### Vincoli necessari al limite nella soluzione');
    p();
    for (const t of [...new Set(tight)]) p(`- ${t}`);
    for (const it of atMax) p(`- ${it.name}: al massimo consentito (${fmt(Math.min(...it.ub), 2)})`);
    if (!tight.length && !atMax.length) p('- nessuno');
    p();
  }
}
if (r.conflicts.length) {
  p('### Incompatibilità (diagnosi del modello)');
  p();
  p(r.outcome === 'preferences_unreachable' ? 'Violazione minima necessaria con le preferenze ampliate trattate come vincoli, insieme ai vincoli necessari:' : 'Violazione minima necessaria dei vincoli:');
  p();
  for (const c of r.conflicts) p(`- ${c.label}${c.shortfall > 0 ? ` — scarto minimo ${fmt(c.shortfall, 3)} ${unitOf(c.label)}` : ''}`);
  p();
}
if (a?.softGaps?.length) {
  p('### Preferenze non raggiunte: cosa le impedisce (una alla volta)');
  p();
  for (const g of a.softGaps) p(`- ${g.label}: ${g.unreachable ? 'non raggiungibile con questi ingredienti in nessuna quantità' : g.blockedBy.length ? `impedita da ${g.blockedBy.join('; ')}` : 'raggiungibile da sola: il conflitto nasce solo insieme alle altre preferenze o vincoli'}`);
  p();
}
if (r.suggestions?.length) {
  p('### Suggerimenti del motore');
  p();
  for (const s of r.suggestions) p(`- ${s}`);
  p();
}
if (a) {
  p('### Dati insufficienti (separati dalle incompatibilità)');
  p();
  const missing = new Map<string, Set<string>>();
  for (const row of a.rows) if (row.checks.some((c) => c.color === 'grey')) for (const x of [...row.missingFrom, ...row.undeclaredFrom]) (missing.get(x) ?? missing.set(x, new Set()).get(x)!).add(row.label);
  for (const [x, labels] of missing) p(`- ${x}: ${[...labels].join(', ')}`);
  if (a.dataQuality?.unknownEnergy.length) p(`- Energia sconosciuta: ${a.dataQuality.unknownEnergy.join(', ')}`);
  for (const b of a.blockers.filter((b) => b.startsWith('Lacuna'))) p(`- ${b}`);
  p();
}
if (r.excluded.length) {
  p('### Componenti esclusi');
  p();
  for (const e of r.excluded) p(`- ${e.name}: ${e.reason}`);
  p();
}
console.log(out.join('\n'));
