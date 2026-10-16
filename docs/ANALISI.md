# Analisi del pacchetto — App di formulazione nutrizionale per cani

Data: 16 ottobre 2026 · Pacchetto analizzato: `Consegna_Completa_AI_Nutrizione_Cani_CORRETTA.zip`
(copiato intatto in `dati/pacchetto/`, contenuto identico al pacchetto precedente, controllato file per file).

Documenti letti integralmente: specifica funzionale v1.0, guida/JSON/CSV FEDIAF 2025 (59 parametri, tabella III-3b,
adulto in mantenimento, colonna 95 kcal/kg^0,75), README e incarico operativo, fonti e integrazione dati, allegati A–F,
schema SQL di riferimento, 18 test di accettazione (T01–T18).

## 1. Architettura scelta

| Parte | Scelta | Perché |
|---|---|---|
| App utente | Web app React + TypeScript (Vite), interfaccia in italiano, pensata per il telefono, stampabile | Si apre da qualsiasi telefono o computer senza App Store; si aggiorna subito; si può provare automaticamente |
| Motore nutrizionale | Modulo TypeScript interno (`src/engine/`), senza interfaccia, con test propri | Stesso codice in app e test; spiegabile riga per riga |
| Ottimizzatore | HiGHS (Università di Edimburgo) in WebAssembly, programmazione lineare a numeri interi | Calcola tutti gli ingredienti e integratori **insieme**; gestisce capsule intere e arrotondamenti; risponde "impossibile" in modo certo |
| Verifica finale | Modulo separato (`src/engine/audit.ts`) che **non usa** il modello dell'ottimizzatore: risomma ogni nutriente da zero sui dati congelati | Requisito 9.3 |
| Dati centrali | Supabase (Postgres): cataloghi, standard, utenti, cani, ricette, prezzi | Requisito 5; dati aggiornabili senza nuova versione dell'app |
| Sicurezza | RLS su **tutte** le tabelle; cataloghi in sola lettura per gli utenti; scrittura solo per chi è in `app_admins` (controllo nel database, non nell'app); trigger di registro modifiche, versioni dei profili, massimo 10 ricette, versioni ricetta immutabili | Requisito 2 e test T11 |
| Modalità prova | Senza Supabase configurato l'app funziona sul dispositivo con dati di **prova fittizi, marcati TEST**, per vedere e collaudare il motore | Ammesso dalla specifica §16; mai presentati come reali |

Flusso del motore (allegato F): ① controllo dei dati di ogni alimento/integratore (sconosciuto ≠ zero) →
② analisi preliminare con soli alimenti, "probabili" carenze → ③ ottimizzazione simultanea a priorità
(sicurezza e limiti ufficiali → copertura nutrienti → kcal → preferenze → praticità/costo) → ④ verifica indipendente su istantanea congelata.

## 2. Componenti

1. **Database Supabase** (`supabase/migrations/`): dizionario nutrienti, versioni dei riferimenti, limiti (ufficiali, legali,
   soglie non ufficiali, informativi separati per classe), categorie e sottocategorie (con frattaglie distinte: cuore, fegato, rene, milza…),
   alimenti e composizioni (una riga per nutriente, con valore di origine, unità, base, stato del dato, fonte, verifica),
   storico dei profili, integratori e composizioni per dose, note di razza, fattori energetici, cani, storico peso,
   ricette, versioni, prezzi personali, registro modifiche, viste di completezza dei dati.
2. **Motore**: unità e conversioni, RER/MER, somme con tracciamento dei dati mancanti, rapporti (Ca:P, ω6/ω3, EPA+DHA senza doppio conteggio,
   Met+Cys), semaforo (rosso/arancio/verde/blu/grigio/viola), ottimizzatore, diagnosi dei conflitti, verifica, costi, confronto versioni e dipendenze scadute.
3. **Interfaccia**: cani, profilo e peso, ricette (max 10, principale), creazione guidata (alimenti per categoria → analisi preliminare →
   integratori → calcolo → risultato), dettaglio nutriente, modifica quantità con campi numerici, storico e anteprima ricalcolo,
   prezzi e fornitori, catalogo con completezza dati, area amministratore (solo per ruolo admin), stampa ed esportazione.
4. **Test**: unità per le formule e test di accettazione T01–T18 (motore e database).

## 3. Incongruenze e informazioni mancanti — servono decisioni

Non ho cambiato nessuna regola nutrizionale. Dove il pacchetto non decide, l'app **non inventa**: il dato resta "non disponibile"
oppure è un parametro modificabile, chiaramente marcato. Elenco delle decisioni necessarie:

| # | Problema | Cosa fa l'app oggi | Decisione richiesta |
|---|---|---|---|
| D1 | **Fattore di attività per MER**: F dice "RER × fattore scelto", ma nessuna tabella di fattori è fornita. La guida FEDIAF ragiona invece su 95 kcal/kg^0,75. | Il fattore si inserisce a mano; senza fattore la MER non viene stimata e serve un obiettivo kcal manuale. Il riferimento 95 kcal/kg^0,75 è mostrato solo come confronto. | Fornire una tabella di fattori approvata, o confermare l'inserimento manuale. |
| D2 | **Cani che mangiano meno di 95 kcal/kg^0,75**: i minimi "per 1000 kcal" della colonna 95 possono sottostimare il fabbisogno (FEDIAF ha altre colonne e indicazioni, non incluse nel dataset). | Avviso ben visibile sulla ricetta quando le kcal sono inferiori al riferimento; il calcolo usa comunque i valori della colonna 95. | Fornire i valori/regole per i cani a basso fabbisogno, o confermare il solo avviso. |
| D3 | **Selenio**: il JSON contiene solo `selenium_wet` (67,5 µg); la guida chiede di poter usare il valore per diete secche (55 µg), che non è nel JSON. L'ID `selenium_wet` è usato anche per la composizione degli alimenti. | L'ID resta `selenium_wet` (compatibilità con i file). Ogni ricetta chiede "dieta umida o secca"; il limite 55 µg è caricato dalla guida, marcato "da rivedere". Senza scelta: selenio grigio. | Confermare il valore 55 µg e se le diete casalinghe/crude vanno considerate "umide". |
| D4 | **Fattori kcal/g di proteine, grassi, carboidrati** per le percentuali energetiche: richiesti ("canine-appropriate verified"), mai forniti. | Le percentuali energetiche risultano "non calcolabili" e le preferenze macro non entrano nel calcolo finché un amministratore non inserisce i fattori (tabella `energy_factors`, vuota). | Indicare i fattori approvati (es. Atwater modificati NRC 3,5/8,5/3,5, se la professionista li approva). |
| D5 | **Tolleranza sulle kcal**: "configurabile", nessun valore. | Parametro tecnico ±2 %, modificabile nelle impostazioni. | Confermare o indicare il valore. |
| D6 | **Ca:P 1,2–1,4** (C): bozza "da rivedere", preferenza non FEDIAF. | Attiva come preferenza morbida, colore arancione, etichetta "bozza non ufficiale". I limiti FEDIAF 1–2 restano rigidi. | Confermare se tenerla attiva. |
| D7 | **Base dei minimi**: la guida calcola `minimo × kcal obiettivo / 1000`; F chiede la densità sull'**energia effettiva** della ricetta. | Il calcolo usa l'energia effettiva (F); il report mostra anche il fabbisogno giornaliero sulle kcal obiettivo. Differenza ≤ tolleranza kcal. | Confermare. |
| D8 | **Ricette archiviate** e limite di 10: non è detto se contano. | Contano (restano salvate); per liberare un posto bisogna eliminare. | Confermare. |
| D9 | **Cistina e tirosina** mancano nel dizionario A, ma servono per "Met+Cys" e "Phe+Tyr". | Questi due valori si leggono solo dalla riga composta dell'alimento; se manca → "non verificabile". | Aggiungere cistina e tirosina al dizionario? |
| D10 | **Fibra totale vs grezza** (nota FEDIAF): un solo ID `fiber`. | Campo "metodo" per ogni valore di composizione; nessun controllo numerico (nessuna soglia). | Indicare il metodo di riferimento. |
| D11 | **Sodio 3,75 g e cloruro 5,87 g** (nota c FEDIAF): "livelli sicuri", non massimi. | Mostrati in blu come informazione, mai come limite. | Confermare. |
| D12 | **Massimi legali UE**: B volutamente vuoto; sono su sostanza secca. | Struttura pronta (base "per kg sostanza secca"); nessun confronto con valori per 1000 kcal (T14). | Fornire dataset legale verificato quando disponibile. |
| D13 | **Fasi di vita**: c'è solo adulto in mantenimento. | Per cuccioli, gestazione, allattamento la ricetta risulta "standard non disponibile, non verificabile". | Confermare. |
| D14 | **Arrotondamenti**: F li vuole configurabili, nessun valore. | 1 g per alimenti, 0,1 g o 0,1 ml per integratori, capsule intere. Il motore calcola già con questi passi, quindi la ricetta arrotondata è quella verificata. | Confermare. |
| D15 | **Mese** per i costi. | 30 giorni (dichiarato in app). | Confermare. |
| D16 | **Energia degli integratori**: le etichette spesso non riportano kcal (es. olio di pesce). | Se kcal per dose è vuoto, l'energia della ricetta diventa "parziale" e la ricetta non è verificata. L'amministratore può scrivere 0 solo se la fonte lo supporta. | Nessuna, segnalo l'effetto. |
| D17 | **Equilibrio tra ingredienti**: F cita «ingredient balance» senza criterio. Senza criterio l'ottimizzatore può proporre soluzioni estreme (es. 800 g di carote). | Ultimo criterio, dopo tutti quelli nutrizionali: meno integratori e porzione più compatta (meno grammi totali), costo se i prezzi sono noti. L'utente può sempre fissare minimi/massimi per ingrediente. | Confermare o indicare un criterio (es. quote di energia per gruppo di alimenti). |

**Dati indispensabili mancanti** (già noti nel pacchetto): nessun alimento ha composizione verificata (tutti `NOT_VERIFIED`);
Q-Diet, Omegor Vitality, farina d'ossa, carbonato di calcio, multivitaminico senza etichetta (`MISSING`). Quindi oggi, con i dati reali,
**l'app non può produrre ricette verificate**: lo dice chiaramente e indica cosa manca. Servono (FONTI_E_INTEGRAZIONE_DATI):
etichette complete degli integratori nella variante esatta, analisi o profilo stimato del macinato, la formulazione veterinaria attuale per il confronto,
eventuali target firmati dalla professionista.

## 4. Piano di sviluppo per fasi

1. **Database** — migrazioni Supabase con RLS completa, ruoli, trigger (10 ricette, una principale, versioni immutabili,
   versioni dei profili, registro modifiche, controllo unità), viste di completezza; seed dai file A–F e FEDIAF.
   Prova su Postgres locale, compresi i permessi (T11, T12).
2. **Motore** — unità, energia, somme, rapporti, semaforo, ottimizzatore simultaneo, diagnosi conflitti, verifica indipendente, costi, versioni.
   Test T01–T18 con dati di prova.
3. **Interfaccia** — tutte le schermate della §14, modalità prova e modalità Supabase.
4. **Test e collaudo** — test automatici, prova dell'interfaccia nel browser, poi (con i dati reali) confronto con 3 diete validate da un nutrizionista.
5. **Dati reali** — caricamento dei profili (CSV dei modelli D/E o tabella Supabase), controllo completezza, attivazione dei singoli alimenti/integratori da parte dell'amministratore.
