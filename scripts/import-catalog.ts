// Importazione da riga di comando, con le STESSE verifiche dell'app (src/data/catalogImport.ts).
// Stampa gli errori e, se non ce ne sono, l'istruzione SQL da eseguire come amministratore
// (applica tutto in un'unica transazione con la funzione admin_import_catalog).
//
// Uso:  npx tsx scripts/import-catalog.ts alimenti|integratori <file.csv|file.json> [catalogo.json] > import.sql
// "catalogo.json" (facoltativo) è un'esportazione del catalogo attuale (foods/supplements come nell'app);
// senza, il confronto avviene con il catalogo del pacchetto + dati di prova.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseImport, planImport, toPayload, type ImportKind } from '../src/data/catalogImport';
import { LocalRepository } from '../src/data/localRepository';

const [kindArg, file, catalogFile] = process.argv.slice(2);
const kind: ImportKind | null = kindArg === 'alimenti' ? 'foods' : kindArg === 'integratori' ? 'supplements' : null;
if (!kind || !file) {
  console.error('Uso: npx tsx scripts/import-catalog.ts alimenti|integratori <file> [catalogo.json]');
  process.exit(1);
}
const catalog = await new LocalRepository(null).loadCatalog();
if (catalogFile) Object.assign(catalog, JSON.parse(readFileSync(catalogFile, 'utf8')));
const plan = planImport(parseImport(readFileSync(file, 'utf8'), kind, catalog.nutrients), catalog, basename(file));
for (const w of plan.warnings) console.error(`avviso${w.line ? ` riga ${w.line}` : ''}${w.productId ? ` [${w.productId}]` : ''}: ${w.message}`);
if (plan.errors.length) {
  for (const e of plan.errors) console.error(`ERRORE${e.line ? ` riga ${e.line}` : ''}${e.productId ? ` [${e.productId}]` : ''}: ${e.message}`);
  process.exit(2);
}
if (!plan.canApply) {
  console.error('Nessuna modifica da applicare.');
  process.exit(0);
}
const payload = JSON.stringify(toPayload(plan)).replace(/'/g, "''");
console.log(`select public.admin_import_catalog('${payload}'::jsonb);`);
console.error(`Pronti: ${plan.summary.create} nuovi, ${plan.summary.update} aggiornati, ${plan.summary.unchanged} invariati, ${plan.summary.values} valori.`);
for (const i of plan.items) console.error(`  ${i.id}: ${i.action} → ${i.statusAfter.status}${i.statusAfter.reasons.length ? ` (${i.statusAfter.reasons.join('; ')})` : ''}`);
