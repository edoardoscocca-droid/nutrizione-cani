# Passaggio dello sviluppo a un'altra IA — stato al 22/10/2026

Questo documento descrive cosa esiste, dove si trova e chi lo controlla. Nessun proprietario, account, permesso o configurazione è stato modificato per prepararlo.

**Ultima versione funzionante:** commit `8bfa41d` del 22/10/2026 sul ramo `main`.
- Messaggio: «Catalogo unico corretto del 22/10 incluso nell'app…».
- È la versione che gira sull'iPhone (aggiornamento `637e8351`) e sul server di calcolo (Render, distribuzione `dep-dbd86oh42hec73ak6fq0`, stato *live*).
- Al commit di questo documento il codice non cambia: si aggiungono solo documenti.

---

## 0. In breve

| Cosa | Dove | Account proprietario |
|---|---|---|
| Codice (tutto) | GitHub, https://github.com/edoardoscocca-droid/nutrizione-cani | utente GitHub **edoardoscocca-droid** (account personale, non un'organizzazione) |
| App iPhone: build e aggiornamenti | expo.dev, https://expo.dev/accounts/edoardodroid/projects/nutrizione-cani | account Expo **edoardodroid** (personale) |
| App sull'App Store Connect / TestFlight | App Store Connect, app con ID **6823645403**, bundle `com.edoardoscocca.nutrizionecani` | account Apple Developer: **da verificare** (§3.4) |
| Server di calcolo | Render, servizio **nutrizione-cani-motore**, https://nutrizione-cani-motore-q58c.onrender.com | area di lavoro Render **«nutrizione cani»**, collegata all'email edoardo.scocca@gmail.com |
| Dati (cani, ricette, diario, prezzi, modifiche al catalogo) | solo sull'iPhone, nella memoria dell'app | — |
| Supabase (database online) | **non usato**: nessun progetto collegato | — |

Se gli account GitHub, Expo e Render sono tuoi (email edoardo.scocca@gmail.com), puoi fare da solo tutto il passaggio. Fa eccezione Apple, finché non è chiaro di chi sia l'account.

---

## 1. Repository e codice

### 1.1 Dove si trova
- **Repository:** `edoardoscocca-droid/nutrizione-cani`, https://github.com/edoardoscocca-droid/nutrizione-cani
- **Proprietario:** l'utente GitHub `edoardoscocca-droid`. Non c'è un'organizzazione; non risultano collaboratori aggiunti.
- **Visibilità:** **pubblico**.
  - Chiunque può leggere il codice e i documenti, compresi i casi di Ker e Garmr.
  - Non contiene password né chiavi.
  - Se vuoi renderlo privato: GitHub → repository → *Settings* → *General* → *Danger Zone* → *Change visibility*. Render ed Expo continuano a funzionare, perché Render è collegato con l'app GitHub di Render e ha accesso anche ai repository privati. Conviene comunque controllare che dopo il primo push la distribuzione su Render parta.
- **Ramo:** uno solo, `main`. È la versione aggiornata ed è quella distribuita.
- **Regola importante:** ogni push su `main` aggiorna **automaticamente** il server di calcolo su Render (§4).

### 1.2 Com'è organizzato

| Cartella | Contenuto |
|---|---|
| `mobile/` | **app iPhone** (Expo SDK 58, React Native, Expo Router). Schermate in `mobile/app/`, componenti in `mobile/lib/`. Configurazione in `mobile/app.json` e `mobile/eas.json`. |
| `src/engine/` | **motore nutrizionale**, condiviso da app e server. Generatore v2 (`formulateV2.ts`), verifica (`audit.ts`, `auditV2.ts`), regole (`configV2.ts`), diario (`diary.ts`), vitamina A (`vitaminA.ts`), energia, costi. |
| `src/data/` | modello dei dati, **archivio locale** (`localRepository.ts`), importatore del catalogo (`catalogImport.ts`), cataloghi inclusi nell'app (`bundledImports.ts`), visibilità negli elenchi (`catalogVisibility.ts`), dati di prova `[TEST]` (`testFixtures.ts`), archivio Supabase non usato (`supabaseRepository.ts`). |
| `server/index.ts` | **server di calcolo** pubblicato su Render. |
| `dati/importazioni/` | **cataloghi ricevuti**, uno per data: 16/10, 20/10, 21/10 e 22/10 (`2026-10-22/catalogo_cani_corretto.json`, 95 alimenti). |
| `dati/riferimenti/` | regole e riferimenti: FEDIAF, limiti legali, conversioni, fattori energetici e `formulazione_v2.json` (gruppi del pasto, tetti, valori [PROPOSTA]). |
| `dati/pacchetto/` | il pacchetto di **specifiche** originale, intatto. |
| `docs/` | documenti: specifiche ed esiti, collaudi (`COLLAUDI_V2_2026-10-21.md`), verifica del catalogo, schema di importazione (`modelli-importazione/`), Supabase. |
| `tests/` | test automatici (motore, catalogo, importazioni, collaudi v2, diario, server); `tests/db/` test del database; `tests/e2e/` prova nel browser della versione web. |
| `scripts/` | collaudi (`scripts/collaudo/`), conversione dei dati ricevuti (`scripts/adapters/`), importazione da riga di comando. |
| `supabase/` | migrazioni e file SQL **preparati ma mai eseguiti**: per ora non usarli. |
| `src/ui/`, `index.html`, `vite.config.ts` | vecchia **versione web**: non è pubblicata e non serve all'iPhone. |

### 1.3 Cosa serve alla nuova IA per leggere e modificare il codice
- **Se la nuova IA lavora con il tuo account GitHub** (per esempio collegandola a GitHub da sola, con le tue credenziali): non serve altro, sei già proprietario.
- **Se la nuova IA ha un suo account GitHub:** GitHub → repository → *Settings* → *Collaborators* → *Add people*, con permesso di scrittura. Lo fai tu, perché sei il proprietario.
- **Solo lettura:** il repository è pubblico, quindi basta il link. Per modificarlo serve uno dei due punti sopra.

---

## 2. Comandi che la nuova IA userà

Tutti dalla cartella del repository (Node.js 22 o successivo):

```bash
npm install                      # dipendenze del motore e del server
npm test                         # test automatici (oggi 186, tutti superati)
npx tsc --noEmit                 # controllo dei tipi (motore e server)
npx tsx scripts/collaudo/collaudi-v2.ts > docs/COLLAUDI_V2_2026-10-21.md   # rigenera i collaudi v2
cd mobile && npm install && npx tsc --noEmit && npx expo lint             # controlli dell'app iPhone
```

Prova automatica dell'app nel browser:
1. `npx expo export --platform web`;
2. servire la cartella esportata;
3. `node mobile/e2e/flow.mjs <indirizzo> <cartella per le immagini>`.

Il percorso provato è: crea un cane, una ricetta con alimenti reali, la registra nel diario e la ritrova dopo la riapertura.

---

## 3. Expo e app iPhone

### 3.1 Account e progetto
- **Account Expo:** `edoardodroid`. È il proprietario del progetto. Esiste anche un team `edoardodroids-team`, vuoto e non usato.
- **Progetto:** `@edoardodroid/nutrizione-cani`, ID `f5239aa3-0eaf-43f7-af87-b190b97a5440`.
- **Link:** https://expo.dev/accounts/edoardodroid/projects/nutrizione-cani
- **Nome tecnico dell'app (bundle):** `com.edoardoscocca.nutrizionecani`. **Versione:** 0.1.0.

### 3.2 Come si distribuisce
1. **Build:** la versione da installare viene compilata nel cloud di Expo (EAS Build) e inviata a TestFlight con il profilo `testflight`.
   - Esiste una sola build: versione 0.1.0 (numero 2) del 16/10/2026, inviata a TestFlight lo stesso giorno.
   - Il certificato e il profilo di distribuzione Apple sono custoditi da Expo e scadono il 09/10/2027.
2. **Aggiornamenti (OTA):** le modifiche al codice JavaScript arrivano senza nuova build, sul canale **`interna`**.
   - Comando: `cd mobile && npx eas-cli update --channel interna --environment production --platform ios --message "…"`.
   - All'apertura l'app controlla se c'è un aggiornamento, lo scarica e si riavvia da sola.
3. **Quando serve una build nuova invece di un aggiornamento:** quando si aggiunge un modulo nativo, si cambia `app.json` in modo rilevante o si cambia la versione. La versione di runtime segue la versione dell'app (`runtimeVersion: appVersion`): una build 0.2.0 non riceve gli aggiornamenti pubblicati per la 0.1.0, e viceversa.

### 3.3 Che permessi servono alla nuova IA su Expo
- Pubblicare aggiornamenti e fare build richiede un accesso all'account `edoardodroid`.
- **Modo consigliato:** un **token di accesso personale**.
  1. Lo crei tu su https://expo.dev/settings/access-tokens, con un nome come «nuova IA».
  2. Lo inserisci tu nello strumento della nuova IA come variabile `EXPO_TOKEN`: mai in chat.
  3. Si può revocare in ogni momento dalla stessa pagina.
- **Alternativa:** creare un'organizzazione su Expo, trasferirvi il progetto e invitare un altro account con ruolo *Developer*. Sposta però il progetto, quindi va fatto con calma (§7, fase 3).

### 3.4 Apple Developer e TestFlight
- **App Store Connect:** app con ID **6823645403**, in `mobile/eas.json` → `submit`. L'app si installa con **TestFlight**; non è pubblicata sull'App Store.
- **Account Apple:** Expo non registra il team Apple, quindi **non ho potuto verificare** di quale account Apple Developer si tratta. Per verificarlo:
  1. accedi a https://appstoreconnect.apple.com con l'account che usate per TestFlight;
  2. in *App* deve comparire «nutrizione cani» (bundle `com.edoardoscocca.nutrizionecani`);
  3. in *Utenti e accesso* vedi chi è **Account Holder**, cioè il proprietario.
- **Cosa serve per una build nuova:** l'accesso all'account Apple, oppure una chiave API di App Store Connect caricata su expo.dev.
  - La chiave la crea chi ha il ruolo *Admin* o *Account Holder*.
  - Si carica da expo.dev → progetto → *Credentials*, mai in chat.
- **Per i soli aggiornamenti OTA** Apple non serve.

---

## 4. Render e server di calcolo

- **Servizio:** `nutrizione-cani-motore` (web service, Node, Francoforte, **piano gratuito**).
  - Pannello: https://dashboard.render.com/web/srv-db92sc7avr4c73crgcmg
  - Indirizzo pubblico: https://nutrizione-cani-motore-q58c.onrender.com (controllo di stato: `/health`)
- **Area di lavoro:** «nutrizione cani», collegata all'email edoardo.scocca@gmail.com. Sullo stesso accesso Render ci sono altre due aree, **ecampus commercial** e **VITA**: sono altri progetti e non vanno toccate.
- **Codice:** `server/index.ts`, che usa il motore in `src/engine/`.
- **Costruzione e avvio:** build `npm ci --include=dev`, avvio `npm run start:server`. La distribuzione parte **da sola a ogni push su `main`**.
- **Come parla con l'app:**
  - l'app manda a `POST /api/v2/formulate` il cane, gli alimenti scelti e i limiti, e riceve i grammi e la verifica;
  - l'analisi preliminare usa `POST /api/preliminary`;
  - `POST /api/formulate` resta per le versioni vecchie dell'app.
  - Il server **non salva nulla**.
  - L'indirizzo è scritto nell'app: `mobile/lib/engineClient.ts` e `mobile/eas.json` (`EXPO_PUBLIC_ENGINE_URL`).
- **Limiti:**
  - con il piano gratuito il server «dorme» dopo un periodo di inattività: il primo calcolo può impiegare fino a un minuto;
  - i calcoli si eseguono uno alla volta;
  - c'è un limite di 60 richieste al minuto, modificabile con la variabile `RATE_PER_MIN`.
- **Dare accesso alla nuova IA senza interrompere il servizio:**
  - Render → area «nutrizione cani» → *Settings* → *Members* → *Invite*, con il ruolo più basso che basta. Su alcuni piani gli inviti richiedono un piano a pagamento.
  - Oppure una **chiave API** personale (Account settings → *API Keys*), inserita da te nello strumento della nuova IA.
  - Invitare persone o creare chiavi **non riavvia** il servizio.
  - Non cambiare ramo, comando di avvio o repository collegato senza una prova: ogni cambio lì fa ripartire il server.

---

## 5. Dati e configurazione

### 5.1 Dove stanno i dati sull'iPhone
- Tutto è in **un unico archivio nella memoria dell'app** (AsyncStorage), con la chiave `nutrizione-cani:prova:v1`.
  - Il nome contiene ancora «prova» per non perdere i dati già salvati: **non va rinominato**.
- **Contenuto dell'archivio:**
  - cani, pesi, ricette con tutte le versioni, diario, prezzi;
  - le **modifiche** che fai al catalogo sul telefono (prodotti importati o attivati a mano);
  - soglie personali e metodi energetici;
  - lo storico delle modifiche ai profili.
- **Il catalogo non è salvato per intero sul telefono.** A ogni avvio l'app lo ricostruisce così:
  1. riferimenti del pacchetto;
  2. tutti i cataloghi inclusi (`src/data/bundledImports.ts`), applicati in ordine con lo stesso importatore rigoroso delle importazioni manuali;
  3. sopra, le tue modifiche locali, che hanno la precedenza.
- **Conseguenze:**
  - un catalogo nuovo arriva con un aggiornamento dell'app e non si perde reinstallando;
  - le ricette salvate conservano la fotografia dei dati usati: se un alimento cambia, risultano «da ricalcolare» ma non cambiano da sole.
- **Elenchi dell'app:**
  - i prodotti di prova `[TEST]` e le vecchie voci con il solo nome sono **nascosti** (`src/data/catalogVisibility.ts`);
  - restano nel catalogo, quindi le ricette che li usano si aprono come prima e i test automatici funzionano.
- **Attenzione: non c'è una copia di sicurezza fatta dall'app.**
  - Se l'app viene cancellata, cani, ricette e diario si perdono.
  - Il backup iCloud dell'iPhone di solito comprende i dati delle app, ma non l'ho verificato.
  - Una funzione «Esporta i miei dati» è un buon primo lavoro per la nuova IA.

### 5.2 Come aggiungere o aggiornare il catalogo
1. Il file JSON va in `dati/importazioni/<data>/`. Lo schema è in `docs/modelli-importazione/SCHEMA_IMPORTAZIONE.md`; gli identificativi esistenti sono in `docs/modelli-importazione/IDENTIFICATIVI_ESISTENTI.md`.
2. Si aggiunge una riga in `src/data/bundledImports.ts` con modo `strict`.
3. Si esegue `npm test` e si aggiunge un test come `tests/catalogo-2026-10-22.test.ts`.
4. Si pubblica un aggiornamento OTA (§3.2).

In alternativa, sull'iPhone: Catalogo → *Importa CSV/JSON*. Quei dati però restano solo sul telefono.

### 5.3 Migrazioni, schemi e test
- **Migrazioni Supabase:** `supabase/migrations/` (11 file), dati in `supabase/data/`, ripristino in `supabase/ripristino/`, controllo di sola lettura in `supabase/verifica/`. **Non vanno eseguite**: Supabase non è usato.
- **Schema di importazione:** `docs/modelli-importazione/`, con un esempio in `alimenti_v2.json`.
- **Test:** `tests/` (`npm test`). Database: `tests/db/run.sh`, serve PostgreSQL in locale. App: `mobile/e2e/flow.mjs`.

### 5.4 Variabili d'ambiente (nessuna è segreta oggi)

| Variabile | Dove | A cosa serve | Valore oggi |
|---|---|---|---|
| `EXPO_PUBLIC_ENGINE_URL` | `mobile/eas.json` (profili di build) e, se serve, expo.dev → progetto → *Environment variables* | indirizzo del server di calcolo | `https://nutrizione-cani-motore-q58c.onrender.com` (è anche il valore predefinito nel codice) |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | expo.dev → *Environment variables* | accesso con account (Supabase) | **non impostate**: lasciarle così |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | solo versione web | — | non usate |
| `PORT`, `RATE_PER_MIN` | Render → servizio → *Environment* | porta (la imposta Render) e limite di richieste | predefiniti |
| `EXPO_TOKEN` | nello strumento della nuova IA (mai nel codice, mai in chat) | pubblicare aggiornamenti e build | da creare (§3.3) |

### 5.5 Cose da sapere
- **Expo cambia spesso.** Prima di toccare API Expo leggere la documentazione della versione 58 (vedi `mobile/AGENTS.md`). Le dipendenze si aggiungono con `npx expo install`.
- **Moduli nativi.** Un modulo nativo nuovo richiede una build nuova (§3.2): con un aggiornamento OTA l'app si bloccherebbe.
- **Dati.** Non inventare mai dati nutrizionali: ciò che manca resta sconosciuto e grigio, mai zero.
- **Modifiche automatiche.** Non modificare in automatico ricette, prescrizioni o catalogo dell'utente.
- **Valori provvisori.** I valori [PROPOSTA] in `dati/riferimenti/formulazione_v2.json` sono decisioni operative, non FEDIAF.
- **Limiti noti dei dati** (dettagli in `docs/COLLAUDI_V2_2026-10-21.md` e `docs/VERIFICA_CATALOGO_2026-10-22.md`):
  - Q.Diet e farina d'ossa non dichiarano tutto, quindi alcuni controlli di livello A restano «non verificabili»;
  - linoleico, cloro e iodio mancano in molti alimenti;
  - manzo 5%, manzo 10% e olio di lino (`beef_05`, `beef_10`, `flaxseed_oil`) sono ancora «di confronto», non attivi: si attivano dal Catalogo dell'app se li volete usare nel generatore.
- **Il server sta sul piano gratuito** di Render (§4).
- **Il repository è pubblico** (§1.1).

---

## 6. Regole di lavoro usate finora

- Rispondere in italiano semplice: l'utente non è un programmatore.
- Prima di lavori grandi, proporre e aspettare l'ok.
- Mai chiedere password, token o chiavi in chat: si inseriscono direttamente su expo.dev, Render o GitHub.
- Non toccare il repository e il servizio `ecampus-commercial`, né il progetto VITA.
- Prima di dire «fatto»:
  - `npm test` e `npx tsc --noEmit` nella radice;
  - `npx tsc --noEmit` e `npx expo lint` in `mobile/`.
- Distinguere sempre ciò che è stato verificato nei test da ciò che vale sul telefono.
- Commit a nome di Edoardo: `git -c user.name="edoardoscocca-droid" -c user.email="edoardo.scocca@gmail.com" commit …`.
- Niente Supabase finché non lo decidete voi.

---

## 7. Procedura di passaggio, passo per passo

### Fase 1 — Controllo (nessun rischio)

| # | Cosa | Chi |
|---|---|---|
| 1 | Accedi a GitHub, Expo e Render con i tuoi account e verifica di vedere: il repository `edoardoscocca-droid/nutrizione-cani`; il progetto Expo `nutrizione-cani` sotto `edoardodroid`; l'area Render «nutrizione cani» con il servizio `nutrizione-cani-motore`. | tu |
| 2 | Su App Store Connect verifica chi è *Account Holder* dell'account che contiene l'app 6823645403 (§3.4). | tu, oppure chi possiede l'account Apple |
| 3 | Sull'iPhone, prima di qualunque cambio, verifica che l'app funzioni e che ci siano i tuoi dati. | tu |

### Fase 2 — Dare accesso alla nuova IA (reversibile, non interrompe nulla)

| # | Cosa | Chi |
|---|---|---|
| 4 | **GitHub:** se la nuova IA ha un suo account, aggiungilo come collaboratore con scrittura (§1.3). Altrimenti collega lo strumento al tuo account GitHub. | tu (proprietario del repository) |
| 5 | **Expo:** crea un token di accesso e inseriscilo nello strumento della nuova IA come `EXPO_TOKEN` (§3.3). | tu (proprietario dell'account Expo) |
| 6 | **Render:** invita la nuova IA nell'area «nutrizione cani», oppure crea una chiave API e inseriscila nello strumento (§4). | tu |
| 7 | **Apple** (solo per build nuove): chi è *Account Holder* o *Admin* crea una chiave API di App Store Connect e la carica su expo.dev → *Credentials*. Non serve per gli aggiornamenti. | proprietario dell'account Apple |
| 8 | Fai leggere alla nuova IA questo documento, `README.md`, `mobile/README.md` e `mobile/AGENTS.md`. | tu |

### Fase 3 — Prima prova della nuova IA (consigliata)

| # | Cosa | Chi |
|---|---|---|
| 9 | Chiedi una modifica piccola e innocua, per esempio un testo. La nuova IA esegue i controlli del §2, fa il commit su `main` e pubblica un aggiornamento sul canale `interna`. | nuova IA |
| 10 | Verifica sull'iPhone che l'aggiornamento arrivi (§8) e su Render che la distribuzione risulti *live*. | tu |

### Fase 4 — Facoltativa: spostare i servizi su account diversi

Da fare solo se vuoi che i servizi appartengano ad account diversi da quelli attuali. Ogni passo si può fare in un momento separato.
- **GitHub:** *Settings* → *Transfer ownership*. GitHub reindirizza il vecchio link.
  - Su Render va ricollegato il repository nuovo: *Settings* → *Repository*.
  - Dopo il trasferimento, verifica che il primo push faccia partire la distribuzione.
- **Expo:** trasferire il progetto a un'altra organizzazione (expo.dev → progetto → *Settings* → *Transfer project*).
  - L'ID del progetto resta uguale, quindi l'app installata continua a ricevere gli aggiornamenti.
  - Va fatto da chi possiede l'account `edoardodroid`.
- **Render:**
  - non c'è un trasferimento semplice di un servizio tra aree di lavoro;
  - si crea un servizio nuovo nell'altra area, dallo stesso repository, con build `npm ci --include=dev` e avvio `npm run start:server`;
  - poi si cambia `EXPO_PUBLIC_ENGINE_URL`, si pubblica un aggiornamento dell'app e solo alla fine si spegne il servizio vecchio.
- **Apple:** il trasferimento di un'app tra account Apple si fa da App Store Connect (*App Transfer*) e richiede entrambi gli *Account Holder*. Non è necessario per lavorare.

---

## 8. Come verificare che l'aggiornamento del 22/10 sia arrivato sull'iPhone

1. Apri l'app con il telefono connesso a internet. Attendi qualche secondo: se trova l'aggiornamento si riavvia da sola. Se non succede, chiudila del tutto (scorri via dal multitasking) e riaprila.
2. **Schermata Cani:** in alto non c'è più la scritta arancione «PROVA». C'è invece «Cani, ricette e diario sono salvati su questo iPhone…».
3. **Catalogo → Alimenti:** il filtro mostra **«Tutti (104)»**.
   - Ci sono, per esempio, «Pollo petto crudo senza pelle», «Merluzzo crudo…» e «Riso bianco cotto senza sale».
   - Non compaiono più i prodotti «[TEST] …» né le voci con il solo nome.
   - Se hai importato o modificato prodotti a mano, il numero può essere un po' diverso.
4. **Impostazioni:** compare «Questo iPhone: cani, ricette, diario e catalogo sono salvati su questo iPhone».
5. Le ricette già salvate che usano alimenti aggiornati (per esempio manzo 3%, avena, carota, zucca) compaiono in **«da ricalcolare»**. È normale: non cambiano finché non le apri e confermi.

Riferimento tecnico: aggiornamento `637e8351-fbd9-47e4-bcf9-322835d33902`, canale `interna`, runtime 0.1.0. Si vede su https://expo.dev/accounts/edoardodroid/projects/nutrizione-cani/updates/637e8351-fbd9-47e4-bcf9-322835d33902
