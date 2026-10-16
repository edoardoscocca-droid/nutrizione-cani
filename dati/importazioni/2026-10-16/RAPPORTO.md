# Importazione dati del 16/10/2026 — rapporto

Generato da `scripts/adapters/dati-2026-10-16.ts`. File originali in `originali/`.

## Alimenti

Esito della verifica: nessun errore · 6 nuovi · 0 aggiornati · 256 valori importati.

| Prodotto | ID | Azione | Stato dopo l’importazione | Motivi |
|---|---|---|---|---|
| Macinato di manzo crudo 3% grassi | `beef_03` | nuovo | Da completare | mancano: energia metabolizzabile; 6 nutrienti richiesti senza valore; 38 valori stimati o di qualità non dichiarata |
| Macinato di manzo crudo 15% grassi | `beef_15` | nuovo | Da completare | mancano: energia metabolizzabile; 6 nutrienti richiesti senza valore; 40 valori stimati o di qualità non dichiarata |
| Macinato di manzo crudo 30% grassi | `beef_30` | nuovo | Da completare | mancano: energia metabolizzabile; 6 nutrienti richiesti senza valore; 38 valori stimati o di qualità non dichiarata |
| Avena in fiocchi secca non fortificata | `oat_dry` | nuovo | Da completare | mancano: energia metabolizzabile; 5 nutrienti richiesti senza valore; 37 valori stimati o di qualità non dichiarata |
| Carota cotta al vapore (proxy USDA bollita) | `carrot_cooked` | nuovo | Da completare | mancano: energia metabolizzabile; 5 nutrienti richiesti senza valore; 40 valori stimati o di qualità non dichiarata |
| Zucca cotta al vapore (proxy USDA bollita) | `pumpkin_cooked` | nuovo | Da completare | mancano: energia metabolizzabile; 8 nutrienti richiesti senza valore; 38 valori stimati o di qualità non dichiarata |

**Valori NON importati, in attesa di un fattore di conversione approvato** (restano «non disponibili»):

- beef_03 · Vitamina D: 0.1 µg → IU
- beef_03 · Vitamina E: 0.17 mg → IU
- beef_15 · Vitamina D: 0.1 µg → IU
- beef_15 · Vitamina E: 0.17 mg → IU
- beef_30 · Vitamina D: 0.1 µg → IU
- beef_30 · Vitamina E: 0.17 mg → IU
- oat_dry · Vitamina E: 0.42 mg → IU
- carrot_cooked · Vitamina E: 1.03 mg → IU
- pumpkin_cooked · Vitamina E: 1.06 mg → IU

## Integratori

Esito della verifica: nessun errore · 0 nuovi · 3 aggiornati · 36 valori importati.

| Prodotto | ID | Azione | Stato dopo l’importazione | Motivi |
|---|---|---|---|---|
| Q.Diet Compensa (standard, NON Crescita/Ultra) | `qdiet` | aggiornato | Dati parziali | 18 nutrienti richiesti senza valore; 17 valori stimati o di qualità non dichiarata; energia per dose non indicata; variante/lotto o versione del prodotto non indicati; l’etichetta dichiara solo le quantità aggiunte: non è un’analisi completa; non ancora convalidato da un amministratore |
| Omegor Vitality 1000 (capsula) | `omegor_vitality` | aggiornato | Dati parziali | 37 nutrienti richiesti senza valore; 1 valori stimati o di qualità non dichiarata; peso della singola unità non indicato; energia per dose non indicata; variante/lotto o versione del prodotto non indicati; non ancora convalidato da un amministratore |
| Farina d ossa (marca/prodotto NON confermato) | `bone_meal` | aggiornato | Dati parziali | 33 nutrienti richiesti senza valore; 7 valori stimati o di qualità non dichiarata; energia per dose non indicata; variante/lotto o versione del prodotto non indicati; non ancora convalidato da un amministratore |

## Non caricati di proposito

- Energia: i file contengono solo l’energia alimentare **umana** USDA (`energy_food_kcal`, conservata come dato informativo). L’energia metabolizzabile per il cane resta vuota finché non si approva un metodo (decisione D4): per questo i 6 alimenti risultano «Da completare» e non entrano nel calcolo.
- Riga derivata non importata: omegor_vitality · epa_dha = 0.803 g (Somma EPA+DHA, non aggiungere al totale omega-3) — calcolato dall’app da EPA + DHA.
- Componente da convertire, non importato: qdiet · Vitamina E tutto-rac-alfa-tocoferolo acetato 2000 mg (per kg PROBABILE, da confermare) — NEEDS_IU_FORM_CONVERSION. NON convertire mg in UI implicitamente; validare fattore per tutto-rac-alfa-tocoferil acetato
- Componente da convertire, non importato: qdiet · Calcio D-pantotenato 450 mg (per kg PROBABILE, da confermare) — COMPOUND_NOT_EQUIVALENT. 0,45 mg di sale NON sono automaticamente 0,45 mg di acido pantotenico
- Componente da convertire, non importato: omegor_vitality · Vitamina E d-alfa-tocoferolo 10 mg (per capsula) — NEEDS_IU_FORM_CONVERSION. 10 mg di vitamina E naturale dichiarata; regola UI distinta dalla forma sintetica
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
