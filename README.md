# Nutrizione cani

App web (italiano, pensata per il telefono) per gestire i profili dei cani e **formulare automaticamente** ricette
casalinghe: l'utente sceglie alimenti e integratori disponibili, l'app calcola insieme tutte le quantità, verifica
energia, nutrienti e rapporti rispetto a FEDIAF 2025 (cane adulto) e lo dice chiaramente quando i dati non bastano.

> Le quantità proposte sono stime informative e non sostituiscono una dieta formulata o verificata da un veterinario nutrizionista.

Progetto separato da Vita: vive tutto in questa cartella.

## Documenti

- `docs/ANALISI.md` — analisi del pacchetto, architettura, **decisioni richieste (D1–D21)**, piano.
- `docs/FORMULE.md` — come il motore calcola e verifica (spiegabilità).
- `docs/SUPABASE.md` — come mettere in funzione database, amministratori e hosting.
- `docs/CATALOGO.md` — stati del catalogo (Verificato / Dati parziali / Da completare), convalida, importazioni CSV/JSON.
- `dati/pacchetto/` — il pacchetto di specifiche ricevuto, intatto (fonte dei riferimenti).
- `dati/importazioni/` — dati reali ricevuti (originali), file convertiti e rapporto di cosa è stato importato e cosa no.
- `docs/DA_FARE.md` — cosa serve dal committente per arrivare alle prime ricette reali.

## Struttura

```
src/engine/   motore: energia, somme con dati mancanti, rapporti, ottimizzatore (HiGHS), verifica indipendente, costi, versioni
src/data/     modello dati, archivio Supabase, archivio locale di prova, catalogo dal pacchetto, dati di PROVA fittizi
src/ui/       schermate (cani, ricette, risultato, prezzi, catalogo/amministrazione, impostazioni, accesso)
supabase/     migrazioni (schema, RLS, trigger), seed generato dal pacchetto, seed di prova facoltativo
scripts/      build-seed.ts (seed dal pacchetto), import-catalog.ts (importazione CSV/JSON con le verifiche dell'app)
tests/        acceptance.test.ts (T01–T18 e altro), catalog.test.ts (stati e importazioni), db/ (permessi e regole su Postgres), e2e/ (percorso nel browser)
```

## Comandi

```bash
npm install
npm run dev          # app in locale (senza Supabase parte in modalità prova)
npm test             # test del motore e di accettazione
npm run test:db      # test del database su un Postgres locale temporaneo (serve PostgreSQL 15+)
npm run typecheck
npm run build        # versione da pubblicare in dist/
npm run seed:sql     # rigenera supabase/seed*.sql dai file del pacchetto
npx tsx scripts/import-catalog.ts alimenti dati/mio_file.csv > import.sql   # importazione da riga di comando
```

## Modalità

- **Supabase** (uso reale): con `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` impostati, accesso con codice via email.
  Cataloghi in sola lettura per gli utenti; li modificano solo gli amministratori (regole nel database).
- **Prova** (senza account): tutto resta nel browser; oltre al catalogo del pacchetto (non verificato) ci sono alimenti e
  integratori **[TEST] fittizi** per vedere il motore all'opera. Ogni ricetta con questi dati è marcata «PROVA».

## Stato dei dati reali

Dati ricevuti il 16/10/2026: 6 alimenti (USDA) e 3 integratori (Q.Diet Compensa, Omegor Vitality 1000, farina d'ossa),
importati senza modifiche (`dati/importazioni/2026-10-16/RAPPORTO.md`). Gli alimenti sono ancora «Da completare» perché manca
l'energia metabolizzabile per il cane (decisione D4); gli integratori sono «Dati parziali». Per attivarli:
importare o inserire le composizioni (Catalogo → Importa), controllare i motivi dello stato, convalidare e attivare il prodotto.
