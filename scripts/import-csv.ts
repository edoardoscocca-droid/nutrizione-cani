// Converte i modelli CSV del pacchetto (D_template_composizione_alimenti.csv / E_template_composizione_integratori.csv)
// compilati con i valori verificati in un file SQL da eseguire nell'SQL editor di Supabase (da amministratore).
// Righe senza valore vengono saltate: il dato resta "non disponibile", mai zero.
// Le unità vengono convertite solo massa↔massa; altrimenti la riga è rifiutata.
//
// Uso:  npx tsx scripts/import-csv.ts alimenti  <file.csv> > import.sql
//       npx tsx scripts/import-csv.ts integratori <file.csv> > import.sql

import { readFileSync } from 'node:fs';
import { packageReferences } from '../src/data/packageCatalog';
import { toCanonical } from '../src/engine/units';

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') cur.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cur.push(field);
      if (cur.some((x) => x !== '')) rows.push(cur);
      cur = [];
      field = '';
    } else field += c;
  }
  cur.push(field);
  if (cur.some((x) => x !== '')) rows.push(cur);
  const [head, ...body] = rows;
  const h = head.map((x) => x.replace(/^﻿/, '').trim());
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const q = (v: string | number | null) => (v === null ? 'null' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);

const [kind, file] = process.argv.slice(2);
if (!['alimenti', 'integratori'].includes(kind) || !file) {
  console.error('Uso: npx tsx scripts/import-csv.ts alimenti|integratori <file.csv>');
  process.exit(1);
}
const units = new Map(packageReferences().nutrients.map((n) => [n.id, n]));
const rows = parseCsv(readFileSync(file, 'utf8'));
const out: string[] = ['-- Import generato da scripts/import-csv.ts. Eseguire come amministratore.', 'begin;'];
const errors: string[] = [];
let n = 0;
for (const [i, r] of rows.entries()) {
  const nutrientId = r.nutrient_id;
  const raw = kind === 'alimenti' ? r.value_per_100g : r.declared_amount;
  if (!raw) continue;
  const nut = units.get(nutrientId);
  if (!nut || nut.kind === 'derived') {
    errors.push(`riga ${i + 2}: ${nutrientId} non è un nutriente di composizione`);
    continue;
  }
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`riga ${i + 2}: valore non valido "${raw}"`);
    continue;
  }
  let conv;
  try {
    conv = toCanonical(value, r.unit || nut.unit, nut.unit);
  } catch (e) {
    errors.push(`riga ${i + 2}: ${(e as Error).message}`);
    continue;
  }
  const status = value === 0 ? 'analytical_zero' : kind === 'integratori' ? 'label' : /ESTIM/i.test(r.status ?? '') ? 'estimated' : 'measured';
  if (kind === 'alimenti') {
    out.push(
      `insert into public.food_nutrients (food_id, nutrient_id, amount_per_100g, unit, value_status, source_value, source_unit, source_basis, conversion_rule, source_id)
  values (${q(r.product_id)}, ${q(nutrientId)}, ${conv.value}, ${q(nut.unit)}, '${status}', ${value}, ${q(r.unit || nut.unit)}, ${q(r.basis || null)}, ${q(conv.rule)}, ${q(r.source_id || null)})
  on conflict (food_id, nutrient_id) do update set amount_per_100g = excluded.amount_per_100g, value_status = excluded.value_status, source_value = excluded.source_value,
  source_unit = excluded.source_unit, source_basis = excluded.source_basis, conversion_rule = excluded.conversion_rule, source_id = excluded.source_id, verified_at = null;`,
    );
  } else {
    out.push(
      `insert into public.supplement_nutrients (supplement_id, nutrient_id, amount_per_unit, unit, value_status, declared_total_or_added, source_value, source_unit, conversion_rule, source_id)
  values (${q(r.supplement_id)}, ${q(nutrientId)}, ${conv.value}, ${q(nut.unit)}, '${status}', ${q(r.declared_total_or_added || null)}, ${value}, ${q(r.unit || nut.unit)}, ${q(conv.rule)}, ${q(r.source_id || null)})
  on conflict (supplement_id, nutrient_id) do update set amount_per_unit = excluded.amount_per_unit, value_status = excluded.value_status, declared_total_or_added = excluded.declared_total_or_added,
  source_value = excluded.source_value, source_unit = excluded.source_unit, conversion_rule = excluded.conversion_rule, source_id = excluded.source_id, verified_at = null;`,
    );
  }
  n++;
}
out.push('commit;');
if (errors.length) {
  console.error(`Righe rifiutate (${errors.length}):\n` + errors.join('\n'));
  process.exit(2);
}
console.log(out.join('\n'));
console.error(`${n} valori pronti. Dopo l'import: verificare, impostare energia e stato dei dati, poi attivare il prodotto.`);
