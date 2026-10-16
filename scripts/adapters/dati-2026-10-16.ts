// Converte i pacchetti ricevuti il 16/10/2026 (6 alimenti, 3 integratori) nel formato d'importazione standard
// dell'app, senza cambiare nessun valore: rinomina colonne e categorie e scarta solo ciò che non va caricato
// (righe derivate, componenti da convertire). Tutto ciò che resta fuori è elencato nel rapporto.
//
// Uso: npx tsx scripts/adapters/dati-2026-10-16.ts
// Produce in dati/importazioni/2026-10-16/: import_alimenti.json, import_integratori.json, RAPPORTO.md

import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOG_STATUS_LABEL } from '../../src/engine/catalogStatus';
import { parseCsv, parseImport, planImport, type ImportPlan } from '../../src/data/catalogImport';
import { LocalRepository } from '../../src/data/localRepository';
import { resolveFoodEnergy } from '../../src/engine/energy';
import type { Food } from '../../src/engine/types';

const DIR = new URL('../../dati/importazioni/2026-10-16/', import.meta.url);
const read = (p: string) => parseCsv(readFileSync(new URL(`originali/${p}`, DIR), 'utf8')).rows.map((r) => r.cells);

// ── alimenti ──
const CATEGORY: Record<string, [string, string]> = {
  'animal/muscle': ['animal', 'muscle'],
  'cereal/oats': ['starch', 'cereal'],
  'vegetable/root': ['vegetable', 'vegetable_generic'],
  'vegetable/pumpkin': ['vegetable', 'vegetable_generic'],
};
const PROCESSING: Record<string, { state: string; preparation: string | null }> = {
  raw: { state: 'raw', preparation: null },
  dry_weighed_before_soaking: { state: 'raw', preparation: 'Pesare i fiocchi SECCHI, poi metterli in ammollo (non cotti); l’acqua di ammollo non si scola. Il profilo è quello dei fiocchi secchi.' },
  steam_proxy_boiled: { state: 'cooked_steamed', preparation: 'Cotta al vapore. Approssimazione: il profilo è quello USDA del prodotto bollito e scolato (la cottura al vapore perde meno minerali e vitamine idrosolubili).' },
};
const report: string[] = [];
const foodsCatalog = read('alimenti/D_catalogo_sei_alimenti.csv');
const foodsComp = read('alimenti/D_composizione_sei_alimenti.csv');
const foods = foodsCatalog.map((f) => {
  const cat = CATEGORY[`${f.category}/${f.subcategory}`];
  const proc = PROCESSING[f.processing_state];
  if (!cat || !proc) throw new Error(`Mappatura mancante per ${f.id}`);
  const nutrients: Record<string, unknown> = {};
  for (const r of foodsComp.filter((x) => x.product_id === f.id)) {
    if (!r.value_per_100g) continue; // NOT_REPORTED: resta «non disponibile»
    // vitamina E: conversione solo se la fonte la identifica esplicitamente come alfa-tocoferolo (USDA «alpha-tocopherol»)
    const form = r.nutrient_id === 'vitamin_e' && r.unit === 'mg' && /alfa-tocoferolo|alpha-tocopherol/i.test(r.notes) ? 'd_alpha_tocopherol' : undefined;
    nutrients[r.nutrient_id] = { value: r.value_per_100g, unit: r.unit, status: r.status, source: r.source_id, ...(form ? { form } : {}) };
  }
  return {
    id: f.id,
    name_it: f.name_it,
    category: cat[0],
    subcategory: cat[1],
    processing_state: proc.state,
    preparation: proc.preparation,
    edible_portion: f.basis,
    source_identifier: f.source_id,
    data_status: f.nutrition_status === 'PARTIAL_RESEARCH' ? 'estimated' : 'unverified',
    // decisione della nutrizionista: utilizzabili nella formulazione anche con dati parziali (PARTIAL_RESEARCH)
    available_to_formulate: f.available_to_formulate,
    notes: `${f.notes} · Fonte: ${f.source_url}`,
    nutrients,
  };
});

// ── integratori ──
const suppCatalog = read('integratori/E_catalogo_integratori_IMPORT.csv');
const suppComp = read('integratori/E_composizione_integratori_IMPORT.csv');
const extra = read('integratori/E_componenti_da_convertire_o_non_mappati.csv');
// Conferma della nutrizionista (17/10/2026): gli additivi di Q.Diet Compensa STANDARD (polvere, 250 g) sono dichiarati
// per 1 kg di prodotto → valore per 1 g = valore per kg ÷ 1000. Non vale per Compensa Crescita né Ultra.
const BASIS_CONFIRMED: Record<string, { note: string; sources: string }> = {
  qdiet: {
    note: 'Additivo dichiarato per kg di prodotto, base confermata dalla nutrizionista il 17/10/2026; valore per 1 g = valore per kg ÷ 1000',
    sources: 'Catalogo Q.Diet 2024, Compensa polvere cod. Q40543 (250 g), «Additivi per kg»: https://www.nuovafattoriaallocca.it/wp-content/uploads/2024/05/CATALOGO-Q.DIET-2024.pdf · Scheda prodotto: https://www.pacopetshop.it/it/qdiet/4805-qdiet-compensa-per-cani-e-gatti.htm',
  },
};
const confirmBasis = (id: string, status: string) => (status === 'PER_KG_ASSUMED_CONFIRM' && BASIS_CONFIRMED[id] ? 'MANUFACTURER_DECLARED' : status);
const VARIANT: Record<string, string> = { qdiet: 'Compensa standard in polvere (non Crescita, non Ultra)', omegor_vitality: 'Vitality 1000', bone_meal: 'marca/prodotto non confermato' };
const skippedDerived: string[] = [];
const convertedExtra: string[] = [];
const supplements = suppCatalog.map((s) => {
  const nutrients: Record<string, unknown> = {};
  for (const r of suppComp.filter((x) => x.supplement_id === s.id)) {
    if (!r.amount_per_dose) continue; // UNKNOWN_NOT_DECLARED: mai zero
    if (r.value_status === 'DERIVED') {
      skippedDerived.push(`${s.id} · ${r.nutrient_id} = ${r.amount_per_dose} ${r.unit} (${r.notes}) — calcolato dall’app da EPA + DHA`);
      continue;
    }
    const confirmed = r.value_status === 'PER_KG_ASSUMED_CONFIRM' && BASIS_CONFIRMED[s.id];
    nutrients[r.nutrient_id] = {
      value: r.amount_per_dose,
      unit: r.unit,
      status: confirmBasis(s.id, r.value_status),
      source: confirmed ? BASIS_CONFIRMED[s.id].sources : r.source_id,
      ...(confirmed ? { method: BASIS_CONFIRMED[s.id].note } : {}),
      per_dose: r.per_dose,
      declared_total_or_added: r.declared_total_or_added,
    };
  }
  // vitamina E dichiarata con la forma chimica (file dei componenti da convertire): ora convertibile (D19)
  for (const e of extra.filter((x) => x.product_id === s.id && x.mapping_status === 'NEEDS_IU_FORM_CONVERSION')) {
    const form = /tutto-rac|all-rac/i.test(e.component) ? 'all_rac_alpha_tocopheryl_acetate' : /d-alfa-tocoferolo/i.test(e.component) && !/acetat/i.test(e.component) ? 'd_alpha_tocopherol' : null;
    if (!form) continue;
    const perKg = /per kg/i.test(e.declared_basis);
    convertedExtra.push(`${s.id} · ${e.component} ${e.declared_amount} ${e.declared_unit} (${perKg && BASIS_CONFIRMED[s.id] ? 'per kg, base confermata' : e.declared_basis})`);
    nutrients.vitamin_e = {
      value: perKg ? Number(e.declared_amount) / 1000 : Number(e.declared_amount), // per kg di prodotto → per 1 g
      unit: e.declared_unit,
      form,
      status: perKg ? confirmBasis(s.id, 'PER_KG_ASSUMED_CONFIRM') : 'MANUFACTURER_DECLARED',
      source: perKg && BASIS_CONFIRMED[s.id] ? BASIS_CONFIRMED[s.id].sources : s.source_label_url,
      per_dose: '1',
      ...(suppComp.some((x) => x.supplement_id === s.id && x.declared_total_or_added === 'added') ? { declared_total_or_added: 'added' } : {}),
      method: `${e.component}: ${e.declared_amount} ${e.declared_unit} per kg${perKg && BASIS_CONFIRMED[s.id] ? ` — ${BASIS_CONFIRMED[s.id].note}` : ` (${e.declared_basis})`}`,
    };
  }
  return {
    id: s.id,
    name_it: s.name_it,
    variant: VARIANT[s.id] ?? null,
    class: s.class,
    dose_unit: s.dose_unit,
    mass_per_unit_g: s.dose_unit === 'gram' ? s.dose_mass_g || null : null, // capsula: peso non noto, non si assume 1 g
    label_source: s.source_label_url,
    notes: `${s.notes} · Stato nel file: ${s.nutrient_profile_status}, uso in ottimizzazione: ${s.usable_for_optimization}`,
    nutrients,
  };
});

writeFileSync(new URL('import_alimenti.json', DIR), JSON.stringify({ foods }, null, 1));
writeFileSync(new URL('import_integratori.json', DIR), JSON.stringify({ supplements }, null, 1));

// ── verifica con lo stesso importatore dell'app e rapporto ──
const cat = await new LocalRepository(null).loadCatalog({ withBundledImports: false });
const plans: [string, ImportPlan][] = [
  ['Alimenti', planImport(parseImport(JSON.stringify({ foods }), 'foods', cat.nutrients), cat, 'import_alimenti.json')],
  ['Integratori', planImport(parseImport(JSON.stringify({ supplements }), 'supplements', cat.nutrients), cat, 'import_integratori.json')],
];
const L = new Map(cat.nutrients.map((n) => [n.id, n.label]));
report.push('# Importazione dati del 16/10/2026 — rapporto', '', 'Generato da `scripts/adapters/dati-2026-10-16.ts`. File originali in `originali/`.', '');
for (const [title, plan] of plans) {
  report.push(`## ${title}`, '');
  report.push(`Esito della verifica: ${plan.errors.length ? `**${plan.errors.length} errori**` : 'nessun errore'} · ${plan.summary.create} nuovi · ${plan.summary.update} aggiornati · ${plan.summary.values} valori importati.`, '');
  for (const e of plan.errors) report.push(`- ERRORE: ${e.productId ?? ''} ${e.message}`);
  report.push('| Prodotto | ID | Azione | Utilizzabile nel calcolo | Stato dei dati | Motivi |', '|---|---|---|---|---|---|');
  for (const it of plan.items) {
    const usable = 'availableToFormulate' in it.next ? (it.next as Food).availableToFormulate : (it.next as { usableForOptimization: boolean }).usableForOptimization;
    report.push(`| ${it.name} | \`${it.id}\` | ${it.action === 'create' ? 'nuovo' : 'aggiornato'} | ${usable ? 'sì' : 'no (da attivare)'} | ${CATALOG_STATUS_LABEL[it.statusAfter.status]} | ${[...it.statusAfter.reasons, ...it.statusAfter.info].join('; ')} |`);
  }
  const pending = plan.items.flatMap((i) => i.pendingConversions.map((p) => `${i.id} · ${p.label}: ${p.value} ${p.unit} → ${p.targetUnit}`));
  const conv = plan.items.flatMap((i) => i.valueChanges.filter((v) => v.rule && v.rule.includes('×')).map((v) => `${i.id} · ${v.label}: ${v.sourceValue} ${v.sourceUnit} → ${v.after} ${v.unit} — ${v.rule}`));
  if (conv.length) report.push('', '**Valori convertiti con i fattori approvati (D19)**:', '', ...conv.map((p) => `- ${p}`), '');
  if (pending.length) report.push('', '**Valori NON importati, in attesa di un fattore di conversione approvato** (restano «non disponibili»):', '', ...pending.map((p) => `- ${p}`));
  report.push('');
}
report.push('## Energia metabolizzabile calcolata (D4)', '');
report.push('Metodo della tipologia applicato alla composizione importata. L’energia «umana» USDA è riportata solo per confronto: non è usata.', '');
report.push('| Alimento | Proteine g | Grassi g | Carboidrati disp. g | EM cane kcal/100 g | Metodo | Avvertenza | Energia USDA uomo (non usata) |', '|---|---|---|---|---|---|---|---|');
for (const it of plans[0][1].items) {
  const f = resolveFoodEnergy(it.next as Food, cat.energyMethods, cat.energyAssignments);
  const v = (k: string) => f.nutrients[k]?.value ?? '—';
  report.push(`| ${f.name} | ${v('protein')} | ${v('fat')} | ${v('carbohydrate_available')} | ${f.kcalMePer100g ?? '—'} | ${f.energyMethod ? `${f.energyMethod.label} v. ${f.energyMethod.version}` : 'nessuno'} | ${f.energyMethod?.caution ?? ''} | ${v('energy_food_kcal')} |`);
}
report.push('');
report.push('## Non caricati di proposito', '');
report.push('- Energia: i file contengono solo l’energia alimentare **umana** USDA (`energy_food_kcal`, conservata come dato informativo, mai usata). L’energia metabolizzabile per il cane si calcola nell’app con il metodo energetico della tipologia (decisione D4: FEDIAF 2025, 4/9/4 su proteine, grassi e carboidrati disponibili; vedi `dati/riferimenti/metodi_energetici.json`).');
for (const d of skippedDerived) report.push(`- Riga derivata non importata: ${d}.`);
for (const c of convertedExtra) report.push(`- Vitamina E convertita con la forma chimica dichiarata (D19): ${c}.`);
for (const e of extra.filter((x) => !convertedExtra.some((c) => c.startsWith(`${x.product_id} · ${x.component} `)))) {
  const basis = /per kg/i.test(e.declared_basis) && BASIS_CONFIRMED[e.product_id] ? 'per kg, base confermata' : e.declared_basis;
  report.push(`- Componente da convertire, non importato: ${e.product_id} · ${e.component} ${e.declared_amount} ${e.declared_unit} (${basis}) — ${e.mapping_status}. ${e.notes}`);
}
report.push('- Voci di fonte conservate solo come informazione (nessun limite, nessun calcolo): ' + ['energy_food_kcal', 'carbohydrate_by_difference', 'c18_2_undifferentiated', 'c20_4_undifferentiated', 'vitamin_a_retinol_ug', 'vitamin_a_carotenoid_iu', 'beta_carotene_ug'].map((id) => L.get(id) ?? id).join(', ') + '.');
report.push('- Cistina e tirosina: importate e usate per Metionina + cistina e Fenilalanina + tirosina (formula dell’allegato F).');
report.push('- Attivazione: i 6 alimenti sono **utilizzabili nella formulazione** come chiede il file (decisione della nutrizionista: dati parziali o stimati non impediscono l’uso; fonte, approssimazioni e nutrienti mancanti sono indicati). Gli integratori restano da attivare dall’amministratore: nel file Q-Diet e Omegor sono «condizionali», la farina d’ossa «no».');
report.push('- **Q.Diet Compensa standard — base degli additivi confermata (17/10/2026)**: tutti gli additivi sono dichiarati per 1 kg di prodotto (catalogo Q.Diet 2024, Compensa polvere cod. Q40543 250 g, «Additivi per kg»; scheda prodotto pacopetshop). Valore per 1 g = valore per kg ÷ 1000; i valori diventano «da etichetta». Non vale per Compensa Crescita né Ultra. I nutrienti non dichiarati restano sconosciuti.');
report.push('- **Nel catalogo Q.Diet 2024 (Compensa polvere) ci sono dati non presenti nei file ricevuti, NON importati in attesa di conferma**: energia metabolizzabile 96 kcal/100 g; potassio 7,5 % (nei file «non dichiarato»); colina cloruro 90.000 mg/kg (sale di colina: serve un fattore approvato per la colina; non compare nella scheda prodotto); dosi d’uso per peso (es. 30 kg: 4,5–9 g/die; misurino raso = 3 g).');
report.push('', '## Scelte di conversione (nessun valore modificato)', '');
report.push('- ID: quelli dei file. Gli alimenti sono nuovi prodotti (le voci generiche del pacchetto iniziale, es. «Avena», «Carote», «Macinato di manzo», restano «Da completare»). Gli integratori aggiornano `qdiet`, `omegor_vitality`, `bone_meal`.');
report.push('- Categorie: cereal/oats → Cereali; vegetable/root e vegetable/pumpkin → Verdure.');
report.push('- Stato: avena «pesata secca prima dell’ammollo» → crudo (fiocchi secchi), con nota di preparazione e avvertenza sull’amido non cotto; carota e zucca → «cotto al vapore», con nota: il profilo è quello del bollito, usato come approssimazione.');
report.push('- Qualità dei valori: i codici REPORTED_USDA_PROXY, DERIVED_APPROXIMATION, PER_KG_ASSUMED_CONFIRM, SCREENSHOT_UNVERIFIED, PROXY_OIL_ONLY diventano «stima» (il codice originale resta nel campo metodo); ANALYTICAL_DECLARED e MANUFACTURER_DECLARED diventano «da etichetta».');
report.push('- Profili alimenti dichiarati «stima» (PARTIAL_RESEARCH). Versione della fonte non indicata nei file.');
writeFileSync(new URL('RAPPORTO.md', DIR), report.join('\n') + '\n');
console.log(report.join('\n'));
if (plans.some(([, p]) => p.errors.length)) process.exit(2);
