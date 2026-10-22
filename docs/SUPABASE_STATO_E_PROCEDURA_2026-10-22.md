# Supabase: quale progetto, cosa cambiano i file, backup e ripristino — 22/10/2026

Nessuna modifica è stata fatta su un database online.

## 1. Cosa risulta dalla configurazione

| Parte | Dove l'ho verificato | Esito |
|---|---|---|
| App iPhone | variabili d'ambiente del progetto expo.dev `nutrizione-cani` (account `edoardodroid`), ambienti *production*, *preview*, *development* | **nessuna variabile**: `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` non sono impostate |
| App iPhone | aggiornamento pubblicato il 21/10 (pacchetto JavaScript) | **nessun indirizzo di progetto Supabase** al suo interno |
| Server di calcolo | Render, area di lavoro «nutrizione cani», servizio `nutrizione-cani-motore` | non usa alcun database: riceve i dati nella richiesta e restituisce il risultato |
| App web | Render | non è pubblicata (nessun sito su Render); in locale userebbe `VITE_SUPABASE_URL`, non presente nel progetto |

**Conclusione**
- Oggi **l'app non è collegata a nessun progetto Supabase**. Sul telefono funziona solo la **modalità Prova**: i dati restano sul telefono, nella memoria locale dell'app.
- Il pulsante «Accedi con account» compare solo se il collegamento è configurato, quindi oggi non c'è.
- Non so dirti il nome o l'identificativo di un progetto, perché nella configurazione non ce n'è nessuno.

**Correzione dei resoconti precedenti.** Nei documenti del 20 e 21/10 ho scritto che «il database online contiene i dati del 16/10». Era una deduzione, non una verifica: non ho mai avuto accesso a un database Supabase. Se un progetto esiste (per esempio creato seguendo `docs/SUPABASE.md`), non è collegato all'app.

**Tre archivi distinti**
- **Prova**: sul telefono.
- **Account**: Supabase, oggi non configurato.
- **Server**: nessun archivio.

Prova e account non si sincronizzano.

## 2. Perché non posso accedere al database

- In questa sessione non c'è un collegamento a Supabase: nessun connettore, nessun accesso al progetto.
- Le chiavi non vanno mai date in chat.
- Anche con l'indirizzo del progetto, l'app usa solo la chiave pubblica, limitata dalle regole di accesso. Le migrazioni richiedono l'SQL Editor del proprietario del progetto.
- Gli accessi che ho sono expo.dev (aggiornamenti dell'app), Render (server di calcolo) e GitHub (codice). Nessuno di questi permette di modificare un database Supabase.

Si può collegare Supabase a una sessione futura da https://claude.ai/customize/connectors, poi aprendo una nuova sessione. Non è necessario: la procedura qui sotto la esegui tu dall'SQL Editor.

## 3. Come capire se un progetto esiste e chi lo gestisce

1. Accedi a https://supabase.com/dashboard con la tua email. Se non vedi progetti, chiedi al tuo compagno di fare lo stesso con la sua.
2. Cerca un progetto con un nome simile a «nutrizione cani», regione Francoforte.
3. Nel progetto, **Project Settings → General** mostra il nome e il *Reference ID*: è l'identificativo, quello che compare nell'indirizzo `https://<reference-id>.supabase.co`.
4. In alto a sinistra c'è l'**organizzazione**. In **Organization → Team** vedi chi ne fa parte e con quale ruolo (*Owner* = proprietario).
5. Se il progetto non c'è, non c'è niente da aggiornare. Quando vorrai l'accesso con account, si crea un progetto nuovo da zero seguendo `docs/SUPABASE.md`. In quel caso si eseguono tutte le migrazioni, compresa la 11.

## 4. Controllo dello stato, senza modificare nulla

**SQL Editor** → incolla il contenuto di `supabase/verifica/stato_online.sql` → *Run*.

- È solo lettura.
- Mostra per ciascuna migrazione (01–11) se è applicata e quali file di dati sono stati importati: nomi e date dei file, B5 del QDiet, avena «dried».
- Mostra anche quanti utenti, cani e ricette ci sono, solo come numeri.
- Puoi incollarmi la tabella del risultato: non contiene chiavi né dati personali.

## 5. Cosa modificano esattamente i tre file

### `supabase/migrations/20261025000011_formulazione_v2_diario.sql`

**Tabella `foods`: 6 colonne nuove, vuote per i prodotti esistenti**
- `max_fresh_weight_pct`, `max_g_per_1000_kcal`: tetti per alimento;
- `forbidden`: predefinito *no*;
- `preparation_warning`;
- `prepared_yield`, `prepared_yield_source`: resa di cottura con fonte.

**Due regole nuove**
- un alimento vietato non può essere attivo;
- una resa di cottura deve avere la fonte.

**Due funzioni sostituite**
- `admin_import_catalog`: legge anche i 6 campi nuovi.
- `check_recipe_rules`: il limite passa da 10 a 200 ricette per cane, le archiviate non contano.

**Diario: tabella nuova `diary_entries`**
- Una voce per cane e data.
- Il proprietario deve essere quello del cane.
- Ognuno vede solo le proprie voci (stesse regole delle ricette).
- Se una ricetta viene eliminata, il giorno resta con il suo profilo.

Non cambia nessun dato esistente: cani, ricette, versioni, prezzi e valori del catalogo restano come sono.

### `supabase/data/2026-10-21/01_catalogo_v2.sql`

Solo inserimenti. Se una voce esiste già, non succede nulla.
- la categoria «Altri alimenti (non classificati)»;
- la conversione calcio D-pantotenato → acido pantotenico × 0,92;
- 7 alimenti senza valori: cipolla, aglio, uva e uvetta, xilitolo, cioccolato, macadamia (vietati) e olio d'oliva (da completare);
- 4 integratori senza valori: polvere di guscio d'uovo, olio di pesce, alga per lo iodio, vitamina E.

Richiede la migrazione 11.

### `supabase/data/2026-10-21/02_qdiet_b5.sql`

Un'importazione controllata, la stessa funzione usata dall'app.
- **Solo per il prodotto `qdiet`**: aggiunge la vitamina B5 = 0,414 mg/g, dichiarata «aggiunta». È il calcio D-pantotenato 450 mg/kg × 0,92, con forma e valore originali registrati.
- Aggiorna la nota del prodotto.
- Il profilo prende una nuova versione, la precedente resta nello storico, la convalida decade.
- Le ricette che usano il QDiet risultano «da aggiornare», ma non cambiano finché non le ricalcoli tu.

### Aggiornamenti precedenti necessari

In quest'ordine:
1. migrazioni da 01 a 10;
2. `supabase/seed.sql`;
3. `supabase/data/2026-10-16_alimenti.sql` e `2026-10-16_integratori.sql`;
4. `supabase/data/2026-10-20/01…04`.

Il controllo del §4 dice quali sono già applicati. L'elenco completo con le istruzioni è in `docs/SUPABASE.md`.

## 6. Backup prima di eseguire qualsiasi SQL

1. **Database → Backups**: se il piano è *Pro*, c'è un backup giornaliero (e, se attivato, il ripristino a un minuto preciso). Annota data e ora dell'ultimo. Sul piano gratuito i backup non sono scaricabili: usa il punto 2.
2. **Copia completa da un computer**, consigliata in ogni caso. Serve Node.js.
   - Supabase → **Connect** (o *Project Settings → Database*) → copia la *connection string* «Session pooler». La password è quella del database: inseriscila tu nel terminale, **mai in chat**.
   - Nel terminale:
     ```
     npx supabase db dump --db-url "<connection string>" -f backup_schema.sql
     npx supabase db dump --db-url "<connection string>" -f backup_dati.sql --data-only
     npx supabase db dump --db-url "<connection string>" -f backup_ruoli.sql --role-only
     ```
   - Conserva i tre file in un posto sicuro: contengono i dati degli utenti.
3. Esegui di nuovo `supabase/verifica/stato_online.sql` e conserva il risultato: è lo stato «prima».

## 7. Esecuzione, quando deciderai

1. Backup (§6).
2. SQL Editor: esegui `supabase/migrations/20261025000011_formulazione_v2_diario.sql`.
3. SQL Editor: esegui `supabase/data/2026-10-21/01_catalogo_v2.sql`.
4. SQL Editor: esegui `supabase/data/2026-10-21/02_qdiet_b5.sql`.
5. Esegui di nuovo `stato_online.sql`: le righe 11, 12, 22 e 24 devono risultare `true`, `true`, `6` e `0.414 calcium_d_pantothenate`.
6. Solo se vuoi usare l'accesso con account, collega l'app al progetto:
   - su expo.dev, progetto `nutrizione-cani` → **Environment variables** → ambiente *production*, aggiungi `EXPO_PUBLIC_SUPABASE_URL` (indirizzo del progetto) e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (chiave *anon/public* da *Project Settings → API*; mai la *service_role*);
   - inseriscile tu, non in chat;
   - poi dimmelo: pubblico un aggiornamento dell'app che le include.

## 8. Ripristino, se qualcosa non va

**A. Annullare solo la v2**
- SQL Editor: `supabase/ripristino/20261022_annulla_v2.sql`.
- È un'unica transazione: o tutto o niente.
- Toglie la B5 del QDiet e le voci nuove del catalogo (solo se non usate da ricette o prezzi), la tabella del diario e i campi v2.
- Rimette l'importazione e la regola delle ricette com'erano: limite di 10, archiviate comprese.
- **Cancella il diario registrato con l'account.**
- È stato provato sul database di prova: annulla, controlla che le ricette siano intatte, riapplica i tre file.

**B. Ripristino completo**
- *Database → Backups → Restore* (piano Pro);
- oppure, su un progetto nuovo e vuoto, `psql "<connection string>" -f backup_ruoli.sql`, poi `-f backup_schema.sql`, poi `-f backup_dati.sql`.

## 9. Cosa posso fare io e cosa serve da te

- **Io**: preparo e collaudo i file sul database di prova (fatto: `bash tests/db/run.sh`); pubblico l'aggiornamento dell'app dopo che avrai inserito le variabili su expo.dev.
- **Tu** (o chi è *Owner* del progetto):
  - trovare il progetto (§3);
  - eseguire il controllo (§4) e mandarmi il risultato;
  - fare il backup (§6);
  - eseguire i tre file quando decidi (§7).

Prima del controllo del §4 non eseguire nulla.
