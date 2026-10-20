# Verifica indipendente del menù 1 prescritto a Ker

20 ottobre 2026. Questo pacchetto contiene dati e un calcolo a quantità fisse, NON una nuova dieta e NON una certificazione clinica. Non cambia la prescrizione. Non è stato eseguito nel motore dell’app.

## Risultato pratico

Il precedente collaudo da 1.800 kcal non riproduceva la prescrizione. Nel menù veterinario QDiet è 13 g, sono presenti due oli e psillio, il bovino ha grasso massimo 10%, il fabbisogno scritto è 1.340 kcal. Il tetto operativo di 9–9,9 g QDiet escludeva la dose prescritta: questo impediva al generatore di cercare nella stessa composizione. Non era una prova di insufficienza del menù della veterinaria.

Con la dose prescritta, QDiet da solo apporta 325 UI di D. Nei profili bovini qui esaminati se ne aggiungono 16,8 UI: contributo noto 341,8 UI/giorno. Quindi il precedente ostacolo vitamina D non si presenta in questo confronto a dosi fisse. Il riferimento 95 su 1.340 kcal è 213,06 UI; su 1.800 kcal sarebbe 286,2 UI. Non serve aumentare la carne per compensare il nostro tetto operativo.

Restano dati e assunzioni da chiarire. Non è corretto rendere verdi tutti i controlli perché esiste una prescrizione, né scartare la prescrizione perché una preferenza dell’app è più stretta.

## 1. Prescrizione utilizzata

Fonte: PDF fornito dall’utente, pagina 2, visita del 01/10/2025. Ker allora: 30,2 kg, peso di riferimento 27,2 kg, BCS6/9, 6 anni. Non è il profilo di prova da33kg/1800kcal.

| Componente | Quantità giornaliera |
|---|---:|
| Macinato bovino, grasso massimo10% | 560g |
| Fiocchi d’avena | 100g |
| Olio di cocco | 10g |
| Olio di lino OPPURE canapa | 10g |
| Carote OPPURE zucca al vapore | 90g |
| Farina d’ossa Grau | 5g |
| QDiet Compensa | 13g |
| Omegor Vitality1000 | 1capsula |
| Cuticole di psillio Erbavoglio | 5g |

La prescrizione prevede ammollo dei fiocchi per circa mezz’ora. Nel confronto si assumono100g pesati secchi. I90g di verdura sono trattati come peso cotto per coerenza con il profilo al vapore: la convenzione di pesata non è però esplicitata nella tabella della prescrizione. Non sono usati contemporaneamente lino+canapa o carote+zucca.

## 2. Scenari: non inventare un macinato unico

“Massimo10%” non significa esattamente10%, né identifica il lotto. Sono stati calcolati tre proxy USDA:3%,5%,10%, ciascuno con carota oppure zucca. Nessuno è dichiarato “la carne della veterinaria”. Non è stata ricavata una carne artificiale per far tornare1.340kcal.

Risultati con carota, stessi grammi in tutti i casi:

| Bovino proxy | Energia parziale del modello | Proteine note | Grassi noti | Ca/P sui valori noti |
|---|---:|---:|---:|---:|
| 3% | 1208,90kcal | 137,56g | 44,42g | 1,0878 |
| 5% | 1296,93kcal | 134,36g | 55,62g | 1,0988 |
| 10% | 1517,35kcal | 126,47g | 83,62g | 1,1310 |

Sono tre scenari rappresentativi, NON limiti garantiti della composizione reale. Energia parziale: manca la ME di farina d’ossa e psillio e non è quantificato l’involucro della capsula. Per i cibi è mantenuto il modello4/9/4 del confronto; non è una ME misurata e i carboidrati disponibili stimati non equivalgono automaticamente agli ENA richiesti da altre formule. Il fabbisogno1.340kcal scritto dalla veterinaria non è una misura calorimetrica della ricetta.

I valori energetici USDA per uso umano sono conservati separatamente; non sono sostituiti alla ME del cane. Non si può quindi pretendere coincidenza al2% con un altro software senza concordare composizione e metodo energetico.

## 3. Apporti centrali: esempio bovino5% e carota

Valori del modello, non analisi del pasto reale:

| Grandezza | Contributo noto giornaliero |
|---|---:|
| Calcio | 3,5996g |
| Fosforo | 3,2759g |
| Vitamina D | 341,8UI |
| Vitamina E | 44,41UI |
| Vitamina A preformata/documentata | 3324,67UI |
| Iodio da QDiet | 0,585mg |
| EPA+DHA | 803mg |
| ALA identificato | 5,5011g |
| Fibra alimentare | 17,29g |
| Colina, conversione cloruro×0,746 inclusa | 1318,23mg |

VitaminaA vegetale da carotenoidi non trasferita dalle UI umane al cane. Non sono sommate le masse dei minerali alle ceneri, gli aminoacidi alle proteine o EPA/DHA ai grassi. Il rapporto Ca/P è di contributi noti: psillio e capsula non hanno un’analisi minerale completa, quindi non è un rapporto finale attestato.

La fibra della versione Cuticola Bio contribuisce4,49g nei5g prescritti. La variante Polvere Bio ne darebbe4,25g: non scambiare le due etichette. Fibra grezza di QDiet/Grau non equiparata alla fibra alimentare.

## 4. Cosa dimostra il confronto sulle regole

- QDiet: tabella d’impiego generale e dose prescritta sono distinti. Nell’ANALISI di questa prescrizione13g sono bloccati; mostrare un avviso relativo alla tabella senza cambiare dose. Questo non autorizza a superare automaticamente la tabella in qualunque dieta generata.
- Ca/P: il risultato noto circa1,08–1,13 non raggiunge la preferenza1,2–1,4, pur non violando il limite esterno1–2 sui contributi noti. Il proxy5% fallirebbe di poco persino il nostro ampliamento minimo1,1. Una preferenza non deve diventare un giudizio di carenza o un motivo per alterare una prescrizione.
- Quote macro note con5%: circa41,74% proteine,38,88% grassi,19,39% carboidrati. Sono quote parziali4/9/4: macro non dichiarati degli integratori non sono zeri. Non sono le percentuali delle calorie provenienti dai gruppi “carne/avena/verdura”.
- Lino e Omegor svolgono ruoli differenti nei conteggi: il lino apporta ALA e linoleico, non sostituisce gli803mg EPA+DHA. Non imporre un rapporto universale5–10 fra omega-6 e omega-3. Un rapporto globale non è attestabile finché le due famiglie non sono definite e complete.
- Al riferimento nominale1.340kcal, i minimi del modello95 sono coperti dai contributi noti salvo linoleico, cloruro e B5 ancora esclusa come sale. Non significa verifica completa: molti massimi restano non verificabili perché mancano analisi totali. Il giudizio completo richiede anche energia e incertezze dei prodotti.
- Il pacchetto confronta separatamente i profili95 e110, senza mischiarli o scegliere quello che fa passare il test. L’energia nominale per peso metabolico è circa104 sul peso attuale della visita,112,5 sul peso di riferimento: la scelta clinica del profilo e del peso va documentata, non dedotta per far tornare i risultati.

## 5. Dati recuperati e conversioni

Fonti primarie USDA ottenute dall’API ufficiale in un’acquisizione salvata. Aggiornamenti con gli stessi ID per i sei prodotti esistenti; quattro nuovi profili: bovino5%, bovino10%, cocco, lino. Nuovo profilo specifico di cuticola Erbavoglio per il confronto.

- Oli: linoleico18:2n-6cis,cis effettivamente disponibile. Per10g di lino:1,4246g linoleico e5,3368g ALA. Nessuna assimilazione automatica del18:2 non differenziato.
- Zucca: recuperati fra gli altri D=0 e B12=0 presenti nella banca dati, colina, retinolo e carotenoidi. Non zeri inventati dal silenzio della fonte.
- Bovino: retinolo4µg/100g e carotenoidi riportati zero →13,333UI preformate per100g con0,3µg/UI. Il dato originario USDA in UI è arrotondato a14; l’originale è conservato nello snapshot.
- D bovino: usate3UI/100g native USDA. Prima0,1µg arrotondati erano stati convertiti in4UI. Differenza da arrotondamenti della fonte; non modifica la conclusione sulla dose prescritta di QDiet.
- Minerali in g/mg convertiti: una differenza di unità non è una differenza di concentrazione. E naturale alimentare convertita con1,49UI/mg; QDiet tutto-rac-acetato1UI/mg; colina da cloruro×0,746 applicata una volta sola.

## 6. Cosa non è stato “risolto” inventando valori

**Cloruro:** non disponibile nei profili selezionati. Non si ricava automaticamente dal sodio perché le forme saline non sono documentate. Rimane un dato da ottenere o stimare con una fonte appropriata; nessun nuovo zero.

**Linoleico di carne, avena e verdure:** il18:2 non differenziato rimane dato di fonte. Nel menù sono identificati con certezza analitica di banca dati1,5922g/die dai due oli; la parte degli altri alimenti resta da distinguere. Una somma del18:2 non differenziato può essere mostrata solo come scenario/limite informativo, non come linoleico esatto.

**B5 QDiet:** dichiarati450mg/kg di calcioD-pantotenato. PubChem documenta masse molecolari219,23 e476,5g/mol: fattore teorico2×219,23/476,5=0,92016789. Se i450mg si riferiscono al sale anidro attivo,13g apportano circa5,383mg B5. È sufficiente a cambiare il confronto B5, ma la forma/purezza e la base della dichiarazione del prodotto non sono confermate. La stima è separata, non applicata al calcolo principale e NON va importata automaticamente. Non è corretto registrare450mg di sale come450mg di vitamina.

**Psillio:** scheda attuale della Cuticola Bio: energia194kcal/100g di etichettatura umana, non ME canina; lasciata fuori dal totale energetico principale. Non convertire la fibra in zero calorie né copiare automaticamente194kcal come ME cane. Prodotto in polvere distinto, etichetta energetica online incoerente fra kJ e kcal. La confezione effettiva resta da identificare se si vuole un profilo preciso del prodotto usato nel2025.

**Grau:** mantenuta la variante trascritta22,6%Ca/17,7%P; il sito attuale riporta23,8%Ca/17,6%P. Nessuna sostituzione silenziosa. Energia ancora ignota.

**Omegor:** energia9kcal riguarda il grammo d’olio; massa e contributi dell’involucro restano ignoti. Il contenuto1g non dimostra che la capsula intera pesi1g, né che proteine, carboidrati e minerali dell’intera capsula siano zero.

**Identificazione e preparazione:** grasso effettivo del bovino, variante/lotti degli integratori e convenzione di pesata delle verdure restano fonti di incertezza. Non serve rifare l’Excel; serve non scambiarle per valori già conosciuti.

## 7. File del pacchetto

- `alimenti_esistenti_aggiornati.json`: aggiornamenti tracciati dei sei alimenti, stessi ID; non si importa alla cieca.
- `alimenti_nuovi_confronto.json`: quattro nuovi profili generici; disponibilità automatica disattivata. I due macinati sono scenari, non un’identificazione della carne della prescrizione.
- `psillio_confronto.json`: nuova scheda della Cuticola Bio attuale; utilizzabilità automatica disattivata. Se l’importatore ricava4/9/4 dai macro, il motore deve comunque qualificare la mancata energia da fermentazione, non attestare una ME completa.
- `integratori_riferimento_19ott.json`: copia identica dei tre integratori già consegnati; non nuova revisione e non autorizzazione a reimportare.
- `caso_prescritto_non_importare_come_catalogo.json`: quantità bloccate e assunzioni; formato per sviluppatrice, NON per pulsante Importa catalogo.
- `risultati_dettagliati.json`: sei scenari, contributi per ingrediente, valori mancanti, minimi nominali95/110, stato dei massimi.
- `confronto_nutrienti.csv`: tabella confrontabile; nessun nuovo Excel da compilare.
- `non_importare_automaticamente/qdiet_b5_condizionale.json`: stima chimica separata, non aggiornamento di produzione.
- `calcola_verifica.py` e `fonti/`: calcolo riproducibile e snapshot primari. Eseguire `python3 calcola_verifica.py` nella cartella estratta; usa soltanto la libreria standard e i file inclusi, non legge dati dell’app. Il PDF originale non è redistribuito: il suo hash e la trascrizione della ricetta sono conservati nel caso.

## 8. Istruzione unica per l’IA sviluppatrice

Prima prova solo in memoria, nessuna modifica alle ricette o al catalogo reale. Caricare i JSON tramite l’importatore normale. Usare l’analisi già disponibile con quantità fisse, non il generatore e non il collaudo1800kcal. Non marcare i prodotti come convalidati per ottenere il risultato.

Riprodurre il caso5%+carota come confronto numerico e gli altri cinque scenari come sensibilità. Mantenere13g QDiet e tutti gli ingredienti prescritti. La dose specifica documentata va analizzata; il superamento della tabella d’impiego è un avviso distinto. Non rimuovere indiscriminatamente limiti posologici o nutrizionali del generatore.

Risultati attesi sul caso5%+carota: Ca noto3,5996g; P noto3,2759g; rapporto noto1,09881254; D nota341,8UI; E nota44,41193UI; iodio noto0,585mg; EPA+DHA803mg; fibra nota17,29g; colina nota1318,23mg. Energia parziale1296,93kcal (precisione numerica del modello, non misura fisica).

Il test passa se l’app riproduce questi apporti e distingue correttamente sconosciuti, stime e preferenze. NON passa solo perché mostra tutti i controlli verdi. Non deve imporre±2% rispetto a1340 come requisito per conservare o analizzare la prescrizione: calcolo energetico e richiesta calorica sono grandezze da confrontare, non quantità da forzare uguali in analisi manuale.

Restituire un confronto campo-per-campo con eventuali scostamenti. Solo dopo il confronto decidere quali dati aggiornare in produzione e quali regole del generatore rivedere. Non aggiungere nuove quantità per “correggere” la prescrizione e non cambiare i riferimenti per farla passare.

## Fonti principali

- Prescrizione veterinaria fornita dall’utente,01/10/2025,pagina2 e istruzioni di preparazione. Hash nel file del caso.
- USDA SR Legacy, API FoodData Central: ID173111,171790,174030,171796,168652,173904,170394,168449,171412,167702. Snapshot completo in`fonti/usda_records.json`; provenienza per ogni valore nei JSON.
- Erbavoglio Cuticola Bio: https://erbavoglio.it/shop/cuticola-di-psillio-bio/
- Variante diversa Polvere Bio: https://erbavoglio.it/shop/polvere-di-psillio-cuticola-bio/
- QDiet Compensa polvere: catalogo2024,pagina stampata19,pagina PDF19: https://www.nuovafattoriaallocca.it/wp-content/uploads/2024/05/CATALOGO-Q.DIET-2024.pdf
- Omegor: https://www.omegor.com/products/omegor-vitality-1000/
- Grau attuale: https://www.grau-generationpet.de/00001073/naturreines-knochenmehl-175-g
- Retinolo: https://dsid.od.nih.gov/unit-conversions
- PubChem CID443753 e6613; snapshot`fonti/pubchem_pantotenato.json`.
- FEDIAF2025, tabellaIII-3b,pagina16: https://www.europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025.pdf

Verifiche svolte: normalizzazione unità; choline_chloride e formeE; somme e sottoinsiemi; grammi prescritti; fonti dei nuovi zeri; distinzione tipo di fibra; sei scenari; esportazione JSON; controlli strutturali locali. Importazione e confronto nel codice dell’app ancora da eseguire. Non è stata attestata la completezza clinica del menù né modificata la dieta di Ker.

## Errata corrige dopo confronto con l’app

L’unità dello iodio nelle righe di controllo e nel CSV era erroneamente indicata come g: corretta in mg. I numeri e i contributi non cambiano (caso principale: 0,585 mg/giorno). I confronti del pacchetto restano nominali su 1340 kcal; l’app applica invece la specifica max(calorie obiettivo, calorie calcolate). Per questo il giudizio sul triptofano dello scenario al 10% può differire senza differenze negli apporti. Il confronto FEDIAF110 resta documentale, non implementato nell’app.
