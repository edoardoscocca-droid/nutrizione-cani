# Integratori per app Nutrizione Cani — guida importazione

**Data:** 16 ottobre 2026. **Prodotti:** Q.Diet Compensa STANDARD (NON Ultra e NON Crescita), Omegor Vitality 1000, farina d’ossa non ancora identificata con certezza.

## File
- `E_catalogo_integratori_IMPORT.csv`: i tre prodotti, identificativi compatibili con seed dell’app.
- `E_composizione_integratori_IMPORT.csv`: matrice completa **59 nutrienti per prodotto**; i valori non dichiarati hanno cella vuota con `UNKNOWN_NOT_DECLARED`, mai valore zero. Unità canoniche dal dizionario A.
- `E_componenti_da_convertire_o_non_mappati.csv`: vitamina E in mg, calcio D-pantotenato, ceneri e olio, da NON mappare automaticamente in quantità inesatte.
- `E_integratori_dettaglio.json`: rappresentazione strutturata alternativa.

## Avvisi vincolanti per sviluppo
1. **Q.Diet:** gli additivi 250.000 UI vitamina A, 25.000 UI D3, ecc. sono assunti **per kg di prodotto** secondo la convenzione delle etichette mangimistiche. La pagina web consultata NON specifica esplicitamente `per kg` nell’intestazione: **confermare dalla confezione o dal produttore prima di usare i numeri nella formulazione effettiva**. I valori per 1 g qui sono quindi PROVVISORI. Gli additivi sono quantità dichiarate aggiunte; non rappresentano necessariamente il totale analitico. Il 18% di calcio, 6,5% di fosforo, ecc., invece, sono percentuali del prodotto. Non contare il calcio nel sale pantotenato una seconda volta.
2. **Vitamina E:** FEDIAF nell'allegato usa UI; Q-Diet dichiara mg di *tutto-rac-alfa-tocoferolo acetato*, Omegor mg di *d-alfa-tocoferolo*. Servono regole di conversione **specifiche della forma chimica** approvate dallo sviluppatore con verifica tecnica; non registrare i mg direttamente come UI. Le materie prime possono richiedere ulteriori correzioni per attività biologica.
3. **B5 Q-Diet:** `450 mg/kg di calcio D-pantotenato` è la massa del sale, non equivale a 450 mg di acido pantotenico; conservato come componente grezzo finché non si valida la conversione e l’eventuale forma chimica.
4. **Omegor:** valori per **capsula**, non per grammo di polvere. Una capsula contiene 1000 mg di olio, ma pesa complessivamente più dell’olio a causa dell’involucro; non assegnare automaticamente `mass_per_unit_g = 1`. Omega-3 totale (900 mg) **include** EPA 535 mg e DHA 268 mg, non sommarli due volte. EPA+DHA = 803 mg, indicatore derivato. Il prodotto è per uso umano, quindi il range posologico sul sito non è una prescrizione per il cane.
5. **Farina d'ossa:** lo screenshot deriva da una risposta sintetica di ricerca con fonti diverse e non identifica con certezza la confezione realmente utilizzata. Calcio 22,6% e fosforo 17,7% = Ca:P 1,277:1, ma sono **VALORI PROVVISORI**, da non trattare come verified. Per la prima formulazione reale occorre foto della confezione o scheda tecnica della marca acquistata.
6. **Riserve:** il contenuto di nutrienti non dichiarati non è zero. Per alcuni micronutrienti di un multivitaminico, i quantitativi analitici totali possono differire dai quantitativi di additivi dichiarati: mantenere `declared_total_or_added`.
7. **Importazione:** schema SQL attuale `supplement_nutrients` non ha tutte le colonne di questo CSV (es. `per_dose`, `declared_total_or_added`, `notes`, `verified`). L’altra AI deve eseguire mapping/estensione dello schema, poi UPSERT per `(supplement_id,nutrient_id)` dopo validazione. **Non caricare il CSV direttamente in Supabase senza mapping.**
8. **Ottimizzazione:** Q-Diet e farina d'ossa non sono ancora contrassegnati come verificati. Sono consultabili e preparati per importazione, ma le dosi calcolate restano illustrative finché non si conferma il riferimento dei dati. Non usare la presunta dose per chilo di Q-Diet come già confermata.

## Fonti
- Foto dell’utente Q-Diet (IMG_5114), farina d'ossa (IMG_5115), Omegor (IMG_5116).
- Q.Diet sito produttore: https://www.qdiet.it/products/compensa-250-g
- Omegor sito produttore: https://www.omegor.com/products/omegor-vitality-1000/
- Farina d'ossa: ricerca mostrata nello screenshot dell'utente, non sufficientemente identificabile come singola scheda prodotto.

## Esempi di controllo matematico (senza raccomandazione di dose)
- 1 g Compensa **se confermata base additivi/kg:** calcio 0,18 g; fosforo 0,065 g; vitamina A 250 UI; D3 25 UI; taurina 50 mg; zinco 2 mg; iodio 0,045 mg; selenio 4 µg.
- 1 capsula Omegor: omega-3 totale 0,900 g, EPA 0,535 g, DHA 0,268 g, EPA+DHA 0,803 g; vitamina E 10 mg (non ancora convertita in UI).
- 1 g farina d’ossa **se confermata con etichetta:** calcio 0,226 g e fosforo 0,177 g; per es. 5 g -> 1,13 g Ca e 0,885 g P. Il rapporto della sola farina non indica il rapporto dell'intera ricetta.
