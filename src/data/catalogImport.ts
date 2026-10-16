// Importazione e aggiornamento massivo del catalogo (solo amministratori).
// 1) parseImport: legge CSV (formato lungo dei modelli D/E, formato largo "un nutriente per colonna", anagrafiche) o JSON;
// 2) planImport: associa i nutrienti agli ID, confronta con il catalogo (crea/aggiorna/invariato, nessun duplicato),
//    verifica unità, valori, fonti e campi obbligatori e calcola lo stato risultante — SENZA modificare nulla;
// 3) l'archivio applica il piano solo se non ci sono errori, in un'unica operazione (tutto o niente),
//    conservando le versioni precedenti; le ricette collegate risultano "da ricalcolare".

import { foodStatus, supplementStatus, type CatalogStatus, type StatusResult } from '../engine/catalogStatus';
import { isMassUnit, normalizeUnit, toCanonical } from '../engine/units';
import type { DataStatus, DoseUnit, Food, Nutrient, NutrientValue, ProcessingState, Supplement, ValueStatus } from '../engine/types';
import type { Category } from './packageCatalog';

export type ImportKind = 'foods' | 'supplements';
export type ImportFormat = 'csv-long' | 'csv-wide' | 'json';

export interface ImportIssue {
  line?: number;
  productId?: string;
  message: string;
}

interface RawValue {
  line?: number;
  productId: string;
  nutrientKey: string;
  raw: string;
  unit: string;
  status?: string;
  source?: string;
  method?: string;
  basis?: string;
  perDose?: string;
  declared?: string;
}

interface RawProduct {
  line?: number;
  id: string;
  fields: Record<string, string>;
}

export interface ParsedImport {
  kind: ImportKind;
  format: ImportFormat;
  products: RawProduct[];
  values: RawValue[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface ValueChange {
  nutrientId: string;
  label: string;
  unit: string;
  before: number | null;
  after: number | null;
  /** valore e unità come scritti nel file, per tracciabilità. */
  sourceValue: number | null;
  sourceUnit: string | null;
  rule: string | null;
  status: ValueStatus;
  source: string | null;
  basis: string | null;
  method: string | null;
  declared: string | null;
}

export interface PlanItem {
  kind: ImportKind;
  id: string;
  name: string;
  action: 'create' | 'update' | 'unchanged';
  fieldChanges: { field: string; before: unknown; after: unknown }[];
  valueChanges: ValueChange[];
  statusBefore: CatalogStatus | null;
  statusAfter: StatusResult;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  /** valori con unità valida ma non convertibile senza fattore approvato: non importati. */
  pendingConversions: { nutrientId: string; label: string; value: number; unit: string; targetUnit: string }[];
  next: Food | Supplement;
}

export interface ImportPlan {
  kind: ImportKind;
  format: ImportFormat;
  fileName: string;
  items: PlanItem[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  canApply: boolean;
  summary: { create: number; update: number; unchanged: number; values: number };
}

export interface CatalogForImport {
  foods: Food[];
  supplements: Supplement[];
  categories: Category[];
  nutrients: Nutrient[];
}

// ───────────────────────── utilità ─────────────────────────

export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseCsv(text: string): { headers: string[]; rows: { line: number; cells: Record<string, string> }[] } {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: { line: number; fields: string[] }[] = [];
  let cur: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let startLine = 1;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else {
        if (c === '\n') line++;
        field += c;
      }
    } else if (c === '"') quoted = true;
    else if (c === sep) cur.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      cur.push(field);
      if (cur.some((x) => x.trim() !== '')) rows.push({ line: startLine, fields: cur });
      cur = [];
      field = '';
      line++;
      startLine = line;
    } else field += c;
  }
  cur.push(field);
  if (cur.some((x) => x.trim() !== '')) rows.push({ line: startLine, fields: cur });
  const [head, ...body] = rows;
  const headers = (head?.fields ?? []).map((h) => h.trim());
  return { headers, rows: body.map((r) => ({ line: r.line, cells: Object.fromEntries(headers.map((h, i) => [h, (r.fields[i] ?? '').trim()])) })) };
}

/** Indice per riconoscere i nutrienti da ID, nome italiano, parti del nome e sinonimi comuni (IT/EN/simboli). */
const ALIASES: Record<string, string[]> = {
  protein: ['proteina', 'proteine grezze', 'crude protein', 'protein'],
  fat: ['grassi', 'lipidi', 'total fat', 'fat total', 'grasso'],
  carbohydrate_available: ['carboidrati', 'carbohydrate', 'carbohydrates', 'available carbohydrate'],
  fiber: ['fibra', 'fibra totale', 'fiber', 'fibre', 'dietary fiber'],
  moisture: ['acqua', 'water', 'moisture'],
  linoleic_acid: ['acido linoleico', 'linoleic acid', 'la', 'c18 2'],
  ala: ['alfa linolenico', 'alpha linolenic acid', 'c18 3'],
  epa_dha: ['epa dha', 'epa + dha'],
  omega3_total: ['omega 3', 'omega 3 totali', 'n 3', 'total omega 3'],
  omega6_total: ['omega 6', 'omega 6 totali', 'n 6', 'total omega 6'],
  arachidonic_acid: ['ara', 'arachidonic acid'],
  calcium: ['ca', 'calcio', 'calcium'],
  phosphorus: ['p', 'fosforo', 'phosphorus'],
  potassium: ['k', 'potassio', 'potassium'],
  sodium: ['na', 'sodio', 'sodium'],
  chloride: ['cl', 'cloro', 'cloruri', 'chloride', 'chlorine'],
  magnesium: ['magnesio', 'magnesium'],
  copper: ['cu', 'rame', 'copper'],
  iodine: ['iodio', 'iodine'],
  iron: ['fe', 'ferro', 'iron'],
  manganese: ['mn', 'manganese'],
  selenium_wet: ['se', 'selenio', 'selenium'],
  zinc: ['zn', 'zinco', 'zinc'],
  vitamin_a: ['vit a', 'vitamin a', 'retinolo'],
  vitamin_d: ['vit d', 'vitamin d', 'vitamina d3', 'colecalciferolo'],
  vitamin_e: ['vit e', 'vitamin e'],
  vitamin_b1: ['tiamina', 'thiamin', 'thiamine', 'vitamin b1'],
  vitamin_b2: ['riboflavina', 'riboflavin', 'vitamin b2'],
  vitamin_b3: ['niacina', 'niacin', 'vitamin b3'],
  vitamin_b5: ['acido pantotenico', 'pantothenic acid', 'vitamin b5'],
  vitamin_b6: ['piridossina', 'vitamin b6'],
  vitamin_b9: ['folati', 'acido folico', 'folate', 'folic acid', 'vitamin b9'],
  vitamin_b12: ['cobalamina', 'vitamin b12'],
  choline: ['colina', 'choline'],
  vitamin_c: ['vitamin c', 'acido ascorbico'],
  vitamin_b7: ['biotina', 'biotin', 'vitamin b7'],
  vitamin_k: ['vitamin k'],
  methionine_cystine: ['met cys', 'metionina cistina', 'methionine cystine'],
  phenylalanine_tyrosine: ['phe tyr', 'fenilalanina tirosina', 'phenylalanine tyrosine'],
  taurine: ['taurina', 'taurine'],
  l_carnitine: ['carnitina', 'l carnitina', 'carnitine', 'l carnitine'],
};

export function nutrientIndex(nutrients: Nutrient[]): Map<string, Nutrient> {
  const idx = new Map<string, Nutrient>();
  const add = (k: string, n: Nutrient) => {
    const key = norm(k);
    if (key && !idx.has(key)) idx.set(key, n);
  };
  for (const n of nutrients) {
    if (n.kind === 'derived' || n.id === 'metabolizable_energy') continue;
    add(n.id, n);
    add(n.label, n);
    for (const part of n.label.split('/')) add(part.replace(/\(.*?\)/g, ''), n);
    for (const a of ALIASES[n.id] ?? []) add(a, n);
  }
  return idx;
}

/** "Calcio (mg)" / "calcium [mg]" / "calcio_mg" → { name, unit } */
function splitHeader(h: string): { name: string; unit: string | null } {
  const m = h.match(/^(.*?)\s*[([]\s*([^)\]]+)\s*[)\]]\s*$/);
  if (m) return { name: m[1], unit: m[2] };
  const u = h.match(/^(.*?)[_ ](g|mg|ug|µg|mcg|iu|ui|kcal)$/i);
  if (u) return { name: u[1], unit: u[2] };
  return { name: h, unit: null };
}

const FOOD_FIELDS: Record<string, string[]> = {
  id: ['id', 'product id', 'food id', 'codice'],
  name: ['name it', 'name', 'nome'],
  categoryId: ['category', 'categoria'],
  subcategoryId: ['subcategory', 'sottocategoria'],
  processingState: ['processing state', 'stato', 'stato preparazione'],
  speciesCut: ['species cut', 'taglio', 'specie taglio'],
  preparation: ['preparation', 'preparazione'],
  ediblePortion: ['edible portion', 'parte edibile'],
  kcalMePer100g: ['kcal me per 100g', 'kcal', 'energia', 'energia metabolizzabile', 'metabolizable energy', 'kcal me'],
  meMethod: ['me method', 'metodo em', 'me calculation method', 'metodo energia'],
  source: ['source identifier', 'source', 'fonte', 'fdc id', 'nutrition source id'],
  sourceUrl: ['source url', 'url fonte'],
  sourceVersion: ['source version', 'versione fonte'],
  dataStatus: ['data status', 'qualita dati'],
  uncertainty: ['uncertainty', 'incertezza'],
  notes: ['notes', 'note'],
};
const SUPP_FIELDS: Record<string, string[]> = {
  id: ['id', 'product id', 'supplement id', 'codice'],
  name: ['name it', 'name', 'nome'],
  brand: ['brand', 'marca'],
  variant: ['product variant', 'variant', 'variante'],
  supplementClass: ['class', 'classe'],
  doseUnit: ['dose unit', 'unita dose'],
  massPerUnitG: ['mass per unit g', 'dose mass g', 'grammi per unita'],
  kcalPerUnit: ['kcal per unit', 'kcal per dose', 'kcal'],
  integerDose: ['integer dose', 'dosi intere'],
  maxDailyUnits: ['max daily units', 'max daily product dose', 'dose massima'],
  maxDailySource: ['max daily source', 'max daily dose source', 'fonte dose massima'],
  labelSource: ['label source', 'source label url', 'etichetta', 'scheda tecnica', 'source', 'fonte'],
  version: ['product version', 'version', 'versione', 'lotto'],
  labelAddedOnly: ['label added only', 'solo aggiunti'],
  notes: ['notes', 'note'],
};
/** colonne note dei file del pacchetto che l'importazione non usa (l'attivazione si fa dopo la convalida). */
const IGNORED = ['available to formulate', 'usable for optimization', 'nutrition status', 'nutrient profile status', 'food data id', 'density per 100g', 'dose volume ml', 'verified'];
const LONG_COLS = {
  product: ['product id', 'food id', 'supplement id', 'id prodotto'],
  nutrient: ['nutrient id', 'nutrient', 'nutriente'],
  value: ['value per 100g', 'declared amount', 'amount per unit', 'amount per dose', 'value', 'valore', 'amount'],
  unit: ['unit', 'unita'],
  basis: ['basis', 'base'],
  source: ['source id', 'source', 'fonte'],
  status: ['status', 'value status', 'stato valore'],
  method: ['method', 'metodo'],
  perDose: ['per dose'],
  declared: ['declared total or added'],
};

function fieldOf(map: Record<string, string[]>, header: string): string | null {
  const h = norm(header);
  for (const [f, keys] of Object.entries(map)) if (keys.includes(h)) return f;
  return null;
}
function colOf(headers: string[], keys: string[]): string | null {
  return headers.find((h) => keys.includes(norm(h))) ?? null;
}

// ───────────────────────── lettura ─────────────────────────

export function parseImport(text: string, kind: ImportKind, nutrients: Nutrient[]): ParsedImport {
  const out: ParsedImport = { kind, format: 'csv-wide', products: [], values: [], errors: [], warnings: [] };
  const trimmed = text.trim();
  if (!trimmed) {
    out.errors.push({ message: 'File vuoto.' });
    return out;
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJson(trimmed, kind, out);
  const { headers, rows } = parseCsv(text);
  const fields = kind === 'foods' ? FOOD_FIELDS : SUPP_FIELDS;
  const idx = nutrientIndex(nutrients);
  const productCol = colOf(headers, LONG_COLS.product);
  const nutrientCol = colOf(headers, LONG_COLS.nutrient);
  if (nutrientCol) {
    // formato lungo: una riga per prodotto × nutriente (modelli D/E del pacchetto)
    out.format = 'csv-long';
    const valueCol = colOf(headers, LONG_COLS.value);
    if (!productCol || !valueCol) {
      out.errors.push({ message: 'Formato lungo: servono le colonne del prodotto (product_id) e del valore (value_per_100g / declared_amount).' });
      return out;
    }
    const get = (r: Record<string, string>, keys: string[]) => {
      const c = colOf(headers, keys);
      return c ? r[c] : '';
    };
    for (const { line, cells } of rows) {
      out.values.push({
        line,
        productId: cells[productCol],
        nutrientKey: cells[nutrientCol],
        raw: cells[valueCol],
        unit: get(cells, LONG_COLS.unit),
        status: get(cells, LONG_COLS.status),
        source: get(cells, LONG_COLS.source),
        method: get(cells, LONG_COLS.method),
        basis: get(cells, LONG_COLS.basis),
        perDose: get(cells, LONG_COLS.perDose),
        declared: get(cells, LONG_COLS.declared),
      });
    }
    return out;
  }
  // formato largo o anagrafica: colonne di prodotto + eventuali colonne di nutrienti
  const idCol = headers.find((h) => fieldOf(fields, h) === 'id');
  if (!idCol) {
    out.errors.push({ message: 'Manca la colonna dell’identificativo stabile (id).' });
    return out;
  }
  const productHeaders: [string, string][] = [];
  const nutrientHeaders: [string, string, string | null][] = [];
  for (const h of headers) {
    if (h === idCol) continue;
    const f = fieldOf(fields, h);
    if (f) {
      productHeaders.push([h, f]);
      continue;
    }
    if (IGNORED.includes(norm(h))) {
      out.warnings.push({ message: `Colonna «${h}» ignorata: attivazione e convalida si fanno dopo l’importazione, dall’amministratore.` });
      continue;
    }
    const { name, unit } = splitHeader(h);
    const n = idx.get(norm(name)) ?? idx.get(norm(h));
    if (n) nutrientHeaders.push([h, n.id, unit]);
    else out.errors.push({ message: `Colonna «${h}» non riconosciuta: non è un campo del prodotto né un nutriente del dizionario.` });
  }
  for (const { line, cells } of rows) {
    const id = cells[idCol];
    const pf: Record<string, string> = {};
    for (const [h, f] of productHeaders) if (cells[h] !== '') pf[f] = cells[h];
    out.products.push({ line, id, fields: pf });
    for (const [h, nid, unit] of nutrientHeaders) {
      if (cells[h] === '') continue;
      out.values.push({ line, productId: id, nutrientKey: nid, raw: cells[h], unit: unit ?? '', source: '' });
    }
  }
  return out;
}

function parseJson(text: string, kind: ImportKind, out: ParsedImport): ParsedImport {
  out.format = 'json';
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    out.errors.push({ message: `JSON non valido: ${(e as Error).message}` });
    return out;
  }
  const list = Array.isArray(data) ? data : ((data as Record<string, unknown>)[kind] as unknown[]) ?? ((data as Record<string, unknown>).items as unknown[]);
  if (!Array.isArray(list)) {
    out.errors.push({ message: `Nel JSON serve un elenco «${kind}» (o un array di prodotti).` });
    return out;
  }
  const fields = kind === 'foods' ? FOOD_FIELDS : SUPP_FIELDS;
  list.forEach((p, i) => {
    const line = i + 1;
    if (!p || typeof p !== 'object') {
      out.errors.push({ line, message: 'Elemento non valido.' });
      return;
    }
    const obj = p as Record<string, unknown>;
    let id = '';
    const pf: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'nutrients') continue;
      const f = fieldOf(fields, k);
      if (f === 'id') id = String(v ?? '');
      else if (f) {
        if (v !== null && v !== undefined && v !== '') pf[f] = String(v);
      } else if (IGNORED.includes(norm(k))) out.warnings.push({ line, message: `Campo «${k}» ignorato.` });
      else out.errors.push({ line, message: `Campo «${k}» non riconosciuto.` });
    }
    out.products.push({ line, id, fields: pf });
    const nut = obj.nutrients;
    const entries: [string, unknown][] = Array.isArray(nut)
      ? nut.map((x) => [String((x as Record<string, unknown>).nutrient_id ?? (x as Record<string, unknown>).nutrient ?? ''), x])
      : nut && typeof nut === 'object'
        ? Object.entries(nut as Record<string, unknown>)
        : [];
    for (const [key, v] of entries) {
      const o = (v && typeof v === 'object' ? v : { value: v }) as Record<string, unknown>;
      const raw = o.value ?? o.amount ?? o.value_per_100g ?? o.declared_amount;
      out.values.push({
        line,
        productId: id,
        nutrientKey: key,
        raw: raw === null ? 'null' : raw === undefined ? '' : String(raw),
        unit: String(o.unit ?? ''),
        status: o.status !== undefined ? String(o.status) : '',
        source: o.source !== undefined ? String(o.source) : o.source_id !== undefined ? String(o.source_id) : '',
        method: o.method !== undefined ? String(o.method) : '',
        basis: o.basis !== undefined ? String(o.basis) : '',
        perDose: o.per_dose !== undefined ? String(o.per_dose) : '',
        declared: o.declared_total_or_added !== undefined ? String(o.declared_total_or_added) : '',
      });
    }
  });
  return out;
}

// ───────────────────────── verifica e piano ─────────────────────────

const ID_RE = /^[a-z0-9][a-z0-9_]{1,62}$/;
const CLEAR_TOKENS = new Set(['null', 'na', 'n a', 'nd', 'n d', 'non disponibile']);
const PROCESSING: ProcessingState[] = ['raw', 'cooked_boiled', 'cooked_baked', 'cooked_other', 'dried', 'canned', 'raw_or_unspecified'];
const PROCESSING_ALIASES: Record<string, ProcessingState> = { crudo: 'raw', bollito: 'cooked_boiled', lesso: 'cooked_boiled', 'al forno': 'cooked_baked', cotto: 'cooked_other', essiccato: 'dried', 'in scatola': 'canned' };
const DOSE_UNITS: Record<string, DoseUnit> = { g: 'g', gram: 'g', grammi: 'g', ml: 'ml', capsule: 'capsule', capsula: 'capsule', tablet: 'tablet', compressa: 'tablet', scoop: 'scoop', misurino: 'scoop' };

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, '');
  if (!s) return null;
  const n = Number(/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Qualità del valore. Accetta anche i codici delle fonti (es. REPORTED_USDA_PROXY), conservati come «metodo». */
function mapValueStatus(raw: string | undefined, value: number): ValueStatus | null {
  const s = norm(raw ?? '');
  if (value === 0 && (s === '' || s === 'unverified' || s === 'verified' || s === 'zero' || s === 'analytical zero')) return 'analytical_zero';
  if (s === '' || s === 'unverified' || s === 'verified' || s === 'measured' || s === 'misurato' || s === 'analitico') return 'measured';
  if (['estimated', 'stima', 'stimato', 'estimate'].includes(s)) return 'estimated';
  if (['label', 'etichetta', 'dichiarato'].includes(s)) return 'label';
  if (['calculated', 'calcolato', 'derived'].includes(s)) return 'calculated';
  if (['analytical zero', 'zero analitico'].includes(s)) return 'analytical_zero';
  // codici delle fonti: valori tipici di banca dati usati come proxy, schermate, basi da confermare → stima
  // uno zero riportato esplicitamente dalla fonte è un dato dichiarato, non una stima
  if (value === 0 && /reported|declared|proxy|approx|screenshot|confirm|assumed/.test(s)) return 'analytical_zero';
  if (/proxy|approx|screenshot|confirm|assumed|unverified|provvisorio/.test(s)) return 'estimated';
  if (/analytical declared|manufacturer declared|declared/.test(s)) return 'label';
  return null;
}

/** "1 g", "1 capsula", "5" → numero di dosi; null se non leggibile. */
function parseDoseCount(raw: string): number | null {
  const m = raw.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

const KNOWN_UNITS = new Set(['g', 'mg', 'µg', 'kg', 'IU', 'kcal', '%']);

function parseBool(raw: string): boolean | null {
  const s = norm(raw);
  if (['true', 'si', 'sì', 'yes', '1', 'vero'].includes(s)) return true;
  if (['false', 'no', '0', 'falso'].includes(s)) return false;
  return null;
}

function resolveCategory(cats: Category[], categoryRaw: string | undefined, subRaw: string | undefined): { cat: string; sub: string } | null {
  if (!subRaw) return null;
  const match = (raw: string, list: Category[]) => list.find((c) => c.id === raw || norm(c.id) === norm(raw) || norm(c.label) === norm(raw));
  let sub = match(subRaw, cats.filter((c) => c.parentId));
  // file del pacchetto: categoria "vegetable" + sottocategoria "vegetable"
  if (!sub && categoryRaw && norm(subRaw) === norm(categoryRaw)) sub = cats.find((c) => c.parentId && norm(c.parentId) === norm(categoryRaw));
  if (!sub) return null;
  if (categoryRaw) {
    const cat = match(categoryRaw, cats.filter((c) => !c.parentId));
    if (cat && cat.id !== sub.parentId) return null;
  }
  return { cat: sub.parentId as string, sub: sub.id };
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function planImport(parsed: ParsedImport, catalog: CatalogForImport, fileName = 'import'): ImportPlan {
  const kind = parsed.kind;
  const errors: ImportIssue[] = [...parsed.errors];
  const warnings: ImportIssue[] = [...parsed.warnings];
  const idx = nutrientIndex(catalog.nutrients);
  const existing: (Food | Supplement)[] = kind === 'foods' ? catalog.foods : catalog.supplements;
  const byId = new Map(existing.map((p) => [p.id, p]));
  const otherKind = new Set((kind === 'foods' ? catalog.supplements : catalog.foods).map((p) => p.id));
  const items = new Map<string, PlanItem>();
  const itemFor = (id: string, line?: number): PlanItem | null => {
    if (items.has(id)) return items.get(id)!;
    if (!ID_RE.test(id)) {
      errors.push({ line, productId: id, message: `Identificativo «${id}» non valido: usare minuscole, numeri e _ (es. beef_lean).` });
      return null;
    }
    if (otherKind.has(id)) {
      errors.push({ line, productId: id, message: `L’ID «${id}» appartiene all’altro catalogo (${kind === 'foods' ? 'integratori' : 'alimenti'}).` });
      return null;
    }
    const prev = byId.get(id);
    const next = prev
      ? structuredClone(prev)
      : kind === 'foods'
        ? ({ id, name: '', categoryId: '', subcategoryId: '', processingState: 'raw_or_unspecified', kcalMePer100g: null, dataStatus: 'unverified', availableToFormulate: false, profileVersion: 0, nutrients: {} } as Food)
        : ({ id, name: '', doseUnit: 'g', massPerUnitG: null, kcalPerUnit: null, integerDose: false, maxDailyUnits: null, status: 'missing', usableForOptimization: false, profileVersion: 0, nutrients: {} } as Supplement);
    const it: PlanItem = {
      kind,
      id,
      name: prev?.name ?? id,
      action: prev ? 'update' : 'create',
      fieldChanges: [],
      valueChanges: [],
      statusBefore: prev ? (kind === 'foods' ? foodStatus(prev as Food, catalog.nutrients) : supplementStatus(prev as Supplement, catalog.nutrients)).status : null,
      statusAfter: { status: 'to_complete', reasons: [], missing: [], readyForValidation: false },
      errors: [],
      warnings: [],
      pendingConversions: [],
      next,
    };
    items.set(id, it);
    return it;
  };

  // anagrafiche
  const seenProducts = new Set<string>();
  for (const p of parsed.products) {
    if (!p.id) {
      errors.push({ line: p.line, message: 'Riga senza identificativo (id).' });
      continue;
    }
    if (seenProducts.has(p.id)) {
      errors.push({ line: p.line, productId: p.id, message: `Prodotto «${p.id}» ripetuto nel file.` });
      continue;
    }
    seenProducts.add(p.id);
    const it = itemFor(p.id, p.line);
    if (!it) continue;
    const n = it.next as unknown as Record<string, unknown>;
    const err = (m: string) => it.errors.push({ line: p.line, productId: p.id, message: m });
    const set = (f: string, v: unknown) => {
      if (!same(n[f], v)) it.fieldChanges.push({ field: f, before: n[f] ?? null, after: v });
      n[f] = v;
    };
    const f = p.fields;
    if (f.name !== undefined) set('name', f.name.trim());
    if (kind === 'foods') {
      if (f.subcategoryId !== undefined || f.categoryId !== undefined) {
        const r = resolveCategory(catalog.categories, f.categoryId, f.subcategoryId ?? (n.subcategoryId as string));
        if (!r) err(`Categoria/sottocategoria non valida: «${f.categoryId ?? ''} / ${f.subcategoryId ?? ''}». Usare le categorie del catalogo (es. animal / secreting_offal_liver).`);
        else {
          set('categoryId', r.cat);
          set('subcategoryId', r.sub);
        }
      }
      if (f.processingState !== undefined) {
        const ps = PROCESSING.find((x) => x === f.processingState) ?? PROCESSING_ALIASES[norm(f.processingState)];
        if (!ps) err(`Stato di preparazione «${f.processingState}» non valido (${PROCESSING.join(', ')}).`);
        else set('processingState', ps);
      }
      for (const k of ['speciesCut', 'preparation', 'ediblePortion', 'meMethod', 'source', 'sourceVersion', 'uncertainty', 'notes'] as const) if (f[k] !== undefined) set(k, f[k]);
      if (f.sourceUrl !== undefined) set('notes', [n.notes, `URL fonte: ${f.sourceUrl}`].filter(Boolean).join(' · '));
      if (f.kcalMePer100g !== undefined) {
        const v = parseNumber(f.kcalMePer100g);
        if (v === null || Number.isNaN(v) || v < 0 || v > 900) err(`Energia «${f.kcalMePer100g}» non valida (kcal EM per 100 g, tra 0 e 900).`);
        else set('kcalMePer100g', v);
      }
      if (f.dataStatus !== undefined) {
        const s = norm(f.dataStatus);
        const map: Record<string, DataStatus> = { estimated: 'estimated', stima: 'estimated', review_required: 'review_required', 'review required': 'review_required', unverified: 'unverified', not_verified: 'unverified', 'not verified': 'unverified' };
        if (s === 'verified' || s === 'verificato') it.warnings.push({ line: p.line, productId: p.id, message: 'Lo stato «verificato» non si importa: si ottiene con la convalida dell’amministratore.' });
        else if (map[s]) set('dataStatus', map[s]);
        else err(`Stato dei dati «${f.dataStatus}» non valido.`);
      }
    } else {
      for (const k of ['brand', 'variant', 'supplementClass', 'maxDailySource', 'labelSource', 'version', 'notes'] as const) if (f[k] !== undefined) set(k, f[k]);
      if (f.doseUnit !== undefined) {
        const u = DOSE_UNITS[norm(f.doseUnit)];
        if (!u) err(`Unità di dose «${f.doseUnit}» non valida (g, ml, capsule, tablet, scoop).`);
        else {
          set('doseUnit', u);
          if (f.integerDose === undefined) set('integerDose', ['capsule', 'tablet', 'scoop'].includes(u));
        }
      }
      for (const k of ['massPerUnitG', 'kcalPerUnit', 'maxDailyUnits'] as const) {
        if (f[k] === undefined) continue;
        const v = parseNumber(f[k]);
        if (v === null || Number.isNaN(v) || v < 0 || (k !== 'kcalPerUnit' && v === 0)) err(`Valore «${f[k]}» non valido per ${k}.`);
        else set(k, v);
      }
      for (const k of ['integerDose', 'labelAddedOnly'] as const) {
        if (f[k] === undefined) continue;
        const b = parseBool(f[k]);
        if (b === null) err(`Valore «${f[k]}» non valido per ${k} (sì/no).`);
        else set(k, b);
      }
    }
  }

  // valori nutrizionali
  const seenValues = new Set<string>();
  for (const v of parsed.values) {
    if (!v.productId) {
      errors.push({ line: v.line, message: 'Valore senza prodotto.' });
      continue;
    }
    if (!byId.has(v.productId) && !seenProducts.has(v.productId)) {
      errors.push({ line: v.line, productId: v.productId, message: `Prodotto «${v.productId}» inesistente: aggiungerlo prima in anagrafica (stesso file o catalogo).` });
      continue;
    }
    const it = itemFor(v.productId, v.line);
    if (!it) continue;
    const err = (m: string) => it.errors.push({ line: v.line, productId: v.productId, message: m });
    if (!v.raw.trim()) continue; // vuoto = nessuna modifica (il dato resta com'è; mai zero)
    const nut = idx.get(norm(v.nutrientKey));
    if (!nut) {
      if (norm(v.nutrientKey) === 'metabolizable energy' || norm(v.nutrientKey) === 'energia metabolizzabile') err('L’energia va nel campo del prodotto (kcal_me_per_100g / kcal_per_unit), non tra i nutrienti.');
      else err(`Nutriente «${v.nutrientKey}» non riconosciuto nel dizionario.`);
      continue;
    }
    const key = `${v.productId}:${nut.id}`;
    if (seenValues.has(key)) {
      err(`${nut.label}: indicato più volte nel file.`);
      continue;
    }
    seenValues.add(key);
    const cur = it.next.nutrients[nut.id];
    const before = cur?.value ?? null;
    if (CLEAR_TOKENS.has(norm(v.raw))) {
      if (before !== null) {
        it.valueChanges.push({ nutrientId: nut.id, label: nut.label, unit: nut.unit, before, after: null, sourceValue: null, sourceUnit: null, rule: null, status: 'unknown', source: v.source || null, basis: null, method: null, declared: null });
        it.next.nutrients[nut.id] = { value: null, status: 'unknown', source: v.source || null };
      }
      continue;
    }
    let value = parseNumber(v.raw);
    if (value === null || Number.isNaN(value) || value < 0) {
      err(`${nut.label}: valore «${v.raw}» non valido (numero ≥ 0, oppure NA per «non disponibile»).`);
      continue;
    }
    if (!v.unit) {
      err(`${nut.label}: unità mancante (attesa ${nut.unit} o un’unità di massa convertibile).`);
      continue;
    }
    let conv: { value: number; rule: string } | undefined;
    try {
      conv = toCanonical(value, v.unit, nut.unit);
    } catch {
      if (value === 0 && KNOWN_UNITS.has(normalizeUnit(v.unit))) {
        conv = { value: 0, rule: `zero: uguale in ogni unità (${normalizeUnit(v.unit)} → ${nut.unit})` };
      } else if (KNOWN_UNITS.has(normalizeUnit(v.unit)) && KNOWN_UNITS.has(normalizeUnit(nut.unit))) {
        // unità valida ma di altra natura (es. µg → UI): serve un fattore approvato per la forma chimica
        it.warnings.push({ line: v.line, productId: v.productId, message: `${nut.label}: ${v.raw} ${v.unit} non importato — da convertire in ${nut.unit} con un fattore approvato per la forma chimica; resta «non disponibile».` });
        it.pendingConversions.push({ nutrientId: nut.id, label: nut.label, value: parseNumber(v.raw) ?? NaN, unit: v.unit, targetUnit: nut.unit });
      } else {
        err(`${nut.label}: unità «${v.unit}» non riconosciuta o non convertibile in ${nut.unit}.`);
      }
      if (!conv) continue;
    }
    value = conv.value;
    if (kind === 'supplements' && v.perDose) {
      const pd = parseDoseCount(v.perDose);
      if (pd === null || pd <= 0) {
        err(`${nut.label}: «per_dose» «${v.perDose}» non valido.`);
        continue;
      }
      if (pd !== 1) {
        value = value / pd;
        it.warnings.push({ line: v.line, productId: v.productId, message: `${nut.label}: valore riferito a ${pd} dosi, convertito per 1 dose.` });
      }
    }
    const status = mapValueStatus(v.status, value);
    if (!status) {
      err(`${nut.label}: stato del valore «${v.status}» non valido (measured, label, calculated, estimated, analytical_zero).`);
      continue;
    }
    if (value === 0 && status === 'estimated') {
      err(`${nut.label}: uno zero deve essere un dato analitico o di etichetta, non una stima.`);
      continue;
    }
    const productSource = kind === 'foods' ? (it.next as Food).source : (it.next as Supplement).labelSource;
    const source = v.source || productSource || null;
    if (!source) {
      err(`${nut.label}: fonte mancante (colonna source_id o fonte del prodotto).`);
      continue;
    }
    if (kind === 'foods' && v.basis && /cook|cott/i.test(v.basis) !== /cook/.test((it.next as Food).processingState)) {
      it.warnings.push({ line: v.line, productId: v.productId, message: `${nut.label}: base «${v.basis}» non coerente con lo stato del prodotto (${(it.next as Food).processingState}). Crudo e cotto sono prodotti distinti.` });
    }
    const dn = norm(v.declared ?? '');
    const declared = dn === 'added' ? 'added' : dn === 'total' ? 'total' : null;
    if (v.declared && !declared && !['reported or estimated', 'unknown', ''].includes(dn)) err(`${nut.label}: declared_total_or_added deve essere total o added.`);
    if (declared === 'added' && kind === 'supplements' && !(it.next as Supplement).labelAddedOnly) {
      (it.next as Supplement).labelAddedOnly = true;
      it.fieldChanges.push({ field: 'labelAddedOnly', before: false, after: true });
    }
    const sourceCode = v.status && !['measured', 'label', 'calculated', 'estimated', 'analytical_zero', ''].includes(norm(v.status).replace(' ', '_')) ? v.status : null;
    const nv: NutrientValue = { value, status, source, method: v.method || sourceCode || null };
    if (!same(cur?.value, nv.value) || !same(cur?.status ?? null, nv.status) || !same(cur?.source ?? null, nv.source) || !same(cur?.method ?? null, nv.method)) {
      it.valueChanges.push({
        nutrientId: nut.id,
        label: nut.label,
        unit: nut.unit,
        before,
        after: value,
        sourceValue: parseNumber(v.raw),
        sourceUnit: normalizeUnit(v.unit),
        rule: conv.rule,
        status,
        source,
        basis: v.basis || null,
        method: nv.method ?? null,
        declared,
      });
    }
    it.next.nutrients[nut.id] = nv;
  }

  // controlli sul prodotto risultante
  const existingNames = new Map(existing.map((p) => [norm(p.name), p.id]));
  const newNames = new Map<string, string>();
  for (const it of items.values()) {
    const p = it.next;
    const err = (m: string) => it.errors.push({ productId: it.id, message: m });
    if (!p.name) err('Nome obbligatorio.');
    else {
      const other = existingNames.get(norm(p.name));
      if (other && other !== it.id) err(`Nome già usato da «${other}»: per aggiornarlo usare il suo ID (niente duplicati).`);
      const dup = newNames.get(norm(p.name));
      if (dup && dup !== it.id) err(`Nome uguale a «${dup}» nello stesso file.`);
      newNames.set(norm(p.name), it.id);
    }
    if (kind === 'foods') {
      const f = p as Food;
      if (!f.subcategoryId) err('Sottocategoria obbligatoria.');
      let massG = 0;
      for (const [nid, v] of Object.entries(f.nutrients)) {
        const unit = catalog.nutrients.find((n) => n.id === nid)?.unit ?? 'g';
        if (v.value !== null && isMassUnit(unit)) {
          const g = toCanonical(v.value, unit, 'g').value;
          if (g > 100) err(`${nid}: ${v.value} ${unit} per 100 g è impossibile.`);
          if (['protein', 'fat', 'carbohydrate_available', 'fiber', 'moisture'].includes(nid)) massG += g;
        }
      }
      if (massG > 105) err(`Proteine + grassi + carboidrati + fibra + umidità = ${massG.toFixed(1)} g su 100 g: dati incoerenti.`);
      const fat = f.nutrients.fat?.value;
      for (const sub of ['linoleic_acid', 'omega3_total', 'omega6_total'])
        if (fat !== null && fat !== undefined && (f.nutrients[sub]?.value ?? 0) > fat + 0.01) err(`${sub} supera i grassi totali.`);
    } else {
      const s = p as Supplement;
      const unitMass = s.doseUnit === 'g' ? 1 : s.massPerUnitG;
      if (unitMass) {
        let massG = 0;
        for (const [nid, v] of Object.entries(s.nutrients)) {
          const unit = catalog.nutrients.find((n) => n.id === nid)?.unit ?? 'g';
          if (v.value !== null && isMassUnit(unit) && nid !== 'moisture') massG += toCanonical(v.value, unit, 'g').value;
        }
        if (massG > unitMass * 1.05 + 1e-9) err(`I nutrienti dichiarati pesano ${massG.toFixed(3)} g per dose, più della dose stessa (${unitMass} g).`);
      }
      if (s.kcalPerUnit !== null && unitMass && s.kcalPerUnit > unitMass * 9.5) err('Energia per dose incoerente con il peso della dose.');
      if (s.maxDailyUnits !== null && !s.maxDailySource) err('Dose massima senza fonte (etichetta o scheda del produttore).');
    }
    const changed = it.fieldChanges.length > 0 || it.valueChanges.length > 0;
    if (it.action === 'update' && !changed) it.action = 'unchanged';
    if (changed) {
      if (p.validatedAt) it.warnings.push({ productId: it.id, message: 'La convalida decade: andrà ripetuta dopo il controllo dei nuovi dati.' });
      p.validatedAt = null;
      p.validatedBy = null;
      p.profileVersion = (byId.get(it.id)?.profileVersion ?? 0) + 1;
    }
    if (kind === 'supplements' && (p as Supplement).status === 'missing' && Object.values(p.nutrients).some((v) => v.value !== null)) {
      (p as Supplement).status = 'review_required';
    }
    it.name = p.name || it.id;
    it.statusAfter = kind === 'foods' ? foodStatus(p as Food, catalog.nutrients) : supplementStatus(p as Supplement, catalog.nutrients);
    const active = kind === 'foods' ? (p as Food).availableToFormulate : (p as Supplement).usableForOptimization;
    if (active && it.statusAfter.status === 'to_complete') {
      if (kind === 'foods') (p as Food).availableToFormulate = false;
      else (p as Supplement).usableForOptimization = false;
      it.warnings.push({ productId: it.id, message: 'Il prodotto torna «da completare» e viene disattivato per la formulazione.' });
    }
  }

  const list = [...items.values()];
  const allErrors = [...errors, ...list.flatMap((i) => i.errors)];
  const allWarnings = [...warnings, ...list.flatMap((i) => i.warnings)];
  if (!list.length && !allErrors.length) allErrors.push({ message: 'Nessun prodotto o valore da importare.' });
  return {
    kind,
    format: parsed.format,
    fileName,
    items: list,
    errors: allErrors,
    warnings: allWarnings,
    canApply: allErrors.length === 0 && list.some((i) => i.action !== 'unchanged'),
    summary: {
      create: list.filter((i) => i.action === 'create').length,
      update: list.filter((i) => i.action === 'update').length,
      unchanged: list.filter((i) => i.action === 'unchanged').length,
      values: list.reduce((a, i) => a + i.valueChanges.length, 0),
    },
  };
}

/** Dati inviati al database (funzione admin_import_catalog): solo prodotti cambiati, valori con provenienza. */
export interface ImportPayload {
  kind: ImportKind;
  file_name: string;
  summary: ImportPlan['summary'];
  products: Record<string, unknown>[];
  values: Record<string, unknown>[];
}

export function toPayload(plan: ImportPlan): ImportPayload {
  if (!plan.canApply) throw new Error('Importazione con errori: correggere il file prima di confermare.');
  const changed = plan.items.filter((i) => i.action !== 'unchanged');
  const products = changed.map((i) => {
    if (plan.kind === 'foods') {
      const f = i.next as Food;
      return {
        id: f.id, name_it: f.name, category_id: f.categoryId, subcategory_id: f.subcategoryId, species_cut: f.speciesCut ?? null,
        processing_state: f.processingState, preparation: f.preparation ?? null, edible_portion: f.ediblePortion ?? null,
        kcal_me_per_100g: f.kcalMePer100g, me_method: f.meMethod ?? null, source_identifier: f.source ?? null, source_version: f.sourceVersion ?? null,
        data_status: f.dataStatus === 'verified' ? 'review_required' : f.dataStatus, uncertainty: f.uncertainty ?? null, notes: f.notes ?? null,
        available_to_formulate: f.availableToFormulate,
      };
    }
    const s = i.next as Supplement;
    return {
      id: s.id, name_it: s.name, brand: s.brand ?? null, product_variant: s.variant ?? null, class: s.supplementClass ?? null, dose_unit: s.doseUnit,
      mass_per_unit_g: s.massPerUnitG, kcal_per_unit: s.kcalPerUnit, integer_dose: s.integerDose, max_daily_units: s.maxDailyUnits,
      max_daily_source: s.maxDailySource ?? null, label_source: s.labelSource ?? null, label_added_only: !!s.labelAddedOnly,
      product_version: s.version ?? null, status: s.status === 'verified' ? 'review_required' : s.status === 'missing' && i.statusAfter.status !== 'to_complete' ? 'review_required' : s.status,
      notes: s.notes ?? null, usable_for_optimization: s.usableForOptimization,
    };
  });
  const values = changed.flatMap((i) =>
    i.valueChanges.map((v) => ({
      product_id: i.id, nutrient_id: v.nutrientId, amount: v.after, unit: v.unit, value_status: v.after === null ? 'unknown' : v.status,
      source_value: v.sourceValue, source_unit: v.sourceUnit, source_basis: v.basis, conversion_rule: v.rule, source_id: v.source, method: v.method,
      declared_total_or_added: v.declared,
    })),
  );
  return { kind: plan.kind, file_name: plan.fileName, summary: plan.summary, products, values };
}
