// Il calcolo dei grammi (ottimizzazione + verifica) avviene sul server di calcolo, con lo stesso motore dell'app web.
import type { FormulationInput, FormulationResult, PreliminaryResult } from '../../src/engine/formulate';

export const ENGINE_URL = (process.env.EXPO_PUBLIC_ENGINE_URL ?? 'https://nutrizione-cani-motore-q58c.onrender.com').replace(/\/$/, '');

/** Il catalogo per i suggerimenti si invia solo con i prodotti che hanno dati (anche non ancora attivati: §3.6). */
function slim(input: FormulationInput): FormulationInput {
  const c = input.catalogForSuggestions;
  return c
    ? {
        ...input,
        catalogForSuggestions: {
          foods: c.foods.filter((f) => !f.forbidden && f.kcalMePer100g !== null && Object.values(f.nutrients).some((v) => v.value !== null)),
          supplements: c.supplements.filter((s) => s.status !== 'missing' && Object.values(s.nutrients).some((v) => v.value !== null)),
        },
      }
    : input;
}

async function post<T>(path: string, input: FormulationInput): Promise<T> {
  const ctrl = new AbortController();
  // il piano gratuito di Render «dorme»: il primo calcolo può impiegare fino a un minuto
  const timer = setTimeout(() => ctrl.abort(), 95_000);
  try {
    const res = await fetch(`${ENGINE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(slim(input)),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { error?: string }).error ?? `Errore del server di calcolo (${res.status})`);
    return body as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('Il server di calcolo non risponde. Controlla la connessione e riprova.');
    throw e instanceof Error && /Network request failed/.test(e.message) ? new Error('Nessuna connessione al server di calcolo.') : e;
  } finally {
    clearTimeout(timer);
  }
}

/** generatore v2 (gruppi del pasto, livello A rigido, livello B morbido): stesse regole della verifica nell'app. */
export const formulateRemote = (input: FormulationInput) => post<FormulationResult>('/api/v2/formulate', input);
export const preliminaryRemote = (input: FormulationInput) => post<PreliminaryResult>('/api/preliminary', input);

export async function engineHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${ENGINE_URL}/health`);
    return r.ok;
  } catch {
    return false;
  }
}
