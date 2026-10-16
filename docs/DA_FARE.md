# Cosa serve per le prime ricette reali

Aggiornato al 18/10/2026, dopo l'importazione dei 6 alimenti e dei 3 integratori.

## 1. Decisioni con la nutrizionista (bloccanti)
1. **Energia per il cane (D4)** — approvare i fattori kcal/g per proteine, grassi e carboidrati disponibili
   (proposta comune: Atwater modificati NRC 2006, 3,5 / 8,5 / 3,5). Senza questo nessun alimento entra nel calcolo.
   Poi: Catalogo → Riferimenti → «Fattori energetici» (con nome di chi approva) → «Calcola».
2. **Vitamina D ed E (D19)** — approvare i fattori di conversione in UI per forma chimica.
3. **Etichette incomplete (D20)** — decidere se e quando i nutrienti non dichiarati di un integratore si possono considerare assenti.
4. Confermare le altre scelte tecniche (D1–D18 in `ANALISI.md`), soprattutto i criteri di «Verificato» (D18).

## 2. Dati da procurare (foto o schede)
- **Q.Diet Compensa**: foto della tabella sulla confezione, per confermare che vitamine e minerali sono «per kg»; kcal se indicate; lotto.
- **Farina d'ossa**: marca esatta e foto dell'etichetta (i valori attuali vengono da una ricerca, non dal prodotto).
- **Omegor Vitality 1000**: lotto; facoltativo il peso di una capsula intera (serve solo per i costi).
- Per tutti gli alimenti: cloruro, iodio, vitamina A (come retinolo per il cane), taurina mancano nella fonte USDA: dire se
  esistono fonti migliori o se si accetta che restino non verificabili.

## 3. Mettere online (una volta sola)
Seguire `docs/SUPABASE.md`: nuovo progetto Supabase, eseguire i file SQL nell'ordine indicato (compresi i dati del 16/10),
diventare amministratore, pubblicare su Render con le due variabili. Le chiavi si inseriscono nei pannelli, mai in chat.

## 4. Dopo le decisioni
Calcolare l'energia, controllare i motivi dello stato di ogni prodotto, convalidare, attivare, creare la prima ricetta e
confrontarla con la formulazione della veterinaria.
