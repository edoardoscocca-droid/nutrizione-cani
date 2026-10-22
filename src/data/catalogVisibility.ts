// Quali prodotti compaiono negli elenchi dell'app: restano nascosti i dati di prova fittizi [TEST] (servono solo ai
// collaudi automatici) e le vecchie voci con il solo nome, senza alcun valore. Restano nel catalogo, quindi le ricette
// che li usano si aprono come prima; gli alimenti vietati senza valori restano visibili come avviso.
import type { Food, Supplement } from '../engine/types';

const hasValues = (p: Food | Supplement) => Object.values(p.nutrients).some((v) => v.value !== null);

export function isTestFixture(p: Food | Supplement): boolean {
  return p.dataStatus === 'test_fixture' || ('status' in p && p.status === 'test_fixture');
}

export function isNameOnly(p: Food | Supplement): boolean {
  if ('forbidden' in p && p.forbidden) return false;
  return !hasValues(p) && !('kcalMePer100g' in p && p.kcalMePer100g !== null);
}

/** keep: id da mostrare comunque (es. già scelti in una ricetta o con un prezzo registrato). */
export function listedInApp(p: Food | Supplement, keep?: ReadonlySet<string>): boolean {
  return keep?.has(p.id) === true || (!isTestFixture(p) && !isNameOnly(p));
}
