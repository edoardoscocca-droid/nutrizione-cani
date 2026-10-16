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
  dry_weighed_before_soaking: { state: 'raw', preparation: 'Fiocchi secchi non cotti: pesare SECCHI prima dell’ammollo; acqua di ammollo non scolata.' },
  steam_proxy_boiled: { state: 'cooked_boiled', preparation: 'In casa cotta al vapore; il profilo è quello USDA del prodotto bollito e scolato, usato come approssimazione.' },
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
    nutrients[r.nutrient_id] = { value: r.value_per_100g, unit: r.unit, status: r.status, source: r.source_id };
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
    notes: `${f.notes} · Fonte: ${f.source_url}`,
    nutrients,
  };
});

// ── integratori ──
const suppCatalog = read('integratori/E_catalogo_integratori_IMPORT.csv');
const suppComp = read('integratori/E_composizione_integratori_IMPORT.csv');
const extra = read('integratori/E_componenti_da_convertire_o_non_mappati.csv');
const VARIANT: Record<string, string> = { qdiet: 'Compensa standard (non Crescita, non Ultra)', omegor_vitality: 'Vitality 1000', bone_meal: 'marca/prodotto non confermato' };
const skippedDerived: string[] = [];
const supplements = suppCatalog.map((s) => {
  const nutrients: Record<string, unknown> = {};
  for (const r of suppComp.filter((x) => x.supplement_id === s.id)) {
    if (!r.amount_per_dose) continue; // UNKNOWN_NOT_DECLARED: mai zero
    if (r.value_status === 'DERIVED') {
      skippedDerived.push(`${s.id} · ${r.nutrient_id} = ${r.amount_per_dose} ${r.unit} (${r.notes}) — calcolato dall’app da EPA + DHA`);
      continue;
    }
    nutrients[r.nutrient_id] = {
      value: r.amount_per_dose,
      unit: r.unit,
      status: r.value_status,
      source: r.source_id,
      per_dose: r.per_dose,
      declared_total_or_added: r.declared_total_or_added,
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
  report.push('| Prodotto | ID | Azione | Stato dopo l’importazione | Motivi |', '|---|---|---|---|---|');
  for (const it of plan.items) {
    report.push(`| ${it.name} | \`${it.id}\` | ${it.action === 'create' ? 'nuovo' : 'aggiornato'} | ${CATALOG_STATUS_LABEL[it.statusAfter.status]} | ${it.statusAfter.reasons.join('; ')} |`);
  }
  const pending = plan.items.flatMap((i) => i.pendingConversions.map((p) => `${i.id} · ${p.label}: ${p.value} ${p.unit} → ${p.targetUnit}`));
  if (pending.length) report.push('', '**Valori NON importati, in attesa di un fattore di conversione approvato** (restano «non disponibili»):', '', ...pending.map((p) => `- ${p}`));
  report.push('');
}
report.push('## Non caricati di proposito', '');
report.push('- Energia: i file contengono solo l’energia alimentare **umana** USDA (`energy_food_kcal`, conservata come dato informativo). L’energia metabolizzabile per il cane resta vuota finché non si approva un metodo (decisione D4): per questo i 6 alimenti risultano «Da completare» e non entrano nel calcolo.');
for (const d of skippedDerived) report.push(`- Riga derivata non importata: ${d}.`);
for (const e of extra) report.push(`- Componente da convertire, non importato: ${e.product_id} · ${e.component} ${e.declared_amount} ${e.declared_unit} (${e.declared_basis}) — ${e.mapping_status}. ${e.notes}`);
report.push('- Voci di fonte conservate solo come informazione (nessun limite, nessun calcolo): ' + ['energy_food_kcal', 'carbohydrate_by_difference', 'c18_2_undifferentiated', 'c20_4_undifferentiated', 'vitamin_a_retinol_ug', 'vitamin_a_carotenoid_iu', 'beta_carotene_ug'].map((id) => L.get(id) ?? id).join(', ') + '.');
report.push('- Cistina e tirosina: importate e usate per Metionina + cistina e Fenilalanina + tirosina (formula dell’allegato F).');
report.push('- Attivazione: i file chiedono «available_to_formulate = true»; l’importazione non attiva mai i prodotti. Si attivano dal Catalogo quando non sono più «Da completare».');
report.push('', '## Scelte di conversione (nessun valore modificato)', '');
report.push('- ID: quelli dei file. Gli alimenti sono nuovi prodotti (le voci generiche del pacchetto iniziale, es. «Avena», «Carote», «Macinato di manzo», restano «Da completare»). Gli integratori aggiornano `qdiet`, `omegor_vitality`, `bone_meal`.');
report.push('- Categorie: cereal/oats → Cereali; vegetable/root e vegetable/pumpkin → Verdure.');
report.push('- Stato: avena «secca da pesare prima dell’ammollo» → crudo, con nota di preparazione; carota e zucca «vapore, proxy bollito» → cotto (bollito) con nota: il profilo è del bollito.');
report.push('- Qualità dei valori: i codici REPORTED_USDA_PROXY, DERIVED_APPROXIMATION, PER_KG_ASSUMED_CONFIRM, SCREENSHOT_UNVERIFIED, PROXY_OIL_ONLY diventano «stima» (il codice originale resta nel campo metodo); ANALYTICAL_DECLARED e MANUFACTURER_DECLARED diventano «da etichetta».');
report.push('- Profili alimenti dichiarati «stima» (PARTIAL_RESEARCH). Versione della fonte non indicata nei file.');
writeFileSync(new URL('RAPPORTO.md', DIR), report.join('\n') + '\n');
console.log(report.join('\n'));
if (plans.some(([, p]) => p.errors.length)) process.exit(2);
