# QDiet Compensa: dati dichiarati e informazioni da chiedere al produttore

Generato il 22/10/2026 dal profilo importato (`qdiet`, catalogo 2024 p. 19). Valori per 1 g di prodotto, unità canoniche dell’app.

## Come l’app tiene separate le tre cose

1. **Dose indicata dal produttore**: tabella d’impiego 5–40 kg (0,3 g/kg al massimo); oltre 40 kg e sotto 5 kg estrapolata con lo stesso rapporto g/kg e sempre segnata «estrapolato, non indicato dal produttore».
2. **Margine operativo del generatore**: +10% oltre il massimo della tabella (gradino 2), scelta operativa dell’utente in `dati/riferimenti/formulazione_v2.json`; non è un margine di sicurezza.
3. **Limiti nutrizionali (FEDIAF N) e legali (FEDIAF L su sostanza secca)**: controllati nutriente per nutriente sul totale della razione, in modo indipendente dalla dose.

Superare la dose del produttore è descritto come tale (con la percentuale e il margine configurato) e richiede una valutazione veterinaria; non viene presentato come superamento di un limite ufficiale né come prova di tossicità.

## Componenti analitici totali (dichiarati come «total»)

| Nutriente | Valore per g |
|---|---|
| Proteine | 0,0425 g |
| Grassi totali | 0,0007 g |
| Umidità | 0,03 g |
| Calcio | 0,18 g |
| Fosforo | 0,065 g |
| Sodio | 0,02 g |
| Magnesio | 0,015 g |
| Potassio | 0,075 g |

## Additivi dichiarati come «aggiunti» (restano aggiunti: mai trasformati in totali)

| Nutriente | Aggiunto per g | Forma o conversione | Perché serve il totale |
|---|---|---|---|
| Rame | 0,25 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | massimo legale su sostanza secca |
| Iodio | 0,045 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | massimo legale su sostanza secca |
| Ferro | 1,25 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | massimo legale su sostanza secca |
| Manganese | 0,3 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | massimo legale su sostanza secca |
| Selenio (diete umide) | 4 µg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | massimo legale su sostanza secca |
| Zinco | 2 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | massimo legale su sostanza secca |
| Vitamina A | 250 IU |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | massimo nutrizionale FEDIAF |
| Vitamina D | 25 IU |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | massimo legale su sostanza secca e massimo nutrizionale FEDIAF |
| Vitamina B1 / tiamina | 0,075 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Vitamina B2 / riboflavina | 0,25 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Vitamina B3 / niacina | 0,05 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Vitamina B6 / piridossina | 0,05 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Vitamina B9 / folati | 10 µg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Vitamina B12 | 1 µg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Vitamina C | 1,25 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Biotina / vitamina B7 | 2,5 µg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Taurina | 50 mg |  · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Vitamina E | 2 IU | all_rac_alpha_tocopheryl_acetate · mg→IU × 1 (tutto-rac/dl-alfa-tocoferil acetato (sintetico); 1 UI/mg — approvato dalla nutrizionista il 16/10/2026) · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Colina | 67,14 mg | choline_chloride · cloruro di colina (puro) → colina × 0,746 (fattore stechiometrico 0,746 — approvato dalla nutrizionista il 17/10/2026) · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |
| Vitamina B5 / acido pantotenico | 0,414 mg | calcium_d_pantothenate · calcio D-pantotenato → acido pantotenico × 0,92 (fattore 0,92 (FEDIAF 2025, tab. VII-14: 1 mg di calcio D-pantotenato = 0,92 mg di acido D-pantotenico) — conversione richiesta dalla specifica v2 del 21/10/2026 (§6), fattore confermato dall'utente il 22/10/2026; forma e valore originali conservati) · base per_kg → per dose (1 g di prodotto = 1 g, × 0,001) | solo minimo (il totale serve per la precisione, non per un massimo) |

## Cosa chiedere al produttore

Domande precise, nell’ordine di importanza per i controlli di livello A:

1. **Contenuto totale analitico** (non solo la quantità aggiunta) di: Rame, Iodio, Ferro, Manganese, Selenio (diete umide), Zinco, Vitamina A, Vitamina D. Oppure una dichiarazione che le materie prime di base (sostanze minerali, maltodestrina) non ne apportano quantità rilevanti, con il limite superiore. Finché manca, i massimi legali e i massimi nutrizionali di vitamina A e D restano **grigi** (non verificabili) in ogni ricetta con QDiet.
2. **Nutrienti non dichiarati** (oggi sconosciuti, mai zero): Acido linoleico omega-6, Cloruro, Arginina, Istidina, Isoleucina, Leucina, Lisina, Metionina, Metionina + cistina, Fenilalanina, Fenilalanina + tirosina, Treonina, Triptofano, Valina.
3. **Fibra alimentare totale** e **carboidrati disponibili** (in etichetta c’è solo la fibra grezza 0,01%, che non equivale alla fibra totale).
4. **Composizione delle «sostanze minerali»**: quali sali e in che quantità (serve anche per il cloruro).
5. **Purezza del cloruro di colina** usato (la conversione 0,746 assume il sale puro) e conferma che il calcio D-pantotenato è la forma dichiarata (conversione 0,92 confermata il 22/10).
6. **Indicazioni d’uso oltre 40 kg** (oggi l’app estrapola 0,3 g/kg e lo segnala).
7. **Lotto o versione** del prodotto a cui si riferiscono i dati.

