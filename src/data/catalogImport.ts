// Importazione e aggiornamento massivo del catalogo (solo amministratori).
// 1) parseImport: legge CSV (formato lungo dei modelli D/E, formato largo "un nutriente per colonna", anagrafiche) o JSON;
// 2) planImport: associa i nutrienti agli ID, confronta con il catalogo (crea/aggiorna/invariato, nessun duplicato),
//    verifica unità, valori, fonti e campi obbligatori e calcola lo stato risultante — SENZA modificare nulla;
// 3) l'archivio applica il piano solo se non ci sono errori, in un'unica operazione (tutto o niente),
//    conservando le versioni precedenti; le ricette collegate risultano "da ricalcolare".

import { foodStatus, supplementStatus, type CatalogStatus, type StatusResult } from '../engine/catalogStatus';
import { resolveFoodEnergy } from '../engine/energy';
import { isMassUnit, normalizeUnit, toCanonical } from '../engine/units';
import type { DataStatus, DoseUnit, EnergyAssignment, EnergyMethod, Food, Nutrient, NutrientValue, ProcessingState, Supplement, UnitConversion, ValueStatus } from '../engine/types';
import type { Category } from './packageCatalog';

export type ImportKind = 'foods' | 'supplements';
export type ImportFormat = 'csv-long' | 'csv-wide' | 'json';
/**
 * strict = schema definitivo per i file degli amministratori (stato di ogni valore obbligatorio, conversioni obbligatorie,
 * prodotti TEST protetti, base quantitativa esplicita); legacy = solo per rileggere i file già convertiti dei pacchetti
 * precedenti (dati/importazioni), con le regole con cui sono stati caricati.
 */
export type ImportMode = 'strict' | 'legacy';

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
  /** forma chimica (necessaria per convertire la vitamina E da mg a UI). */
  form?: string;
  /** integratori in capsule/compresse/misurini con base per massa: a quale massa si riferisce (content | gross). */
  basisMass?: string;
}

interface RawProduct {
  line?: number;
  id: string;
  fields: Record<string, string>;
}

export interface ParsedImport {
  kind: ImportKind;
  format: ImportFormat;
  mode: ImportMode;
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
  /** conversione completa applicata (unità, forma chimica, base quantitativa). */
  conversion?: string | null;
  status: ValueStatus;
  source: string | null;
  basis: string | null;
  method: string | null;
  form?: string | null;
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
  /** conversioni approvate tra unità non di massa (vitamina D µg → UI, vitamina E mg → UI per forma chimica). */
  unitConversions?: UnitConversion[];
  /** metodi energetici: lo stato dopo l'importazione considera l'energia calcolata. */
  energyMethods?: EnergyMethod[];
  energyAssignments?: EnergyAssignment[];
}

/** Forma chimica scritta nel file → codice delle conversioni approvate (null se non riconosciuta). */
export function normalizeForm(raw: string | undefined): string | null {
  const f = norm(raw ?? '');
  if (!f) return null;
  const code = (raw ?? '').trim();
  if (['d_alpha_tocopherol', 'all_rac_alpha_tocopheryl_acetate', 'd_alpha_tocopheryl_acetate', 'choline_chloride', 'calcium_d_pantothenate'].includes(code)) return code;
  if (/colina cloruro|cloruro di colina|choline chloride/.test(f)) return 'choline_chloride';
  if (/pantotenato|pantothenate/.test(f)) return 'calcium_d_pantothenate';
  const vitE = /tocofer|tocopher/.test(f);
  if (vitE && /acetat/.test(f)) {
    if (/all rac|tutto rac|\bdl\b|sintet|synthetic/.test(f)) return 'all_rac_alpha_tocopheryl_acetate';
    if (/\bd alfa|\bd alpha|rrr|natural/.test(f)) return 'd_alpha_tocopheryl_acetate';
    return null;
  }
  if (vitE && /\bd alfa|\bd alpha|rrr|natural/.test(f)) return 'd_alpha_tocopherol';
  return null;
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
  availableToFormulate: ['available to formulate', 'utilizzabile', 'attivo per la formulazione'],
  uncertainty: ['uncertainty', 'incertezza'],
  notes: ['notes', 'note'],
  // formulazione v2 (specifica del 21/10/2026, §9): tetti di quantità, alimenti vietati, avvertenze
  maxFreshWeightPct: ['max fresh weight pct', 'tetto peso fresco', 'tetto peso fresco pct'],
  maxGPer1000Kcal: ['max g per 1000 kcal', 'tetto g per 1000 kcal'],
  forbidden: ['forbidden', 'vietato'],
  preparationWarning: ['preparation warning', 'avvertenza preparazione', 'avvertenza'],
  // resa di preparazione documentata (g pronti per 1 g pesato nello stato del profilo, es. riso secco → cotto)
  preparedYield: ['prepared yield', 'resa', 'resa di cottura'],
  preparedYieldSource: ['prepared yield source', 'fonte resa', 'fonte resa di cottura'],
};
const SUPP_FIELDS: Record<string, string[]> = {
  id: ['id', 'product id', 'supplement id', 'codice'],
  usableForOptimization: ['usable for optimization', 'utilizzabile', 'attivo per la formulazione'],
  doseGuide: ['dose guide', 'tabella d impiego', 'dosi per peso'],
  name: ['name it', 'name', 'nome'],
  brand: ['brand', 'marca'],
  variant: ['product variant', 'variant', 'variante'],
  supplementClass: ['class', 'classe'],
  doseUnit: ['dose unit', 'unita dose'],
  massPerUnitG: ['content mass per unit g', 'massa contenuto g'],
  grossMassPerUnitG: ['gross mass per unit g', 'massa lorda g'],
  /** nome ambiguo (contenuto o unità intera?): accettato solo per i file dei pacchetti precedenti. */
  legacyMass: ['mass per unit g', 'dose mass g', 'grammi per unita'],
  sourceUrl: ['source url', 'url fonte'],
  dataStatus: ['data status', 'qualita dati'],
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
  form: ['form', 'chemical form', 'forma', 'forma chimica'],
  basisMass: ['basis mass', 'massa della base'],
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

export function parseImport(text: string, kind: ImportKind, nutrients: Nutrient[], opts: { mode?: ImportMode } = {}): ParsedImport {
  const out: ParsedImport = { kind, format: 'csv-wide', mode: opts.mode ?? 'strict', products: [], values: [], errors: [], warnings: [] };
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
        form: get(cells, LONG_COLS.form),
        basisMass: get(cells, LONG_COLS.basisMass),
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

/** proprietà ammesse per ogni valore nutrizionale nel JSON. */
const VALUE_KEYS = new Set(['nutrient_id', 'nutrient', 'value', 'amount', 'value_per_100g', 'declared_amount', 'unit', 'status', 'source', 'source_id', 'method', 'basis', 'basis_mass', 'per_dose', 'declared_total_or_added', 'form', 'chemical_form']);

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
        if (v !== null && v !== undefined && v !== '') pf[f] = typeof v === 'object' ? JSON.stringify(v) : String(v);
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
      if (out.mode === 'strict') {
        const unknownKeys = Object.keys(o).filter((k) => !VALUE_KEYS.has(k));
        if (unknownKeys.length) out.errors.push({ line, productId: id, message: `${key}: proprietà non riconosciute ${unknownKeys.map((k) => `«${k}»`).join(', ')}.` });
      }
      const raw = o.value ?? o.amount ?? o.value_per_100g ?? o.declared_amount;
      const explicitNull = ['value', 'amount', 'value_per_100g', 'declared_amount'].some((k) => k in o && o[k] === null) && (raw === null || raw === undefined);
      if (explicitNull && out.mode === 'strict') {
        out.errors.push({ line, productId: id, message: `${key}: valore null non ammesso — scrivere "NA" per «non disponibile», oppure omettere il nutriente per non modificarlo.` });
        continue;
      }
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
        form: o.form !== undefined ? String(o.form) : o.chemical_form !== undefined ? String(o.chemical_form) : '',
        basisMass: o.basis_mass !== undefined ? String(o.basis_mass) : '',
      });
    }
  });
  return out;
}

// ───────────────────────── verifica e piano ─────────────────────────

const ID_RE = /^[a-z0-9][a-z0-9_]{1,62}$/;
const CLEAR_TOKENS = new Set(['null', 'na', 'n a', 'nd', 'n d', 'non disponibile']);
const PROCESSING: ProcessingState[] = ['raw', 'cooked_boiled', 'cooked_steamed', 'cooked_baked', 'cooked_other', 'dried', 'canned', 'raw_or_unspecified'];
const PROCESSING_ALIASES: Record<string, ProcessingState> = { crudo: 'raw', bollito: 'cooked_boiled', lesso: 'cooked_boiled', 'al vapore': 'cooked_steamed', vapore: 'cooked_steamed', steamed: 'cooked_steamed', 'al forno': 'cooked_baked', cotto: 'cooked_other', essiccato: 'dried', 'in scatola': 'canned' };
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

/** Schema definitivo: stato esplicito, solo questi codici (nessuna deduzione da valore o codici di fonte). */
const STRICT_STATUS: Record<string, ValueStatus> = { measured: 'measured', label: 'label', calculated: 'calculated', estimated: 'estimated', analytical_zero: 'analytical_zero' };
function strictStatus(raw: string | undefined): ValueStatus | null {
  return STRICT_STATUS[(raw ?? '').trim().toLowerCase()] ?? null;
}

/** Base quantitativa dichiarata nel file → fattore verso «per 1 g» (null = base della dose, nessuna conversione). */
const MASS_BASIS: Record<string, number> = { per_kg: 1 / 1000, per_100g: 1 / 100, per_g: 1 };

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

/**
 * Relazioni totale → componenti (stessa unità di massa dopo la conversione in g). Un totale dichiarato contiene le sue
 * componenti: non si sommano di nuovo. Se il totale manca, conta la somma delle componenti note (limite inferiore).
 */
export const COMPONENTS: Record<string, string[]> = {
  fat: ['omega3_total', 'omega6_total'],
  omega3_total: ['ala', 'epa_dha'],
  epa_dha: ['epa', 'dha'],
  omega6_total: ['linoleic_acid', 'arachidonic_acid'],
  protein: ['arginine', 'histidine', 'isoleucine', 'leucine', 'lysine', 'methionine_cystine', 'phenylalanine_tyrosine', 'threonine', 'tryptophan', 'valine'],
  methionine_cystine: ['methionine', 'cystine'],
  phenylalanine_tyrosine: ['phenylalanine', 'tyrosine'],
};
const IS_COMPONENT = new Set(Object.values(COMPONENTS).flat());
/** voci che non sono masse della dose (solo dati di fonte o derivate). */
const NOT_MASS = new Set(['energy_food_kcal', 'carbohydrate_by_difference', 'c18_2_undifferentiated', 'c20_4_undifferentiated', 'vitamin_a_retinol_ug', 'beta_carotene_ug']);

function gramsOf(values: Record<string, NutrientValue>, nutrients: Nutrient[], id: string): number | null {
  const v = values[id]?.value;
  const unit = nutrients.find((n) => n.id === id)?.unit;
  if (v === null || v === undefined || !unit || !isMassUnit(unit)) return null;
  return toCanonical(v, unit, 'g').value;
}

/** massa del nodo: il totale dichiarato, altrimenti la somma delle componenti note. */
function effectiveG(values: Record<string, NutrientValue>, nutrients: Nutrient[], id: string): number | null {
  const own = gramsOf(values, nutrients, id);
  if (own !== null) return own;
  const parts = (COMPONENTS[id] ?? []).map((c) => effectiveG(values, nutrients, c)).filter((x): x is number => x !== null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

/** componenti che superano il proprio totale dichiarato (tolleranza 5%). */
export function componentMismatches(values: Record<string, NutrientValue>, nutrients: Nutrient[]): string[] {
  const out: string[] = [];
  const label = (id: string) => nutrients.find((n) => n.id === id)?.label ?? id;
  for (const [total, parts] of Object.entries(COMPONENTS)) {
    const t = gramsOf(values, nutrients, total);
    if (t === null) continue;
    const known = parts.map((c) => [c, effectiveG(values, nutrients, c)] as const).filter((x): x is readonly [string, number] => x[1] !== null);
    const sum = known.reduce((a, [, g]) => a + g, 0);
    if (known.length && sum > t * 1.05 + 1e-6) {
      out.push(`${known.map(([c]) => label(c)).join(' + ')} = ${+sum.toFixed(4)} g, più del totale dichiarato di ${label(total)} (${+t.toFixed(4)} g): le componenti sono parte del totale.`);
    }
  }
  return out;
}

/** massa complessiva dei nutrienti dichiarati, contando ogni totale una sola volta (componenti escluse). */
export function topLevelMassG(values: Record<string, NutrientValue>, nutrients: Nutrient[]): number {
  let g = 0;
  for (const id of Object.keys(values)) {
    if (IS_COMPONENT.has(id) || NOT_MASS.has(id) || COMPONENTS[id]) continue;
    g += gramsOf(values, nutrients, id) ?? 0;
  }
  for (const root of Object.keys(COMPONENTS).filter((k) => !IS_COMPONENT.has(k))) g += effectiveG(values, nutrients, root) ?? 0;
  return g;
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
    if (parsed.mode === 'strict' && /^test_/i.test(id)) {
      errors.push({ line, productId: id, message: `L’ID «${id}» è riservato ai prodotti di prova (test_…): non si crea né si modifica con l’importazione.` });
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
      statusAfter: { status: 'to_complete', reasons: [], missing: [], info: [], readyForValidation: false },
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
      for (const k of ['speciesCut', 'preparation', 'ediblePortion', 'meMethod', 'source', 'sourceUrl', 'sourceVersion', 'uncertainty', 'notes', 'preparationWarning', 'preparedYieldSource'] as const) if (f[k] !== undefined) set(k, f[k]);
      if (f.preparedYield !== undefined) {
        if (CLEAR_TOKENS.has(norm(f.preparedYield))) set('preparedYield', null);
        else {
          const v = parseNumber(f.preparedYield);
          if (v === null || Number.isNaN(v) || !(v > 0) || v > 10) err(`Resa «${f.preparedYield}» non valida (g di alimento pronto per 1 g pesato, tra 0 e 10).`);
          else if (!(f.preparedYieldSource ?? (n.preparedYieldSource as string | undefined))?.trim()) err('Resa di preparazione senza fonte (prepared_yield_source): la resa non si inserisce senza documentazione.');
          else set('preparedYield', v);
        }
      }
      for (const [k, max] of [['maxFreshWeightPct', 100], ['maxGPer1000Kcal', 5000]] as const) {
        if (f[k] === undefined) continue;
        if (CLEAR_TOKENS.has(norm(f[k]))) {
          set(k, null);
          continue;
        }
        const v = parseNumber(f[k]);
        if (v === null || Number.isNaN(v) || !(v > 0) || v > max) err(`Tetto «${f[k]}» non valido per ${k} (numero positivo, al massimo ${max}).`);
        else set(k, v);
      }
      if (f.forbidden !== undefined) {
        const b = parseBool(f.forbidden);
        if (b === null) err(`Valore «${f.forbidden}» non valido per forbidden (sì/no).`);
        else set('forbidden', b);
      }
      if (f.kcalMePer100g !== undefined && CLEAR_TOKENS.has(norm(f.kcalMePer100g))) {
        // cancellazione esplicita di un valore errato: l'energia torna sconosciuta (o calcolata dal metodo), mai zero
        set('kcalMePer100g', null);
        set('meMethod', null);
        it.warnings.push({ line: p.line, productId: p.id, message: 'Energia inserita cancellata (NA): torna sconosciuta o calcolata con il metodo energetico.' });
      } else if (f.kcalMePer100g !== undefined) {
        const v = parseNumber(f.kcalMePer100g);
        if (v === null || Number.isNaN(v) || v < 0 || v > 900) err(`Energia «${f.kcalMePer100g}» non valida (kcal EM per 100 g, tra 0 e 900).`);
        else set('kcalMePer100g', v);
      }
      if (f.availableToFormulate !== undefined) {
        const b = parseBool(f.availableToFormulate);
        if (b === null) err(`Valore «${f.availableToFormulate}» non valido per available_to_formulate (sì/no).`);
        else set('availableToFormulate', b);
      }
      if (f.dataStatus !== undefined) {
        const s = norm(f.dataStatus);
        const map: Record<string, DataStatus> = { estimated: 'estimated', stima: 'estimated', review_required: 'review_required', 'review required': 'review_required', unverified: 'unverified', not_verified: 'unverified', 'not verified': 'unverified' };
        if ((s === 'verified' || s === 'verificato') && parsed.mode === 'strict') err('Lo stato «verified» non si importa: si ottiene con la convalida dell’amministratore.');
        else if (s === 'verified' || s === 'verificato') it.warnings.push({ line: p.line, productId: p.id, message: 'Lo stato «verificato» non si importa: si ottiene con la convalida dell’amministratore.' });
        else if (map[s]) set('dataStatus', map[s]);
        else err(`Stato dei dati «${f.dataStatus}» non valido.`);
      }
    } else {
      for (const k of ['brand', 'variant', 'supplementClass', 'maxDailySource', 'labelSource', 'sourceUrl', 'version', 'notes'] as const) if (f[k] !== undefined) set(k, f[k]);
      if (f.legacyMass !== undefined) {
        if (parsed.mode === 'strict') err('«mass_per_unit_g» è ambiguo: usare content_mass_per_unit_g (contenuto, es. olio nella capsula) e/o gross_mass_per_unit_g (unità intera con involucro).');
        else if (f.massPerUnitG === undefined) f.massPerUnitG = f.legacyMass;
      }
      if (f.dataStatus !== undefined) {
        const ds = norm(f.dataStatus).replace(/ /g, '_');
        if (ds === 'verified' || ds === 'verificato') err('Lo stato «verified» non si importa: si ottiene con la convalida dell’amministratore.');
        else if (ds === 'unverified' || ds === 'estimated' || ds === 'review_required') set('dataStatus', ds);
        else err(`Qualità dei dati «${f.dataStatus}» non valida (unverified, estimated, review_required).`);
      }
      if (f.doseUnit !== undefined) {
        const u = DOSE_UNITS[norm(f.doseUnit)];
        if (!u) err(`Unità di dose «${f.doseUnit}» non valida (g, ml, capsule, tablet, scoop).`);
        else {
          set('doseUnit', u);
          if (f.integerDose === undefined) set('integerDose', ['capsule', 'tablet', 'scoop'].includes(u));
        }
      }
      for (const k of ['massPerUnitG', 'grossMassPerUnitG', 'kcalPerUnit', 'maxDailyUnits'] as const) {
        if (f[k] === undefined) continue;
        if (k === 'kcalPerUnit' && CLEAR_TOKENS.has(norm(f[k]))) {
          set('kcalPerUnit', null);
          set('kcalOrigin', null);
          it.warnings.push({ line: p.line, productId: p.id, message: 'Energia per dose cancellata (NA): torna sconosciuta (non zero).' });
          continue;
        }
        const v = parseNumber(f[k]);
        if (v === null || Number.isNaN(v) || v < 0 || (k !== 'kcalPerUnit' && v === 0)) err(`Valore «${f[k]}» non valido per ${k}.`);
        else set(k, v);
      }
      if (f.doseGuide !== undefined) {
        // { "points": [{ "weight_kg": 5, "min": 1, "max": 1.5 }, …], "source": "…", "note": "…" }
        try {
          const g = JSON.parse(f.doseGuide) as { points?: Record<string, unknown>[]; source?: string; note?: string };
          const points = (g.points ?? []).map((x) => ({ weightKg: Number(x.weight_kg ?? x.weightKg), min: Number(x.min), max: Number(x.max) }));
          if (!g.source) err('Tabella d’impiego senza fonte.');
          else if (!points.length || points.some((x) => !(x.weightKg > 0) || !(x.min >= 0) || !(x.max >= x.min))) err('Tabella d’impiego non valida: servono peso > 0 e 0 ≤ minimo ≤ massimo.');
          else set('doseGuide', { points, source: g.source, note: g.note ?? null });
        } catch {
          err('Tabella d’impiego non leggibile (JSON).');
        }
      }
      if (f.usableForOptimization !== undefined) {
        const b = parseBool(f.usableForOptimization);
        if (b === null) err(`Valore «${f.usableForOptimization}» non valido per usable_for_optimization (sì/no).`);
        else set('usableForOptimization', b);
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
  const strict = parsed.mode === 'strict';
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
      // NA: il dato diventa «non disponibile» (sconosciuto, mai zero)
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
    const raw0 = value;
    // vitamina A = solo preformata (retinolo, esteri): il beta-carotene ha il suo campo e il motore lo converte una volta sola
    if (nut.id === 'vitamin_a' && /carot/i.test(v.form ?? '')) {
      err(`${nut.label}: forma «${v.form}» — il beta-carotene va in beta_carotene_ug (µg); la vitamina A dichiarata è solo quella preformata. Il contributo del beta-carotene è calcolato dal motore (FEDIAF 2025, 1 mg = 833 UI): inserirlo anche qui lo conterebbe due volte.`);
      continue;
    }
    if (!v.unit) {
      err(`${nut.label}: unità mancante (attesa ${nut.unit} o un’unità di massa convertibile).`);
      continue;
    }
    // stato del valore: obbligatorio ed esplicito nello schema definitivo
    let status: ValueStatus | null;
    if (strict) {
      status = strictStatus(v.status);
      if (!status) {
        err(`${nut.label}: stato del valore ${v.status ? `«${v.status}» non valido` : 'mancante'} — obbligatorio: measured, label, calculated, estimated o analytical_zero.`);
        continue;
      }
      if (status === 'analytical_zero' && value !== 0) {
        err(`${nut.label}: stato analytical_zero con valore ${v.raw}: lo zero documentato vale solo per 0.`);
        continue;
      }
    } else status = null; // modalità precedente: dedotto più avanti
    let conv: { value: number; rule: string } | undefined;
    let converted: UnitConversion | null = null;
    // composto dichiarato (es. cloruro di colina): si converte nel nutriente con il fattore approvato per quella forma
    const compoundForm = normalizeForm(v.form);
    const compound = compoundForm
      ? (catalog.unitConversions ?? []).find((c) => c.nutrientId === nut.id && c.form === compoundForm && isMassUnit(c.fromUnit) && isMassUnit(c.toUnit) && isMassUnit(v.unit))
      : undefined;
    // unità del dizionario con una precisazione tra parentesi (es. «IU (carotenoids; human labeling)»): la stessa unità base
    // scritta senza precisazione è equivalente; il valore resta nel campo informativo e non si somma ad altri nutrienti
    const qualified = /^(.+?)\s*\(.+\)$/.exec(nut.unit);
    const unitIn = qualified && normalizeUnit(qualified[1]) === normalizeUnit(v.unit) ? nut.unit : v.unit;
    try {
      conv = toCanonical(value, unitIn, nut.unit);
      if (compound) {
        converted = compound;
        const inFrom = toCanonical(value, v.unit, compound.fromUnit).value * compound.factor;
        conv = { value: Math.round(toCanonical(inFrom, compound.toUnit, nut.unit).value * 1e6) / 1e6, rule: `${compound.formLabel} × ${String(compound.factor).replace('.', ',')} (${compound.source})` };
      }
    } catch {
      const from = normalizeUnit(v.unit);
      const candidates = (catalog.unitConversions ?? []).filter((c) => c.nutrientId === nut.id && normalizeUnit(c.fromUnit) === from && normalizeUnit(c.toUnit) === normalizeUnit(nut.unit));
      const form = normalizeForm(v.form);
      converted = candidates.find((c) => c.form === null) ?? (form ? (candidates.find((c) => c.form === form) ?? null) : null);
      if (value === 0 && KNOWN_UNITS.has(from)) {
        conv = { value: 0, rule: `zero: uguale in ogni unità (${from} → ${nut.unit})` };
      } else if (converted) {
        // conversione approvata (per la vitamina E solo con la forma chimica indicata)
        conv = { value: Math.round(value * converted.factor * 1e6) / 1e6, rule: `${from}→${nut.unit} × ${String(converted.factor).replace('.', ',')} (${converted.formLabel}; ${converted.source})` };
      } else if (KNOWN_UNITS.has(from) && KNOWN_UNITS.has(normalizeUnit(nut.unit))) {
        // unità valida ma di altra natura (es. mg → UI): serve un fattore approvato per la forma chimica
        const forms = candidates.map((c) => c.formLabel).join('; ');
        const why = candidates.length
          ? v.form
            ? `forma «${v.form}» non tra quelle approvate (${forms})`
            : `indicare la forma chimica in «form» (${forms}): nessun fattore unico per tutte le forme`
          : `nessun fattore approvato per ${from} → ${nut.unit}`;
        if (strict) err(`${nut.label}: ${v.raw} ${v.unit} non convertibile in ${nut.unit} — ${why}. Importazione bloccata: il valore non viene omesso.`);
        else {
          it.warnings.push({ line: v.line, productId: v.productId, message: `${nut.label}: ${v.raw} ${v.unit} non importato, da convertire in ${nut.unit} — ${why}; resta «non disponibile».` });
          it.pendingConversions.push({ nutrientId: nut.id, label: nut.label, value: parseNumber(v.raw) ?? NaN, unit: v.unit, targetUnit: nut.unit });
        }
      } else {
        err(`${nut.label}: unità «${v.unit}» non riconosciuta o non convertibile in ${nut.unit}.`);
      }
      if (!conv) continue;
    }
    value = conv.value;
    const steps: string[] = [conv.rule];
    let basisNote: string | null = v.basis || null;
    // base quantitativa: esplicita nel file, mai dedotta da nome, note o confezione
    const basis = strict ? norm(v.basis ?? '').replace(/ /g, '_') : '';
    if (strict && basis) {
      if (kind === 'foods') {
        if (!(basis in MASS_BASIS)) {
          err(`${nut.label}: base «${v.basis}» non valida per un alimento (per_100g, per_kg, per_g).`);
          continue;
        }
        if (basis !== 'per_100g') {
          const k = MASS_BASIS[basis] * 100;
          value = Math.round(value * k * 1e9) / 1e9;
          steps.push(`base ${basis} → per 100 g (× ${String(k).replace('.', ',')})`);
        }
        basisNote = basis;
      } else {
        const s = it.next as Supplement;
        if (basis === 'per_dose') basisNote = 'per_dose';
        else if (basis in MASS_BASIS) {
          if (v.perDose) {
            err(`${nut.label}: per_dose si usa solo con la base per_dose.`);
            continue;
          }
          let refMass: number | null = null;
          let refLabel = '';
          if (s.doseUnit === 'g') {
            refMass = 1;
            refLabel = '1 g di prodotto';
          } else if (s.doseUnit === 'ml') {
            err(`${nut.label}: base ${basis} con dose in ml: serve la densità, non supportata. Riportare il valore per 1 ml (base per_dose).`);
            continue;
          } else {
            const bm = norm(v.basisMass ?? '');
            if (bm !== 'content' && bm !== 'gross') {
              err(`${nut.label}: base ${basis} per un prodotto in ${s.doseUnit}: indicare basis_mass = content (massa del contenuto) o gross (unità intera con involucro).`);
              continue;
            }
            refMass = bm === 'content' ? s.massPerUnitG : (s.grossMassPerUnitG ?? null);
            refLabel = bm === 'content' ? `contenuto di 1 ${s.doseUnit}` : `1 ${s.doseUnit} intera con involucro`;
            if (!(refMass && refMass > 0)) {
              err(`${nut.label}: base ${basis} riferita a ${bm === 'content' ? 'content_mass_per_unit_g' : 'gross_mass_per_unit_g'}, che non è documentata: la massa non si inventa.`);
              continue;
            }
          }
          const k = MASS_BASIS[basis] * refMass;
          value = Math.round(value * k * 1e9) / 1e9;
          steps.push(`base ${basis} → per dose (${refLabel} = ${String(refMass).replace('.', ',')} g, × ${String(Math.round(k * 1e9) / 1e9).replace('.', ',')})`);
          basisNote = `${basis} (${refLabel})`;
        } else {
          err(`${nut.label}: base «${v.basis}» non valida per un integratore (per_dose, per_kg, per_100g, per_g).`);
          continue;
        }
      }
    }
    if (kind === 'supplements' && v.perDose) {
      const pd = parseDoseCount(v.perDose);
      if (pd === null || pd <= 0) {
        err(`${nut.label}: «per_dose» «${v.perDose}» non valido.`);
        continue;
      }
      if (pd !== 1) {
        value = value / pd;
        steps.push(`riferito a ${pd} dosi → per 1 dose (÷ ${pd})`);
        it.warnings.push({ line: v.line, productId: v.productId, message: `${nut.label}: valore riferito a ${pd} dosi, convertito per 1 dose.` });
      }
    }
    if (!strict) status = mapValueStatus(v.status, value);
    if (!status) {
      err(`${nut.label}: stato del valore «${v.status}» non valido (measured, label, calculated, estimated, analytical_zero).`);
      continue;
    }
    if (value === 0 && status === 'estimated') {
      err(`${nut.label}: uno zero deve essere un dato documentato (analytical_zero, label, measured o calculated), non una stima.`);
      continue;
    }
    const productSource = kind === 'foods' ? (it.next as Food).source : (it.next as Supplement).labelSource;
    const source = v.source || productSource || null;
    if (!source) {
      err(`${nut.label}: fonte mancante (colonna source_id o fonte del prodotto).`);
      continue;
    }
    if (!strict && kind === 'foods' && v.basis && /cook|cott/i.test(v.basis) !== /cook/.test((it.next as Food).processingState)) {
      it.warnings.push({ line: v.line, productId: v.productId, message: `${nut.label}: base «${v.basis}» non coerente con lo stato del prodotto (${(it.next as Food).processingState}). Crudo e cotto sono prodotti distinti.` });
    }
    const dn = norm(v.declared ?? '');
    const declared = dn === 'added' ? 'added' : dn === 'total' ? 'total' : null;
    if (strict) {
      if (kind === 'supplements' && !declared) {
        err(`${nut.label}: declared_total_or_added obbligatorio per gli integratori (total = composizione analitica totale, added = quantità aggiunta).`);
        continue;
      }
      if (kind === 'foods' && v.declared && declared !== 'total') {
        err(`${nut.label}: negli alimenti declared_total_or_added può essere solo total.`);
        continue;
      }
    } else if (v.declared && !declared && !['reported or estimated', 'unknown', ''].includes(dn)) err(`${nut.label}: declared_total_or_added deve essere total o added.`);
    if (declared === 'added' && kind === 'supplements' && !(it.next as Supplement).labelAddedOnly) {
      (it.next as Supplement).labelAddedOnly = true;
      it.fieldChanges.push({ field: 'labelAddedOnly', before: false, after: true });
    }
    const sourceCode = !strict && v.status && !['measured', 'label', 'calculated', 'estimated', 'analytical_zero', ''].includes(norm(v.status).replace(' ', '_')) ? v.status : null;
    const convNote = converted ? `convertito da ${v.raw} ${normalizeUnit(v.unit)} (${converted.formLabel}, × ${String(converted.factor).replace('.', ',')})` : null;
    const conversion = steps.filter((x) => x !== 'identity').join(' · ') || null;
    const nv: NutrientValue = {
      value,
      status,
      source,
      // modalità precedente: la conversione resta anche nel metodo, come nei dati già caricati
      method: (strict ? v.method || null : [v.method || sourceCode, convNote].filter(Boolean).join(' · ')) || null,
      // valore, unità, forma chimica e base originali restano registrati, con la conversione applicata
      sourceValue: raw0,
      sourceUnit: normalizeUnit(v.unit),
      form: normalizeForm(v.form) ?? (v.form?.trim() || null),
      basis: basisNote,
      conversion,
      declared,
    };
    const sameValue =
      same(cur?.value, nv.value) && same(cur?.status ?? null, nv.status) && same(cur?.source ?? null, nv.source) && same(cur?.method ?? null, nv.method) &&
      (!strict || (same(cur?.form ?? null, nv.form) && same(cur?.basis ?? null, nv.basis) && same(cur?.declared ?? null, nv.declared) && same(cur?.sourceValue ?? null, nv.sourceValue) && same(cur?.sourceUnit ?? null, nv.sourceUnit)));
    if (!sameValue) {
      it.valueChanges.push({
        nutrientId: nut.id,
        label: nut.label,
        unit: nut.unit,
        before,
        after: value,
        sourceValue: raw0,
        sourceUnit: normalizeUnit(v.unit),
        rule: conv.rule,
        conversion,
        status,
        source,
        basis: basisNote,
        method: nv.method ?? null,
        form: nv.form ?? null,
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
    if (parsed.mode === 'strict' && /^\s*\[test\]/i.test(p.name)) err('I nomi che iniziano con «[TEST]» sono riservati ai prodotti di prova.');
    // coerenza tra totali e componenti (EPA e DHA sono parte dei grassi, gli aminoacidi parte delle proteine…)
    for (const m of componentMismatches(p.nutrients, catalog.nutrients)) err(m);
    if (kind === 'foods') {
      const f = p as Food;
      if (!f.subcategoryId) err('Sottocategoria obbligatoria.');
      for (const [nid, v] of Object.entries(f.nutrients)) {
        const unit = catalog.nutrients.find((n) => n.id === nid)?.unit ?? 'g';
        if (v.value !== null && isMassUnit(unit) && toCanonical(v.value, unit, 'g').value > 100) err(`${nid}: ${v.value} ${unit} per 100 g è impossibile.`);
      }
      const massG = topLevelMassG(f.nutrients, catalog.nutrients);
      if (massG > 105) err(`I nutrienti dichiarati pesano ${massG.toFixed(1)} g su 100 g (totali senza contare due volte le componenti): dati incoerenti.`);
    } else {
      const s = p as Supplement;
      // massa del contenuto della dose: 1 g per le dosi in grammi; per capsule, compresse e misurini solo se documentata
      const content = s.doseUnit === 'g' ? 1 : s.massPerUnitG;
      const gross = s.doseUnit === 'g' || s.doseUnit === 'ml' ? null : (s.grossMassPerUnitG ?? null);
      if (content && gross && content > gross * 1.0001) err(`Il contenuto (${content} g) pesa più dell’unità intera con involucro (${gross} g).`);
      const massG = topLevelMassG(s.nutrients, catalog.nutrients);
      if (content && massG > content * 1.05 + 1e-9) err(`I nutrienti dichiarati pesano ${massG.toFixed(3)} g per dose, più del contenuto della dose (${content} g).`);
      else if (!content && gross && massG > gross * 1.05 + 1e-9) err(`I nutrienti dichiarati pesano ${massG.toFixed(3)} g per dose, più dell’unità intera (${gross} g).`);
      if (s.kcalPerUnit !== null && content && s.kcalPerUnit > content * 9.5) err('Energia per dose incoerente con la massa del contenuto della dose.');
      if (s.maxDailyUnits !== null && !s.maxDailySource) err('Dose massima senza fonte (etichetta o scheda del produttore).');
    }
    const changed = it.fieldChanges.length > 0 || it.valueChanges.length > 0;
    // l'attivazione per la formulazione non è un dato del profilo: non crea una nuova versione
    const profileChanged = it.fieldChanges.some((c) => c.field !== 'availableToFormulate' && c.field !== 'usableForOptimization') || it.valueChanges.length > 0;
    if (it.action === 'update' && !changed) it.action = 'unchanged';
    if (profileChanged) {
      if (p.validatedAt) it.warnings.push({ productId: it.id, message: 'La convalida decade: andrà ripetuta dopo il controllo dei nuovi dati.' });
      p.validatedAt = null;
      p.validatedBy = null;
      p.profileVersion = (byId.get(it.id)?.profileVersion ?? 0) + 1;
    }
    if (kind === 'supplements' && (p as Supplement).status === 'missing' && Object.values(p.nutrients).some((v) => v.value !== null)) {
      (p as Supplement).status = 'review_required';
    }
    it.name = p.name || it.id;
    // EM inserita nel file = dichiarata; altrimenti si calcola dal metodo energetico della tipologia
    if (kind === 'foods' && it.fieldChanges.some((c) => c.field === 'kcalMePer100g')) (p as Food).kcalMeOrigin = (p as Food).kcalMePer100g === null ? null : 'declared';
    const resolved = kind === 'foods' && catalog.energyMethods ? resolveFoodEnergy(p as Food, catalog.energyMethods, catalog.energyAssignments ?? []) : p;
    it.statusAfter = kind === 'foods' ? foodStatus(resolved as Food, catalog.nutrients) : supplementStatus(p as Supplement, catalog.nutrients);
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
        kcal_me_per_100g: f.kcalMeOrigin === 'calculated' ? null : f.kcalMePer100g, me_method: f.kcalMeOrigin === 'calculated' ? null : (f.meMethod ?? null), source_identifier: f.source ?? null, source_url: f.sourceUrl ?? null, source_version: f.sourceVersion ?? null,
        data_status: f.dataStatus === 'verified' ? 'review_required' : f.dataStatus, uncertainty: f.uncertainty ?? null, notes: f.notes ?? null,
        available_to_formulate: f.availableToFormulate,
        // colonne della migrazione 11 (ignorate dalla funzione precedente)
        max_fresh_weight_pct: f.maxFreshWeightPct ?? null, max_g_per_1000_kcal: f.maxGPer1000Kcal ?? null, forbidden: !!f.forbidden, preparation_warning: f.preparationWarning ?? null,
        prepared_yield: f.preparedYield ?? null, prepared_yield_source: f.preparedYieldSource ?? null,
      };
    }
    const s = i.next as Supplement;
    return {
      id: s.id, name_it: s.name, brand: s.brand ?? null, product_variant: s.variant ?? null, class: s.supplementClass ?? null, dose_unit: s.doseUnit,
      mass_per_unit_g: s.massPerUnitG, gross_mass_per_unit_g: s.grossMassPerUnitG ?? null, source_url: s.sourceUrl ?? null, data_status: s.dataStatus ?? null, kcal_per_unit: s.kcalOrigin === 'calculated' ? null : s.kcalPerUnit, integer_dose: s.integerDose, max_daily_units: s.maxDailyUnits,
      max_daily_source: s.maxDailySource ?? null, label_source: s.labelSource ?? null, label_added_only: !!s.labelAddedOnly,
      product_version: s.version ?? null, status: s.status === 'verified' ? 'review_required' : s.status === 'missing' && i.statusAfter.status !== 'to_complete' ? 'review_required' : s.status,
      notes: s.notes ?? null, usable_for_optimization: s.usableForOptimization, dose_guide: s.doseGuide ?? null,
    };
  });
  const values = changed.flatMap((i) =>
    i.valueChanges.map((v) => ({
      product_id: i.id, nutrient_id: v.nutrientId, amount: v.after, unit: v.unit, value_status: v.after === null ? 'unknown' : v.status,
      source_value: v.sourceValue, source_unit: v.sourceUnit, source_basis: v.basis, conversion_rule: v.conversion ?? v.rule, source_id: v.source, method: v.method,
      chemical_form: v.form ?? null, declared_total_or_added: v.declared,
    })),
  );
  return { kind: plan.kind, file_name: plan.fileName, summary: plan.summary, products, values };
}
