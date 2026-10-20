# Anteprima dell’importazione

Generata con `npx tsx scripts/importa-pacchetto.ts`: importatore dell’app (`src/data/catalogImport.ts`), schema definitivo JSON, modalità strict.
Confronto con il catalogo attuale (pacchetto + importazioni del 16/10, cioè lo stato caricato in Supabase con `supabase/data/2026-10-16_*.sql`).
Nessuna ricetta, quantità o preferenza viene modificata; nessuna convalida viene attribuita (i valori aggiornati perdono la convalida).

## alimenti_esistenti_aggiornati.json (alimenti)

sha256 `41d447c8d3629033a82e9b4449869d30b6101316832796997a143125fb3b7f13` · 0 nuovi, 6 aggiornati, 0 invariati, 309 valori · errori 0 · avvisi 0 · conversioni in sospeso 0

| Prodotto | Azione | Utilizzabile nel calcolo | Stato dopo | Campi cambiati | Valori cambiati (prima → dopo, canonici) |
|---|---|---|---|---|---|
| beef_03 — Macinato di manzo crudo 3% grassi | aggiornato | sì | partial (3 nutrienti richiesti senza valore; 35 valori stimati o di qualità non dichiarata) | preparation, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g | EPA + DHA: — → 0 g; Vitamina A: — → 13,333333 IU; Vitamina D: 4 → 3 IU; Vitamina K: — → 0,1 µg; Metionina + cistina: — → 0,792 g; Fenilalanina + tirosina: — → 1,535 g; Beta-carotene (fonte): — → 0 µg |
| beef_15 — Macinato di manzo crudo 15% grassi | aggiornato | sì | partial (3 nutrienti richiesti senza valore; 37 valori stimati o di qualità non dichiarata) | preparation, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g | EPA + DHA: — → 0,003 g; Vitamina A: — → 13,333333 IU; Vitamina D: 4 → 3 IU; Vitamina K: — → 1,3 µg; Metionina + cistina: — → 0,669 g; Fenilalanina + tirosina: — → 1,297 g; Beta-carotene (fonte): — → 0 µg |
| beef_30 — Macinato di manzo crudo 30% grassi | aggiornato | sì | partial (3 nutrienti richiesti senza valore; 35 valori stimati o di qualità non dichiarata) | preparation, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes | EPA + DHA: — → 0 g; Vitamina A: — → 13,333333 IU; Vitamina D: 4 → 3 IU; Vitamina K: — → 2,9 µg; Metionina + cistina: — → 0,517 g; Fenilalanina + tirosina: — → 1 g; Beta-carotene (fonte): — → 0 µg |
| oat_dry — Avena in fiocchi secca non fortificata | aggiornato | sì | partial (3 nutrienti richiesti senza valore; 32 valori stimati o di qualità non dichiarata) | processingState, preparation, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g | EPA + DHA: — → 0 g; Vitamina A: — → 0 IU; Vitamina K: — → 2 µg; Metionina + cistina: — → 0,662 g; Fenilalanina + tirosina: — → 1,06 g; Acido grasso 20:4 non differenziato (fonte): — → 0 g; Retinolo (fonte, µg): — → 0 µg; Beta-carotene (fonte): — → 0 µg |
| carrot_cooked — Carota cotta al vapore (proxy USDA bollita) | aggiornato | sì | partial (4 nutrienti richiesti senza valore; 35 valori stimati o di qualità non dichiarata) | preparation, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g | EPA + DHA: — → 0 g; Vitamina K: — → 13,7 µg; Metionina + cistina: — → 0,085 g; Fenilalanina + tirosina: — → 0,085 g; Acido grasso 20:4 non differenziato (fonte): — → 0 g; Retinolo (fonte, µg): — → 0 µg |
| pumpkin_cooked — Zucca cotta al vapore (proxy USDA bollita) | aggiornato | sì | partial (4 nutrienti richiesti senza valore; 35 valori stimati o di qualità non dichiarata) | preparation, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g | Carboidrati disponibili: 3,79 → 3,8 g; EPA: — → 0 g; DHA: — → 0 g; EPA + DHA: — → 0 g; Vitamina D: — → 0 IU; Vitamina E: 1,5794 → 1,192 IU; Vitamina B9 / folati: 8,5 → 9 µg; Vitamina B12: — → 0 µg; Colina: — → 6,2 mg; Vitamina K: — → 0,8 µg; Metionina + cistina: — → 0,01 g; Fenilalanina + tirosina: — → 0,053 g; Carboidrati per differenza (fonte): 4,89 → 4,9 g; Acido grasso 20:4 non differenziato (fonte): — → 0 g; Retinolo (fonte, µg): — → 0 µg; Vitamina A da carotenoidi (UI per uso umano): 1082 → 5755 IU (carotenoids; human labeling); Beta-carotene (fonte): — → 2096 µg |

SQL: `supabase/data/2026-10-20/01_alimenti_esistenti_aggiornati.sql`

## alimenti_nuovi_confronto.json (alimenti)

sha256 `dd4f4af6f9f3e9fada6b11e145e94d7ae0ca59236ac9c8d6305bdf5a8b677d57` · 4 nuovi, 0 aggiornati, 0 invariati, 195 valori · errori 0 · avvisi 0 · conversioni in sospeso 0

| Prodotto | Azione | Utilizzabile nel calcolo | Stato dopo | Campi cambiati | Valori cambiati (prima → dopo, canonici) |
|---|---|---|---|---|---|
| beef_05 — Macinato di manzo crudo 5% grassi — proxy USDA | nuovo | no | partial (3 nutrienti richiesti senza valore; 35 valori stimati o di qualità non dichiarata) | name, categoryId, subcategoryId, processingState, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g, dataStatus | 52 valori |
| beef_10 — Macinato di manzo crudo 10% grassi — proxy USDA | nuovo | no | partial (3 nutrienti richiesti senza valore; 35 valori stimati o di qualità non dichiarata) | name, categoryId, subcategoryId, processingState, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g, dataStatus | 52 valori |
| coconut_oil — Olio di cocco alimentare — proxy USDA | nuovo | no | partial (2 nutrienti richiesti senza valore; 10 valori stimati o di qualità non dichiarata) | name, categoryId, subcategoryId, processingState, preparation, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g, dataStatus | 53 valori |
| flaxseed_oil — Olio di lino alimentare spremuto a freddo — proxy USDA | nuovo | no | partial (15 nutrienti richiesti senza valore; 10 valori stimati o di qualità non dichiarata) | name, categoryId, subcategoryId, processingState, preparation, ediblePortion, meMethod, source, sourceUrl, sourceVersion, uncertainty, notes, kcalMePer100g, dataStatus | 38 valori |

SQL: `supabase/data/2026-10-20/02_alimenti_nuovi_confronto.sql`

## integratori_riferimento_19ott.json (integratori)

sha256 `56a4357c6c869c4712b23f996eafa7169eb08d206b2ab33cde86aa809f22b346` · 0 nuovi, 3 aggiornati, 0 invariati, 41 valori · errori 0 · avvisi 0 · conversioni in sospeso 0

| Prodotto | Azione | Utilizzabile nel calcolo | Stato dopo | Campi cambiati | Valori cambiati (prima → dopo, canonici) |
|---|---|---|---|---|---|
| qdiet — Q.Diet Compensa (standard, NON Crescita/Ultra) | aggiornato | sì | partial (lacuna non risolta: B5 come sale e colina da cloruro di colina richiedono documentazione chimica; additivi dichiarati solo come aggiunti (totale incerto); profilo segnalato da rivedere) | brand, variant, labelSource, sourceUrl, version, notes, dataStatus, doseGuide, usableForOptimization | Fibra alimentare: 0,0001 → — (sconosciuto) |
| omegor_vitality — Omegor Vitality 1000 (capsula) | aggiornato | sì | partial (1 valori stimati o di qualità non dichiarata; profilo dichiarato come stima) | brand, labelSource, sourceUrl, version, notes, dataStatus, massPerUnitG, kcalPerUnit, usableForOptimization, labelAddedOnly | EPA + DHA: — → 0,803 g [total] |
| bone_meal — Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) | aggiornato | sì | partial (lacuna non risolta: variante trascritta dall’utente (Ca 22,6%, P 17,7%) diversa dal profilo attuale del produttore: confermare la confezione reale; energia ignota (non zero); profilo segnalato da rivedere) | name, brand, variant, labelSource, sourceUrl, version, notes, dataStatus, usableForOptimization, labelAddedOnly | Fibra alimentare: 0,003 → — (sconosciuto) |

SQL: `supabase/data/2026-10-20/03_integratori_riferimento_19ott.sql`

## psillio_confronto.json (integratori)

sha256 `b717e7f0e85edebb1e7b1dba74677ecf6ff43b95b501850f954089639c67451b` · 1 nuovi, 0 aggiornati, 0 invariati, 5 valori · errori 0 · avvisi 0 · conversioni in sospeso 0

| Prodotto | Azione | Utilizzabile nel calcolo | Stato dopo | Campi cambiati | Valori cambiati (prima → dopo, canonici) |
|---|---|---|---|---|---|
| psyllium_erbavoglio_husk_bio — Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) | nuovo | no | partial (profilo segnalato da rivedere; non ancora convalidato da un amministratore) | name, brand, variant, supplementClass, labelSource, sourceUrl, version, notes, dataStatus, labelAddedOnly | 5 valori |

SQL: `supabase/data/2026-10-20/04_psillio_confronto.sql`

