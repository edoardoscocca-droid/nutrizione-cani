# Mettere in funzione Supabase e la pubblicazione

Consigliato un **progetto Supabase nuovo e separato** da quello di Vita: dati, utenti e amministratori restano distinti.
Nessuna chiave va mai scritta in chat o nel codice.

## 1. Database

1. Su https://supabase.com/dashboard crea un nuovo progetto (regione Francoforte).
2. **SQL Editor** → esegui, in ordine, il contenuto di:
   1. `supabase/migrations/20261016000001_schema.sql`
   2. `supabase/migrations/20261016000002_rules_and_security.sql`
   3. `supabase/migrations/20261017000003_catalog_status_import.sql` (stati del catalogo, convalida, importazioni)
   4. `supabase/migrations/20261018000004_compounds_capsules.sql`
   5. `supabase/migrations/20261019000005_energy_methods_declared.sql` (metodi energetici, conversioni vitamine, integratori)
   6. `supabase/migrations/20261020000006_usability_declared_data.sql` (utilizzabilità, dati dichiarati, cottura al vapore)
   7. `supabase/migrations/20261021000007_dose_guide.sql` (tabella d'impiego del produttore)
   8. `supabase/seed.sql` (dizionario, FEDIAF 2025, soglie C, categorie, nomi di alimenti e integratori, nota Irish Wolfhound)
   9. i dati reali ricevuti: `supabase/data/2026-10-16_alimenti.sql` e `supabase/data/2026-10-16_integratori.sql`
   10. facoltativo, solo per provare: `supabase/seed_test_fixtures.sql` (dati **[TEST] fittizi**; si tolgono con le due righe in cima al file)

   In alternativa, con la Supabase CLI: `supabase link` e `supabase db push`, poi il seed.

## 2. Accesso con codice via email

**Authentication → Providers → Email**: attivo. In **Authentication → Email Templates → Magic Link** il testo deve
contenere `{{ .Token }}` (il codice da digitare nell'app). Per inviare molte email serve un SMTP proprio (es. Resend).

## 3. Amministratori

Gli amministratori si aggiungono solo dall'SQL Editor (nessuno può farlo dall'app):

```sql
-- la persona deve aver fatto almeno un accesso all'app
insert into public.app_admins (user_id, note)
select id, 'gestione catalogo' from auth.users where email = 'indirizzo@esempio.it';
```

Gli amministratori modificano alimenti, integratori, soglie e metodi energetici dalla pagina **Catalogo** dell'app
oppure direttamente dalle tabelle di Supabase. Ogni modifica a una composizione crea una nuova versione del profilo
(`food_profile_history`, `supplement_profile_history`) e una riga in `audit_log`; le ricette collegate vengono segnalate
«da ricalcolare» ma non cambiano finché l'utente non conferma.

Stato di ogni prodotto (Verificato / Dati parziali / Da completare) con i motivi: vista `catalog_status`.
Completezza nutriente per nutriente: viste `food_completeness` e `supplement_completeness`.
Importazioni massive e convalida: vedi `docs/CATALOGO.md`.

## 4. Pubblicazione dell'app (es. Render, sito statico)

- Root directory: `nutrizione-cani` · Build: `npm ci && npm run build` · Publish directory: `dist`
- Variabili d'ambiente (da inserire nella dashboard di Render, mai in chat):
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Supabase → Project Settings → API, chiave **anon/public**).
  **Mai** la chiave `service_role`.

## 5. Sicurezza in breve

- RLS attiva su tutte le tabelle; accesso anonimo negato.
- Cani, ricette, versioni, prezzi e impostazioni: ognuno vede e modifica solo i propri.
- Cataloghi e standard: lettura per gli utenti, scrittura solo con `is_admin()` verificato dal database.
- Versioni di ricetta immutabili; massimo 10 ricette per cane imposto anche dal database.
- Controlli nel database: unità uguale a quella del dizionario, `null` ≠ 0 (uno zero va dichiarato), nessun alimento
  attivabile senza energia e stato del dato, soglie non ufficiali mai rosse o rigide.
