// Server di calcolo per l'app iPhone: riceve i dati della ricetta (profilo, alimenti, integratori, limiti — tutto
// già nella richiesta), esegue lo STESSO motore dell'app web (ottimizzazione + verifica indipendente) e restituisce
// il risultato. Non salva nulla e non legge nessun database: i dati restano su Supabase e sul telefono.
//
//   POST /api/v2/formulate  → FormulationResult del generatore v2 (specifiche del 21/10/2026: gruppi, livelli A/B)
//   POST /api/formulate     → FormulationResult del motore precedente (per le app non ancora aggiornate)
//   POST /api/preliminary   → PreliminaryResult
//   GET  /health            → { ok: true }

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { ENGINE_VERSION, formulate, preliminaryAnalysis, type FormulationInput } from '../src/engine/formulate';
import { ENGINE_VERSION_V2, formulateV2 } from '../src/engine/formulateV2';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY = 8 * 1024 * 1024;
const MAX_TIME_LIMIT_S = 15;
const RATE_PER_MIN = Number(process.env.RATE_PER_MIN ?? 60);

const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > RATE_PER_MIN;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Richiesta troppo grande'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('JSON non valido'));
      }
    });
    req.on('error', reject);
  });
}

function validInput(x: unknown): x is FormulationInput {
  const i = x as FormulationInput;
  return !!i && typeof i === 'object' && !!i.dog && Array.isArray(i.foods) && Array.isArray(i.supplements) && Array.isArray(i.nutrients) && Array.isArray(i.limits) && !!i.settings;
}

// il risolutore è sincrono: le richieste si eseguono una alla volta, in ordine
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p;
}

export const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, engine: ENGINE_VERSION, engineV2: ENGINE_VERSION_V2 });
  if (req.method !== 'POST' || !['/api/formulate', '/api/v2/formulate', '/api/preliminary'].includes(req.url ?? '')) return send(res, 404, { error: 'Non trovato' });
  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  if (limited(ip)) return send(res, 429, { error: 'Troppe richieste, riprova tra un minuto' });
  try {
    const body = await readJson(req);
    if (!validInput(body)) return send(res, 400, { error: 'Dati della ricetta incompleti' });
    body.settings = { ...body.settings, timeLimitSeconds: Math.min(Math.max(Number(body.settings.timeLimitSeconds) || 10, 1), MAX_TIME_LIMIT_S) };
    const result = await serial<unknown>(() => (req.url === '/api/v2/formulate' ? formulateV2(body) : req.url === '/api/formulate' ? formulate(body) : preliminaryAnalysis(body)));
    return send(res, 200, result);
  } catch (e) {
    return send(res, 400, { error: e instanceof Error ? e.message : String(e) });
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`Motore nutrizione cani (${ENGINE_VERSION_V2}, precedente ${ENGINE_VERSION}) in ascolto sulla porta ${PORT}`));
}
