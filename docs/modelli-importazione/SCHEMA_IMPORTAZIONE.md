# Schema di importazione del catalogo (definitivo)

App Nutrizione cani · versione del 22/10/2026 (campi della formulazione v2 aggiunti; il resto invariato dal 19/10) · formato: **JSON**, codifica **UTF-8**.

Questo documento descrive le regole che l’importatore applica davvero. Un file con anche un solo errore viene rifiutato per intero: non si salva niente. Ogni errore indica il prodotto, il campo o nutriente e il motivo.

## 1. Struttura del file

- Alimenti: `{ "foods": [ prodotto, … ] }`. Integratori: `{ "supplements": [ prodotto, … ] }`. Un file contiene un solo tipo.
- Ogni prodotto è un oggetto con i campi della sezione 2 e un oggetto `nutrients`: `{ "codice_nutriente": valore, … }`.
- Ogni valore è un oggetto con le proprietà della sezione 4. **Proprietà o campi non riconosciuti sono un errore.**
- Numeri: in JSON con il punto (`21.5`) oppure come testo con la virgola (`"21,5"`). Non usare separatori delle migliaia.

## 2. Campi dell’alimento

| Campo | Obbligo | Valori e note |
|---|---|---|
| `id` | sempre | Identificativo stabile: minuscole, numeri e `_`, da 2 a 63 caratteri (es. `manzo_girello_crudo`). È l’unica chiave: id nuovo = nuovo prodotto, id esistente = aggiornamento. Vietato iniziare con `test_`. |
| `name_it` | nuovi prodotti | Unico in catalogo (senza distinzione di maiuscole). Vietato iniziare con `[TEST]`. |
| `category` | facoltativo | Se presente deve essere coerente con la sottocategoria (tabella sezione 6). |
| `subcategory` | nuovi prodotti | Codice della sezione 6. |
| `processing_state` | sì | `raw`, `cooked_boiled`, `cooked_steamed`, `cooked_baked`, `cooked_other`, `dried`, `canned` (`raw_or_unspecified` solo se davvero ignoto: l’energia non si calcola). Crudo e cotto sono prodotti distinti. |
| `species_cut` | facoltativo | Specie e taglio. |
| `preparation` | facoltativo | Come si prepara e si pesa (es. «pesata secca, poi ammollata»). |
| `edible_portion` | per «Verificato» | Testo (es. «100% parte edibile, senza ossa»). |
| `kcal_me_per_100g` | facoltativo | Energia metabolizzabile inserita, kcal per 100 g, tra 0 e 900. Se manca si calcola con il metodo approvato (FEDIAF 2025, 4/9/4) da proteine, grassi e carboidrati disponibili. |
| `me_method` | con l’energia inserita | Come è stata ottenuta l’energia inserita. |
| `source` | sì | Fonte del profilo (banca dati, scheda, analisi). Vale per ogni valore senza fonte propria. |
| `source_url` | facoltativo | Indirizzo della fonte (campo dedicato). |
| `source_version` | per «Verificato» | Versione o data della fonte. |
| `data_status` | facoltativo | Qualità del profilo: `unverified` (predefinito), `estimated`, `review_required`. `verified` è un errore: si ottiene solo con la convalida nell’app. |
| `available_to_formulate` | facoltativo | `true`/`false` (predefinito `false`). Torna `false` se il prodotto risulta «da completare». |
| `uncertainty`, `notes` | facoltativi | Testo. |
| `prepared_yield` | facoltativo, con fonte | **Resa di preparazione documentata**: grammi di alimento pronto per 1 g pesato nello stato `processing_state` (es. riso pesato secco → cotto). Serve solo ai tetti in % del peso della razione pronta; i nutrienti restano sul peso come pesato. Tra 0 e 10. Senza resa, per cereali, tuberi e legumi pesati crudi o secchi il tetto non è verificabile (la resa non si stima). |
| `prepared_yield_source` | con `prepared_yield` | Fonte della resa (pesata, tabella, scheda). Una resa senza fonte è un errore. |
| `max_fresh_weight_pct` | facoltativo | Tetto per alimento in % del peso degli alimenti della razione pronta (senza acqua aggiunta né integratori). Sostituisce il predefinito della categoria (fegato 5%, altre frattaglie secernenti 10%, verdure 20%). |
| `max_g_per_1000_kcal` | facoltativo | Tetto per alimento in grammi per 1000 kcal della razione. |
| `forbidden` | facoltativo | `true` = alimento vietato per il cane: mai utilizzabile, rosso se presente in una ricetta. |
| `preparation_warning` | facoltativo | Avvertenza di preparazione mostrata nella ricetta (es. «sempre cotto e senza sale»). |

**Prodotti concentrati**: fegato (`secreting_offal_liver`) e integratori di classe `iodine` (alghe) non vengono usati dal generatore finché non sono documentati i nutrienti determinanti: fegato → vitamina A (preformata o retinolo **e** beta-carotene) e rame; alghe → iodio.

Valori degli alimenti: **per 100 g di parte edibile, nello stato `processing_state`** (come si pesa), salvo `basis` diverso (sezione 4).

## 3. Campi dell’integratore

| Campo | Obbligo | Valori e note |
|---|---|---|
| `id`, `name_it` | come alimenti | Stesse regole, compreso il divieto `test_` / `[TEST]`. Un id non può essere già usato da un alimento. |
| `brand`, `product_variant`, `class` | facoltativi | Testo. La variante distingue prodotti simili (es. «Compensa» da «Compensa Crescita»). |
| `dose_unit` | sì | `g`, `ml`, `capsule`, `tablet`, `scoop`. |
| `content_mass_per_unit_g` | capsule, compresse, misurini | Massa del **contenuto** di una unità (es. olio nella capsula), in g. Ometterla se non è documentata. |
| `gross_mass_per_unit_g` | facoltativo | Massa dell’**unità intera con involucro**, in g. Ometterla se non è documentata: non si stima. |
| `kcal_per_unit` | facoltativo | kcal per una unità di dose. Se manca si stima solo dai macronutrienti dichiarati (tutti e tre), altrimenti resta sconosciuta. |
| `integer_dose` | facoltativo | `true`/`false`; predefinito `true` per capsule, compresse, misurini. |
| `max_daily_units` + `max_daily_source` | insieme | Dose massima giornaliera nell’unità di dose, con la sua fonte. |
| `dose_guide` | facoltativo | `{"points":[{"weight_kg":10,"min":1.5,"max":3}],"source":"…","note":"…"}`: fonte obbligatoria, 0 ≤ min ≤ max. Intervalli consigliati, non limiti tossicologici. |
| `label_source` | sì | Etichetta o scheda tecnica (fonte di ogni valore senza fonte propria). |
| `source_url` | facoltativo | Indirizzo della fonte. |
| `product_version` | per «Verificato» | Lotto o versione. |
| `data_status` | facoltativo | Qualità e provenienza dei dati: `unverified`, `estimated`, `review_required`. `verified` è un errore. |
| `label_added_only` | facoltativo | `true` se l’etichetta dichiara solo gli additivi aggiunti; si imposta da solo se un valore è `added`. |
| `usable_for_optimization` | facoltativo | `true`/`false` (predefinito `false`). |
| `notes` | facoltativo | Testo. |

Il vecchio campo `mass_per_unit_g` è un errore (ambiguo): usare `content_mass_per_unit_g` e/o `gross_mass_per_unit_g`.

Valori degli integratori: **per una unità di dose** (1 g, 1 ml, 1 capsula, 1 compressa, 1 misurino), salvo `basis` diverso.

## 4. Proprietà di ogni valore nutrizionale

| Proprietà | Obbligo | Valori e note |
|---|---|---|
| `value` | sì | Numero ≥ 0, oppure `"NA"` = non disponibile. |
| `unit` | con un numero | Unità di massa (`kg`, `g`, `mg`, `µg`) convertita automaticamente; `IU` per vitamine A, D, E. |
| `status` | con un numero | `measured` (analisi o banca dati), `label` (dichiarato in etichetta), `calculated` (calcolato: spiegare in `method`), `estimated` (stima), `analytical_zero` (zero documentato, solo con `value` 0). Nessun valore predefinito. |
| `source` | se diversa dal prodotto | Fonte del singolo valore. |
| `method` | facoltativo | Come è stato ottenuto (es. «per differenza»). |
| `form` | vitamina E in mg, cloruro di colina, calcio D-pantotenato | Forma chimica: `d_alpha_tocopherol` (1,49 UI/mg), `all_rac_alpha_tocopheryl_acetate` (1 UI/mg), `d_alpha_tocopheryl_acetate` (1,36 UI/mg), `choline_chloride` (× 0,746 → colina), `calcium_d_pantothenate` (× 0,92 → acido pantotenico, per `vitamin_b5`). Valore, unità e forma originali restano registrati. Per altri nutrienti la forma è solo registrata. |
| `basis` | facoltativo | Base del valore nella fonte. Alimenti: `per_100g` (predefinito), `per_kg`, `per_g`. Integratori: `per_dose` (predefinito), `per_kg`, `per_100g`, `per_g`. Va indicata esplicitamente: non si deduce mai da nome, note o confezione. |
| `basis_mass` | integratori in capsule/compresse/misurini con base per massa | `content` (riferita al contenuto: serve `content_mass_per_unit_g`) o `gross` (riferita all’unità intera: serve `gross_mass_per_unit_g`). Se la massa non è documentata: errore. Con dose in `ml` le basi per massa non sono ammesse (servirebbe la densità). |
| `per_dose` | facoltativo | Solo con base `per_dose`: numero di dosi a cui si riferisce il valore (es. `2` = valore per 2 capsule); l’app divide. |
| `declared_total_or_added` | integratori: sì | `total` = composizione analitica totale; `added` = quantità aggiunta (additivo). Si conserva così com’è. Negli alimenti solo `total` o assente. |

Si conservano sempre: valore e unità originali, forma chimica, base originale e la conversione applicata.

## 5. Dati mancanti, zeri e qualità

| Caso | Come scriverlo | Effetto |
|---|---|---|
| Nessuna modifica | nutriente omesso, oppure `"value": ""` | Il valore esistente resta com’è; in un prodotto nuovo resta sconosciuto. Mai zero. |
| Non disponibile | `"value": "NA"` | Il dato diventa sconosciuto (anche se prima c’era). |
| Zero documentato | `"value": 0` con `status` esplicito (`analytical_zero`, `label`, `measured` o `calculated`) e una fonte | Entra nei calcoli come zero. Uno zero `estimated` o senza stato è un errore. |
| `null` | — | Errore: usare `"NA"` oppure omettere. |

Quattro cose distinte, mai dedotte l’una dall’altra:

- **qualità e provenienza** dei dati (`status` e fonte di ogni valore, `data_status` del prodotto);
- **utilizzabilità** nella formulazione (`available_to_formulate` / `usable_for_optimization`);
- **completezza** del profilo (calcolata dall’app: Da completare, Dati parziali, Verificato);
- **convalida** di un amministratore nell’app (non si importa; decade a ogni modifica del profilo).

## 6. Categorie degli alimenti

| `category` | `subcategory` | Nome |
|---|---|---|
| animal | muscle | Carne muscolare |
| animal | heart | Cuore |
| animal | secreting_offal_liver | Frattaglie secernenti · fegato |
| animal | secreting_offal_kidney | Frattaglie secernenti · rene |
| animal | secreting_offal_spleen | Frattaglie secernenti · milza |
| animal | secreting_offal_other | Frattaglie secernenti · altre |
| animal | fish | Pesce |
| animal | egg | Uova |
| animal | animal_other | Altre fonti animali |
| starch | cereal | Cereali |
| starch | tuber | Tuberi |
| starch | legume | Legumi |
| vegetable | vegetable_generic | Verdure |
| other | fat_oil | Oli e grassi |
| other | other_generic | Altri alimenti (non classificati; es. voci vietate) |

## 7. Codici dei nutrienti

«Richiesto» = se manca, l’alimento resta «Dati parziali». L’energia **non** è un nutriente: va in `kcal_me_per_100g` o `kcal_per_unit`.

| Codice | Nome | Unità del catalogo | Gruppo | Note |
|---|---|---|---|---|
| `protein` | Proteine | g | Macronutrienti | richiesto |
| `fat` | Grassi totali | g | Macronutrienti | richiesto |
| `carbohydrate_available` | Carboidrati disponibili | g | Macronutrienti | facoltativo |
| `fiber` | Fibra alimentare | g | Macronutrienti | facoltativo |
| `moisture` | Umidità | g | Composizione | facoltativo |
| `linoleic_acid` | Acido linoleico omega-6 | g | Acidi grassi | richiesto |
| `ala` | Acido alfa-linolenico ALA | g | Acidi grassi | facoltativo |
| `epa` | EPA | g | Acidi grassi | facoltativo |
| `dha` | DHA | g | Acidi grassi | facoltativo |
| `epa_dha` | EPA + DHA | g | Acidi grassi | facoltativo: se manca si calcola da EPA + DHA |
| `omega3_total` | Omega-3 totali | g | Acidi grassi | facoltativo |
| `omega6_total` | Omega-6 totali | g | Acidi grassi | facoltativo |
| `arachidonic_acid` | Acido arachidonico | mg | Acidi grassi | facoltativo |
| `calcium` | Calcio | g | Minerali | richiesto |
| `phosphorus` | Fosforo | g | Minerali | richiesto |
| `potassium` | Potassio | g | Minerali | richiesto |
| `sodium` | Sodio | g | Minerali | richiesto |
| `chloride` | Cloruro | g | Minerali | richiesto |
| `magnesium` | Magnesio | g | Minerali | richiesto |
| `copper` | Rame | mg | Minerali | richiesto |
| `iodine` | Iodio | mg | Minerali | richiesto |
| `iron` | Ferro | mg | Minerali | richiesto |
| `manganese` | Manganese | mg | Minerali | richiesto |
| `selenium_wet` | Selenio (diete umide) | µg | Minerali | richiesto |
| `zinc` | Zinco | mg | Minerali | richiesto |
| `vitamin_a` | Vitamina A | IU | Vitamine e colina | richiesto; **solo la vitamina A preformata**, in UI. Il retinolo in µg va in `vitamin_a_retinol_ug` e il beta-carotene in `beta_carotene_ug`: il motore li converte (1 UI = 0,3 µg di retinolo, usato solo se manca la preformata in UI; 1 mg di beta-carotene = 833 UI). Non sommare le UI «per uso umano» da carotenoidi |
| `vitamin_d` | Vitamina D | IU | Vitamine e colina | richiesto; µg → UI × 40 automatico |
| `vitamin_e` | Vitamina E | IU | Vitamine e colina | richiesto; da mg serve `form` |
| `vitamin_b1` | Vitamina B1 / tiamina | mg | Vitamine e colina | richiesto |
| `vitamin_b2` | Vitamina B2 / riboflavina | mg | Vitamine e colina | richiesto |
| `vitamin_b3` | Vitamina B3 / niacina | mg | Vitamine e colina | richiesto |
| `vitamin_b5` | Vitamina B5 / acido pantotenico | mg | Vitamine e colina | richiesto |
| `vitamin_b6` | Vitamina B6 / piridossina | mg | Vitamine e colina | richiesto |
| `vitamin_b9` | Vitamina B9 / folati | µg | Vitamine e colina | richiesto |
| `vitamin_b12` | Vitamina B12 | µg | Vitamine e colina | richiesto |
| `choline` | Colina | mg | Vitamine e colina | richiesto; cloruro di colina con `form` = choline_chloride |
| `vitamin_c` | Vitamina C | mg | Vitamine informative | facoltativo |
| `vitamin_b7` | Biotina / vitamina B7 | µg | Vitamine informative | facoltativo |
| `vitamin_k` | Vitamina K | µg | Vitamine informative | facoltativo |
| `arginine` | Arginina | g | Aminoacidi | richiesto |
| `histidine` | Istidina | g | Aminoacidi | richiesto |
| `isoleucine` | Isoleucina | g | Aminoacidi | richiesto |
| `leucine` | Leucina | g | Aminoacidi | richiesto |
| `lysine` | Lisina | g | Aminoacidi | richiesto |
| `methionine` | Metionina | g | Aminoacidi | richiesto |
| `methionine_cystine` | Metionina + cistina | g | Aminoacidi | richiesto: se manca si calcola dalle due parti |
| `phenylalanine` | Fenilalanina | g | Aminoacidi | richiesto |
| `phenylalanine_tyrosine` | Fenilalanina + tirosina | g | Aminoacidi | richiesto: se manca si calcola dalle due parti |
| `threonine` | Treonina | g | Aminoacidi | richiesto |
| `tryptophan` | Triptofano | g | Aminoacidi | richiesto |
| `valine` | Valina | g | Aminoacidi | richiesto |
| `taurine` | Taurina | mg | Monitoraggio | facoltativo |
| `l_carnitine` | L-carnitina | mg | Monitoraggio | facoltativo |
| `cystine` | Cistina | g | Aminoacidi | facoltativo |
| `tyrosine` | Tirosina | g | Aminoacidi | facoltativo |
| `energy_food_kcal` | Energia alimentare (uomo, NON EM cane) | kcal | Solo fonte | solo dato di fonte, non entra nei calcoli |
| `carbohydrate_by_difference` | Carboidrati per differenza (fonte) | g | Solo fonte | solo dato di fonte, non entra nei calcoli |
| `c18_2_undifferentiated` | Acido grasso 18:2 non differenziato (fonte) | g | Solo fonte | solo dato di fonte, non entra nei calcoli |
| `c20_4_undifferentiated` | Acido grasso 20:4 non differenziato (fonte) | g | Solo fonte | solo dato di fonte, non entra nei calcoli |
| `vitamin_a_retinol_ug` | Retinolo (fonte, µg) | µg | Solo fonte | entra nei calcoli come vitamina A preformata (÷ 0,3) **solo se** `vitamin_a` manca |
| `vitamin_a_carotenoid_iu` | Vitamina A da carotenoidi (UI per uso umano) | IU (carotenoids; human labeling) | Solo fonte | solo dato di fonte, non entra nei calcoli |
| `beta_carotene_ug` | Beta-carotene (fonte) | µg | Fonte, convertito | entra nella vitamina A del cane: mg × 833 UI (FEDIAF 2025 tab. VII-14) |

## 8. Controlli prima del salvataggio

- Identificativi validi, non ripetuti, non `test_…`, non usati dall’altro catalogo; nomi presenti, unici, non `[TEST]…`.
- Campi e proprietà riconosciuti; categoria coerente; stato di preparazione valido; energia tra 0 e 900 kcal/100 g; masse e dosi > 0; dose massima con fonte; tabella d’impiego con fonte e 0 ≤ min ≤ max.
- Ogni numero con unità convertibile, stato valido e una fonte. Vitamina E in mg senza forma chimica approvata: **errore** (il valore non viene mai omesso in silenzio).
- Base quantitativa valida e, per capsule/compresse/misurini, massa di riferimento indicata e documentata.
- **Componenti rispetto al proprio totale** (tolleranza 5%): EPA + DHA ≤ EPA+DHA; ALA + EPA+DHA ≤ omega-3 totali; acido linoleico + arachidonico ≤ omega-6 totali; omega-3 + omega-6 ≤ grassi totali; aminoacidi essenziali ≤ proteine; metionina + cistina, fenilalanina + tirosina ≤ i loro totali. Le componenti non si sommano di nuovo al totale.
- **Massa complessiva** (ogni totale contato una sola volta): alimenti ≤ 105 g per 100 g e nessun nutriente oltre 100 g; integratori ≤ massa del contenuto della dose (+5%), o ≤ unità intera se è nota solo quella; contenuto ≤ unità intera; kcal per dose ≤ 9,5 × massa del contenuto.

## 9. Nuovi prodotti, aggiornamenti, prodotti già presenti

- Reimportare dati identici: prodotto «invariato», nessuna nuova versione, convalida mantenuta.
- Una modifica effettiva (valore, stato, fonte, forma, base, unità originale, campo del prodotto) è un aggiornamento: nuova versione, la precedente resta nello storico, la convalida decade e le ricette collegate risultano da aggiornare.
- Prodotti TEST (`test_…`, «[TEST] …»): non si creano né si modificano con l’importazione.
- Prodotti reali già presenti: per aggiornarli usare **lo stesso id**; un nome uguale con un id diverso è un errore (niente duplicati).

L’elenco completo degli identificativi già presenti (con dati, solo nome, vietati) è in `IDENTIFICATIVI_ESISTENTI.md`.

Un file che usa uno di questi id **aggiorna** quel prodotto: includerlo solo se si vogliono davvero sostituirne i dati.

## 10. Modelli

`alimenti.json`, `integratori.json` e `alimenti_v2.json` (allegati) contengono valori **di esempio** e mostrano tutti i casi: base per kg e per 100 g, dato non disponibile, zero documentato, stima, forma chimica, aggiunto/totale, capsula con massa del contenuto nota e massa lorda ignota. Sono stati importati senza errori e, reimportati, risultano invariati. `alimenti_v2.json` mostra i campi del 22/10 (resa di cottura con fonte, tetto per alimento, avvertenza) su un riso secco e un fegato di esempio.
