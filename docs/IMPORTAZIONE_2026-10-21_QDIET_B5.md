# Anteprima dell’importazione

Generata con `npx tsx scripts/importa-pacchetto.ts`: importatore dell’app (`src/data/catalogImport.ts`), schema definitivo JSON, modalità strict.
Confronto con il catalogo dopo le importazioni fino al 2026-10-20 (i file SQL precedenti vanno eseguiti prima).
Nessuna ricetta, quantità o preferenza viene modificata; nessuna convalida viene attribuita (i valori aggiornati perdono la convalida).

## qdiet_b5.json (integratori)

sha256 `02d5ed85e937ae0068711e414469ec7d24dd447dc27e976678d953d09b67a18d` · 0 nuovi, 1 aggiornati, 0 invariati, 1 valori · errori 0 · avvisi 0 · conversioni in sospeso 0

| Prodotto | Azione | Utilizzabile nel calcolo | Stato dopo | Campi cambiati | Valori cambiati (prima → dopo, canonici) |
|---|---|---|---|---|---|
| qdiet — Q.Diet Compensa (standard, NON Crescita/Ultra) | aggiornato | sì | partial (lacuna non risolta: colina da cloruro di colina richiede documentazione chimica; B5 dal calcio D-pantotenato conteggiata con il fattore 0,92 dal 21/10/2026 (specifica v2 §6); additivi dichiarati solo come aggiunti (totale incerto); profilo segnalato da rivedere) | notes | Vitamina B5 / acido pantotenico: — → 0,414 mg [added] |

SQL: `supabase/data/2026-10-21/02_qdiet_b5.sql (dopo 01_catalogo_v2.sql)`

