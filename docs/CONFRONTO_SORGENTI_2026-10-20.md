# Confronto delle sorgenti dei dati — collaudo del 20/10/2026

Generato con `npx tsx scripts/collaudo/confronto-sorgenti.ts <cartella>`; nessuna scrittura su catalogo, database o ricette.

Livelli confrontati (valori **canonici**: unità del dizionario, per 100 g per gli alimenti, per unità di dose per gli integratori; unità diverse ma equivalenti non sono differenze):

1. **JSON 19/10** — file sorgente (percorso e hash sotto).
2. **Importatore** — uscita di `parseImport` + `planImport` (`src/data/catalogImport.ts`, schema definitivo JSON, modalità strict) su una copia del catalogo.
3. **Collaudo / iPhone (prova)** — catalogo di `LocalRepository.loadCatalog()`: pacchetto + `dati/importazioni/2026-10-16/import_*.json` (modalità legacy). È la sorgente usata da `scripts/collaudo/caso-reale.ts` e dall’app in modalità prova.
4. **Supabase (iPhone con accesso)** — payload dei file `supabase/data/2026-10-16_*.sql`, generati dalle stesse importazioni del 16/10. Il database online non è leggibile da qui: se dopo il 16/10 nessuno ha importato altri file dalla scheda Catalogo, è questo.

## Alimenti

- File: `/home/user/nutrizione-cani/dati/confronti/2026-10-19/alimenti_reali_2026-10-19.json` — sha256 `379e265f8a2ae982e79363e9ad72b1aecd4dce6939fe4b82d6a701216e9fd99d`
- Importatore: formato json, modalità strict; errori 0, avvisi 0, conversioni in sospeso 0; 6 prodotti da aggiornare, 0 da creare, 265 valori
- Supabase: `supabase/data/2026-10-16_alimenti.sql` (6 prodotti, 265 valori)

### beef_03 — Macinato di manzo crudo 3% grassi

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| stato di lavorazione | raw | raw | raw |
| **energia kcal/100 g** | 114,92 | 114,9 | — (calcolata 4/9/4 al caricamento) |
| **origine energia** | inserita dal file | calculated | calcolata |
| qualità dati | estimated | estimated | estimated |

Valori nutrizionali canonici e marcature total/added identici nei quattro livelli.

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

### beef_15 — Macinato di manzo crudo 15% grassi

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| stato di lavorazione | raw | raw | raw |
| **energia kcal/100 g** | 209,36 | 209,4 | — (calcolata 4/9/4 al caricamento) |
| **origine energia** | inserita dal file | calculated | calcolata |
| qualità dati | estimated | estimated | estimated |

Valori nutrizionali canonici e marcature total/added identici nei quattro livelli.

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

### beef_30 — Macinato di manzo crudo 30% grassi

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| stato di lavorazione | raw | raw | raw |
| **energia kcal/100 g** | 327,4 | 327,4 | — (calcolata 4/9/4 al caricamento) |
| **origine energia** | calculated | calculated | calcolata |
| qualità dati | estimated | estimated | estimated |

Valori nutrizionali canonici e marcature total/added identici nei quattro livelli.

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

### oat_dry — Avena in fiocchi secca non fortificata

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| **stato di lavorazione** | dried | raw | raw |
| **energia kcal/100 g** | 341,68 | 341,7 | — (calcolata 4/9/4 al caricamento) |
| **origine energia** | inserita dal file | calculated | calcolata |
| qualità dati | estimated | estimated | estimated |

Valori nutrizionali canonici e marcature total/added identici nei quattro livelli.

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

### carrot_cooked — Carota cotta al vapore (proxy USDA bollita)

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| stato di lavorazione | cooked_steamed | cooked_steamed | cooked_steamed |
| **energia kcal/100 g** | 25,54 | 25,5 | — (calcolata 4/9/4 al caricamento) |
| **origine energia** | inserita dal file | calculated | calcolata |
| qualità dati | estimated | estimated | estimated |

Valori nutrizionali canonici e marcature total/added identici nei quattro livelli.

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

### pumpkin_cooked — Zucca cotta al vapore (proxy USDA bollita)

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| stato di lavorazione | cooked_steamed | cooked_steamed | cooked_steamed |
| **energia kcal/100 g** | 18,67 | 18,7 | — (calcolata 4/9/4 al caricamento) |
| **origine energia** | inserita dal file | calculated | calcolata |
| qualità dati | estimated | estimated | estimated |

Valori nutrizionali canonici e marcature total/added identici nei quattro livelli.

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

## Integratori

- File: `/home/user/nutrizione-cani/dati/confronti/2026-10-19/integratori_reali_2026-10-19.json` — sha256 `56a4357c6c869c4712b23f996eafa7169eb08d206b2ab33cde86aa809f22b346`
- Importatore: formato json, modalità strict; errori 0, avvisi 0, conversioni in sospeso 0; 3 prodotti da aggiornare, 0 da creare, 41 valori
- Supabase: `supabase/data/2026-10-16_integratori.sql` (3 prodotti, 40 valori)

### qdiet — Q.Diet Compensa (standard, NON Crescita/Ultra)

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| nome | Q.Diet Compensa (standard, NON Crescita/Ultra) | Q.Diet Compensa (standard, NON Crescita/Ultra) | Q.Diet Compensa (standard, NON Crescita/Ultra) |
| **marca** | Q.Diet | — | — |
| massa del contenuto g/unità | 1 | 1 | 1 |
| kcal/unità | 0,96 | 0,96 | 0,96 |
| etichetta di soli additivi | true | true | true |
| qualità dati | review_required | review_required | review_required |
| **utilizzabile nel calcolo** | true | false | false |
| **tabella d’impiego** | 5 kg: 1–1.5; 10 kg: 1.5–3; 20 kg: 3–6; 30 kg: 4.5–9; 40 kg: 6–12 | 5 kg: 1–1.5; 10 kg: 1.5–3; 20 kg: 3–6; 30 kg: 4.5–9; 40 kg: 6–12 | — |

| Nutriente | JSON 19/10 (come scritto) | Importatore (canonico) | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|---|
| Proteine (g) | 4,25 g per_100g | 0,0425 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,0425 | 0,0425 |
| Grassi totali (g) | 0,07 g per_100g | 0,0007 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,0007 | 0,0007 |
| Fibra alimentare (g) | NA | — | 0,0001 | 0,0001 |
| Umidità (g) | 3 g per_100g | 0,03 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,03 | 0,03 |
| Calcio (g) | 18 g per_100g | 0,18 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,18 | 0,18 |
| Fosforo (g) | 6,5 g per_100g | 0,065 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,065 | 0,065 |
| Sodio (g) | 2 g per_100g | 0,02 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,02 | 0,02 |
| Magnesio (g) | 1,5 g per_100g | 0,015 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,015 | 0,015 |
| Potassio (g) | 7,5 g per_100g | 0,075 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,075 | 0,075 |

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

### omegor_vitality — Omegor Vitality 1000 (capsula)

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| nome | Omegor Vitality 1000 (capsula) | Omegor Vitality 1000 (capsula) | Omegor Vitality 1000 (capsula) |
| **marca** | Omegor | — | — |
| **massa del contenuto g/unità** | 1 | — | — |
| **kcal/unità** | 9 | — | — |
| **etichetta di soli additivi** | false | — | false |
| **qualità dati** | estimated | review_required | review_required |
| **utilizzabile nel calcolo** | true | false | false |
| tabella d’impiego | — | — | — |

| Nutriente | JSON 19/10 (come scritto) | Importatore (canonico) | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|---|
| Grassi totali (g) | 1 g per_dose | 1 (total) | 1 | 1 |
| EPA (g) | 535 mg per_dose | 0,535 (total) — mg->g | 0,535 | 0,535 |
| DHA (g) | 268 mg per_dose | 0,268 (total) — mg->g | 0,268 | 0,268 |
| Omega-3 totali (g) | 900 mg per_dose | 0,9 (total) — mg->g | 0,9 | 0,9 |
| Vitamina E (IU) | 10 mg per_dose | 14,9 (total) — mg→IU × 1,49 (d-alfa-tocoferolo naturale (RRR); 1,49 UI/mg — approvato dalla nutrizionista il 16/10/2026) | 14,9 | 14,9 |
| EPA + DHA (g) | 803 mg per_dose | 0,803 (total) | calcolata EPA + DHA = 0,803 | calcolata (equivalente) |

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

### bone_meal — Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%)

| Campo | JSON 19/10 → importatore | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|
| **nome** | Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) | Farina d ossa (marca/prodotto NON confermato) | Farina d ossa (marca/prodotto NON confermato) |
| **marca** | Grau | — | — |
| massa del contenuto g/unità | 1 | 1 | 1 |
| kcal/unità | — | — | — |
| **etichetta di soli additivi** | false | — | false |
| qualità dati | review_required | review_required | review_required |
| **utilizzabile nel calcolo** | true | false | false |
| tabella d’impiego | — | — | — |

| Nutriente | JSON 19/10 (come scritto) | Importatore (canonico) | Collaudo / iPhone (prova) | Supabase (SQL 16/10) |
|---|---|---|---|---|
| Proteine (g) | 0,6 g per_100g | 0,006 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,006 | 0,006 |
| Grassi totali (g) | 0,3 g per_100g | 0,003 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,003 | 0,003 |
| Fibra alimentare (g) | NA | — | 0,003 | 0,003 |
| Umidità (g) | 20,9 g per_100g | 0,209 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,209 | 0,209 |
| Calcio (g) | 22,6 g per_100g | 0,226 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,226 | 0,226 |
| Fosforo (g) | 17,7 g per_100g | 0,177 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,177 | 0,177 |
| Sodio (g) | 0,03 g per_100g | 0,0003 (total) — base per_100g → per dose (1 g di prodotto = 1 g, × 0,01) | 0,0003 | 0,0003 |

Fedeltà dell’importatore: ogni valore del file è presente dopo l’importazione; ogni NA resta sconosciuto (nessuno zero creato).

