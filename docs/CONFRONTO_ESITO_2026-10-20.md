# Confronto dei dati del collaudo — esito (20/10/2026)

Riferimenti: `dati/confronti/2026-10-19/` (JSON reali del 19/10 e istruzioni, hash verificati), confronto campo per campo
`docs/CONFRONTO_SORGENTI_2026-10-20.md`, caso reale con i JSON `docs/CASO_REALE_JSON_2026-10-19.md`, caso reale precedente
`docs/CASO_REALE_2026-10-20.md`. Nessuna modifica a catalogo, database o ricette: i JSON sono caricati solo in copie in memoria.

## 1. Dove nascono le differenze

**Causa: versione dei dati, non un errore dell’importatore.** Il resoconto precedente usava il catalogo della modalità prova
(`LocalRepository.loadCatalog()`): pacchetto + `dati/importazioni/2026-10-16/import_*.json`, convertiti dai file del **16/10**
(`dati/importazioni/2026-10-16/originali/`) con l’adattatore e importati in modalità legacy. Da questi stessi file sono generati
`supabase/data/2026-10-16_*.sql`, quindi anche l’iPhone collegato a Supabase ha i dati del 16/10, salvo importazioni fatte dopo dalla
scheda Catalogo (il database online non è leggibile da qui). I JSON del **19/10** non erano mai entrati nel progetto: il 19/10 era stato
chiesto di non importare ancora prodotti reali.

L’importatore normale (`src/data/catalogImport.ts`, schema definitivo JSON, modalità strict) legge i due JSON del 19/10 senza errori,
avvisi o conversioni in sospeso. Ogni valore del file è presente dopo l’importazione e ogni NA resta sconosciuto: nessuno zero creato.
Lo script del collaudo non aveva altre fixture: solo `usableForOptimization = true` sui tre integratori, nella copia (lo stesso valore
del file del 19/10).

| Differenza | File 16/10 → catalogo/Supabase | JSON 19/10 → importatore | Passaggio |
|---|---|---|---|
| QDiet calcio e fosforo | `reported_or_estimated` / ANALYTICAL_DECLARED, nessuna marcatura | `total` | sorgente diversa; importatore fedele in entrambi i casi |
| Omegor massa del contenuto | assente («massa totale capsula ignota») | 1 g/capsula | sorgente diversa |
| Omegor energia | assente | 9 kcal/capsula (stima della sola quota olio) | sorgente diversa |
| Farina d’ossa, identità | «marca/prodotto NON confermato» | Grau, variante Ca 22,6% / P 17,7% | sorgente diversa; **Ca, P, proteine, grassi, umidità, sodio identici** |
| Avena, stato | CSV `dry_weighed_before_soaking` → adattatore → `raw` | `dried` | **adattatore del 16/10** (mappatura su `raw`) |

Altre differenze trovate nel confronto campo per campo:
- **Fibra di QDiet e della farina d’ossa**: nel 16/10 la fibra *grezza* (0,01% e 0,3%) era registrata come fibra alimentare
  (0,0001 e 0,003 g/g). Nel 19/10 è NA, con la nota «fibra grezza non equiparata alla fibra alimentare totale».
- **EPA + DHA di Omegor**: dichiarato 803 mg nel 19/10; nel 16/10 era calcolato come EPA 535 + DHA 268 = 803 mg. Equivalente.
- **Energia degli alimenti**: stessi valori 4/9/4 (114,92 contro 114,9 per arrotondamento). Nel 19/10 l’energia è scritta nel file, quindi
  risulta «inserita»; per il manzo 30% il valore coincide e resta «calcolata». Nessuna differenza nel calcolo.
- Solo metadati: marca, URL della fonte, versione del prodotto, note, preparazione.
- Nessuna differenza su vitamina D (QDiet 25 UI/g «added», manzo 4 UI/100 g), su calcio e fosforo canonici, sulla tabella d’impiego di QDiet.

Il resoconto precedente diceva «nel file consegnato calcio e fosforo sono reported_or_estimated»: era vero per il file del 16/10, non per
quello del 19/10. La frase ora indica il file effettivo.

La lacuna del catalogo su Omegor (`dati/riferimenti/lacune_catalogo.json`) dice ancora «massa del contenuto per capsula non indicata».
Con il file del 19/10 la massa è indicata (1 g), ma la stima di 9 kcal e la potenza per capsula restano da controllare. Il testo non è
stato cambiato automaticamente.

## 2. Effetto sull’esito

| | Scenario A, dati 16/10 | Scenario A, JSON 19/10 | Scenario B, dati 16/10 | Scenario B, JSON 19/10 |
|---|---|---|---|---|
| Esito | preferenze non raggiungibili | **uguale** | preferenze non raggiungibili | **uguale** |
| Manzo totale | 1.037 g | 1.042 g | 968 g | 968 g |
| Avena / carota / zucca | 77 / 0 / 195 g | 79 / 0 / 182 g | 0 / 708 / 468 g | 0 / 706 / 470 g |
| QDiet / Omegor / farina d’ossa | 9,9 g / 1 / 22,7 g | 9,9 g / 1 / 22,6 g | 9,9 g / 1 / 23,8 g | 9,9 g / 1 / 23,8 g |
| Energia nota | 1.764 kcal | 1.764 kcal | 1.764 kcal | 1.764 kcal |
| Energia sconosciuta | Omegor, farina d’ossa | solo farina d’ossa | Omegor, farina d’ossa | solo farina d’ossa |
| Quote 4/9/4 (P/G/C) | 52,2 / 36,1 / 11,7% | 52,9 / 35,1 / 11,9% | 47,2 / 40,4 / 12,4% | 47,6 / 40,0 / 12,4% |
| Ca:P con i soli valori noti | 1,005 | 1,001 | 1,071 | 1,071 |

**Il collo di bottiglia sulla vitamina D resta, invariato.** Minimo 159 UI/1000 kcal su 1.800 kcal = 286,2 UI/die. Con i dati noti la
vitamina D viene solo da QDiet (al massimo 9,9 g → 247,5 UI, valore «added») e dal manzo (4 UI/100 g). Servono quindi almeno ~968 g di
manzo, e lo scenario B ne usa esattamente 968 g. Nello scenario B la diagnosi indica di nuovo vitamina D e dose massima di QDiet, con
scarto minimo 3,4 UI/die. Nello scenario A i vincoli saturi sono gli stessi di prima: fosforo massimo, Ca:P ≥ 1, rame minimo e QDiet al
massimo. Non sono stati aumentati valori sconosciuti né abbassato il requisito.

Cosa cambia nei controlli con i JSON del 19/10, senza effetto sull’esito:
- **Quote energetiche**: con la massa del contenuto di Omegor (1 g, di cui 1 g di grassi dichiarati) l’intervallo delle quote diventa
  calcolabile. In A le quote di proteine (49,9–52,9%) e grassi (33,1–35,1%) sono **preferenze non rispettate in modo dimostrato**, non più
  «non verificabili». La quota di carboidrati resta non verificabile perché QDiet non dichiara i carboidrati.
- **Fibra**: diventa non verificabile, perché QDiet e farina d’ossa ora hanno fibra alimentare sconosciuta (prima c’era la fibra grezza).
- **Energia**: resta sconosciuta solo quella della farina d’ossa (1,1–1,7% del peso della razione).
- **Ca:P e massimi di calcio e fosforo**: restano non verificabili, perché Omegor non dichiara calcio e fosforo. Non si deduce che siano
  zero dalla massa dell’olio (1 g di grassi è un’approssimazione di 1000 mg di olio, non un’analisi della capsula).

## 3. Stato delle soluzioni mostrate

In tutte e quattro le prove la soluzione mostrata soddisfa **i vincoli del modello sui contributi noti**, ma la **verifica nutrizionale
è incompleta**. Restano non verificabili:
- acido linoleico e cloruro (nessun dato);
- iodio e vitamina A (copertura non verificabile);
- rapporto Ca:P (Omegor);
- massimi di calcio, fosforo e vitamine A e D;
- energia (farina d’ossa).

Le quantità sono diagnostiche: le preferenze non sono raggiunte nemmeno con gli ampliamenti, e non è un menù generato. Nessuna di queste
soluzioni va descritta come «tutti i requisiti nutrizionali soddisfatti». Le diciture dell’app sono state allineate:
- «Vincoli del modello sui contributi noti rispettati; verifica nutrizionale incompleta (dati non verificabili)»;
- «Preferenze non raggiungibili: vincoli del modello sui contributi noti rispettati, preferenze no; non è un menù».

## 4. Separazione delle cause

- **Differenza di versione dei dati**: 16/10 contro 19/10 (sopra). Nessun errore dell’importatore. Una mappatura discutibile
  dell’adattatore del 16/10: avena `dry_weighed_before_soaking` → `raw`. Una scelta del 16/10 superata dal 19/10: fibra grezza come
  fibra alimentare.
- **Limiti della composizione selezionata**: vitamina D dimostrabile solo con QDiet e manzo, fosforo massimo, Ca:P ≥ 1 e rame minimo,
  dose massima di QDiet. Valgono con entrambe le versioni.
- **Preferenze**: scenario A (proteine ≥ 60%, grassi ≤ 15%) incompatibile con quei limiti; scenario B più vicino, ma i carboidrati non
  raggiungono la quota.
- **Dati non verificabili**: elencati sopra. Non sono la causa dell’esito e non sono stati trasformati in zeri.

Per allineare il catalogo ai JSON del 19/10 basta importarli dalla scheda Catalogo → Importa (anteprima, poi conferma). Non l’ho fatto:
serve il tuo ok.
