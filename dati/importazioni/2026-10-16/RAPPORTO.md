# Importazione dati del 16/10/2026 — rapporto

Generato da `scripts/adapters/dati-2026-10-16.ts`. File originali in `originali/`.

## Alimenti

Esito della verifica: nessun errore · 6 nuovi · 0 aggiornati · 265 valori importati.

| Prodotto | ID | Azione | Stato dopo l’importazione | Motivi |
|---|---|---|---|---|
| Macinato di manzo crudo 3% grassi | `beef_03` | nuovo | Dati parziali | 4 nutrienti richiesti senza valore; 40 valori stimati o di qualità non dichiarata; versione della fonte non indicata; profilo dichiarato come stima; non ancora convalidato da un amministratore |
| Macinato di manzo crudo 15% grassi | `beef_15` | nuovo | Dati parziali | 4 nutrienti richiesti senza valore; 42 valori stimati o di qualità non dichiarata; versione della fonte non indicata; profilo dichiarato come stima; non ancora convalidato da un amministratore |
| Macinato di manzo crudo 30% grassi | `beef_30` | nuovo | Dati parziali | 4 nutrienti richiesti senza valore; 40 valori stimati o di qualità non dichiarata; versione della fonte non indicata; profilo dichiarato come stima; non ancora convalidato da un amministratore |
| Avena in fiocchi secca non fortificata | `oat_dry` | nuovo | Dati parziali | 4 nutrienti richiesti senza valore; 38 valori stimati o di qualità non dichiarata; versione della fonte non indicata; profilo dichiarato come stima; non ancora convalidato da un amministratore |
| Carota cotta al vapore (proxy USDA bollita) | `carrot_cooked` | nuovo | Dati parziali | 4 nutrienti richiesti senza valore; 41 valori stimati o di qualità non dichiarata; versione della fonte non indicata; profilo dichiarato come stima; non ancora convalidato da un amministratore |
| Zucca cotta al vapore (proxy USDA bollita) | `pumpkin_cooked` | nuovo | Dati parziali | 7 nutrienti richiesti senza valore; 39 valori stimati o di qualità non dichiarata; versione della fonte non indicata; profilo dichiarato come stima; non ancora convalidato da un amministratore |

**Valori convertiti con i fattori approvati (D19)**:

- beef_03 · Vitamina D: 0.1 µg → 4 IU — µg→IU × 40 (vitamina D (colecalciferolo); 1 µg = 40 UI — approvato dalla nutrizionista il 16/10/2026)
- beef_03 · Vitamina E: 0.17 mg → 0.2533 IU — mg→IU × 1,49 (d-alfa-tocoferolo naturale (RRR); 1,49 UI/mg — approvato dalla nutrizionista il 16/10/2026)
- beef_15 · Vitamina D: 0.1 µg → 4 IU — µg→IU × 40 (vitamina D (colecalciferolo); 1 µg = 40 UI — approvato dalla nutrizionista il 16/10/2026)
- beef_15 · Vitamina E: 0.17 mg → 0.2533 IU — mg→IU × 1,49 (d-alfa-tocoferolo naturale (RRR); 1,49 UI/mg — approvato dalla nutrizionista il 16/10/2026)
- beef_30 · Vitamina D: 0.1 µg → 4 IU — µg→IU × 40 (vitamina D (colecalciferolo); 1 µg = 40 UI — approvato dalla nutrizionista il 16/10/2026)
- beef_30 · Vitamina E: 0.17 mg → 0.2533 IU — mg→IU × 1,49 (d-alfa-tocoferolo naturale (RRR); 1,49 UI/mg — approvato dalla nutrizionista il 16/10/2026)
- oat_dry · Vitamina E: 0.42 mg → 0.6258 IU — mg→IU × 1,49 (d-alfa-tocoferolo naturale (RRR); 1,49 UI/mg — approvato dalla nutrizionista il 16/10/2026)
- carrot_cooked · Vitamina E: 1.03 mg → 1.5347 IU — mg→IU × 1,49 (d-alfa-tocoferolo naturale (RRR); 1,49 UI/mg — approvato dalla nutrizionista il 16/10/2026)
- pumpkin_cooked · Vitamina E: 1.06 mg → 1.5794 IU — mg→IU × 1,49 (d-alfa-tocoferolo naturale (RRR); 1,49 UI/mg — approvato dalla nutrizionista il 16/10/2026)


## Integratori

Esito della verifica: nessun errore · 0 nuovi · 3 aggiornati · 38 valori importati.

| Prodotto | ID | Azione | Stato dopo l’importazione | Motivi |
|---|---|---|---|---|
| Q.Diet Compensa (standard, NON Crescita/Ultra) | `qdiet` | aggiornato | Dati parziali | 18 valori stimati o di qualità non dichiarata; energia per dose non dichiarata (inserire le kcal, o 0 se documentato); variante/lotto o versione del prodotto non indicati; l’etichetta dichiara solo le quantità aggiunte: non è un’analisi completa; non ancora convalidato da un amministratore |
| Omegor Vitality 1000 (capsula) | `omegor_vitality` | aggiornato | Dati parziali | 1 valori stimati o di qualità non dichiarata; peso della singola unità non indicato; energia per dose non dichiarata (inserire le kcal, o 0 se documentato); variante/lotto o versione del prodotto non indicati; non ancora convalidato da un amministratore |
| Farina d ossa (marca/prodotto NON confermato) | `bone_meal` | aggiornato | Dati parziali | 7 valori stimati o di qualità non dichiarata; energia per dose non dichiarata (inserire le kcal, o 0 se documentato); variante/lotto o versione del prodotto non indicati; non ancora convalidato da un amministratore |

**Valori convertiti con i fattori approvati (D19)**:

- qdiet · Vitamina E: 2 mg → 2 IU — mg→IU × 1 (tutto-rac/dl-alfa-tocoferil acetato (sintetico); 1 UI/mg — approvato dalla nutrizionista il 16/10/2026)
- omegor_vitality · Vitamina E: 10 mg → 14.9 IU — mg→IU × 1,49 (d-alfa-tocoferolo naturale (RRR); 1,49 UI/mg — approvato dalla nutrizionista il 16/10/2026)


## Energia metabolizzabile calcolata (D4)

Metodo della tipologia applicato alla composizione importata. L’energia «umana» USDA è riportata solo per confronto: non è usata.

| Alimento | Proteine g | Grassi g | Carboidrati disp. g | EM cane kcal/100 g | Metodo | Avvertenza | Energia USDA uomo (non usata) |
|---|---|---|---|---|---|---|---|
| Macinato di manzo crudo 3% grassi | 21.98 | 3 | 0 | 114.9 | FEDIAF 2025 · 4/9/4 (ingredienti naturali) v. 2025.1 |  | 121 |
| Macinato di manzo crudo 15% grassi | 18.59 | 15 | 0 | 209.4 | FEDIAF 2025 · 4/9/4 (ingredienti naturali) v. 2025.1 |  | 215 |
| Macinato di manzo crudo 30% grassi | 14.35 | 30 | 0 | 327.4 | FEDIAF 2025 · 4/9/4 (ingredienti naturali) v. 2025.1 |  | 332 |
| Avena in fiocchi secca non fortificata | 13.15 | 6.52 | 57.6 | 341.7 | FEDIAF 2025 · 4/9/4 (ingredienti naturali) v. 2025.1 | Amido non cotto: nel cane è meno digeribile; l'energia calcolata può essere sovrastimata. | 379 |
| Carota cotta al vapore (proxy USDA bollita) | 0.76 | 0.18 | 5.22 | 25.5 | FEDIAF 2025 · 4/9/4 (ingredienti naturali) v. 2025.1 |  | 35 |
| Zucca cotta al vapore (proxy USDA bollita) | 0.72 | 0.07 | 3.79 | 18.7 | FEDIAF 2025 · 4/9/4 (ingredienti naturali) v. 2025.1 |  | 20 |

## Non caricati di proposito

- Energia: i file contengono solo l’energia alimentare **umana** USDA (`energy_food_kcal`, conservata come dato informativo, mai usata). L’energia metabolizzabile per il cane si calcola nell’app con il metodo energetico della tipologia (decisione D4: FEDIAF 2025, 4/9/4 su proteine, grassi e carboidrati disponibili; vedi `dati/riferimenti/metodi_energetici.json`).
- Riga derivata non importata: omegor_vitality · epa_dha = 0.803 g (Somma EPA+DHA, non aggiungere al totale omega-3) — calcolato dall’app da EPA + DHA.
- Vitamina E convertita con la forma chimica dichiarata (D19): qdiet · Vitamina E tutto-rac-alfa-tocoferolo acetato 2000 mg (per kg PROBABILE, da confermare).
- Vitamina E convertita con la forma chimica dichiarata (D19): omegor_vitality · Vitamina E d-alfa-tocoferolo 10 mg (per capsula).
- Componente da convertire, non importato: qdiet · Calcio D-pantotenato 450 mg (per kg PROBABILE, da confermare) — COMPOUND_NOT_EQUIVALENT. 0,45 mg di sale NON sono automaticamente 0,45 mg di acido pantotenico
- Componente da convertire, non importato: omegor_vitality · Olio di pesce concentrato 1000 mg (per capsula) — FAT_CONTRIBUTION_APPROX_OIL_ONLY. 1000 mg di olio di pesce per capsula; 1g grassi come approssimazione per olio, non analisi dell intera capsula
- Componente da convertire, non importato: bone_meal · Ceneri grezze 72.8 % (per 100g) — SCREENSHOT_UNVERIFIED. Schermata ricerca generata, fonte non identificata
- Componente da convertire, non importato: qdiet · Ceneri grezze 73 % (per 100g) — ANALYTICAL_DECLARED. Non definito nel dizionario nutrienti corrente
- Voci di fonte conservate solo come informazione (nessun limite, nessun calcolo): Energia alimentare (uomo, NON EM cane), Carboidrati per differenza (fonte), Acido grasso 18:2 non differenziato (fonte), Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte).
- Cistina e tirosina: importate e usate per Metionina + cistina e Fenilalanina + tirosina (formula dell’allegato F).
- Attivazione: i file chiedono «available_to_formulate = true»; l’importazione non attiva mai i prodotti. Si attivano dal Catalogo quando non sono più «Da completare».

## Scelte di conversione (nessun valore modificato)

- ID: quelli dei file. Gli alimenti sono nuovi prodotti (le voci generiche del pacchetto iniziale, es. «Avena», «Carote», «Macinato di manzo», restano «Da completare»). Gli integratori aggiornano `qdiet`, `omegor_vitality`, `bone_meal`.
- Categorie: cereal/oats → Cereali; vegetable/root e vegetable/pumpkin → Verdure.
- Stato: avena «secca da pesare prima dell’ammollo» → crudo, con nota di preparazione; carota e zucca «vapore, proxy bollito» → cotto (bollito) con nota: il profilo è del bollito.
- Qualità dei valori: i codici REPORTED_USDA_PROXY, DERIVED_APPROXIMATION, PER_KG_ASSUMED_CONFIRM, SCREENSHOT_UNVERIFIED, PROXY_OIL_ONLY diventano «stima» (il codice originale resta nel campo metodo); ANALYTICAL_DECLARED e MANUFACTURER_DECLARED diventano «da etichetta».
- Profili alimenti dichiarati «stima» (PARTIAL_RESEARCH). Versione della fonte non indicata nei file.
