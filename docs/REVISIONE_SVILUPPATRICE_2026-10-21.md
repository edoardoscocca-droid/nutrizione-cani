# Risposta al dossier di revisione del 21/10/2026

## 0. Premessa

Questa **non è una revisione indipendente**: l’ho scritta io, l’IA che ha implementato l’app. Il dossier chiede una nuova IA, ed è
giusto che resti così.

Questo documento serve a due cose:
1. Dare alla revisione indipendente i **fatti verificati sul codice**, che nel dossier mancano («il codice non è incluso»). Tutto
   quello che dico sul comportamento del generatore viene dal codice attuale (`main`, commit `6a84f3f`) o da prove eseguite in memoria
   (`scripts/collaudo/varianti-revisione.ts`). Nessun dato, ricetta o prescrizione è stato modificato.
2. Dare la mia diagnosi, che va letta come un parere di parte.

## 1. Fatti verificati sul codice (rispondono alle domande aperte del dossier)

| Domanda del dossier | Stato nel codice |
|---|---|
| Quali preferenze sono attive (§7) | Proteine 25–40%, grassi 25–45%, carboidrati 20–50% delle kcal macro 4/9/4; fibra 5–15 g/1000 kcal (`dati/riferimenti/preferenze_iniziali.json`). Ampliamenti: ±5 punti, fibra ×0,8/×1,2, Ca:P ±0,1. |
| Minimo pratico «5 g oppure 0,5%» (§7) | È il **maggiore** dei due: max(5 g, 0,5% delle kcal obiettivo / kcal per g). Solo per gli alimenti, come «0 oppure almeno il minimo». |
| Copertura dei minimi con dati incompleti (§6.5) | È ancora al **livello H**. Prima delle preferenze il motore massimizza la copertura con i soli contributi noti e la fissa. |
| Funzione di praticità (P2) | Somma di: scarto energetico dall’obiettivo, grammi degli alimenti (peso minimo), unità degli integratori. **Non conta il numero di ingredienti** e non conosce gruppi o proporzioni: tre macinati quasi uguali non costano nulla in più di uno. |
| Tabella d’impiego oltre l’ultima riga | **Nessun limite**. Per Garmr (72 kg, tabella fino a 40 kg) il generatore propone 27,7 g di QDiet. Per Ker invece il limite c’è: le due regole sono incoerenti. |
| Retinolo 0 delle verdure | **Non applicato**: `vitamin_a` della carota e della zucca resta sconosciuta. Il beta-carotene invece è convertito. |
| Database online | Non lo posso leggere. L’app ha due modalità. **Prova**: dati sul telefono, catalogo incluso nell’app. **Con accesso**: Supabase. Un’importazione fatta dall’app in modalità Prova resta solo su quel telefono. |

## 2. Prove in memoria (Ker 1.340 kcal e Garmr 2.700 kcal, stessi dati e regole)

| Caso | Esito | Carne | Avena | Carote | Lino | Farina d’ossa | QDiet |
|---|---|---:|---:|---:|---:|---:|---:|
| Ker, tre macinati, preferenze (stato attuale) | soluzione (2ª ricerca) | 544+16+16 | 37 | 532 | 40 | 18 | 9 |
| Ker, solo 5%, preferenze | preferenze non raggiungibili | 601 | 5 | 663 | 36 | 18,4 | 9 |
| Ker, solo 5%, **senza** preferenze macro/fibra | soluzione | 598 | 0 | 710 | 37 | 18,4 | 9 |
| Ker, solo 10%, **senza** preferenze macro/fibra | soluzione | 353 | 12 | **1.403** | 36 | 0 | 9 |
| Garmr, solo 5%, preferenze | preferenze non raggiungibili | 1.229 | 5 | 1.309 | 73 | 34 | 24 |
| Garmr, solo 5%, **senza** preferenze | soluzione | 1.194 | 0 | 1.541 | 73 | 0 | **27,7** |

In tutti i casi lo stato è «verifica nutrizionale incompleta».

**Cosa dimostrano le prove**: le quantità estreme **non dipendono dalle preferenze sui macronutrienti**. Restano anche togliendole. Le
cause sono tre, ciascuna legata a una regola del motore.

1. **Il lino è dettato dal linoleico calcolato sui soli contributi noti.** Carne, avena e verdure hanno linoleico «sconosciuto» (18:2
   non differenziato). Il minimo va dimostrato al livello H, e l’unica fonte documentata è il lino. Servono circa 36 g a 1.340 kcal e
   73 g a 2.700 kcal, sempre.
2. **Le carote servono a «diluire» il fosforo e a inseguire Ca:P ≥ 1,2.** Il fosforo massimo (4 g/1000 kcal) è quasi sempre saturo.
   Il calcio viene da QDiet, che ha un tetto, e dalla farina d’ossa, che porta anche fosforo. Quando Ca:P 1,2–1,4 (una **soglia non
   ufficiale**, trattata come preferenza prioritaria) non si raggiunge altrimenti, il solver toglie carne e mette verdura, che ha
   poche calorie e poco fosforo. Con il 10% si arriva a 1,4 kg di carote.
3. **Il modello non ha una «forma» del pasto.** Nessun vincolo dice quanta parte delle calorie o del peso può venire dalle verdure o
   dagli oli, e nessuna penalità limita il numero di ingredienti. Un’ottimizzazione lineare porta naturalmente le quantità agli
   estremi.

Due altri difetti emersi:
- con un solo macinato la diagnosi elenca il **cloruro** (che non ha nessun dato) fra le cause del conflitto: è rumore della diagnosi
  sui vincoli fissati, non una vera causa;
- l’energia esce sempre a **−2%** (1.313,2 kcal), segno che le fasi precedenti spingono contro il bordo della tolleranza.

## 3. Diagnosi

**Concettualmente sbagliato o troppo complicato:**

1. **Il generatore ottimizza numeri, non un pasto.** Il metodo dell’Excel (calorie per gruppo: carne, amidacei, verdure, oli) era una
   struttura pratica sensata. Sostituirlo con quote di macronutrienti ha tolto proprio l’informazione che impedisce 1,4 kg di carote.
   Le quote macro sono un risultato da mostrare, non la leva giusta per costruire il menù.
2. **«Dimostrare con i soli dati noti» al livello H** è corretto per la *verifica* (non chiamare verificato ciò che non lo è), ma
   **dannoso per la *generazione***. Costringe il solver a comprare certezza con quantità estreme (lino) invece di dichiarare il dato
   insufficiente. Verifica e generazione devono avere due politiche diverse sull’incertezza.
3. **Ca:P 1,2–1,4 come preferenza prioritaria (P1)** pesa più della praticità, senza base ufficiale (FEDIAF: 1–2). Da sola produce le
   quantità più assurde.
4. **Troppi stati intermedi** («non verificabile», «parziale», «ampliato», «seconda ricerca», «bozza diagnostica») senza una scala di
   attendibilità unica. L’utente non riesce a capire se la proposta è utilizzabile.

**Da mantenere** (funziona ed è verificato con i confronti del pacchetto):
- somme, conversioni di unità e forme, total/added, capsule intere;
- analisi a quantità fisse senza toccare i grammi;
- beta-carotene, EPA+DHA come obiettivo separato;
- tabella d’impiego come limite operativo in generazione e come avviso in analisi;
- importatore con anteprima.

## 4. Architettura che propongo: menù per gruppi, poi integrazione, controllo congiunto

Confronto le tre alternative del dossier (§14B):

- **Ottimizzazione congiunta di tutto** (attuale): potente ma cieca alla praticità. Per renderla pratica servirebbero comunque i
  vincoli per gruppo.
- **Ricette di riferimento con sostituzioni**: robusta, ma richiede un archivio di ricette documentate che oggi non c’è, e non copre
  ingredienti nuovi.
- **Proposta: per fasi, nello stesso solver.**
  1. **Struttura**: l’utente sceglie gli ingredienti, ciascuno con il suo gruppo (carne, amidaceo, verdura, olio). Le calorie per
     gruppo hanno intervalli precompilati e modificabili, come nell’Excel. Esempio iniziale da far fissare alla prima IA:
     carne 60–85%, amidacei 10–30%, verdure 0–10%, oli 0–10%. Un solo ingrediente per gruppo, salvo scelta esplicita
     dell’utente; penalità per ogni ingrediente in più.
  2. **Necessari (H)** solo su dati **documentati o stimati con fonte** (vedi §5): minimi e massimi FEDIAF 95, Ca:P 1–2, energia
     ±2%, EPA+DHA, tabelle d’impiego (con una regola esplicita oltre l’ultima riga).
  3. **Integratori**: scelti nello stesso modello, per coprire i deficit dimostrati, con il minimo di unità. Nessuna fase separata
     che perda gli apporti incrociati di QDiet o della farina d’ossa.
  4. **Preferenze** (macro %, fibra, Ca:P 1,2–1,4): solo da mostrare, o al massimo un ultimo criterio debole dopo la praticità.
  5. **Verifica finale**, invariata e severa: mostra cosa è dimostrato, cosa poggia su stime e cosa è sconosciuto.

Non è una riscrittura: si riusano solver, verifica, importatore e dati. Cambiano i vincoli di P1 e P2 e la politica dell’incertezza
in generazione.

## 5. Incertezza: tre livelli invece di due

- **Documentato**: dato del prodotto o di banca dati per quell’alimento.
- **Stimato con fonte**: proxy dichiarato. Esempi: linoleico da 18:2 non differenziato per carni e cereali (in gran parte n-6 cis,cis,
  ma con una quota di isomeri da documentare), avena dal database ceco, retinolo 0 delle verdure, cloruro e iodio da tabelle compatibili. Il generatore li usa; la verifica
  scrive «dimostrato con stime» e indica quali.
- **Sconosciuto**: mai zero. Il generatore **non** compra copertura con quantità estreme. La proposta si chiude con «dato
  insufficiente per X: serve Y», e Y è una richiesta di dato, non 40 g di olio.

Per i massimi con contributi marginali sconosciuti (involucro di Omegor, minerali di una capsula da 1 g): fissare un criterio
documentato di «contributo trascurabile». Per esempio: massa sconosciuta sotto lo 0,5% della razione, o tetto fisico dato dalla massa
(1 g di capsula non può contenere più di 1 g di calcio). Così i massimi non diventano tutti non verificabili.

## 6. Correzioni, in un piano finito

**1. Bloccanti (dati e formule):**
- regola per le tabelle d’impiego oltre l’ultima riga (Garmr): limite proporzionale in g/kg dell’ultima riga, dichiarato come
  estrapolazione, oppure nessun uso automatico;
- retinolo 0 delle verdure come zero documentato della sola preformata;
- diagnosi senza i vincoli «fissati» privi di dati (cloruro).

**2. Decisioni da fissare una volta** (prima IA o utente):
- intervalli calorici per gruppo;
- tetto al numero di ingredienti per gruppo;
- Ca:P preferito solo informativo;
- +10% sugli aminoacidi: documentare la fonte o toglierlo;
- tolleranza energetica con energia incerta;
- regola delle stime con fonte.

**3. Incertezze accettabili da mostrare:**
- verdure bollite al posto di quelle al vapore;
- profili USDA medi;
- variante della farina d’ossa;
- psillio assunto;
- energia stimata 4/9/4.

**4. Dati realmente necessari** (non bloccano una prima versione):
- linoleico identificato, cloruro e iodio dei 6 alimenti principali, come stime con fonte;
- energia della farina d’ossa.

**5. Da rimandare:**
- limiti legali su sostanza secca;
- erbe e spezie;
- annullamento del calcolo;
- profilo FEDIAF 110;
- velocità.

## 7. Collaudo di accettazione (sette casi, non solo Ker)

Una proposta passa se, sui dati documentati più le stime con fonte:
- rispetta i vincoli necessari;
- resta nei gruppi calorici;
- non contiene più di un ingrediente per gruppo se non scelto;
- ha oli non oltre il loro intervallo, salvo un deficit dimostrato e spiegato;
- usa capsule intere e minimi pratici;
- elenca ciò che resta sconosciuto.

I casi:
1. Analisi della prescrizione di Ker a grammi fissi: apporti identici al pacchetto, beta-carotene a parte. Già superato.
2. Ker, generazione con **una** carne scelta (5%), avena, carota, olio, QDiet, Omegor, farina d’ossa.
3. Stesso caso con la zucca al posto della carota e con un’altra fonte di calcio (profilo documentato).
4. Garmr 2.700 kcal: verifica della regola della tabella oltre i 40 kg.
5. Fabbisogno diverso (per esempio 900 kcal, cane piccolo) con gli stessi ingredienti.
6. Caso impossibile intenzionale (per esempio solo carne magra e olio, senza fonte di calcio): risposta «non fattibile» con la causa
   precisa e il suggerimento di cosa aggiungere.
7. Dati insufficienti (un alimento con metà dei nutrienti mancanti): proposta con l’elenco dei dati da completare, senza quantità
   estreme per compensare.

**Utilizzabile quando** i sette casi passano. Limite permanente: la proposta resta da far valutare a un veterinario nutrizionista.
L’app non dichiara mai «dieta completa»: dichiara «vincoli rispettati su dati documentati e stimati, ecco le incognite».

## 8. Cosa servirebbe alla revisione indipendente

Il codice è nel repository e posso allegare i file. Per la diagnosi bastano:
- `src/engine/formulate.ts` (fasi e obiettivi);
- `src/engine/audit.ts` (verifica);
- `src/engine/totals.ts` e `src/engine/vitaminA.ts`;
- `dati/riferimenti/preferenze_iniziali.json`;
- questo documento e le prove in `scripts/collaudo/varianti-revisione.ts`.
