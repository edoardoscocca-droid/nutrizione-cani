# Ker: importazione controllata, analisi della prescrizione e generatore — esito (20/10/2026)

Pacchetto corretto `Verifica_menu_Ker_2026-10-20_1` in `dati/confronti/2026-10-20_ker/`. Rispetto al precedente cambia solo l’unità
dello iodio (g → mg in 6 righe dei risultati e nel CSV) e le note; i file di dati sono identici byte per byte.

Dettagli:
- anteprima dell’importazione: `docs/IMPORTAZIONE_2026-10-20_ANTEPRIMA.md`;
- analisi della prescrizione: `docs/VERIFICA_KER_2026-10-20.md`;
- generatore: `docs/GENERATORE_KER_2026-10-20.md`.

## 1. Importazione nel catalogo reale (preparata, da eseguire in Supabase)

L’importatore normale (schema definitivo, modalità strict) dà 0 errori e 0 conversioni in sospeso, su quattro file in ordine:
1. aggiornamento dei 6 alimenti, con gli stessi identificativi;
2. 4 nuovi profili di confronto (bovino 5% e 10%, olio di cocco, olio di lino);
3. i tre integratori del 19/10;
4. psillio Erbavoglio.

- **Non utilizzabili nel calcolo**: i profili di confronto e lo psillio (come chiede il file).
- **Restano come sono**: i 6 alimenti già attivi.
- **Diventano utilizzabili**: i tre integratori, come indica il loro file del 19/10.
- **Conservati**: fonti, stati dei valori e marcatura total/added (QDiet: calcio e fosforo «total», vitamine e oligoelementi «added»).
- **Nessuna convalida attribuita**: i valori aggiornati perdono quella eventuale.
- **Nessuna ricetta, quantità o preferenza toccata**: il test del database lo verifica, ricette invariate.

**Un ostacolo trovato e risolto.** Il database rifiutava 28 zeri «calculated» dei file degli alimenti (EPA+DHA = 0 + 0, carboidrati
per differenza, minerali degli oli a 0,0 in USDA). Il vincolo del database era del 16/10 e ammetteva solo zeri analitici, misurati o
da etichetta. L’importatore applicava già la regola decisa il 19/10: «uno zero deve essere un dato documentato (analytical_zero,
label, measured o calculated), non una stima». La migrazione `20261024000010_zeri_calcolati.sql` allinea il database a quella regola;
lo zero «estimated» resta vietato.

Ordine in Supabase (SQL Editor):
1. migrazione `supabase/migrations/20261024000010_zeri_calcolati.sql`;
2. poi `supabase/data/2026-10-20/01_…`, `02_…`, `03_…`, `04_…`.

Il tutto è provato sul database di prova con le stesse migrazioni. La modalità prova dell’app ha già lo stesso pacchetto.

## 2. Analisi della prescrizione (quantità bloccate)

- Gli apporti noti coincidono con il pacchetto in tutti e sei gli scenari, **energia compresa (Δ 0 kcal)**. Lo iodio ora si confronta
  in mg senza correzioni manuali.
- **Psillio**: è il profilo Erbavoglio Cuticola Bio, **assunto per il confronto**. Resta a 5 g esatti.
  - L’energia metabolizzabile completa è **sconosciuta**.
  - Le 0,1404 kcal/g (0,702 kcal) ricavate dai macronutrienti dichiarati compaiono a parte, come contributo parziale escluso dal
    totale; il totale resta non attestato.
  - Regola nel motore: un integratore senza energia dichiarata e con fibra alimentare dichiarata non riceve più un’energia 4/9/4
    «completa».
- **Base calorica dei minimi**: ora è scritta nella verifica, per esempio «Minimi per 1000 kcal applicati su 1517,3 kcal: il maggiore
  fra obiettivo (1340 kcal) e calorie calcolate (1517,3 kcal)». La regola non è cambiata: il triptofano dello scenario al 10% resta
  «copertura non verificabile».
- **QDiet 13 g**: avviso di superamento della tabella d’impiego; la dose non cambia.
- **Profilo FEDIAF**: solo il 95.

## 3. Generatore automatico (1.340 kcal)

Impostazioni:
- **Ingredienti**: bovino 3%, 5% e 10% (la prescrizione dice «grasso massimo 10%»), avena, carote, olio di cocco, olio di lino,
  farina d’ossa, QDiet, Omegor, psillio. Resi utilizzabili solo nella copia in memoria.
- **Preferenze**: quelle iniziali dell’adulto sano.
- **QDiet**: limite della tabella d’impiego al peso attuale, **9,06 g** (9 g con il passo di 0,1 g). I 13 g prescritti non lo
  aumentano.

**Esito: preferenze non raggiungibili.** Tutti i vincoli necessari sono rispettati sui contributi noti (33 dimostrati, 0 violati,
6 non verificabili), ma nessuna combinazione rispetta le preferenze, nemmeno ampliate. Le quantità sono diagnostiche: non è un menù.

| Componente | Generatore (diagnostico) | Prescrizione |
|---|---:|---:|
| Bovino 3% / 5% / 10% | 690 / 0 / 63 g | 560 g (max 10%) |
| Avena | 0 g | 100 g |
| Carote | 280 g | 90 g |
| Olio di cocco / lino | 0 / 36 g | 10 / 10 g |
| Farina d’ossa | 17,3 g | 5 g |
| QDiet | 9 g | 13 g |
| Omegor | 1 capsula | 1 capsula |
| Psillio | 12,5 g | 5 g |

**Apporti**:
- energia nota 1.313,2 kcal (estremo basso della tolleranza; non attestata per farina d’ossa e psillio);
- quote 4/9/4: proteine 47,8–51%, grassi 41,6–44,4%, carboidrati 4,5–10,5%;
- vitamina D 247,6 UI (minimo 213 UI: non è più il collo di bottiglia);
- EPA+DHA 803 mg;
- linoleico identificato 5,13 g;
- Ca/P sui noti 1,082 (non verificabile).

**Preferenze**:
- rispettata la quota grassi;
- disattese la quota proteine (massimo 40%, ampliato 45%) e la quota carboidrati (minimo 20%, ampliato 15%);
- fibra e Ca:P non verificabili.

### Cosa impedisce la soluzione

**Vincolo necessario dominante (incompatibile con le preferenze): vitamina A minima.**
- Il minimo è 1.754 UI/1000 kcal su 1.340 kcal = 2.350 UI/die.
- Con i dati noti la vitamina A viene solo da QDiet (250 UI/g, «added») e dal retinolo del manzo (13,3 UI/100 g). I carotenoidi della
  carota non sono convertiti per il cane e non contano.
- Con QDiet fermo a 9 g (2.250 UI) servono almeno **~753 g di manzo**; la soluzione ne usa esattamente 753.
- Tanta carne porta la quota proteica sopra il 45% e il fosforo al massimo (4 g/1000 kcal, saturo). Il fosforo al massimo esclude
  l’avena, e quindi i carboidrati.
- La diagnosi indica come conflitto minimo vitamina A e dose massima di QDiet (scarto 16,3 UI/die).
- Nella prescrizione la vitamina A non è un problema perché i 13 g di QDiet ne danno 3.250 UI: la differenza nasce dal limite della
  tabella d’impiego, che il generatore rispetta.

**Altri vincoli al limite**:
- fosforo massimo;
- linoleico minimo, coperto solo dall’olio di lino: da qui i 36 g e un ALA di 19,4 g;
- Omegor a 1 capsula.

**Preferenze non raggiungibili**: Ca:P ≥ 1,2, impedito da triptofano (+10% senza digeribilità documentata) e dose massima di QDiet;
quote di proteine e carboidrati.

**Dati insufficienti, che non sono la causa dell’esito**:
- cloruro, senza dati;
- calcio, fosforo, vitamine A e D di Omegor e psillio;
- fibra di QDiet e della farina d’ossa;
- energia di farina d’ossa e psillio;
- lacune del catalogo elencate nel dettaglio.

### Nota sulle quantità diagnostiche

Ora anche una soluzione diagnostica passa per le fasi successive della specifica (altre preferenze, P2 praticità, P3 costo). Prima si
fermava a P1. Psillio e farina d’ossa però non cambiano, perché sono dettati da P1:
- la farina d’ossa sale finché il fosforo è al massimo, per avvicinare Ca:P alla preferenza;
- lo psillio alza di pochissimo la quota di carboidrati, finché la fibra arriva al suo massimo.

Sono effetti di un calcolo diagnostico, non dosi consigliate.

## 4. Da decidere (non cambiato)

1. Vitamina A dei vegetali: senza una conversione documentata dei carotenoidi per il cane, la vitamina A dipende da QDiet e dalla
   carne.
2. Copertura del linoleico con il solo olio di lino: il generatore lo usa per dimostrare il minimo, ma porta tanto ALA.
3. Preferenze di Ker: qui sono usate quelle iniziali dell’adulto sano. Se la veterinaria ha intervalli suoi, vanno inseriti nel
   profilo.
