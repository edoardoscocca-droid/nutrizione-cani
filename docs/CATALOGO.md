# Catalogo: stati, convalida e importazioni

## Tre stati, calcolati dalla qualità dei dati

Lo stato non si sceglie a mano e non dipende dal numero di campi compilati: lo calcolano le stesse regole
nell'app (`src/engine/catalogStatus.ts`) e nel database (`food_status_of`, `supplement_status_of`, vista `catalog_status`).
Un test controlla che app e database diano lo stesso risultato.

| Stato | Alimento | Integratore | Nel calcolo |
|---|---|---|---|
| **Da completare** | manca l'energia metabolizzabile, le proteine o i grassi | nessun valore dichiarato, oppure manca l'etichetta/scheda, oppure (capsule, compresse, misurini) manca il contenuto della singola dose | escluso; non attivabile |
| **Dati parziali** | utilizzabile ma almeno un criterio sotto non è soddisfatto | come a sinistra | ammesso se attivato, ma la ricetta **non può essere dichiarata completa** (la verifica lo indica col nome del prodotto) |
| **Verificato** | tutti i criteri soddisfatti **e** convalida di un amministratore | come a sinistra | pieno utilizzo |

Criteri per «Verificato» (decisione D18, da confermare con la professionista):
- valore presente per **tutti** i nutrienti con requisito ufficiale (dizionario A: core + aminoacidi essenziali);
- ogni valore di qualità adeguata (misurato, da etichetta, calcolato o zero dichiarato — non una stima) e **con fonte**;
- alimenti: metodo di calcolo dell'energia, fonte e versione della fonte, stato crudo/cotto specificato, parte edibile; profilo non dichiarato «stima»;
- integratori: energia per dose (anche 0, se la fonte lo dice), variante/lotto o versione, etichetta che non dichiari solo le quantità aggiunte;
- convalida esplicita di un amministratore (`validate_catalog_item`), possibile solo quando tutto il resto è a posto.

Ogni modifica alla composizione crea una nuova versione e **fa decadere la convalida**. Il profilo precedente resta nello storico
(`food_profile_history`, `supplement_profile_history`; nell'app: Catalogo → prodotto → «Versioni precedenti»).

## Importazione (solo amministratori)

Catalogo → **Importa**: scegli alimenti o integratori, carica o incolla il file, **Analizza**. L'anteprima mostra, per ogni prodotto:
nuovo / aggiornato / invariato, ogni campo e valore prima → dopo, lo stato risultante, gli errori e gli avvisi, e le tue ricette che
diventeranno «da ricalcolare». Con anche un solo errore la conferma è bloccata. La conferma applica tutto in un'unica transazione
(funzione `admin_import_catalog`): o entra tutto, o niente. Ogni importazione resta nel registro (`catalog_imports`).

Formati accettati:
- **CSV lungo** (modelli D/E del pacchetto): `product_id, nutrient_id, value_per_100g | declared_amount, unit, basis, source_id, status`
  (integratori anche `per_dose`, `declared_total_or_added`). Separatore `,` o `;`, decimali con `,` o `.`.
- **CSV largo**: una riga per prodotto, colonne di anagrafica (`id, nome, categoria, sottocategoria, stato, kcal, fonte…`)
  e una colonna per nutriente, con unità nel titolo: `Calcio (mg)`, `Vit D [IU]`, `zinc_mg`.
- **JSON**: `{ "foods": [ { "id": …, "name_it": …, "nutrients": { "calcium": { "value": 0.15, "unit": "g", "status": "measured", "source": "FDC 123" } } } ] }`
  (oppure `"supplements"`). I modelli si scaricano dalla scheda Importa.

Regole:
- l'**ID stabile** decide: stesso ID = aggiornamento; ID nuovo = nuovo prodotto; un nome già usato da un altro ID è un errore (niente duplicati);
- i nutrienti si riconoscono da ID, nome italiano o inglese e sinonimi comuni (`Calcio`, `calcium`, `Ca`…); colonne sconosciute = errore;
- cella vuota = nessuna modifica; `NA` = rendi il dato «non disponibile» (mai zero);
- unità: conversione automatica solo tra unità di massa (g, mg, µg); IU ↔ mg mai senza fattore documentato;
- obbligatori: unità, fonte (del valore o del prodotto), nome e sottocategoria per i nuovi alimenti, unità di dose per i nuovi integratori;
- controlli di coerenza: niente valori negativi, nessun nutriente oltre 100 g per 100 g, somma di proteine+grassi+carboidrati+fibra+umidità ≤ 105 g,
  acidi grassi non oltre i grassi totali, nutrienti di un integratore non più pesanti della dose, zeri solo come dato analitico o di etichetta;
- l'importazione **non attiva e non convalida** mai: lo fa l'amministratore dopo il controllo; un prodotto che torna «da completare» viene disattivato.

Da riga di comando (stesse verifiche): `npx tsx scripts/import-catalog.ts alimenti file.csv > import.sql`, poi eseguire `import.sql`
nell'SQL Editor di Supabase come amministratore.

## Ricette collegate

Le ricette salvate conservano l'istantanea dei dati usati e **non cambiano**. Quando un prodotto cambia versione, ogni utente vede in home
«N ricette da ricalcolare» e nella ricetta l'elenco dei cambiamenti, con anteprima del ricalcolo da confermare.
