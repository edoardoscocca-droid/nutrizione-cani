# Catalogo: stati, convalida e importazioni

## Tre stati, calcolati dalla qualità dei dati

Lo stato non si sceglie a mano e non dipende dal numero di campi compilati: lo calcolano le stesse regole
nell'app (`src/engine/catalogStatus.ts`) e nel database (`food_status_of`, `supplement_status_of`, vista `catalog_status`).
Un test controlla che app e database diano lo stesso risultato.

Tre cose distinte (decisione della nutrizionista):
1. **utilizzabilità** nella formulazione: la decide l'amministratore (o il file d'importazione) con «attivo per la formulazione»;
2. **qualità e completezza dei dati** del prodotto: lo stato qui sotto;
3. **verifica nutrizionale della ricetta**: si fa sulla ricetta, e dice quali fabbisogni sono dimostrabilmente soddisfatti,
   quali non lo sono e quali non si possono verificare per dati mancanti.

Un prodotto con dati parziali o stimati **si può usare** nella formulazione: fonte, approssimazioni e nutrienti mancanti sono
indicati, e l'incertezza emerge nella verifica della ricetta. Non serve conoscere tutti i micronutrienti e gli aminoacidi.

| Stato | Alimento | Integratore | Nel calcolo |
|---|---|---|---|
| **Da completare** | mancano proteine o grassi, oppure l'energia metabolizzabile non c'è e non si può calcolare (stato crudo/cotto non indicato, nessun metodo per la tipologia, carboidrati disponibili mancanti) | nessun valore dichiarato, oppure manca l'etichetta/scheda | escluso; non attivabile |
| **Dati parziali** | almeno un criterio sotto non è soddisfatto | come a sinistra | utilizzabile se attivo; la verifica della ricetta indica «con dati di composizione stimati o non convalidati» |
| **Verificato** | tutti i criteri soddisfatti **e** convalida di un amministratore | dati **dichiarati** verificati e convalidati | utilizzabile se attivo |

### Criteri di «Verificato» (D18)

«Verificato» riguarda solo i dati del singolo prodotto in catalogo. La ricetta completa ha una verifica separata.

**Alimento** — «Verificato» quando sono vere tutte queste condizioni:
1. c'è un valore per tutti i nutrienti con requisito ufficiale (nutrienti principali e aminoacidi essenziali; Met+Cys e Phe+Tyr valgono anche come somma delle parti);
2. ogni valore è misurato, da etichetta, calcolato con metodo o uno zero documentato — nessuna stima — e ha una fonte;
3. l'energia metabolizzabile è inserita con il metodo con cui è stata ottenuta, oppure calcolata con il metodo approvato della tipologia;
4. sono indicati fonte e versione, stato di preparazione (crudo, cotto, al vapore…) e parte edibile;
5. il profilo non è dichiarato «stima»;
6. un amministratore lo ha convalidato (possibile solo con 1–5 soddisfatti). Ogni modifica fa decadere la convalida.

Un'avvertenza di digeribilità (amido o verdura crudi) **non** impedisce né l'uso né la verifica: si mostra nella scheda e nella ricetta.

**Integratore** — «Verificato» significa **dati dichiarati verificati**, non composizione nutrizionale completa. Condizioni:
1. c'è l'etichetta o la scheda tecnica e almeno un valore dichiarato per dose;
2. ogni valore dichiarato è da etichetta, misurato, calcolato o uno zero documentato — nessuna stima — e ha una fonte;
3. la base quantitativa dei valori è confermata (per dose, per kg…): i valori con base da confermare restano «dati parziali»
   e la ricetta lo segnala come motivo per non usarla in una formulazione reale (es. Q-Diet «per kg»);
4. per capsule, compresse e misurini è indicato il peso della singola unità;
5. sono indicate variante, lotto o versione;
6. un amministratore lo ha convalidato.

Non sono requisiti (decisione della nutrizionista), ma si mostrano come informazione:
- i nutrienti **non dichiarati**: restano sconosciuti, mai zero;
- l'**energia per dose** non dichiarata: sconosciuta (si stima solo se l'etichetta dichiara proteine, grassi e carboidrati disponibili e c'è un metodo approvato);
- un'etichetta che dichiara solo gli **additivi aggiunti** e alcuni componenti analitici: si verificano i dati dichiarati, la composizione completa resta non nota.

Ogni modifica alla composizione crea una nuova versione e **fa decadere la convalida**. Il profilo precedente resta nello storico
(`food_profile_history`, `supplement_profile_history`; nell'app: Catalogo → prodotto → «Versioni precedenti»).

## Importazione (solo amministratori)

Catalogo → **Importa**: scegli alimenti o integratori, carica o incolla il file, **Analizza**. L'anteprima mostra, per ogni prodotto:
nuovo / aggiornato / invariato, ogni campo e valore prima → dopo, lo stato risultante, gli errori e gli avvisi, e le tue ricette che
diventeranno «da ricalcolare». Con anche un solo errore la conferma è bloccata. La conferma applica tutto in un'unica transazione
(funzione `admin_import_catalog`): o entra tutto, o niente. Ogni importazione resta nel registro (`catalog_imports`).

Formati accettati:
- **CSV lungo** (modelli D/E del pacchetto): `product_id, nutrient_id, value_per_100g | declared_amount, unit, basis, source_id, status`
  (facoltativa `form` per la forma chimica; integratori anche `per_dose`, `declared_total_or_added`). Separatore `,` o `;`, decimali con `,` o `.`.
- **CSV largo**: una riga per prodotto, colonne di anagrafica (`id, nome, categoria, sottocategoria, stato, kcal, fonte…`)
  e una colonna per nutriente, con unità nel titolo: `Calcio (mg)`, `Vit D [IU]`, `zinc_mg`.
- **JSON**: `{ "foods": [ { "id": …, "name_it": …, "nutrients": { "calcium": { "value": 0.15, "unit": "g", "status": "measured", "source": "FDC 123" } } } ] }`
  (oppure `"supplements"`). I modelli si scaricano dalla scheda Importa.

Regole:
- l'**ID stabile** decide: stesso ID = aggiornamento; ID nuovo = nuovo prodotto; un nome già usato da un altro ID è un errore (niente duplicati);
- i nutrienti si riconoscono da ID, nome italiano o inglese e sinonimi comuni (`Calcio`, `calcium`, `Ca`…); colonne sconosciute = errore;
- cella vuota = nessuna modifica; `NA` = rendi il dato «non disponibile» (mai zero);
- unità: conversione automatica tra unità di massa (g, mg, µg); tra unità diverse solo con le conversioni approvate (D19:
  vitamina D µg → UI × 40; vitamina E mg → UI solo con la **forma chimica** nella colonna `form`: d-alfa-tocoferolo 1,49,
  tutto-rac/dl-alfa-tocoferil acetato 1, d-alfa-tocoferil acetato 1,36). Il valore originale e la regola restano registrati;
- obbligatori: unità, fonte (del valore o del prodotto), nome e sottocategoria per i nuovi alimenti, unità di dose per i nuovi integratori;
- controlli di coerenza: niente valori negativi, nessun nutriente oltre 100 g per 100 g, somma di proteine+grassi+carboidrati+fibra+umidità ≤ 105 g,
  acidi grassi non oltre i grassi totali, nutrienti di un integratore non più pesanti della dose, zeri solo come dato analitico o di etichetta;
- l'importazione **non convalida** mai; applica l'attivazione indicata nel file (`available_to_formulate` / `usable_for_optimization`), che non crea una nuova versione del profilo; un prodotto «da completare» non resta mai attivo;
- di ogni valore restano registrati valore, unità e forma chimica originali (colonna facoltativa `form`).

Da riga di comando (stesse verifiche): `npx tsx scripts/import-catalog.ts alimenti file.csv > import.sql`, poi eseguire `import.sql`
nell'SQL Editor di Supabase come amministratore.

## Ricette collegate

Le ricette salvate conservano l'istantanea dei dati usati e **non cambiano**. Quando un prodotto cambia versione, ogni utente vede in home
«N ricette da ricalcolare» e nella ricetta l'elenco dei cambiamenti, con anteprima del ricalcolo da confermare.
