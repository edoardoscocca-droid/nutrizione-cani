# Specifica del calcolo dei menù (20/10/2026) — esito dell’implementazione

Motore `motore-2.0.0`. Test: `tests/spec-2026-10-20.test.ts` (casi di accettazione §16 e altre regole), più tutti i test precedenti
aggiornati dove la specifica cambia il comportamento. Nessun prodotto reale, profilo clinico o ricetta salvata è stato modificato:
i prodotti reali sono usati solo come copie in memoria nei test e nelle misure dei tempi.

## 1. Mappa regola → codice → test

| § | Regola | Dove (codice) | Test |
|---|---|---|---|
| 3 | Ordine lessicografico H → P1 → P2 → P3, nessuna somma di pesi | `formulate()` in `src/engine/formulate.ts` (fasi H, EPA+DHA, P1 prima/seconda ricerca, altre preferenze, P2, P3) | tutti i casi di generazione |
| 3 | EPA+DHA attivo = vincolo necessario (H) | `buildRows` (`RECOMMENDED_ALLOWANCE` rigido; copertura se dati parziali) | «33 kg … 1 capsula», «senza fonti di EPA+DHA» |
| 3 | Nessuna preferenza rimossa per dati o metodi mancanti | quote macro su 4/9/4 fisso, senza metodo energetico | «senza metodo energetico … restano applicate», «avena dried» |
| 4 | Minimi per 1000 kcal su `max(E_target, E_finale)`, massimi su `E_finale` | riga aggiuntiva in `buildRows`; `measure()` in `audit.ts` | «energia 1.379 kcal» |
| 4 | Sotto 95 kcal/kg^0,75 (peso ideale): nessuna generazione conforme | `formulate()` (esito `blocked`) | «sotto 95 kcal/kg^0,75» |
| 4 | Aminoacidi essenziali +10% senza digeribilità ≥ 80% garantita, dichiarato | `applicableLimits()`; campo del cane «digeribilità proteica ≥ 80% documentata» | «aminoacidi essenziali +10%» |
| 5 | P1: Ca:P 1,2–1,4; quote macro; fibra. Prima ricerca esatta, seconda solo con ampliamenti (±5 punti; fibra ±20%; Ca:P ±0,1); oltre: diagnostico | `p1Widening()`, fasi P1 di `formulate()`, esito `preferences_unreachable` | «seconda ricerca», «preferenza non rispettata», «Ca:P 1,05» |
| 5 | Preferenza fissata dal professionista: non si amplia | `p1Widening()` (solo preferenze non rigide) | — |
| 5 | Fibra automatica in g/1000 kcal; quella in g/die non viene trasformata | `toFormulationProfile()` | test delle preferenze iniziali |
| 6 | Minimo pratico `max(5 g, 0,5% kcal)` per alimento attivo; 0 oppure minimo | `buildItems()` + variabili binarie in `buildModel()` | «1 g di carote» |
| 6 | Capsule intere; nuova verifica sulle quantità mostrate | variabili intere; `finalAudit()` | «capsule intere» |
| 6/12 | Analisi manuale dei grammi esatti, nessuna riformulazione | `editedVersion()` | «modifica manuale», «1 g di carote» |
| 7 | Ripartizione energetica stimata 4/9/4, denominatore Ep+Ef+Ec, separata dalla EM | `computeTotals()` in `totals.ts`; vincoli in `buildRows` | «origine riconoscibile…», T13 |
| 7 | Macronutrienti non dichiarati da un integratore: quote parziali (intervallo dalla massa non attribuita della dose) | `computeTotals()`, `evaluate()` | — |
| 7/12 | Energia sconosciuta: totale parziale, tolleranza energetica non attestata | `auditRecipe()` (energia grigia, bozza parziale) | «energia della farina d’ossa ignota» |
| 7 | Cancellazione esplicita di un’energia errata | importazione: `"kcal_me_per_100g": "NA"`, `"kcal_per_unit": "NA"` | «NA cancella esplicitamente» |
| 8 | Ca:P come vincolo lineare, stessa equazione per ogni prodotto | righe `ratio` in `buildRows` | «solo Grau 86,7022», «prodotto X 3,10303», «Ca/P 3592,85/2815» |
| 9 | Limite operativo olio `ceil(T/u)`; minor numero di capsule; un solo prodotto omega se non richiesti più | `buildItems()` (`omegaMax`), fase «EPA+DHA: minimo indispensabile», vincolo `omega_one` | «1 capsula», «52 capsule», «olio non aumentato» |
| 9 | Olio non usato senza obiettivo EPA+DHA attivo | `buildItems()` | «olio non aumentato…» |
| 9 | EPA+DHA contati una volta | `compoundValue()`, `COMPOUNDS` | «Omegor 803 mg» |
| 10 | Tabella del produttore: interpolazione senza estrapolazione; il minimo non forza l’uso | `doseRangeFor()`; riga condizionata a «se usato» in `buildModel()` | «QDiet 9,9 g» |
| 10 | «added» = limite inferiore: dimostra un minimo, non un massimo | `supplementData().lowerBound`, `evaluate()` | — |
| 11 | Selenio: secco solo per mangime secco completo; altrimenti il riferimento maggiore | `applicableLimits()`; scelta nella nuova ricetta | «dieta mista o ignota» |
| 12 | Minimo coperto dai dati noti = dimostrato; sotto con ignoti = non verificabile; massimo con ignoti = non verificabile; rapporti mai dai soli valori presenti | `measure()`/`evaluate()` in `audit.ts`, `ratio()` in `totals.ts` | «linoleico NA», «iodio 0,419», D20 aggiornati |
| 12 | Stati a–e; controlli sconosciuti restano nel conteggio | `RecipeStatus`, `summary` | — |
| 13 | Analisi preliminare con tutti gli obiettivi attivi, EPA+DHA compreso | `preliminaryAnalysis()` (EPA+DHA ora vincolo H) | — |
| 14 | Infattibilità evidente prima del calcolo; timeout ≠ infattibilità; tempi registrati | `trivialConflicts()`, esito `timeout`, `stats` | «tempo scaduto», «deterministico» |
| 15 | Lacune del catalogo visibili, ricetta non interamente verificata | `dati/riferimenti/lacune_catalogo.json`, `withCatalogGaps()`, `auditRecipe()`, `foodStatus()`/`supplementStatus()` | «lacune del catalogo reale visibili» |

## 2. Casi di accettazione (§16)

Tutti i 23 casi della tabella sono test automatici e passano (`tests/spec-2026-10-20.test.ts`, 28 test in totale nel file). Totale del progetto:
**130 test dell’app superati** e **test del database superati** (migrazioni 1–9).

Note sui casi:
- «Due minimi incompatibili con un massimo»: non fattibile, nessuna quantità; la diagnosi elenca la violazione minima necessaria (qui i due minimi).
- «Avena dried senza metodo»: l’alimento è escluso con il motivo esplicito (energia non calcolabile), le preferenze restano nel modello.
- «QDiet 33 kg → 9,9 g»: verificato sulla tabella e nel calcolo: la tabella d’impiego usa il **peso attuale** (decisione del 20/10).

## 3. Tempi misurati

Server di calcolo equivalente a quello usato dall’iPhone (Intel Xeon 2,1 GHz × 4, Node 22), 20 ripetizioni, due ricerche e verificatore compresi
(`npx tsx scripts/collaudo/tempi.ts 20`):

| Scenario | p50 | p95 | max | Esito |
|---|---:|---:|---:|---|
| Copie dei prodotti reali, 6 alimenti + 3 integratori | 0,87 s | 1,03 s | 1,17 s | preferenze non raggiungibili (diagnostico) |
| Prodotti TEST, 6 alimenti + 3 integratori | 0,10 s | 0,17 s | 0,33 s | verificata |

Entro l’obiettivo (p95 ≤ 3 s, limite 8 s). Non misurato sul dispositivo: l’iPhone chiama il server, quindi al tempo di calcolo si aggiunge la rete e,
sul piano gratuito di Render, fino a circa un minuto di avvio dopo un periodo di inattività.

## 4. Punti da decidere (contraddizioni o indicazioni insufficienti)

1. **Peso per la tabella d’impiego di QDiet**: deciso il 20/10: peso attuale (33 kg → massimo 9,9 g), senza passaggio implicito al peso ideale.
2. **Avena «dried»**: la specifica chiede una politica esplicita ma non la fornisce. Oggi un alimento essiccato senza energia inserita non ha metodo e resta escluso con il motivo.
3. **Ampliamento di un Ca:P personalizzato**: documentato solo per 1,2–1,4 → 1,1–1,5. Ho applicato ±0,1 anche a un intervallo Ca:P personalizzato: confermare.
4. **Altre preferenze personali** (su nutrienti diversi da macro, fibra e Ca:P): non sono nel P1 della specifica; restano preferenze minimizzate dopo P1, senza ampliamento né esito diagnostico.
5. **Quote macro**: la specifica sostituisce la decisione del 19/10 (quote sull’energia totale, che sommavano al 93,5%) con la ripartizione 4/9/4 su Ep+Ef+Ec, che somma al 100%. Applicata la specifica; la differenza tra energia inserita e stimata resta segnalata a parte.
6. **Valori non dichiarati dagli integratori**: la specifica (§12) sostituisce la decisione D20 («massimi rispettati sulla composizione dichiarata»): ora un apporto sconosciuto rende un massimo o un rapporto «non verificabile». Effetto pratico sotto (§5).
7. **Margine aminoacidi +10%**: senza digeribilità documentata si applica sempre. La digeribilità è un dato della **dieta** (scelta nella nuova ricetta, con riferimento documentale obbligatorio), non del cane.
8. **Erbe e spezie** escluse dal minimo pratico: il catalogo non ha questa categoria, quindi oggi il minimo vale per tutti gli alimenti.
9. **Annullamento del calcolo** dall’interfaccia e **modulo dei limiti legali «L»** su sostanza secca: non realizzati (nel catalogo non ci sono limiti legali).

## 5. Esito con i prodotti reali e dati mancanti

Con le copie dei 6 alimenti reali + QDiet + Omegor + farina d’ossa (cane 33/31 kg, 1.800 kcal, preferenze iniziali) il motore restituisce
**«preferenze non raggiungibili»**: le quantità sono solo diagnostiche e la ricetta è **bozza parziale**. Cause individuate:

- Resoconto completo dopo le correzioni del 20/10: `docs/CASO_REALE_2026-10-20.md` (vincolo guida: vitamina D minima, coperta solo da QDiet e manzo; il minimo ampliato di Ca:P passato al solver è 1,1).
- Omegor non dichiara calcio, fosforo, fibra, proteine e carboidrati: Ca:P, fibra e quote macro risultano non verificabili quando è usato.
  Servono valori documentati (anche zeri) e la massa del contenuto della capsula.
- QDiet: solo i valori marcati «added» (vitamine A e D, oligoelementi, colina…) sono limiti inferiori; calcio e fosforo, non marcati, sono componenti analitici dichiarati (correzione del 20/10: prima l’etichetta di soli additivi li rendeva tutti «aggiunti»).
- Farina d’ossa: energia ignota (energia della ricetta non attestata); variante da confermare.
- I 6 alimenti: acido linoleico solo come 18:2 non differenziato; cloruro e iodio mancanti; vitamina A solo come dati di fonte; energia stimata 4/9/4.
- Avena: pesata secca e preparazione da verificare.

Queste lacune sono elencate in `dati/riferimenti/lacune_catalogo.json`, compaiono nella scheda dei prodotti e nella verifica di ogni ricetta che li usa.
Si chiudono solo con dati documentati.
