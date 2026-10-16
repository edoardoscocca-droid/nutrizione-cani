// Stato di catalogo di alimenti e integratori: Verificato · Dati parziali · Da completare.
// Lo stato si calcola da criteri di QUALITÀ e COMPLETEZZA (quali dati, con quale origine e fonte, convalidati da chi),
// non dal semplice numero di campi compilati. Le stesse regole sono replicate nel database
// (supabase/migrations/…_catalog_status_import.sql, funzioni food_status / supplement_status).

import { COMPOUNDS } from './totals';
import type { Food, Nutrient, NutrientValue, Supplement } from './types';

export type CatalogStatus = 'verified' | 'partial' | 'to_complete';

export const CATALOG_STATUS_LABEL: Record<CatalogStatus, string> = {
  verified: 'Verificato',
  partial: 'Dati parziali',
  to_complete: 'Da completare',
};

export const CATALOG_STATUS_HELP: Record<CatalogStatus, string> = {
  verified: 'Composizione del prodotto documentata e convalidata da un amministratore. Riguarda solo il prodotto: non dice nulla sulla ricetta completa, che ha una verifica a parte.',
  partial: 'Composizione disponibile solo in parte o non convalidata: consultabile, ma una ricetta che lo usa non può essere dichiarata completa.',
  to_complete: 'Presente in catalogo ma senza i dati necessari: non utilizzabile nel calcolo.',
};

export interface StatusResult {
  status: CatalogStatus;
  /** motivi per cui non è "verificato" (vuoto se verificato). */
  reasons: string[];
  /** nutrienti richiesti senza valore (per gli integratori: non dichiarati, cioè sconosciuti). */
  missing: string[];
  /** informazioni che non cambiano lo stato (es. nutrienti non dichiarati da un integratore). */
  info: string[];
  /** criteri soddisfatti tranne la convalida: l'amministratore può convalidare. */
  readyForValidation: boolean;
}

/** Valori di qualità sufficiente per la convalida: misurati, da etichetta, calcolati con metodo, zeri dichiarati. */
const GOOD_QUALITY = new Set(['measured', 'label', 'calculated', 'analytical_zero']);

/** Nutrienti richiesti: tutti quelli con un requisito ufficiale nel dizionario (core e aminoacidi essenziali). */
export function requiredNutrients(nutrients: Nutrient[]): Nutrient[] {
  return nutrients.filter((n) => n.kind === 'core' || n.kind === 'advanced');
}

const known = (v: NutrientValue | undefined) => v !== undefined && v.value !== null && v.value !== undefined;

function valueChecks(values: Record<string, NutrientValue>, required: Nutrient[], reasons: string[], missingIsReason = true) {
  const has = (id: string) => known(values[id]) || (!!COMPOUNDS[id] && COMPOUNDS[id].every((p) => known(values[p])));
  const missing = required.filter((n) => !has(n.id)).map((n) => n.id);
  if (missing.length && missingIsReason) reasons.push(`${missing.length} nutrienti richiesti senza valore`);
  const knownEntries = Object.entries(values).filter(([, v]) => known(v));
  const estimated = knownEntries.filter(([, v]) => !GOOD_QUALITY.has(v.status ?? 'measured')).map(([k]) => k);
  if (estimated.length) reasons.push(`${estimated.length} valori stimati o di qualità non dichiarata`);
  const noSource = knownEntries.filter(([, v]) => !v.source).map(([k]) => k);
  if (noSource.length) reasons.push(`${noSource.length} valori senza fonte`);
  return missing;
}

export function foodStatus(f: Food, nutrients: Nutrient[]): StatusResult {
  const required = requiredNutrients(nutrients);
  const reasons: string[] = [];
  // Da completare: senza energia o senza i macronutrienti di base non è utilizzabile.
  const hardMissing: string[] = [];
  const info: string[] = [];
  if (f.kcalMePer100g === null) {
    // l'EM si calcola dal metodo energetico della tipologia: si dice cosa manca per calcolarla
    if (f.processingState === 'raw_or_unspecified') hardMissing.push('energia metabolizzabile (stato crudo/cotto non indicato: non si calcola)');
    else if (f.energyMethod === null) hardMissing.push('energia metabolizzabile (nessun metodo energetico per questa tipologia)');
    else if (!known(f.nutrients.carbohydrate_available)) hardMissing.push('energia metabolizzabile (servono i carboidrati disponibili)');
    else hardMissing.push('energia metabolizzabile');
  }
  if (!known(f.nutrients.protein)) hardMissing.push('proteine');
  if (!known(f.nutrients.fat)) hardMissing.push('grassi');
  const missing = valueChecks(f.nutrients, required, reasons);
  if (f.kcalMeOrigin === 'calculated' && f.energyMethod) {
    info.push(`Energia calcolata con ${f.energyMethod.label} (v. ${f.energyMethod.version}).`);
    if (f.energyMethod.caution) info.push(`Avvertenza energia: ${f.energyMethod.caution}`);
  }
  if (hardMissing.length) {
    return { status: 'to_complete', reasons: [`mancano: ${hardMissing.join(', ')}`, ...reasons], missing, info, readyForValidation: false };
  }
  if (!f.meMethod) reasons.push('metodo di calcolo dell’energia non indicato');
  if (!f.source) reasons.push('fonte del profilo non indicata');
  if (!f.sourceVersion) reasons.push('versione della fonte non indicata');
  if (f.processingState === 'raw_or_unspecified') reasons.push('stato crudo/cotto non specificato');
  if (!f.ediblePortion) reasons.push('parte edibile non indicata');
  if (f.dataStatus === 'estimated') reasons.push('profilo dichiarato come stima');
  const readyForValidation = reasons.length === 0;
  if (!f.validatedAt && f.dataStatus !== 'test_fixture') reasons.push('non ancora convalidato da un amministratore');
  return { status: reasons.length ? 'partial' : 'verified', reasons, missing, info, readyForValidation };
}

export function supplementStatus(s: Supplement, nutrients: Nutrient[]): StatusResult {
  const required = requiredNutrients(nutrients);
  const reasons: string[] = [];
  const declared = Object.values(s.nutrients).filter(known).length;
  const hardMissing: string[] = [];
  if (!declared) hardMissing.push('composizione per dose');
  if (!s.labelSource) hardMissing.push('etichetta o scheda tecnica');
  // Integratore: vale la composizione dichiarata. I nutrienti non dichiarati sono sconosciuti (mai zero) e non
  // rendono il prodotto incompleto; la verifica della ricetta li segnala dove contano.
  const missing = valueChecks(s.nutrients, required, reasons, false);
  const info = missing.length ? [`${missing.length} nutrienti richiesti non dichiarati in etichetta: sconosciuti, non zero.`] : [];
  if (hardMissing.length) {
    return { status: 'to_complete', reasons: [`mancano: ${hardMissing.join(', ')}`, ...reasons], missing, info, readyForValidation: false };
  }
  // i nutrienti sono dichiarati per unità: il peso della capsula serve per costi e sostanza secca, non per il calcolo
  if (s.doseUnit !== 'g' && s.doseUnit !== 'ml' && s.massPerUnitG === null) reasons.push('peso della singola unità non indicato');
  if (s.kcalPerUnit === null) reasons.push('energia per dose non dichiarata (inserire le kcal, o 0 se documentato)');
  if (!s.version) reasons.push('variante/lotto o versione del prodotto non indicati');
  if (s.labelAddedOnly) reasons.push('l’etichetta dichiara solo le quantità aggiunte: non è un’analisi completa');
  const readyForValidation = reasons.length === 0;
  if (!s.validatedAt && s.status !== 'test_fixture') reasons.push('non ancora convalidato da un amministratore');
  return { status: reasons.length ? 'partial' : 'verified', reasons, missing, info, readyForValidation };
}
