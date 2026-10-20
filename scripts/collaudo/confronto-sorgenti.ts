// Confronto campo per campo (20/10/2026) fra i JSON reali del 19/10, l'uscita del normale importatore, il catalogo usato dal
// collaudo e dall'iPhone in modalità prova, e i dati caricati in Supabase (file SQL del 16/10). Nessuna scrittura: solo copie in memoria.
// Uso: npx tsx scripts/collaudo/confronto-sorgenti.ts <cartella dei JSON> > docs/CONFRONTO_SORGENTI_2026-10-20.md
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseImport, planImport, type PlanItem } from '../../src/data/catalogImport';
import { LocalRepository } from '../../src/data/localRepository';
import type { Food, Supplement } from '../../src/engine/types';

const dir = process.argv[2];
if (!dir) throw new Error('Indicare la cartella dei JSON del 19/10');
const cat = await new LocalRepository(null).loadCatalog({ bundledUpTo: '2026-10-16' });
const label = new Map(cat.nutrients.map((n) => [n.id, `${n.label} (${n.unit})`]));
const fmt = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'number' ? v.toLocaleString('it-IT', { maximumFractionDigits: 6 }) : typeof v === 'object' ? JSON.stringify(v) : String(v));
const same = (a: number | null | undefined, b: number | null | undefined) =>
  (a ?? null) === null || (b ?? null) === null ? (a ?? null) === (b ?? null) : Math.abs((a as number) - (b as number)) <= 1e-6 * Math.max(Math.abs(a as number), Math.abs(b as number), 1e-12);

// Supabase: il contenuto caricato è il payload JSON dei file SQL generati dalle importazioni del 16/10
function sqlPayload(path: string) {
  const t = readFileSync(path, 'utf8');
  const m = /admin_import_catalog\('([\s\S]*?)'(?:::jsonb)?\)/.exec(t);
  if (!m) throw new Error(`payload non trovato in ${path}`);
  return JSON.parse(m[1].replace(/''/g, "'")) as { products: Record<string, unknown>[]; values: Record<string, unknown>[] };
}
const SQL = { foods: 'supabase/data/2026-10-16_alimenti.sql', supplements: 'supabase/data/2026-10-16_integratori.sql' } as const;

const out: string[] = [];
const p = (s = '') => out.push(s);
p('# Confronto delle sorgenti dei dati — collaudo del 20/10/2026');
p();
p('Generato con `npx tsx scripts/collaudo/confronto-sorgenti.ts <cartella>`; nessuna scrittura su catalogo, database o ricette.');
p();
p('Livelli confrontati (valori **canonici**: unità del dizionario, per 100 g per gli alimenti, per unità di dose per gli integratori; unità diverse ma equivalenti non sono differenze):');
p();
p('1. **JSON 19/10** — file sorgente (percorso e hash sotto).');
p('2. **Importatore** — uscita di `parseImport` + `planImport` (`src/data/catalogImport.ts`, schema definitivo JSON, modalità strict) su una copia del catalogo.');
p('3. **Collaudo / iPhone (prova)** — catalogo di `LocalRepository.loadCatalog()`: pacchetto + `dati/importazioni/2026-10-16/import_*.json` (modalità legacy). È la sorgente usata da `scripts/collaudo/caso-reale.ts` e dall’app in modalità prova.');
p('4. **Supabase (iPhone con accesso)** — payload dei file `supabase/data/2026-10-16_*.sql`, generati dalle stesse importazioni del 16/10. Il database online non è leggibile da qui: se dopo il 16/10 nessuno ha importato altri file dalla scheda Catalogo, è questo.');
p();

for (const [file, kind] of [['alimenti_reali_2026-10-19.json', 'foods'], ['integratori_reali_2026-10-19.json', 'supplements']] as const) {
  const path = resolve(dir, file);
  const text = readFileSync(path, 'utf8');
  const parsed = parseImport(text, kind, cat.nutrients, { mode: 'strict' });
  const plan = planImport(parsed, cat, file);
  const src = JSON.parse(text)[kind] as Record<string, unknown>[];
  const db = sqlPayload(SQL[kind]);
  p(`## ${kind === 'foods' ? 'Alimenti' : 'Integratori'}`);
  p();
  p(`- File: \`${path}\` — sha256 \`${createHash('sha256').update(text).digest('hex')}\``);
  p(`- Importatore: formato ${parsed.format}, modalità ${parsed.mode}; errori ${parsed.errors.length + plan.errors.length + plan.items.reduce((a, i) => a + i.errors.length, 0)}, avvisi ${parsed.warnings.length + plan.warnings.length}, conversioni in sospeso ${plan.items.reduce((a, i) => a + i.pendingConversions.length, 0)}; ${plan.summary.update} prodotti da aggiornare, ${plan.summary.create} da creare, ${plan.summary.values} valori`);
  p(`- Supabase: \`${SQL[kind]}\` (${db.products.length} prodotti, ${db.values.length} valori)`);
  p();
  for (const it of plan.items as PlanItem[]) {
    const cur = (kind === 'foods' ? cat.foods : cat.supplements).find((x) => x.id === it.id) as (Food & Supplement) | undefined;
    const nxt = it.next as Food & Supplement;
    const dbp = db.products.find((x) => x.id === it.id);
    const s = src.find((x) => x.id === it.id)!;
    p(`### ${it.id} — ${nxt.name}`);
    p();
    // campi del prodotto rilevanti per il calcolo o per l'identità
    const fields: [string, unknown, unknown, unknown][] =
      kind === 'foods'
        ? [
            ['stato di lavorazione', nxt.processingState, cur?.processingState, dbp?.processing_state],
            ['energia kcal/100 g', nxt.kcalMePer100g, cur?.kcalMePer100g, dbp?.kcal_me_per_100g ?? '— (calcolata 4/9/4 al caricamento)'],
            ['origine energia', nxt.kcalMePer100g !== null && nxt.kcalMePer100g !== cur?.kcalMePer100g ? 'inserita dal file' : (cur?.kcalMeOrigin ?? '—'), cur?.kcalMeOrigin, dbp?.kcal_me_per_100g ? 'inserita' : 'calcolata'],
            ['qualità dati', nxt.dataStatus, cur?.dataStatus, dbp?.data_status],
          ]
        : [
            ['nome', nxt.name, cur?.name, dbp?.name_it],
            ['marca', nxt.brand, cur?.brand, dbp?.brand],
            ['massa del contenuto g/unità', nxt.massPerUnitG, cur?.massPerUnitG, dbp?.mass_per_unit_g],
            ['kcal/unità', nxt.kcalPerUnit, cur?.kcalPerUnit, dbp?.kcal_per_unit],
            ['etichetta di soli additivi', nxt.labelAddedOnly, cur?.labelAddedOnly, dbp?.label_added_only],
            ['qualità dati', nxt.dataStatus ?? nxt.status, cur?.dataStatus ?? cur?.status, dbp?.data_status ?? dbp?.status],
            ['utilizzabile nel calcolo', nxt.usableForOptimization, cur?.usableForOptimization, dbp?.usable_for_optimization ?? '—'],
            ['tabella d’impiego', nxt.doseGuide?.points.map((x) => `${x.weightKg} kg: ${x.min}–${x.max}`).join('; '), cur?.doseGuide?.points.map((x) => `${x.weightKg} kg: ${x.min}–${x.max}`).join('; '), '—'],
          ];
    p('| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |');
    p('|---|---|---|---|');
    for (const [f, a, b, c] of fields) {
      const diff = fmt(a) !== fmt(b) || fmt(a) !== fmt(c);
      p(`| ${diff ? '**' + f + '**' : f} | ${fmt(a)} | ${fmt(b)} | ${fmt(c)} |`);
    }
    p();
    // valori: differenze canoniche, marcatura total/added, valori presenti in un livello e sconosciuti nell'altro
    const ids = new Set([...Object.keys(nxt.nutrients), ...Object.keys(cur?.nutrients ?? {})]);
    const rows: string[] = [];
    for (const id of ids) {
      const a = nxt.nutrients[id];
      const b = cur?.nutrients[id];
      const d = db.values.find((v) => v.product_id === it.id && v.nutrient_id === id);
      const dv = (d?.amount as number | undefined) ?? null;
      const av = a?.value ?? null;
      const bv = b?.value ?? null;
      const ad = a?.declared ?? null;
      const bd = b?.declared ?? null;
      const dd = (d?.declared_total_or_added as string | null | undefined) ?? null;
      if (same(av, bv) && same(av, dv) && ad === bd && ad === dd) continue;
      const raw = (s.nutrients as Record<string, Record<string, unknown>> | undefined)?.[id];
      const vc = it.valueChanges.find((v) => v.nutrientId === id);
      const rawText = raw ? `${fmt(raw.value)} ${raw.unit ?? ''} ${raw.basis ?? ''}`.trim() : '—';
      // somma dichiarata nel file e somma calcolata dai componenti nei livelli precedenti: equivalenti se coincidono
      if (id === 'epa_dha' && bv === null && same(av, (cur?.nutrients.epa?.value ?? 0) + (cur?.nutrients.dha?.value ?? 0))) {
        rows.push(`| ${label.get(id) ?? id} | ${rawText} | ${fmt(av)} (${ad}) | calcolata EPA + DHA = ${fmt((cur?.nutrients.epa?.value ?? 0) + (cur?.nutrients.dha?.value ?? 0))} | calcolata | equivalente |`.replace(/ \| equivalente \|$/, ' (equivalente) |'));
        continue;
      }
      rows.push(`| ${label.get(id) ?? id} | ${rawText} | ${fmt(av)}${ad ? ` (${ad})` : ''}${vc?.conversion ? ` — ${vc.conversion}` : ''} | ${fmt(bv)}${bd ? ` (${bd})` : ''} | ${fmt(dv)}${dd ? ` (${dd})` : ''} |`);
    }
    if (rows.length) {
      p('| Nutriente | JSON 19/10 (come scritto) | Importatore (canonico) | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |');
      p('|---|---|---|---|---|');
      for (const r of rows) p(r);
    } else p('Valori nutrizionali canonici e marcature total/added identici nei quattro livelli.');
    p();
    // fedeltà dell'importatore: ogni valore del file risulta nel prodotto importato (NA = sconosciuto, mai zero)
    const lost: string[] = [];
    for (const [id, raw] of Object.entries((s.nutrients ?? {}) as Record<string, Record<string, unknown>>)) {
      const v = nxt.nutrients[id];
      if (raw.value === 'NA' || raw.value === null) {
        if (v && v.value !== null) lost.push(`${id}: NA nel file ma ${v.value} dopo l’importazione`);
      } else if (!v || v.value === null) lost.push(`${id}: ${raw.value} ${raw.unit} nel file ma assente dopo l’importazione`);
    }
    p(lost.length ? `Fedeltà dell’importatore: **${lost.join('; ')}**` : 'Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).');
    p();
  }
}
console.log(out.join('\n'));
