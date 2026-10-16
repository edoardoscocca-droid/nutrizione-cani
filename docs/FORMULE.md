# Formule e funzionamento del motore

Versione del motore: `motore-1.0.0` (salvata in ogni versione di ricetta).

## Energia
- RER = 70 × peso_riferimento^0,75 (peso ideale per convenzione concordata).
- MER = RER × fattore energetico (inserito; nessun fattore predefinito).
- Riferimento FEDIAF della colonna usata: 95 × peso^0,75 (solo confronto e avviso D2).
- Energia della ricetta = Σ kcal EM/100 g × g/100 + Σ kcal per dose × dosi. Se un componente non ha kcal, l'energia è «parziale».

## Somme dei nutrienti
- Alimento: valore per 100 g × grammi / 100. Integratore: valore per dose × numero di dosi.
- Ogni totale tiene separati i contributi noti e i componenti **senza dato** (null ≠ 0).
- EPA+DHA: riga composta se presente, altrimenti EPA + DHA; mai sommati di nuovo agli omega-3 totali.
- Met+Cys e Phe+Tyr: riga composta se presente, altrimenti metionina + cistina e fenilalanina + tirosina (formula dell'allegato F; cistina e tirosina aggiunte al dizionario come voci descrittive).

## Rapporti e quote
- Ca:P = Σ Ca (g) / Σ P (g); definito solo con dati completi e P > 0; verificato **insieme** ai minimi assoluti.
- ω6/ω3 = Σ omega-6 totali / Σ omega-3 totali; solo con entrambi completi e > 0.
- Quota energetica = 100 × grammi × fattore kcal/g / kcal della ricetta; solo con fattori approvati (D4).

## Limiti
- Per 1000 kcal: densità = totale / kcal effettive × 1000 (equivalente giornaliero mostrato sulle kcal effettive).
- Limiti su sostanza secca o mangime al 12 %: nessun confronto senza conversione approvata.
- Colori: rosso (limite ufficiale violato, anche dimostrato con soli dati noti per i massimi), arancione (soglia non
  ufficiale/preferenza), verde, blu (nessun limite numerico), grigio (non verificabile), viola (nota individuale/di razza).
- Stato ricetta: *Non rispetta limiti ufficiali* > *Dati insufficienti* > *Rispetta i limiti ma non tutte le preferenze* >
  *Verificata rispetto ai controlli disponibili* (mai «clinicamente completa»).

## Ottimizzazione (HiGHS, programmazione lineare a interi)
Variabili: grammi di ogni alimento e dosi di ogni integratore selezionato, come multipli del passo di arrotondamento
(capsule e compresse sempre intere). Un unico modello, risolto in fasi a priorità:

1. **Vincoli rigidi**: minimi e massimi ufficiali, rapporto Ca:P 1–2, target fissati da professionista, energia entro la
   tolleranza, limiti scelti dall'utente, dose massima del produttore (solo se la fonte è registrata).
   Con dati parziali: un massimo resta rigido (i soli valori noti già lo vincolano), un minimo diventa «copertura»
   da massimizzare e la verifica resta grigia.
2. Copertura dei minimi con dati parziali.
3. Kcal il più vicine possibile all'obiettivo.
4. Preferenze flessibili (target personali, Ca:P 1,2–1,4 non ufficiale, quote energetiche).
5. Praticità (D17): meno integratori, porzione più compatta, costo minore se tutti i prezzi sono noti.

Ogni fase fissa il risultato della precedente. Se la fase 1 è impossibile, un modello «elastico» trova la violazione
minima e indica i vincoli in conflitto e cosa c'è in catalogo con dati verificati per quei nutrienti: nessuna aggiunta ciclica.

## Verifica indipendente
Dopo il calcolo, `audit.ts` ricalcola tutto da zero sulle quantità arrotondate e sull'istantanea congelata
(alimenti, integratori, limiti, fattori, profilo del cane, impostazioni), senza usare il modello di ottimizzazione.
La stessa verifica si ripete a ogni modifica manuale delle quantità.
