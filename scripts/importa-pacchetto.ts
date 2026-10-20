// Importazione controllata di un pacchetto di file JSON (schema definitivo, modalità strict) con l'importatore dell'app.
// Pianifica i file in ordine sul catalogo attuale (pacchetto + importazioni già incluse), scrive l'anteprima in Markdown
// e, per ogni file con modifiche, l'istruzione SQL per Supabase (funzione admin_import_catalog, un'unica transazione).
// Non modifica ricette, quantità o preferenze; non attribuisce convalide.
//
// Uso: npx tsx scripts/importa-pacchetto.ts <cartella SQL di uscita> <anteprima.md> <tipo:file.json> [<tipo:file.json> …]
//      tipo = alimenti | integratori

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseImport, planImport, toPayload, type ImportKind } from '../src/data/catalogImport';
import { LocalRepository } from '../src/data/localRepository';
import type { Food, Supplement } from '../src/engine/types';

const [outDir, previewPath, ...specs] = process.argv.slice(2);
if (!outDir || !previewPath || !specs.length) {
  console.error('Uso: npx tsx scripts/importa-pacchetto.ts <cartella SQL> <anteprima.md> alimenti:<file> integratori:<file> …');
  process.exit(1);
}
const fmt = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'number' ? v.toLocaleString('it-IT', { maximumFractionDigits: 6 }) : String(v));
const same = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b), 1e-12));

const cat = await new LocalRepository(null).loadCatalog({ bundledUpTo: '2026-10-16' });
const out: string[] = [];
const p = (s = '') => out.push(s);
p('# Anteprima dell’importazione');
p();
p('Generata con `npx tsx scripts/importa-pacchetto.ts`: importatore dell’app (`src/data/catalogImport.ts`), schema definitivo JSON, modalità strict.');
p('Confronto con il catalogo attuale (pacchetto + importazioni del 16/10, cioè lo stato caricato in Supabase con `supabase/data/2026-10-16_*.sql`).');
p('Nessuna ricetta, quantità o preferenza viene modificata; nessuna convalida viene attribuita (i valori aggiornati perdono la convalida).');
p();
let n = 0;
let blocked = false;
for (const spec of specs) {
  const [k, file] = [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)];
  const kind: ImportKind = k === 'alimenti' ? 'foods' : 'supplements';
  const text = readFileSync(file, 'utf8');
  const plan = planImport(parseImport(text, kind, cat.nutrients, { mode: 'strict' }), cat, basename(file));
  const errs = [...plan.errors, ...plan.items.flatMap((i) => i.errors)];
  p(`## ${basename(file)} (${k})`);
  p();
  p(`sha256 \`${createHash('sha256').update(text).digest('hex')}\` · ${plan.summary.create} nuovi, ${plan.summary.update} aggiornati, ${plan.summary.unchanged} invariati, ${plan.summary.values} valori · errori ${errs.length} · avvisi ${plan.warnings.length + plan.items.reduce((a, i) => a + i.warnings.length, 0)} · conversioni in sospeso ${plan.items.reduce((a, i) => a + i.pendingConversions.length, 0)}`);
  p();
  for (const e of errs) p(`- **ERRORE** ${e.productId ?? ''} ${e.message}`);
  if (errs.length || !plan.canApply) {
    blocked = blocked || errs.length > 0;
    p(errs.length ? 'Importazione bloccata: nessun file SQL generato.' : 'Nessuna modifica da applicare.');
    p();
    continue;
  }
  p('| Prodotto | Azione | Utilizzabile nel calcolo | Stato dopo | Campi cambiati | Valori cambiati (prima → dopo, canonici) |');
  p('|---|---|---|---|---|---|');
  for (const it of plan.items) {
    const nx = it.next as Food & Supplement;
    const usable = kind === 'foods' ? nx.availableToFormulate : nx.usableForOptimization;
    const fields = it.fieldChanges.map((c) => c.field).join(', ') || '—';
    const vals = it.valueChanges
      .filter((v) => !same(v.before, v.after))
      .map((v) => `${v.label}: ${fmt(v.before)} → ${fmt(v.after)} ${v.after === null ? '(sconosciuto)' : v.unit}${v.declared ? ` [${v.declared}]` : ''}`);
    p(`| ${it.id} — ${nx.name} | ${it.action === 'create' ? 'nuovo' : it.action === 'update' ? 'aggiornato' : 'invariato'} | ${usable ? 'sì' : 'no'} | ${it.statusAfter.status}${it.statusAfter.reasons.length ? ` (${it.statusAfter.reasons.slice(0, 2).join('; ')})` : ''} | ${fields} | ${it.action === 'create' ? `${it.valueChanges.filter((v) => v.after !== null).length} valori` : vals.join('; ') || 'nessuno'} |`);
  }
  p();
  // applica alla copia in memoria, così il file successivo si confronta con lo stato aggiornato
  const next = plan.items.filter((i) => i.action !== 'unchanged').map((i) => i.next);
  if (kind === 'foods') cat.foods = [...cat.foods.filter((x) => !next.some((v) => v.id === x.id)), ...(next as Food[])];
  else cat.supplements = [...cat.supplements.filter((x) => !next.some((v) => v.id === x.id)), ...(next as Supplement[])];
  n++;
  const sqlName = `${String(n).padStart(2, '0')}_${basename(file, '.json')}.sql`;
  const payload = JSON.stringify(toPayload(plan)).replace(/'/g, "''");
  writeFileSync(join(outDir, sqlName), `-- ${basename(file)} (sha256 ${createHash('sha256').update(text).digest('hex')})\n-- generato da scripts/importa-pacchetto.ts; eseguire come amministratore, nell'ordine dei numeri\nselect public.admin_import_catalog('${payload}'::jsonb);\n`);
  p(`SQL: \`${join(outDir, sqlName)}\``);
  p();
}
writeFileSync(previewPath, out.join('\n') + '\n');
if (blocked) process.exit(2);
