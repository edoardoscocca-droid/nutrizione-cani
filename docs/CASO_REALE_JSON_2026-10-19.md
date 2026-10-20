# Caso reale — formulazione del 20/10/2026

Generato con `npx tsx scripts/collaudo/caso-reale.ts` sul motore `motore-2.0.0`. Prodotti reali usati come **copie in memoria**: gli integratori
sono autorizzati solo per questa prova (nel catalogo restano non attivi); nessun prodotto, ricetta o preferenza salvata è stato modificato.

**Sorgente dei dati: JSON reali del 19/10/2026**, caricati con il normale importatore (`src/data/catalogImport.ts`, `parseImport` + `planImport`, schema definitivo JSON, modalità strict) sopra una copia del catalogo della modalità prova:
- /home/user/nutrizione-cani/dati/confronti/2026-10-19/alimenti_reali_2026-10-19.json (sha256 379e265f8a2ae982e79363e9ad72b1aecd4dce6939fe4b82d6a701216e9fd99d): formato json, modalità strict, 6 aggiornati, 0 creati, 265 valori, errori 0, conversioni in sospeso 0
- /home/user/nutrizione-cani/dati/confronti/2026-10-19/integratori_reali_2026-10-19.json (sha256 56a4357c6c869c4712b23f996eafa7169eb08d206b2ab33cde86aa809f22b346): formato json, modalità strict, 3 aggiornati, 0 creati, 41 valori, errori 0, conversioni in sospeso 0

## Cane e impostazioni

Femmina, 5 anni, non sterilizzata; peso **attuale 33 kg** (tabella d’impiego QDiet ed EPA+DHA), ideale 31 kg; BCS 5/9; obiettivo **1.800 kcal/die** impostato manualmente.
Dieta casalinga (selenio: riferimento più alto, 67,5 µg/1000 kcal). Digeribilità proteica della dieta **non documentata** → minimi degli aminoacidi essenziali +10%.
EPA+DHA: apporto raccomandato 30 × 33^0,75 = 413,05 mg/die (vincolo necessario).

## Prodotti e versioni

| id | Prodotto | Versione profilo | Stato / preparazione | Energia | Qualità dati |
|---|---|---:|---|---|---|
| beef_03 | Macinato di manzo crudo 3% grassi | v2 | raw — Pesare crudo. | 114,9 kcal/100 g (inserita) | estimated |
| beef_15 | Macinato di manzo crudo 15% grassi | v2 | raw — Pesare crudo. | 209,4 kcal/100 g (inserita) | estimated |
| beef_30 | Macinato di manzo crudo 30% grassi | v2 | raw — Pesare crudo. | 327,4 kcal/100 g (calcolata: FEDIAF 2025 · 4/9/4 (ingredienti naturali)) | estimated |
| oat_dry | Avena in fiocchi secca non fortificata | v2 | dried — Pesare secca prima dell’ammollo; acqua non scolata. Ammollo diverso dalla cottura. | 341,7 kcal/100 g (inserita) | estimated |
| carrot_cooked | Carota cotta al vapore (proxy USDA bollita) | v2 | cooked_steamed — Cotta al vapore, pesata cotta; composizione proxy USDA bollita e scolata senza sale. | 25,5 kcal/100 g (inserita) | estimated |
| pumpkin_cooked | Zucca cotta al vapore (proxy USDA bollita) | v2 | cooked_steamed — Cotta al vapore, pesata cotta; composizione proxy USDA bollita e scolata senza sale. | 18,7 kcal/100 g (inserita) | estimated |
| qdiet | Q.Diet Compensa (standard, NON Crescita/Ultra) | v3 | dose in g, contenuto 1 g/unità | 0,96 kcal/g | review_required, etichetta con additivi |
| omegor_vitality | Omegor Vitality 1000 (capsula) | v3 | dose in capsule, contenuto 1 g/unità | 9 kcal/capsule | review_required |
| bone_meal | Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) | v3 | dose in g, contenuto 1 g/unità | sconosciuta | review_required |

Dichiarazioni total/added di QDiet nei dati caricati: calcium = total; phosphorus = total; protein = total; vitamin_a = added; vitamin_d = added; zinc = added; choline = added.
Nei JSON del 19/10 calcio e fosforo di QDiet sono marcati «total»; solo i valori marcati «added» sono limiti inferiori.

## Scenario A — preferenze salvate nella ricetta di prova (19/10)

Preferenze effettive passate al calcolo (prima ricerca → seconda ricerca con gli ampliamenti documentati):

- protein_energy_pct: 60–85 % energia macro (4/9/4) → minimo ampliato 55 % energia macro stimata (4/9/4); massimo ampliato 90 % energia macro stimata (4/9/4)
- fat_energy_pct: 10–15 % energia macro (4/9/4) → minimo ampliato 5 % energia macro stimata (4/9/4); massimo ampliato 20 % energia macro stimata (4/9/4)
- carb_energy_pct: 15–30 % energia macro (4/9/4) → minimo ampliato 10 % energia macro stimata (4/9/4); massimo ampliato 35 % energia macro stimata (4/9/4)
- fiber: 1–10 g/die → minimo ampliato 0,8 g/die; massimo ampliato 12 g/die
- Rapporto Ca:P (preferenza 1,2–1,4) → minimo ampliato 1,1 ; massimo ampliato 1,5 ; vincolo necessario 1–2. Coefficienti netti passati al solver per il minimo ampliato (riga «Ca − 1,1·P ≥ 0», g per passo): Macinato di manzo crudo 3% grassi (per 1 g) -0,002153; Macinato di manzo crudo 15% grassi (per 1 g) -0,001731; Macinato di manzo crudo 30% grassi (per 1 g) -0,001212; Avena in fiocchi secca non fortificata (per 1 g) -0,00399; Carota cotta al vapore (proxy USDA bollita) (per 1 g) -0,00003; Zucca cotta al vapore (proxy USDA bollita) (per 1 g) -0,00018; Q.Diet Compensa (standard, NON Crescita/Ultra) (per 0,1 unità) 0,01085; Omegor Vitality 1000 (capsula) (per 1 unità) 0; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) (per 0,1 unità) 0,00313.
  Righe originarie del rapporto (prima ricerca e vincolo necessario): Rapporto calcio/fosforo: minimo 1 → 0,0115 per QDiet; Rapporto calcio/fosforo: minimo 1,2 → 0,0102 per QDiet.

**Esito: Preferenze non raggiungibili: vincoli del modello sui contributi noti rispettati, preferenze no; non è un menù** (`preferences_unreachable`, 2,61 s, ricerca P1: nessuna riuscita).

Quantità diagnostiche (vincoli del modello sui contributi noti rispettati; non è un menù):

| Componente | Quantità |
|---|---:|
| Macinato di manzo crudo 3% grassi | 801 g |
| Macinato di manzo crudo 15% grassi | 227 g |
| Macinato di manzo crudo 30% grassi | 14 g |
| Avena in fiocchi secca non fortificata | 79 g |
| Carota cotta al vapore (proxy USDA bollita) | 0 g |
| Zucca cotta al vapore (proxy USDA bollita) | 182 g |
| Q.Diet Compensa (standard, NON Crescita/Ultra) | 9,9 g |
| Omegor Vitality 1000 (capsula) | 1 capsule |
| Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) | 22,6 g |

Energia: 1764 kcal (totale parziale: energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%)) su 1.800 kcal (tolleranza ±2%: 1.764–1.836).
Ripartizione energetica stimata 4/9/4: proteine 52,9%, grassi 35,1%, carboidrati disponibili 11,9%; fibra 10 g/die (5,7 g/1000 kcal); Ca:P con i soli valori noti 1,001; EPA+DHA 810 mg/die.

### Vincoli problematici nella soluzione mostrata

| Nutriente | Controllo | Esito | Dettaglio (soglia, apporto, scostamento o motivo) |
|---|---|---|---|
| Fibra alimentare | PERSONAL_TARGET min 1 max 10 per_day | non verificabile | preferenza (min 1 · max 10 g/die): massimo non verificabile — con i dati noti 9,981 g/die; dato sconosciuto in Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Acido linoleico omega-6 | OFFICIAL_MIN min 3,82 per_1000_kcal_me | non verificabile | minimo ufficiale (min 3,82 g/1000 kcal): non verificabile — nessun dato disponibile |
| Calcio | OFFICIAL_NUTRITIONAL_MAX  max 6,25 per_1000_kcal_me | non verificabile | massimo nutrizionale ufficiale (max 6,25 g/1000 kcal): massimo non verificabile — con i dati noti 4,002 g/1000 kcal; dato sconosciuto in Omegor Vitality 1000 (capsula) |
| Fosforo | OFFICIAL_NUTRITIONAL_MAX  max 4 per_1000_kcal_me | non verificabile | massimo nutrizionale ufficiale (max 4 g/1000 kcal): massimo non verificabile — con i dati noti 3,999 g/1000 kcal; dato sconosciuto in Omegor Vitality 1000 (capsula) |
| Cloruro | OFFICIAL_MIN min 0,43 per_1000_kcal_me | non verificabile | minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Iodio | OFFICIAL_MIN min 0,3 per_1000_kcal_me | non verificabile | minimo ufficiale (min 0,3 mg/1000 kcal): copertura non verificabile — con i dati noti 0,248 mg/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo 3% grassi, Macinato di manzo crudo 15% grassi, Macinato di manzo crudo 30% grassi, Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Rapporto calcio/fosforo | OFFICIAL_MIN min 1 ratio | non verificabile | minimo ufficiale (min 1): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,001, non usato per il giudizio) |
| Rapporto calcio/fosforo | OFFICIAL_NUTRITIONAL_MAX  max 2 ratio | non verificabile | massimo nutrizionale ufficiale (max 2): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,001, non usato per il giudizio) |
| Rapporto calcio/fosforo | NON_OFFICIAL_ATTENTION min 1,2 max 1,4 ratio | non verificabile | soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,001, non usato per il giudizio) |
| Vitamina A | OFFICIAL_MIN min 1754 per_1000_kcal_me | non verificabile | minimo ufficiale (min 1754 IU/1000 kcal): copertura non verificabile — con i dati noti 1375 IU/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo 3% grassi, Macinato di manzo crudo 15% grassi, Macinato di manzo crudo 30% grassi, Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Vitamina A | OFFICIAL_NUTRITIONAL_MAX  max 100.000 per_1000_kcal_me | non verificabile | massimo nutrizionale ufficiale (max 100.000 IU/1000 kcal): massimo non verificabile — con i dati noti 1403,1 IU/1000 kcal; dato sconosciuto in Macinato di manzo crudo 3% grassi, Macinato di manzo crudo 15% grassi, Macinato di manzo crudo 30% grassi, Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%); Q.Diet Compensa (standard, NON Crescita/Ultra) dichiara solo quantità aggiunte (totale incerto) |
| Vitamina D | OFFICIAL_NUTRITIONAL_MAX  max 800 per_1000_kcal_me | non verificabile | massimo nutrizionale ufficiale (max 800 IU/1000 kcal): massimo non verificabile — con i dati noti 163,9 IU/1000 kcal; dato sconosciuto in Zucca cotta al vapore (proxy USDA bollita), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%); Q.Diet Compensa (standard, NON Crescita/Ultra) dichiara solo quantità aggiunte (totale incerto) |
| Quota energia da proteine | PERSONAL_TARGET min 60 max 85 energy_pct | preferenza non rispettata | preferenza (min 60 · max 85 % energia macro (4/9/4)): non raggiunto in tutto l’intervallo possibile (49,9–52,9 % energia macro (4/9/4)) — richiesto 60–85 % energia macro (4/9/4), risultato 52,9 % energia macro (4/9/4), scostamento -7,1 % energia macro (4/9/4) |
| Quota energia da grassi | PERSONAL_TARGET min 10 max 15 energy_pct | preferenza non rispettata | preferenza (min 10 · max 15 % energia macro (4/9/4)): superato in tutto l’intervallo possibile (33,1–35,1 % energia macro (4/9/4)) — richiesto 10–15 % energia macro (4/9/4), risultato 33,1 % energia macro (4/9/4), scostamento +18,1 % energia macro (4/9/4) |
| Quota energia da carboidrati disponibili | PERSONAL_TARGET min 15 max 30 energy_pct | non verificabile | preferenza (min 15 · max 30 % energia macro (4/9/4)): non verificabile — intervallo possibile 11,9–17 % energia macro (4/9/4); quota parziale: macronutrienti non dichiarati da Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) (intervallo dalla massa non attribuita della dose) |
| Energia | ±2% | non verificabile | 1764,003 kcal su obiettivo 1800 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 22,6 g (1,7% del peso della razione): totale parziale, la tolleranza energetica non è attestata. |

### Vincoli necessari al limite nella soluzione mostrata

- Fosforo: massimo 4 g/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75))
- Rame: minimo 2,08 mg/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1800 kcal obiettivo
- Rapporto calcio/fosforo: minimo 1 (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75))
- Q.Diet Compensa (standard, NON Crescita/Ultra): al massimo consentito (9,9)
- Omegor Vitality 1000 (capsula): al massimo consentito (1)

### Incompatibilità matematiche (diagnosi del modello)

Violazione minima necessaria se le preferenze **ampliate** fossero vincoli, insieme ai vincoli necessari (scarto nell’unità della riga del modello; per le quote, kcal di «Ep − quota·(Ep+Ef+Ec)», circa 18 kcal per punto percentuale su 1.800 kcal):

- Rapporto calcio/fosforo: minimo ampliato 1,1  — scarto minimo 0,295 g di calcio/die
- Quota energia da proteine: minimo ampliato 55 % energia macro stimata (4/9/4) — scarto minimo 138,938 kcal
- Quota energia da grassi: massimo ampliato 20 % energia macro stimata (4/9/4) — scarto minimo 402,557 kcal
- Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) non oltre 9,9 — raggiunto, contribuisce al conflitto

### Preferenze iniziali non raggiunte: cosa le impedisce (una alla volta)

- Rapporto calcio/fosforo: minimo 1,2 (Allegato C — preferenza formulativa NON FEDIAF, bozza da rivedere): impedita da Vitamina D: minimo 159 IU/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1800 kcal obiettivo — coperto con i soli dati noti (livello H); Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) 9,9 (superarla richiede una valutazione veterinaria)
- Quota energia da proteine: minimo 60 % energia macro stimata (4/9/4) (Target personale — preferenza utente (2026-10-20)): impedita da Rapporto calcio/fosforo: minimo 1 (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)); Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) non oltre 9,9 — raggiunto, contribuisce al conflitto
- Quota energia da grassi: massimo 15 % energia macro stimata (4/9/4) (Target personale — preferenza utente (2026-10-20)): impedita da Vitamina D: minimo 159 IU/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1800 kcal obiettivo — coperto con i soli dati noti (livello H); Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) non oltre 9,9 — raggiunto, contribuisce al conflitto
- Quota energia da carboidrati disponibili: minimo 15 % energia macro stimata (4/9/4) (Target personale — preferenza utente (2026-10-20)): raggiungibile da sola: il conflitto nasce solo insieme alle altre preferenze o vincoli

### Dati mancanti (separati dalle incompatibilità)

- Omegor Vitality 1000 (capsula): Proteine, Carboidrati disponibili, Fibra alimentare, Umidità, Acido linoleico omega-6, Acido alfa-linolenico ALA, Omega-6 totali, Acido arachidonico, Calcio, Fosforo, Potassio, Sodio, Cloruro, Magnesio, Rame, Iodio, Ferro, Manganese, Selenio (diete umide), Zinco, Vitamina A, Vitamina D, Vitamina B1 / tiamina, Vitamina B2 / riboflavina, Vitamina B3 / niacina, Vitamina B5 / acido pantotenico, Vitamina B6 / piridossina, Vitamina B9 / folati, Vitamina B12, Colina, Vitamina C, Biotina / vitamina B7, Vitamina K, Arginina, Istidina, Isoleucina, Leucina, Lisina, Metionina, Metionina + cistina, Fenilalanina, Fenilalanina + tirosina, Treonina, Triptofano, Valina, Taurina, L-carnitina, Cistina, Tirosina, Energia alimentare (uomo, NON EM cane), Carboidrati per differenza (fonte), Acido grasso 18:2 non differenziato (fonte), Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Q.Diet Compensa (standard, NON Crescita/Ultra): Carboidrati disponibili, Fibra alimentare, Acido linoleico omega-6, Acido alfa-linolenico ALA, EPA, DHA, EPA + DHA, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Vitamina B5 / acido pantotenico, Vitamina K, Arginina, Istidina, Isoleucina, Leucina, Lisina, Metionina, Metionina + cistina, Fenilalanina, Fenilalanina + tirosina, Treonina, Triptofano, Valina, L-carnitina, Cistina, Tirosina, Energia alimentare (uomo, NON EM cane), Carboidrati per differenza (fonte), Acido grasso 18:2 non differenziato (fonte), Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%): Carboidrati disponibili, Fibra alimentare, Acido linoleico omega-6, Acido alfa-linolenico ALA, EPA, DHA, EPA + DHA, Omega-3 totali, Omega-6 totali, Acido arachidonico, Potassio, Cloruro, Magnesio, Rame, Iodio, Ferro, Manganese, Selenio (diete umide), Zinco, Vitamina A, Vitamina D, Vitamina E, Vitamina B1 / tiamina, Vitamina B2 / riboflavina, Vitamina B3 / niacina, Vitamina B5 / acido pantotenico, Vitamina B6 / piridossina, Vitamina B9 / folati, Vitamina B12, Colina, Vitamina C, Biotina / vitamina B7, Vitamina K, Arginina, Istidina, Isoleucina, Leucina, Lisina, Metionina, Metionina + cistina, Fenilalanina, Fenilalanina + tirosina, Treonina, Triptofano, Valina, Taurina, L-carnitina, Cistina, Tirosina, Energia alimentare (uomo, NON EM cane), Carboidrati per differenza (fonte), Acido grasso 18:2 non differenziato (fonte), Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Macinato di manzo crudo 3% grassi: Acido linoleico omega-6, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Macinato di manzo crudo 15% grassi: Acido linoleico omega-6, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Macinato di manzo crudo 30% grassi: Acido linoleico omega-6, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Avena in fiocchi secca non fortificata: Acido linoleico omega-6, Acido alfa-linolenico ALA, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Zucca cotta al vapore (proxy USDA bollita): Acido linoleico omega-6, Acido alfa-linolenico ALA, EPA, DHA, EPA + DHA, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Vitamina D, Vitamina B12, Colina, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Beta-carotene (fonte)
- Valori solo «aggiunti» (limite inferiore, totale incerto): Q.Diet Compensa (standard, NON Crescita/Ultra): Rame; Q.Diet Compensa (standard, NON Crescita/Ultra): Iodio; Q.Diet Compensa (standard, NON Crescita/Ultra): Ferro; Q.Diet Compensa (standard, NON Crescita/Ultra): Manganese; Q.Diet Compensa (standard, NON Crescita/Ultra): Selenio (diete umide); Q.Diet Compensa (standard, NON Crescita/Ultra): Zinco; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina A; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina D; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina E; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B1 / tiamina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B2 / riboflavina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B3 / niacina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B6 / piridossina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B9 / folati; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B12; Q.Diet Compensa (standard, NON Crescita/Ultra): Colina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina C; Q.Diet Compensa (standard, NON Crescita/Ultra): Biotina / vitamina B7; Q.Diet Compensa (standard, NON Crescita/Ultra): Taurina
- Energia sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Macinato di manzo crudo 15% grassi: energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Macinato di manzo crudo 15% grassi: acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 15% grassi: vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 15% grassi: cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Macinato di manzo crudo 30% grassi: energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Macinato di manzo crudo 30% grassi: acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 30% grassi: vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 30% grassi: cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Avena in fiocchi secca non fortificata: energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Avena in fiocchi secca non fortificata: acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Avena in fiocchi secca non fortificata: vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Avena in fiocchi secca non fortificata: cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Avena in fiocchi secca non fortificata: avena: stato di pesata (secca) e preparazione (ammollo, cottura) da verificare insieme alla validità della stima energetica; l’ammollo non equivale alla cottura dell’amido
- Lacuna del catalogo non risolta — Zucca cotta al vapore (proxy USDA bollita): energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Zucca cotta al vapore (proxy USDA bollita): acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Zucca cotta al vapore (proxy USDA bollita): vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Zucca cotta al vapore (proxy USDA bollita): cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Q.Diet Compensa (standard, NON Crescita/Ultra): B5 come sale e colina da cloruro di colina richiedono documentazione chimica; additivi dichiarati solo come aggiunti (totale incerto)
- Lacuna del catalogo non risolta — Omegor Vitality 1000 (capsula): potenza per capsula e stima energetica dell’olio (9 kcal/capsula) da controllare; massa del contenuto per capsula non indicata
- Lacuna del catalogo non risolta — Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%): variante trascritta dall’utente (Ca 22,6%, P 17,7%) diversa dal profilo attuale del produttore: confermare la confezione reale; energia ignota (non zero)

## Scenario B — nuovi default dell’adulto sano

Preferenze effettive passate al calcolo (prima ricerca → seconda ricerca con gli ampliamenti documentati):

- protein_energy_pct: 25–40 % energia macro (4/9/4) → minimo ampliato 20 % energia macro stimata (4/9/4); massimo ampliato 45 % energia macro stimata (4/9/4)
- fat_energy_pct: 25–45 % energia macro (4/9/4) → minimo ampliato 20 % energia macro stimata (4/9/4); massimo ampliato 50 % energia macro stimata (4/9/4)
- carb_energy_pct: 20–50 % energia macro (4/9/4) → minimo ampliato 15 % energia macro stimata (4/9/4); massimo ampliato 55 % energia macro stimata (4/9/4)
- fiber: 5–15 g/1000 kcal → minimo ampliato 4 g/1000 kcal; massimo ampliato 18 g/1000 kcal
- Rapporto Ca:P (preferenza 1,2–1,4) → minimo ampliato 1,1 ; massimo ampliato 1,5 ; vincolo necessario 1–2. Coefficienti netti passati al solver per il minimo ampliato (riga «Ca − 1,1·P ≥ 0», g per passo): Macinato di manzo crudo 3% grassi (per 1 g) -0,002153; Macinato di manzo crudo 15% grassi (per 1 g) -0,001731; Macinato di manzo crudo 30% grassi (per 1 g) -0,001212; Avena in fiocchi secca non fortificata (per 1 g) -0,00399; Carota cotta al vapore (proxy USDA bollita) (per 1 g) -0,00003; Zucca cotta al vapore (proxy USDA bollita) (per 1 g) -0,00018; Q.Diet Compensa (standard, NON Crescita/Ultra) (per 0,1 unità) 0,01085; Omegor Vitality 1000 (capsula) (per 1 unità) 0; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) (per 0,1 unità) 0,00313.
  Righe originarie del rapporto (prima ricerca e vincolo necessario): Rapporto calcio/fosforo: minimo 1 → 0,0115 per QDiet; Rapporto calcio/fosforo: minimo 1,2 → 0,0102 per QDiet.

**Esito: Preferenze non raggiungibili: vincoli del modello sui contributi noti rispettati, preferenze no; non è un menù** (`preferences_unreachable`, 1,6 s, ricerca P1: nessuna riuscita).

Quantità diagnostiche (vincoli del modello sui contributi noti rispettati; non è un menù):

| Componente | Quantità |
|---|---:|
| Macinato di manzo crudo 3% grassi | 589 g |
| Macinato di manzo crudo 15% grassi | 373 g |
| Macinato di manzo crudo 30% grassi | 6 g |
| Avena in fiocchi secca non fortificata | 0 g |
| Carota cotta al vapore (proxy USDA bollita) | 706 g |
| Zucca cotta al vapore (proxy USDA bollita) | 470 g |
| Q.Diet Compensa (standard, NON Crescita/Ultra) | 9,9 g |
| Omegor Vitality 1000 (capsula) | 1 capsule |
| Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) | 23,8 g |

Energia: 1764 kcal (totale parziale: energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%)) su 1.800 kcal (tolleranza ±2%: 1.764–1.836).
Ripartizione energetica stimata 4/9/4: proteine 47,6%, grassi 40%, carboidrati disponibili 12,4%; fibra 26,4 g/die (14,9 g/1000 kcal); Ca:P con i soli valori noti 1,071; EPA+DHA 814 mg/die.

### Vincoli problematici nella soluzione mostrata

| Nutriente | Controllo | Esito | Dettaglio (soglia, apporto, scostamento o motivo) |
|---|---|---|---|
| Fibra alimentare | PERSONAL_TARGET min 5 max 15 per_1000_kcal_me | non verificabile | preferenza (min 5 · max 15 g/1000 kcal): massimo non verificabile — con i dati noti 14,9 g/1000 kcal; dato sconosciuto in Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Acido linoleico omega-6 | OFFICIAL_MIN min 3,82 per_1000_kcal_me | non verificabile | minimo ufficiale (min 3,82 g/1000 kcal): non verificabile — nessun dato disponibile |
| Calcio | OFFICIAL_NUTRITIONAL_MAX  max 6,25 per_1000_kcal_me | non verificabile | massimo nutrizionale ufficiale (max 6,25 g/1000 kcal): massimo non verificabile — con i dati noti 4,279 g/1000 kcal; dato sconosciuto in Omegor Vitality 1000 (capsula) |
| Fosforo | OFFICIAL_NUTRITIONAL_MAX  max 4 per_1000_kcal_me | non verificabile | massimo nutrizionale ufficiale (max 4 g/1000 kcal): massimo non verificabile — con i dati noti 3,997 g/1000 kcal; dato sconosciuto in Omegor Vitality 1000 (capsula) |
| Cloruro | OFFICIAL_MIN min 0,43 per_1000_kcal_me | non verificabile | minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Iodio | OFFICIAL_MIN min 0,3 per_1000_kcal_me | non verificabile | minimo ufficiale (min 0,3 mg/1000 kcal): copertura non verificabile — con i dati noti 0,248 mg/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo 3% grassi, Macinato di manzo crudo 15% grassi, Macinato di manzo crudo 30% grassi, Carota cotta al vapore (proxy USDA bollita), Zucca cotta al vapore (proxy USDA bollita), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Rapporto calcio/fosforo | OFFICIAL_MIN min 1 ratio | non verificabile | minimo ufficiale (min 1): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,071, non usato per il giudizio) |
| Rapporto calcio/fosforo | OFFICIAL_NUTRITIONAL_MAX  max 2 ratio | non verificabile | massimo nutrizionale ufficiale (max 2): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,071, non usato per il giudizio) |
| Rapporto calcio/fosforo | NON_OFFICIAL_ATTENTION min 1,2 max 1,4 ratio | non verificabile | soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,071, non usato per il giudizio) |
| Vitamina A | OFFICIAL_MIN min 1754 per_1000_kcal_me | non verificabile | minimo ufficiale (min 1754 IU/1000 kcal): copertura non verificabile — con i dati noti 1375 IU/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo 3% grassi, Macinato di manzo crudo 15% grassi, Macinato di manzo crudo 30% grassi, Carota cotta al vapore (proxy USDA bollita), Zucca cotta al vapore (proxy USDA bollita), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Vitamina A | OFFICIAL_NUTRITIONAL_MAX  max 100.000 per_1000_kcal_me | non verificabile | massimo nutrizionale ufficiale (max 100.000 IU/1000 kcal): massimo non verificabile — con i dati noti 1403,1 IU/1000 kcal; dato sconosciuto in Macinato di manzo crudo 3% grassi, Macinato di manzo crudo 15% grassi, Macinato di manzo crudo 30% grassi, Carota cotta al vapore (proxy USDA bollita), Zucca cotta al vapore (proxy USDA bollita), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%); Q.Diet Compensa (standard, NON Crescita/Ultra) dichiara solo quantità aggiunte (totale incerto) |
| Vitamina D | OFFICIAL_NUTRITIONAL_MAX  max 800 per_1000_kcal_me | non verificabile | massimo nutrizionale ufficiale (max 800 IU/1000 kcal): massimo non verificabile — con i dati noti 162,3 IU/1000 kcal; dato sconosciuto in Zucca cotta al vapore (proxy USDA bollita), Omegor Vitality 1000 (capsula), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%); Q.Diet Compensa (standard, NON Crescita/Ultra) dichiara solo quantità aggiunte (totale incerto) |
| Quota energia da proteine | PERSONAL_TARGET min 25 max 40 energy_pct | preferenza non rispettata | preferenza (min 25 · max 40 % energia macro (4/9/4)): superato in tutto l’intervallo possibile (44,7–47,6 % energia macro (4/9/4)) — richiesto 25–40 % energia macro (4/9/4), risultato 44,7 % energia macro (4/9/4), scostamento +4,7 % energia macro (4/9/4) |
| Quota energia da carboidrati disponibili | PERSONAL_TARGET min 20 max 50 energy_pct | preferenza non rispettata | preferenza (min 20 · max 50 % energia macro (4/9/4)): non raggiunto in tutto l’intervallo possibile (12,4–17,7 % energia macro (4/9/4)) — richiesto 20–50 % energia macro (4/9/4), risultato 17,7 % energia macro (4/9/4), scostamento -2,3 % energia macro (4/9/4) |
| Energia | ±2% | non verificabile | 1764,001 kcal su obiettivo 1800 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 23,8 g (1,1% del peso della razione): totale parziale, la tolleranza energetica non è attestata. |

### Vincoli necessari al limite nella soluzione mostrata

- Fosforo: massimo 4 g/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75))
- Rame: minimo 2,08 mg/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1800 kcal obiettivo
- Vitamina D: minimo 159 IU/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1800 kcal obiettivo (coperto con i dati noti)
- Q.Diet Compensa (standard, NON Crescita/Ultra): al massimo consentito (9,9)
- Omegor Vitality 1000 (capsula): al massimo consentito (1)

### Incompatibilità matematiche (diagnosi del modello)

Violazione minima necessaria se le preferenze **ampliate** fossero vincoli, insieme ai vincoli necessari (scarto nell’unità della riga del modello; per le quote, kcal di «Ep − quota·(Ep+Ef+Ec)», circa 18 kcal per punto percentuale su 1.800 kcal):

- Vitamina D: minimo 159 IU/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1800 kcal obiettivo — coperto con i soli dati noti (livello H) — scarto minimo 3,433 IU/die
- Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) non oltre 9,9 — raggiunto, contribuisce al conflitto

### Preferenze iniziali non raggiunte: cosa le impedisce (una alla volta)

- Rapporto calcio/fosforo: minimo 1,2 (Allegato C — preferenza formulativa NON FEDIAF, bozza da rivedere): impedita da Vitamina D: minimo 159 IU/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1800 kcal obiettivo — coperto con i soli dati noti (livello H); Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) 9,9 (superarla richiede una valutazione veterinaria)
- Quota energia da proteine: massimo 40 % energia macro stimata (4/9/4) (Target personale — preferenza utente (2026-10-20)): impedita da Vitamina D: minimo 159 IU/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1800 kcal obiettivo — coperto con i soli dati noti (livello H); Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) 9,9 (superarla richiede una valutazione veterinaria)
- Quota energia da carboidrati disponibili: minimo 20 % energia macro stimata (4/9/4) (Target personale — preferenza utente (2026-10-20)): raggiungibile da sola: il conflitto nasce solo insieme alle altre preferenze o vincoli

### Dati mancanti (separati dalle incompatibilità)

- Omegor Vitality 1000 (capsula): Proteine, Carboidrati disponibili, Fibra alimentare, Umidità, Acido linoleico omega-6, Acido alfa-linolenico ALA, Omega-6 totali, Acido arachidonico, Calcio, Fosforo, Potassio, Sodio, Cloruro, Magnesio, Rame, Iodio, Ferro, Manganese, Selenio (diete umide), Zinco, Vitamina A, Vitamina D, Vitamina B1 / tiamina, Vitamina B2 / riboflavina, Vitamina B3 / niacina, Vitamina B5 / acido pantotenico, Vitamina B6 / piridossina, Vitamina B9 / folati, Vitamina B12, Colina, Vitamina C, Biotina / vitamina B7, Vitamina K, Arginina, Istidina, Isoleucina, Leucina, Lisina, Metionina, Metionina + cistina, Fenilalanina, Fenilalanina + tirosina, Treonina, Triptofano, Valina, Taurina, L-carnitina, Cistina, Tirosina, Energia alimentare (uomo, NON EM cane), Carboidrati per differenza (fonte), Acido grasso 18:2 non differenziato (fonte), Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Q.Diet Compensa (standard, NON Crescita/Ultra): Carboidrati disponibili, Fibra alimentare, Acido linoleico omega-6, Acido alfa-linolenico ALA, EPA, DHA, EPA + DHA, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Vitamina B5 / acido pantotenico, Vitamina K, Arginina, Istidina, Isoleucina, Leucina, Lisina, Metionina, Metionina + cistina, Fenilalanina, Fenilalanina + tirosina, Treonina, Triptofano, Valina, L-carnitina, Cistina, Tirosina, Energia alimentare (uomo, NON EM cane), Carboidrati per differenza (fonte), Acido grasso 18:2 non differenziato (fonte), Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%): Carboidrati disponibili, Fibra alimentare, Acido linoleico omega-6, Acido alfa-linolenico ALA, EPA, DHA, EPA + DHA, Omega-3 totali, Omega-6 totali, Acido arachidonico, Potassio, Cloruro, Magnesio, Rame, Iodio, Ferro, Manganese, Selenio (diete umide), Zinco, Vitamina A, Vitamina D, Vitamina E, Vitamina B1 / tiamina, Vitamina B2 / riboflavina, Vitamina B3 / niacina, Vitamina B5 / acido pantotenico, Vitamina B6 / piridossina, Vitamina B9 / folati, Vitamina B12, Colina, Vitamina C, Biotina / vitamina B7, Vitamina K, Arginina, Istidina, Isoleucina, Leucina, Lisina, Metionina, Metionina + cistina, Fenilalanina, Fenilalanina + tirosina, Treonina, Triptofano, Valina, Taurina, L-carnitina, Cistina, Tirosina, Energia alimentare (uomo, NON EM cane), Carboidrati per differenza (fonte), Acido grasso 18:2 non differenziato (fonte), Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Macinato di manzo crudo 3% grassi: Acido linoleico omega-6, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Macinato di manzo crudo 15% grassi: Acido linoleico omega-6, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Macinato di manzo crudo 30% grassi: Acido linoleico omega-6, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Vitamina A da carotenoidi (UI per uso umano), Beta-carotene (fonte)
- Carota cotta al vapore (proxy USDA bollita): Acido linoleico omega-6, Acido alfa-linolenico ALA, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg)
- Zucca cotta al vapore (proxy USDA bollita): Acido linoleico omega-6, Acido alfa-linolenico ALA, EPA, DHA, EPA + DHA, Omega-3 totali, Omega-6 totali, Acido arachidonico, Cloruro, Iodio, Vitamina A, Vitamina D, Vitamina B12, Colina, Biotina / vitamina B7, Vitamina K, Taurina, L-carnitina, Acido grasso 20:4 non differenziato (fonte), Retinolo (fonte, µg), Beta-carotene (fonte)
- Valori solo «aggiunti» (limite inferiore, totale incerto): Q.Diet Compensa (standard, NON Crescita/Ultra): Rame; Q.Diet Compensa (standard, NON Crescita/Ultra): Iodio; Q.Diet Compensa (standard, NON Crescita/Ultra): Ferro; Q.Diet Compensa (standard, NON Crescita/Ultra): Manganese; Q.Diet Compensa (standard, NON Crescita/Ultra): Selenio (diete umide); Q.Diet Compensa (standard, NON Crescita/Ultra): Zinco; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina A; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina D; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina E; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B1 / tiamina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B2 / riboflavina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B3 / niacina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B6 / piridossina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B9 / folati; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina B12; Q.Diet Compensa (standard, NON Crescita/Ultra): Colina; Q.Diet Compensa (standard, NON Crescita/Ultra): Vitamina C; Q.Diet Compensa (standard, NON Crescita/Ultra): Biotina / vitamina B7; Q.Diet Compensa (standard, NON Crescita/Ultra): Taurina
- Energia sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Macinato di manzo crudo 15% grassi: energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Macinato di manzo crudo 15% grassi: acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 15% grassi: vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 15% grassi: cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Macinato di manzo crudo 30% grassi: energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Macinato di manzo crudo 30% grassi: acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 30% grassi: vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 30% grassi: cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Carota cotta al vapore (proxy USDA bollita): energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Carota cotta al vapore (proxy USDA bollita): acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Carota cotta al vapore (proxy USDA bollita): vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Carota cotta al vapore (proxy USDA bollita): cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Zucca cotta al vapore (proxy USDA bollita): energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Zucca cotta al vapore (proxy USDA bollita): acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Zucca cotta al vapore (proxy USDA bollita): vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Zucca cotta al vapore (proxy USDA bollita): cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Q.Diet Compensa (standard, NON Crescita/Ultra): B5 come sale e colina da cloruro di colina richiedono documentazione chimica; additivi dichiarati solo come aggiunti (totale incerto)
- Lacuna del catalogo non risolta — Omegor Vitality 1000 (capsula): potenza per capsula e stima energetica dell’olio (9 kcal/capsula) da controllare; massa del contenuto per capsula non indicata
- Lacuna del catalogo non risolta — Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%): variante trascritta dall’utente (Ca 22,6%, P 17,7%) diversa dal profilo attuale del produttore: confermare la confezione reale; energia ignota (non zero)

