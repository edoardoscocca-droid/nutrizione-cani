# Prescrizione di Ker nel motore dell’app — esito del confronto (20/10/2026)

Pacchetto «Verifica_menu_Ker_2026-10-20» conservato in `dati/confronti/2026-10-20_ker/` (non importato). Dettaglio completo, generato
dall’app: `docs/VERIFICA_KER_2026-10-20.md` (`npx tsx scripts/collaudo/ker-prescrizione.ts dati/confronti/2026-10-20_ker`).

Prova solo in memoria: nessuna modifica a catalogo, database, ricette o prescrizione; nessun prodotto marcato come convalidato.
La stima condizionale della B5 non è stata importata. Quantità della prescrizione tutte bloccate (QDiet 13 g compresa). È stata usata
l’analisi delle quantità fisse (la stessa di una ricetta modificata a mano), **non** il generatore e non il collaudo da 1.800 kcal.

## 1. Importazione

Il ricalcolo del vostro `calcola_verifica.py` (in una cartella separata) rigenera file identici a quelli del pacchetto. I due file
`*_riferimento_19ott.json` hanno lo stesso hash dei JSON del 19/10 già confrontati.

Con l’importatore normale (schema definitivo, modalità strict), tutti i file entrano con 0 errori e 0 conversioni in sospeso, dopo due
osservazioni:

1. **`psillio_confronto.json` è un file di integratori** (elenco `supplements`, classe `fiber`, dose in g): va importato come
   integratore, non come alimento.
2. **Unità dei carotenoidi**: `alimenti_esistenti_aggiornati.json` scrive «IU» per `vitamin_a_carotenoid_iu`, mentre il dizionario
   dell’app usa «IU (carotenoids; human labeling)». L’importatore bloccava l’intero file.
   - Correzione nell’importatore: un’unità del dizionario con una precisazione tra parentesi accetta la stessa unità base.
   - Il valore resta nel campo informativo e non si somma alla vitamina A.
   - Nessun valore del file è cambiato.

## 2. Apporti: app contro pacchetto (scenario principale bovino 5% + carota)

| Grandezza | Atteso | App |
|---|---:|---:|
| Calcio noto | 3,5996 g | 3,5996 g |
| Fosforo noto | 3,2759 g | 3,2759 g |
| Rapporto noto Ca/P | 1,09881254 | 1,09881254 |
| Vitamina D nota | 341,8 UI | 341,8 UI |
| Vitamina E nota | 44,41193 UI | 44,4119 UI |
| Iodio noto | 0,585 mg | 0,585 mg |
| EPA+DHA | 803 mg | 803 mg |
| Fibra nota | 17,29 g | 17,29 g |
| Colina nota | 1.318,23 mg | 1.318,23 mg |
| Quote 4/9/4 parziali | 41,74 / 38,88 / 19,39% | 41,74 / 38,88 / 19,39% |
| Energia parziale del modello | 1.296,93 kcal | 1.297,63 kcal (**+0,702**) |

Tutti gli altri apporti noti coincidono nei sei scenari: proteine, grassi, minerali, vitamine, aminoacidi, linoleico identificato
1,5922 g, ALA 5,5011 g. L’app indica anche quali componenti non dichiarano ogni nutriente e quali valori sono solo «added».

### Gli unici scostamenti

1. **Energia +0,702 kcal in tutti gli scenari: psillio.**
   - L’app calcola l’energia di un integratore senza energia dichiarata dai macronutrienti dichiarati, con 4/9/4 (decisione D3).
     Per lo psillio sono 0,1404 kcal/g × 5 g = 0,702 kcal: il valore che la nota del vostro file descrive.
   - Il pacchetto lascia invece l’energia dello psillio sconosciuta, perché il 4/9/4 non conta la fermentazione della fibra.
   - Nell’app lo psillio risulta così con energia «calcolata», e solo la farina d’ossa con energia sconosciuta. Il controllo
     dell’energia resta comunque «non attestato», per la farina d’ossa.
   - **Da decidere**: qualificare come parziale l’energia 4/9/4 di un prodotto con fibra dichiarata rilevante, o lasciarla
     sconosciuta. È un criterio nuovo e non l’ho introdotto.
   - Durante il confronto ho trovato anche un arrotondamento: l’energia calcolata di un integratore era arrotondata a 0,1 kcal per
     dose (0,1404 → 0,1). Ora ha 4 decimali. Gli alimenti, per 100 g, non cambiano, e nessun integratore reale cambia.
2. **Triptofano, solo con il bovino 10% (37 esiti dei minimi coincidenti su 38).**
   - Con il bovino 10% l’energia calcolata (1.518 kcal) supera i 1.340 kcal scritti.
   - L’app applica i minimi per 1000 kcal su max(1.340, energia calcolata), come da specifica §4: minimo 0,818 g contro i 0,722 g del
     pacchetto, che usa sempre 1.340.
   - Il triptofano noto (0,762 g) è sotto 0,818, e l’olio di lino non lo dichiara: l’esito dell’app è «copertura non verificabile»,
     quello del pacchetto «coperto».
   - È una differenza di metodo, non di dati. Negli altri cinque scenari tutti i 38 esiti coincidono.

## 3. Come l’app tratta la prescrizione

- **QDiet 13 g**: la dose resta 13 g. La tabella d’impiego (30,2 kg → 4,53–9,06 g) produce un **avviso** di dose oltre il massimo
  consigliato. Il limite del generatore non è stato toccato.
- **Energia rispetto a 1.340 kcal**: è un controllo mostrato, non un requisito per analizzare o salvare. Qui è «non attestato»
  (farina d’ossa). Nessuna quantità è cambiata per avvicinarsi a 1.340.
- **Ca/P**: rapporto noto 1,0988, ma per l’app **non verificabile**, perché Omegor e psillio non dichiarano calcio e fosforo. La
  preferenza 1,2–1,4 appare come preferenza o soglia non ufficiale non verificabile, non come carenza.
- **Stato in tutti e sei gli scenari**: «Bozza parziale: dati mancanti, non interamente verificabile». Vincoli del modello sui
  contributi noti rispettati, verifica nutrizionale incompleta.
- **Minimi non verificabili**: linoleico (solo i due oli identificati), cloruro, B5 (sale di QDiet non convertito), più il
  triptofano nel solo scenario 10%.
- **Massimi non verificabili**: calcio, fosforo, Ca/P, vitamine A e D. Nessun massimo superato in modo dimostrato.
- **Lacune del catalogo**: ne sono segnalate 12 per i prodotti usati.

## 4. Limiti del confronto

- **Profilo 110**: l’app contiene solo la colonna FEDIAF **95 kcal/kg^0,75**. I confronti «110» del pacchetto non sono riproducibili
  nel motore.
- **Unità dello iodio nel pacchetto**: in `risultati_dettagliati.json` e `confronto_nutrienti.csv` lo iodio è indicato in «g», ma i
  valori sono in mg (0,585 mg; minimo 0,3 mg × 1,34 = 0,402 mg). Il confronto è stato fatto in mg.
- **Cosa cambierebbe nel catalogo vero** importando questi file (non fatto; elenco completo nel dettaglio):
  - manzo: vitamina D da 4 a 3 UI/100 g, vitamina A preformata 13,3 UI/100 g;
  - avena: stato «dried»;
  - zucca: vitamina D 0, B12 0, colina 6,2 mg, vitamina E da 1,58 a 1,19 UI, carotenoidi da 1.082 a 5.755 UI (solo informativi);
  - fibra di QDiet e della farina d’ossa sconosciuta invece della fibra grezza;
  - Omegor con 1 g di contenuto e 9 kcal per capsula;
  - nuovi prodotti: bovino 5% e 10%, olio di cocco, olio di lino, psillio;
  - somme metionina+cistina e fenilalanina+tirosina: ora dichiarate, ma uguali a quelle calcolate prima.
- **Lacune del catalogo** (`dati/riferimenti/lacune_catalogo.json`): alcuni testi sono superati dai nuovi dati, per esempio la
  vitamina A del manzo e la massa di Omegor. Non li ho cambiati automaticamente.

## 5. Conclusione

L’app riproduce gli apporti noti del pacchetto, salvo i 0,702 kcal dello psillio, spiegati sopra. Distingue sconosciuti, valori
«added», stime e preferenze. Mantiene le quantità prescritte. Il precedente collo di bottiglia sulla vitamina D non si presenta: con
13 g di QDiet la vitamina D nota è 341,8 UI, contro un minimo di 213,06 UI su 1.340 kcal.

Restano da decidere, prima di aggiornare la produzione:
1. se importare questi dati nel catalogo vero;
2. come trattare l’energia 4/9/4 dei prodotti ricchi di fibra;
3. se aggiungere la colonna FEDIAF 110.
