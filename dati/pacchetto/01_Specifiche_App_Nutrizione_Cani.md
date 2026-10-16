# SPECIFICA FUNZIONALE — APP DI FORMULAZIONE NUTRIZIONALE CANINA

**Versione:** 1.0 — 16 ottobre 2026  
**Destinatario:** assistente AI incaricato dello sviluppo software  
**Stato:** requisiti funzionali concordati; **tabelle nutrizionali e valori di riferimento saranno consegnati separatamente**.  
**Lingua dell'interfaccia:** italiano.  
**Obiettivo:** applicazione per uso quotidiano che propone automaticamente quantità di ingredienti e integratori per ricette individuali canine, ne verifica l'adeguatezza rispetto a dati nutrizionali autorevoli e conserva uno storico tracciabile.

> **ISTRUZIONE PRIORITARIA PER L'AI SVILUPPATRICE:** implementare i requisiti di questo documento. Non inventare fabbisogni, percentuali raccomandate, limiti, composizioni degli alimenti o dosi di integratori. Tutti i numeri nutrizionali, le fonti e le soglie arriveranno in dataset separati. Dove mancano, realizzare la struttura e segnalare «non verificabile», senza fingere che il calcolo sia validato. Scelte di framework, librerie e distribuzione spettano allo sviluppatore; l'architettura qui descritta è logica, non un vincolo di Flutter.

---

## 1. Scopo e principio operativo

L'utente **non deve trovare i grammi per tentativi**. Seleziona un cane e gli alimenti disponibili; il software determina una **proposta di grammi per ciascun alimento** e, quando necessari e disponibili, per gli integratori selezionati. Il calcolo considera contemporaneamente energia, nutrienti, rapporti, limiti, preferenze formulative e vincoli sui prodotti. La ricetta viene poi verificata nuovamente con un calcolo indipendente e mostrata in modo trasparente.

Il software è un **supporto informativo alla formulazione**, non sostituisce la valutazione di un veterinario nutrizionista. Non presentare ricette non verificabili come complete o dosi generate come prescrizioni cliniche. Disclaimer visibile in onboarding, formulazione e stampa/esportazione.

## 2. Componenti logici e persistenza

1. **App utente:** profili cani, ricette, selezione ingredienti/integratori, visualizzazione e modifica delle proposte, prezzi personali, storico, avvisi.
2. **Motore di calcolo nutrizionale:** modulo software interno all'app oppure servizio applicativo scelto dallo sviluppatore; non è necessariamente un'app separata. Esegue stime energetiche, somma nutrienti, ottimizzazione vincolata e validazione indipendente.
3. **Supabase:** archivio centrale dei cataloghi ufficiali e dei riferimenti; archivio dei dati dei singoli utenti, cani e ricette con adeguati controlli di accesso. Cache locale opzionale per consultazione offline, con sincronizzazione controllata.

**Autorizzazioni:** soltanto amministratori autorizzati modificano alimenti, composizioni nutrizionali, integratori, standard e note di razza condivisi. Utenti ordinari possono consultare questi dati, creare/modificare i propri cani, ricette, prezzi e preferenze; nessun utente può modificare il catalogo ufficiale globale. Applicare autenticazione, segregazione per utente (es. RLS Supabase), validazione lato server per scritture amministrative e tracciamento delle modifiche. Non esporre chiavi di servizio amministrative nel client.

## 3. Profilo del cane

Campi:
- identificativo, nome, razza (anche meticcio), data di nascita o età, sesso, sterilizzazione;
- peso attuale (kg), **peso ideale/obiettivo (kg)**, condizione corporea (BCS se disponibile), attività, eventuali note cliniche e target personalizzati validati;
- stima RER, stima MER, fattore energetico, **obiettivo kcal/die modificabile manualmente** e sua provenienza (stimato, veterinario, utente);
- preferenze di distribuzione energetica di proteine/grassi/carboidrati, target fibre e preferenze di ingredienti, con distinzione tra target rigidi e flessibili;
- note di attenzione individuali o di razza (es. Irish Wolfhound: attenzione alla salute cardiaca e alla taurina), senza introdurre automaticamente fabbisogni numerici non dimostrati.

**Comportamento peso:** alla creazione, inizializzare peso ideale = peso attuale. Consentire la modifica. Se la differenza assoluta tra peso ideale e peso attuale **supera 5 kg**, mostrare avviso ben visibile «Uno scostamento superiore a 5 kg richiede la valutazione di un veterinario nutrizionista» e chiedere conferma; **5 kg è una soglia UX concordata, non un limite clinico universale**. Il software usa per impostazione concordata il peso ideale quale riferimento della **stima iniziale** del fabbisogno energetico, ma avvisa che questa convenzione non è sempre clinicamente appropriata, soprattutto in sovrappeso/sottopeso e in patologie. Consentire un obiettivo kcal manuale, soprattutto se indicato dal veterinario. I requisiti nutrizionali giornalieri vanno derivati dallo standard appropriato e dall'obiettivo energetico, non semplicemente moltiplicati per il peso ideale.

**Aggiornare il solo peso attuale non modifica kcal obiettivo né ricette.** Cambiare peso ideale, obiettivo kcal, fattore energetico, target o dati che incidono sulla formulazione segnala ricette da ricalcolare e chiede approvazione prima di crearne una nuova versione. Non sovrascrivere mai silenziosamente una ricetta.

## 4. Macro, percentuali e categorie alimentari

- Distinguere rigorosamente **percentuale delle kcal da proteine, grassi e carboidrati** da **percentuale in peso** e **quota calorica di ingredienti animali/vegetali**. Non sono intercambiabili.
- Mostrare una proposta di distribuzione energetica iniziale soltanto quando esiste un modello formulativo documentato nei dataset; consentire personalizzazione con range formulativi configurabili e chiaramente etichettati, non inventare un range «ufficiale» universale.
- Le fibre sono un parametro separato, non una quarta fetta obbligatoria del 100% energetico.
- Le percentuali energetiche sono preferenze di formulazione: la verifica dei nutrienti effettivi e dei vincoli di sicurezza prevale. In caso di conflitto, spiegare quale preferenza impedisce una soluzione valida.
- Non richiedere all'utente di scegliere «BARF» o «casalinga» come condizione per calcolare i fabbisogni. **Registrare però per ogni ingrediente lo stato crudo/cotto/essiccato** e, se utile, il trattamento di preparazione, perché influenza valori nutrizionali e sicurezza. La modalità alimentare può essere un'etichetta descrittiva facoltativa, non un presupposto del calcolo.
- Consentire ricette senza cereali o senza carboidrati aggiunti, se nutrizionalmente verificabili. **BARF non significa 100% proteine**.

## 5. Catalogo alimenti: Supabase, sola gestione amministrativa

Anagrafica di ciascun alimento: ID, nome univoco, categoria e sottocategoria, specie e taglio/parte, stato di preparazione, parte edibile, base di espressione (per 100 g di parte edibile, cruda/cotta ecc.), energia metabolizzabile, origine/fonte, data e versione dei dati, note e attendibilità. Composizione: macro, vitamine, minerali, acidi grassi e altri nutrienti definiti nelle tabelle successive.

**Categorie iniziali** (espandibili):
- alimenti animali: carne muscolare, **cuore** (classificazione anatomica/culinaria distinta dalle frattaglie secernenti), **frattaglie secernenti** (fegato, rene, milza e altre distinte singolarmente), pesce, uova e altre fonti animali;
- cereali e altre fonti amidacee: avena, riso, patata, miglio ecc.;
- verdure e altre fonti vegetali;
- eventuali altri alimenti.

La distinzione cuore/fegato/rene ecc. è obbligatoria per consentire futuri vincoli su specifiche frattaglie. Nessuna percentuale obbligatoria di frattaglie va inventata; eventuali vincoli saranno definiti dai dataset/modelli formulativi.

**Valori mancanti:** `NULL`/«non disponibile» distinto da **zero analitico**. La mancanza di dati significativi riduce il livello di verifica della ricetta. Non assumere che una fonte fornisca tutti i nutrienti. Per prodotti molto variabili (es. macinato da ritagli) supportare profili alternativi o valori stimati con incertezza e provenienza esplicita.

**Aggiornamento:** solo amministratori via Supabase. L'aggiunta di «acciughe» al catalogo deve renderle selezionabili nell'app senza pubblicare una nuova versione. È possibile predisporre una vista amministrativa tabellare o import/export CSV/Excel, ma **Excel non è la fonte dati obbligatoria**.

## 6. Catalogo integratori: Supabase, sola gestione amministrativa

Ogni prodotto (es. Q-Diet, Omegor, farina d'ossa) possiede ID, marca, variante/formulazione, unità di dosaggio (g, ml, capsula, misurino), peso o contenuto per unità, composizione nutrizionale per unità, fonte/etichetta/scheda tecnica, eventuali limiti e indicazioni del produttore, data e versione. Supportare valori di nutrienti molteplici per lo stesso integratore: farina d'ossa = calcio **e** fosforo; multivitaminico = più vitamine/minerali; olio di pesce = acidi grassi specifici, ecc.

Solo gli integratori **selezionati come disponibili** dall'utente possono entrare nella formulazione automatica; il motore può suggerire quali categorie di nutrienti non sono coperte, ma non deve inventare prodotti, composizioni o dosaggi. Un nuovo multivitaminico va inserito dall'amministratore nel catalogo prima di essere utilizzato.

## 7. Prezzi personalizzati nell'app

Prezzi **per singolo utente e prodotto**, separati dal catalogo nutrizionale ufficiale. Supportare:
- prezzo diretto al kg (es. carne 3,50 €/kg);
- prezzo confezione + contenuto netto in g/kg (es. scatola Q-Diet da X g a Y €);
- prezzo confezione + numero di unità e contenuto per unità (es. capsule), quando appropriato;
- più fornitori/prezzi per stesso prodotto e scelta del prezzo attivo; cronologia facoltativa.

Normalizzare a €/g o €/unità, calcolare costo ingrediente/integratore in base alla dose effettiva, sommare **costo per ricetta giornaliera**, proiezione settimanale e mensile (specificare convenzione 30 giorni o media mensile). Dati mancanti = costo parziale esplicitamente segnalato, non zero tacito. Le modifiche ai prezzi non alterano grammi o valori nutrizionali.

## 8. Ricette per cane

- **Massimo 10 ricette salvate per cane**; una marcabile «principale». Possibilità di rinominare, duplicare, archiviare/eliminare e creare una nuova ricetta fino al limite.
- Creazione: scegliere cane → selezionare ingredienti disponibili (es. agnello, avena, piselli) → analisi preliminare → selezionare eventuali integratori disponibili (es. Q-Diet, Omegor) → **calcolo automatico con proposta di grammi per tutti i componenti** → verifica indipendente → risultato e salvataggio.
- Le quantità **non sono un input iniziale obbligatorio**. È il sistema a proporle. Consentire vincoli opzionali («questo ingrediente non oltre X g», «almeno Y g», «non usare prodotto Z»), se richiesti.
- Analisi preliminare: indicare **potenziali** carenze o necessità di integrazione, chiarendo che i deficit precisi sono determinabili soltanto dopo aver calcolato i grammi. Non affermare in modo definitivo che un integratore è obbligatorio prima della verifica completa.
- Ricette con ingredienti simili ma diversi (manzo vs agnello, sardine vs manzo) richiedono **ricalcolo completo**, mai sostituzione grammo per grammo.
- Il risultato include quantità giornaliere, kcal, macro, micro, rapporti, integratori, costi, fonti dei dati, stato di validazione, avvisi e versione dei riferimenti.
- Le ricette possono essere usate quotidianamente; visualizzazione semplice delle dosi in g e per unità pratiche quando disponibili. Possibile esportazione/consultazione stampabile.

## 9. Motore di formulazione: requisiti inderogabili

### 9.1 Input
Profilo del cane e kcal obiettivo; standard nutrizionale applicabile; target e note individuali; ingredienti selezionati e relative composizioni; integratori selezionati e relative composizioni; vincoli sulle quantità e preferenze percentuali; limiti e condizioni di applicabilità dei nutrienti.

### 9.2 Calcolo
1. Convertire tutti i dati in **unità canoniche** e basi comparabili (per 100 g, per g, per capsula; kcal di energia metabolizzabile). Rispettare stato crudo/cotto, parte edibile, forma chimica, unità IU/mg/µg e condizioni del riferimento.
2. Stimare le quantità con un **ottimizzatore vincolato** che consideri contemporaneamente tutti gli ingredienti e gli integratori, invece di correggere i nutrienti in sequenza. Gestire vincoli minimi/massimi ufficiali, rapporti (Ca:P ecc.), quantità ammesse, preferenze energetiche e obiettivo kcal.
3. Definire una gerarchia: sicurezza/limiti applicabili e fabbisogni verificabili > obiettivo kcal con tolleranza dichiarata > preferenze formulative flessibili > eventuale minimizzazione di costi/complessità. Le soglie personalizzate arancioni non devono essere trattate automaticamente come limiti di tossicità.
4. Evitare cicli di integrazione infinita: non applicare un algoritmo «aggiungi calcio → aggiungi fosforo → aggiungi altro calcio». Ogni incremento deve essere valutato per tutti i nutrienti che apporta.
5. Distinguere **nessuna soluzione valida**, **soluzione con dati insufficienti**, **soluzione che viola preferenze ma non limiti**, e **soluzione verificata rispetto ai controlli disponibili**. Mai garantire completezza clinica assoluta.
6. In caso di impossibilità, mostrare **quali vincoli sono in conflitto** e possibili opzioni da rivedere (ingrediente, integratore disponibile, target), senza inventare sostituzioni o supplementazioni.

### 9.3 Verifica indipendente finale
Dopo la proposta, ricalcolare da zero l'apporto di ogni nutriente come somma degli apporti di **tutti** gli ingredienti e integratori. Confrontare con minimi/massimi e rapporti applicabili, verificare unità e basi, percentuali energetiche e costo. Nessuna ricetta viene contrassegnata «verificata» se i dati essenziali mancano. Confronto e report devono indicare l'esatta versione delle fonti.

### 9.4 Prestazioni
La formulazione deve avere tempi interattivi ragionevoli; i calcoli aritmetici di decine di nutrienti sono leggeri. L'ottimizzazione va progettata con limiti, timeout, diagnostica e comportamento sicuro in caso di mancata convergenza. Non sacrificare controlli nutrizionali per la velocità.

## 10. Soglie, colori e verificabilità

Le tabelle esterne definiranno ogni nutriente con ID, unità, fonte, versione, popolazione applicabile, base (per 1000 kcal, sostanza secca ecc.), minimo, massimo se esiste, tipo di massimo (nutrizionale/legale), eventuale soglia personalizzata, priorità e note.

- **Rosso:** requisito minimo applicabile non soddisfatto o massimo ufficiale applicabile superato. Indicare quale fonte/limite e perché.
- **Arancione:** soglia di attenzione o preferenza formulativa **non ufficiale** oltrepassata; non equipararla automaticamente a pericolo o tossicità.
- **Verde:** entro gli obiettivi controllabili.
- **Blu:** nutriente monitorato ma privo di un limite numerico appropriato; non inventare minimi/massimi.
- **Grigio:** dato insufficiente o non verificabile.
- **Viola:** nota di attenzione individuale/di razza; può coesistere con gli altri stati, non sostituisce la valutazione numerica.

Mostrare sempre quantità effettiva, valore di riferimento, unità, fonte, base di calcolo e stato. Un limite «non definito» non deve essere sostituito automaticamente da un multiplo arbitrario del minimo. Target personalizzati e soglie ufficiali devono restare distinguibili in database, interfaccia e report.

**Irish Wolfhound:** supportare nota visibile su predisposizione cardiaca e monitoraggio della taurina; nessun «range taurina specifico Irish» inventato. Eventuali target clinici numerici solo se forniti e attribuiti a un professionista. Non affermare che la sola composizione alimentare prevenga cardiomiopatie.

## 11. Modifica consapevole, versioni e ricalcoli

- Mostrare proposta originale in sola lettura per impostazione predefinita. Per modificarla, usare azione esplicita «Modifica quantità», con campo numerico preciso; **non usare slider come unico metodo**.
- Salvare separatamente **proposta del motore** e **versione modificata dall'utente**, con timestamp e autore. Dopo qualsiasi modifica, eseguire di nuovo l'intera verifica; se possibile ricalcolare gli integratori coerentemente, ma mai sovrascrivere la scelta senza conferma.
- Cambiamenti di peso attuale: **nessun ricalcolo** automatico delle ricette. Cambiamenti di peso ideale, kcal, target, composizione ufficiale, standard o prodotto: **avviso di ricette potenzialmente obsolete**, anteprima delle differenze, conferma esplicita per creare nuova versione. Conservare storico e versione precedente.
- Cambiamenti di **prezzo soltanto**: aggiornare stime di costo senza alterare la formulazione nutrizionale.
- Per standard ufficiali nuovi, distinguere revisione del riferimento da aggiornamento di un singolo dato alimentare. La revisione non deve invalidare silenziosamente le ricette esistenti.

## 12. Struttura dati suggerita (non schema SQL definitivo)

- `users`/profili e ruoli; `dogs` (profilo, peso attuale e ideale, kcal, preferenze, note); `dog_weight_history` opzionale;
- `foods` (anagrafica), `food_nutrients` (ID alimento, ID nutriente, valore, base, fonte/versione), `food_categories`/sottocategorie;
- `nutrients` (dizionario ID, nome, unità canonica, gruppo);
- `supplements` (anagrafica/prodotto/unità), `supplement_nutrients` (composizioni);
- `nutrient_standards`/`standard_versions` (riferimenti ufficiali, min/max, basi, note), `formulation_targets` (preferenze e soglie personalizzate, etichettate);
- `breed_notes`/`dog_notes` (attenzioni, provenienza, nessuna soglia clinica inventata);
- `recipes`, `recipe_versions`, `recipe_items`, `recipe_results` (ingredienti, quantità proposte e modificate, verifiche, snapshot delle fonti);
- `user_product_prices` (prezzi/confezioni/fornitori), `audit_log` (modifiche amministrative e rilevanti).

**Perché `foods` e `food_nutrients` separati:** il primo contiene nome, categoria, stato ecc.; il secondo contiene una riga per ogni coppia alimento–nutriente. Aggiungere un nutriente non richiede creare nuove colonne SQL. Si può offrire una vista amministrativa tipo foglio elettronico, con nutrienti in righe e alimenti in colonne. Analogamente per gli integratori.

La separazione logica delle tabelle è consigliata; lo sviluppatore può perfezionare lo schema, purché rispetti ruoli, provenienza, versioni e funzionalità.

## 13. Sicurezza nutrizionale e messaggi

- Disclaimer: «Le quantità proposte sono stime informative e non sostituiscono una dieta formulata o verificata da un veterinario nutrizionista. Patologie, crescita, gravidanza, terapie e condizioni individuali richiedono valutazione professionale.»
- Non classificare automaticamente una ricetta come clinicamente sicura per cani con patologie solo perché supera le soglie generiche.
- Non assumere che una BARF sia completa senza integrazioni; non suggerire ossa cotte. Eventuali ingredienti crudi e ossa richiedono avvertenze su rischi microbiologici, meccanici e per persone vulnerabili; evitare automatismi che ne raccomandino l'uso.
- Non interpretare valori nutrizionali mancanti come zero. Le informazioni di etichetta di un integratore potrebbero essere incomplete; la completezza non va presunta.
- Per nutrienti privi di requisito numerico ufficiale (es. taurina per adulto sano in alcune linee guida), mostrare monitoraggio informativo o target clinico esplicitamente fornito, non carenza automatica.

## 14. Interfaccia minima richiesta

1. Elenco cani → crea/modifica cane; profilo con peso attuale, ideale, kcal e target.
2. Scheda cane → fino a 10 ricette, ricetta principale, stato di aggiornamento.
3. Nuova ricetta → selezione alimenti per categoria/sottocategoria, nessun obbligo di immettere grammi.
4. Valutazione preliminare → eventuali nutrienti critici e richiesta di selezionare integratori disponibili.
5. Risultato → dosi proposte in g/unità, kcal, macro, nutrienti, rapporti, prezzi, avvisi, livello di verificabilità.
6. Dettaglio nutriente → quantità, minimo/massimo o target, fonte, natura ufficiale/personalizzata e dati mancanti.
7. Modifica esplicita quantità → differenza rispetto alla proposta, ricalcolo e nuovo controllo.
8. Storico ricetta e anteprima ricalcolo prima della conferma.
9. Prezzi prodotti/confezioni, fornitori e costo complessivo.
10. Pannello amministrativo **non necessariamente nell'app**: i cataloghi sono gestibili direttamente da Supabase da personale autorizzato.

## 15. Esempi di accettazione (senza numeri nutrizionali inventati)

**A — Profilo e peso:** creare cane con peso attuale 30 kg: peso ideale iniziale 30 kg. Impostare peso ideale 35 kg: nuova stima energetica e richiesta di conferma. Cambiare poi peso attuale da 30 a 32 kg: le ricette e le kcal impostate **non cambiano**. Impostare peso ideale 40 kg con attuale 32 kg: avviso scostamento >5 kg e proposta di ricalcolo delle ricette, senza modifiche silenziose.

**B — Ricetta principale:** selezionare cane con 1.400 kcal impostate e ingredienti manzo, avena, carote; selezionare Q-Diet, Omegor e farina d'ossa come prodotti disponibili. Il motore deve proporre quantità per **tutti** i componenti sulla base dei dataset forniti, verificando contemporaneamente calcio, fosforo, altri nutrienti e limiti. Non fissare qui grammi d'esempio.

**C — Sostituzione:** duplicare ricetta manzo, sostituire con agnello; nuova formulazione completa e nuova versione, senza assumere equivalenza grammo-per-grammo.

**D — Catalogo:** amministratore aggiunge acciughe con dati nutrizionali su Supabase: alimento visibile in selezione ricetta. Utente ordinario non può modificare il profilo nutrizionale globale.

**E — Prezzo:** inserire prezzo confezione Q-Diet e grammi netti; costo ricetta proporzionale ai grammi proposti. Cambiare prezzo del Q-Diet: aggiornare solo costo, non quantità.

**F — Conflitto:** combinazione ingredienti/integratori che non soddisfa simultaneamente i requisiti: dichiarare impossibilità e vincoli responsabili, non ripetere aggiunte cicliche di calcio/fosforo.

**G — Dati mancanti:** vitamina non disponibile per un alimento: mostrare «dato mancante» e non trattarla come zero; se necessaria alla verifica, risultato «non verificabile».

**H — Versioning:** cambiare standard FEDIAF o composizione del macinato: avvisare che ricette collegate potrebbero richiedere aggiornamento; mostrare differenze e chiedere conferma prima di salvare nuova versione.

**I — Frattaglie:** il catalogo distingue cuore, fegato, rene, milza; una ricetta può contenerne più tipi, ciascuno con profilo e quantità indipendenti.

**J — Limite ricette:** consentire fino a 10 ricette salvate per cane e segnalare il limite prima dell'undicesima; non eliminare automaticamente ricette.

## 16. Materiali esterni ancora da fornire

**NON inventare i dati mancanti.** Saranno consegnati in uno o più allegati separati:

- **A. Dizionario nutrienti definitivo:** ID, unità canoniche, nutrienti da monitorare, formule dei rapporti, conversioni, aminoacidi essenziali e parametri informativi.
- **B. Standard nutrizionali:** riferimenti FEDIAF e altri ove applicabili, valori minimi, massimi, basi di espressione, categorie fisiologiche, fonti, versioni, limiti legali distinti, note.
- **C. Target formulativi e soglie di attenzione personalizzate:** intervalli e priorità, esplicitamente non ufficiali, con motivazione.
- **D. Catalogo alimenti:** composizioni, energia, stato crudo/cotto, parti edibili, fonti, qualità del dato.
- **E. Catalogo integratori:** Q-Diet, Omegor, farina d'ossa e altri con formulazioni, unità, composizioni e documentazione verificata.
- **F. Eventuali modelli di distribuzione energetica** e criteri di formulazione documentati.

**Finché A–F non sono consegnati e validati**, è possibile implementare database, UI, calcolatore, ottimizzatore e test con **dati fittizi marcati come test**; non distribuire risultati di formulazione reali come verificati. Il completamento dell'app richiede l'importazione e la validazione di questi dataset.

---

## 17. Indicazioni per l'AI sviluppatrice

1. Tratta questa specifica come fonte dei **requisiti funzionali concordati**; non modificare unilateralmente flussi o regole di autorizzazione.
2. Proponi le decisioni implementative non specificate (framework, backend di calcolo, solver, offline, UX) e chiedi conferma al committente quando influenzano il comportamento dell'app.
3. Progetta un sistema estensibile a nuovi alimenti, nutrienti, integratori e versioni degli standard senza migrazioni continue.
4. Scrivi test automatici per conversioni, somme nutrienti, rapporti, vincoli, casi impossibili, valori null, aggiornamenti, permessi e regressioni.
5. Prima dell'uso reale, verifica il motore contro ricette campione validate da professionisti e dati ufficiali completi. Non usare i numeri illustrativi delle conversazioni come dosaggi.
6. Fornisci documentazione delle formule e spiegabilità dei risultati: ogni quantità proposta deve poter essere ricondotta a dati, vincoli e versione del motore.

**Fine della specifica funzionale v1.0.**
