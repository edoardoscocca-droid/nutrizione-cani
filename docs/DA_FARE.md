# Cosa serve per le prime ricette reali

Aggiornato al 16/10/2026, dopo le decisioni della nutrizionista su energia (D4), vitamine (D19) e integratori (D20).

## 1. Decisioni con la nutrizionista
Già decise e applicate: energia FEDIAF 2025 4/9/4 per tipologia (D4), conversioni vitamina D ed E per forma chimica (D19),
integratori sulla composizione dichiarata (D20). I 6 alimenti ora hanno l'energia calcolata e sono «Dati parziali».
1. **Criteri di «Verificato» (D18)** — la nutrizionista deve confermare il testo in `docs/CATALOGO.md` («Criteri di Verificato»).
2. **Energia per dose degli integratori (D21)** — kcal per dose dall'etichetta (o 0 se documentato): senza, con Q-Diet in ricetta
   alcuni minimi (proteine, metionina, triptofano, B5) restano «non dimostrati».
3. Facoltativo: coefficienti di digeribilità per amido o verdure crude (oggi solo un'avvertenza).
4. Confermare le altre scelte tecniche (D1–D17 in `ANALISI.md`).

## 2. Dati da procurare (foto o schede)
- **Q.Diet Compensa**: foto della tabella sulla confezione, per confermare che vitamine e minerali sono «per kg»; kcal se indicate; lotto.
- **Farina d'ossa**: marca esatta e foto dell'etichetta (i valori attuali vengono da una ricerca, non dal prodotto).
- **Omegor Vitality 1000**: lotto; facoltativo il peso di una capsula intera (serve solo per i costi).
- Per tutti gli alimenti: cloruro, iodio, vitamina A (come retinolo per il cane), taurina mancano nella fonte USDA: dire se
  esistono fonti migliori o se si accetta che restino non verificabili.

## 3. App iPhone (senza pubblicarla)
L'app è pronta (`mobile/`), il server di calcolo è online (https://nutrizione-cani-motore-q58c.onrender.com) e il progetto è
registrato su Expo (https://expo.dev/accounts/edoardodroid/projects/nutrizione-cani). Per installarla serve l'account
Apple Developer (titolare: la tua ragazza):
1. **Chiave App Store Connect API**: App Store Connect → Utenti e accessi → Integrazioni → App Store Connect API → nuova chiave
   con ruolo «App Manager» (o Admin); scaricare il file .p8 (si scarica una sola volta) e annotare Key ID e Issuer ID.
   La stessa chiave serve anche per Vita.
2. **Caricarla su Expo** (non in chat): expo.dev → account edoardodroid → Credentials → iOS → App Store Connect API Keys.
3. **Creare l'app su App Store Connect** (non viene pubblicata): App → «+» → Nuova app → nome «Nutrizione cani»,
   bundle ID `com.edoardoscocca.nutrizionecani` (se non compare nell'elenco, lo registro io col primo build).
4. Dirmelo: avvio io il build e l'invio a **TestFlight**. Voi installate l'app «TestFlight» e accettate l'invito.

## 4. Mettere online il database (una volta sola)
Seguire `docs/SUPABASE.md`: nuovo progetto Supabase, eseguire i file SQL nell'ordine indicato (compresi i dati del 16/10),
diventare amministratore, pubblicare su Render con le due variabili. Le chiavi si inseriscono nei pannelli, mai in chat.

## 5. Dopo le decisioni
Calcolare l'energia, controllare i motivi dello stato di ogni prodotto, convalidare, attivare, creare la prima ricetta e
confrontarla con la formulazione della veterinaria.
