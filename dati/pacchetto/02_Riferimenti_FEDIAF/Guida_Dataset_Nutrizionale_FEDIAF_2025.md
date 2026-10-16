# Dataset nutrizionale generale — cane adulto mantenimento
**Versione 1.0 · 16 ottobre 2026**

**Fonte primaria:** [FEDIAF Nutritional Guidelines 2025](https://europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025-ONLINE.pdf), tabella III-3b, p. 16 del PDF. Alla data della verifica, il sito ufficiale pubblica la versione 2025.

> **IMPORTANTE:** Questo dataset contiene i valori di riferimento FEDIAF per il cane adulto sano in mantenimento, colonna **95 kcal/kg^0,75** e unità **per 1.000 kcal di energia metabolizzabile**. Non vale automaticamente per cuccioli, gestazione, lattazione o condizioni cliniche. Non costituisce una validazione di diete domestiche.

## 1. Tabella dei parametri

| Nutriente | Unità / 1000 kcal | Minimo FEDIAF | Max nutrizionale FEDIAF | Tipo |
|---|---|---:|---:|---|
| Proteine | g | 52,1 | — (non definito) | core |
| Grassi totali | g | 13,75 | — (non definito) | core |
| Carboidrati disponibili | g | — (non definito) | — (non definito) | descriptive |
| Fibra alimentare | g | — (non definito) | — (non definito) | descriptive |
| Umidità | g | — (non definito) | — (non definito) | descriptive |
| Acido linoleico omega-6 | g | 3,82 | — (non definito) | core |
| Acido alfa-linolenico ALA | g | — (non definito) | — (non definito) | descriptive |
| EPA | g | — (non definito) | — (non definito) | descriptive |
| DHA | g | — (non definito) | — (non definito) | descriptive |
| EPA + DHA | g | — (non definito) | — (non definito) | descriptive |
| Omega-3 totali | g | — (non definito) | — (non definito) | descriptive |
| Omega-6 totali | g | — (non definito) | — (non definito) | descriptive |
| Acido arachidonico | mg | — (non definito) | — (non definito) | descriptive |
| Calcio | g | 1,45 | 6,25 | core |
| Fosforo | g | 1,16 | 4,0 | core |
| Potassio | g | 1,45 | — (non definito) | core |
| Sodio | g | 0,29 | — (non definito) | core |
| Cloruro | g | 0,43 | — (non definito) | core |
| Magnesio | g | 0,2 | — (non definito) | core |
| Rame | mg | 2,08 | — (non definito) | core |
| Iodio | mg | 0,3 | — (non definito) | core |
| Ferro | mg | 10,4 | — (non definito) | core |
| Manganese | mg | 1,67 | — (non definito) | core |
| Selenio (diete umide) | µg | 67,5 | — (non definito) | core |
| Zinco | mg | 20,8 | — (non definito) | core |
| Rapporto calcio/fosforo | ratio | 1 | 2 | derived |
| Vitamina A | IU | 1754 | 100000 | core |
| Vitamina D | IU | 159 | 800 | core |
| Vitamina E | IU | 10,4 | — (non definito) | core |
| Vitamina B1 / tiamina | mg | 0,62 | — (non definito) | core |
| Vitamina B2 / riboflavina | mg | 1,74 | — (non definito) | core |
| Vitamina B3 / niacina | mg | 4,74 | — (non definito) | core |
| Vitamina B5 / acido pantotenico | mg | 4,11 | — (non definito) | core |
| Vitamina B6 / piridossina | mg | 0,42 | — (non definito) | core |
| Vitamina B9 / folati | µg | 74,7 | — (non definito) | core |
| Vitamina B12 | µg | 9,68 | — (non definito) | core |
| Colina | mg | 474 | — (non definito) | core |
| Vitamina C | mg | — (non definito) | — (non definito) | descriptive |
| Biotina / vitamina B7 | µg | — (non definito) | — (non definito) | descriptive |
| Vitamina K | µg | — (non definito) | — (non definito) | descriptive |
| Arginina | g | 1,51 | — (non definito) | advanced |
| Istidina | g | 0,67 | — (non definito) | advanced |
| Isoleucina | g | 1,33 | — (non definito) | advanced |
| Leucina | g | 2,37 | — (non definito) | advanced |
| Lisina | g | 1,22 | — (non definito) | advanced |
| Metionina | g | 1,16 | — (non definito) | advanced |
| Metionina + cistina | g | 2,21 | — (non definito) | advanced |
| Fenilalanina | g | 1,56 | — (non definito) | advanced |
| Fenilalanina + tirosina | g | 2,58 | — (non definito) | advanced |
| Treonina | g | 1,51 | — (non definito) | advanced |
| Triptofano | g | 0,49 | — (non definito) | advanced |
| Valina | g | 1,71 | — (non definito) | advanced |
| Taurina | mg | — (non definito) | — (non definito) | informational |
| L-carnitina | mg | — (non definito) | — (non definito) | informational |
| Quota energia da proteine | % | — (non definito) | — (non definito) | derived |
| Quota energia da grassi | % | — (non definito) | — (non definito) | derived |
| Quota energia da carboidrati disponibili | % | — (non definito) | — (non definito) | derived |
| Rapporto omega-6/omega-3 | ratio | — (non definito) | — (non definito) | derived |
| Energia metabolizzabile | kcal | — (non definito) | — (non definito) | composition |

## 2. Interpretazione dei limiti
- **Minimo FEDIAF:** il valore della colonna 95 kcal/kg^0,75 è un livello raccomandato per alimenti completi, non un esperimento sul fabbisogno di uno specifico cane.
- **Massimo nutrizionale FEDIAF:** solo ove indicato; ad esempio calcio 6,25 g/1000 kcal, fosforo 4,00 g/1000 kcal, vitamina A 100.000 IU/1000 kcal, vitamina D 800 IU/1000 kcal, rapporto Ca:P 2:1.
- **Massimi legali UE:** **NON sono caricati come numeri** nel JSON poiché richiedono una tabella apposita, conversioni sulla sostanza secca, verifica della disciplina vigente e spesso condizioni sulla forma dell’additivo. Non assumere che il massimo nutrizionale sostituisca il limite legale.
- **Massimo non definito NON significa innocuo senza limiti:** evitare messaggi “nessun problema”. Non autorizzare valori elevati come automaticamente sicuri.
- **Soglie arancioni non ufficiali:** non ne inventiamo numericamente in questo file. La relativa struttura è prevista; saranno definite e documentate in un dataset differente dopo verifica. Una soglia nostra è un indicatore di attenzione, non una soglia tossicologica.
- **Biotina e vitamina K:** il trattino in FEDIAF tabella III-3b non autorizza a trattare questi nutrienti come superflui in ogni condizione.

## 3. Controlli e calcoli per l’AI sviluppatrice
1. Per un cane con K kcal/die: `minimo_giornaliero = minimo_per_1000_kcal × K / 1000`.
2. I dati degli ingredienti devono dichiarare se riferiti a crudo, cotto, essiccato e parte edibile. I valori assenti sono `null`, mai zero.
3. Sommare tutti gli ingredienti **e integratori** contemporaneamente, inclusi calcio e fosforo forniti dalla farina d’ossa e vitamine/minerali dei multivitaminici.
4. Il rapporto Ca:P deve essere verificato insieme ai due minimi assoluti; un rapporto corretto da solo non basta.
5. Gli aminoacidi essenziali sono presenti come modulo avanzato obbligatoriamente riconosciuto: se mancano i dati, il controllo della qualità proteica resta non verificabile.
6. Assicurare unità coerenti: mg, µg, g, IU (conversioni solo per forma chimica appropriata).
7. Le percentuali di energia P/G/C sono target configurabili, **non** massimi o minimi FEDIAF. Non confondere percentuali energetiche con percentuali di ingredienti.
8. Soglie arbitrarie o basate su semplici moltiplicatori del minimo non devono provocare classificazioni di tossicità o eccesso accertato.
9. La verifica finale indipendente ricalcola tutti i valori della ricetta proposta e conserva versione dei dati/sorgenti.

## 4. Note FEDIAF importanti da implementare
- Per il **selenio**, la tabella differenzia diete umide e secche: qui è precaricato **67,50 µg/1.000 kcal per diete umide**; per diete secche **55,00 µg/1.000 kcal**. Implementare selezione della base appropriata, senza utilizzare automaticamente il valore delle diete umide per tutte le ricette.
- FEDIAF riporta nella nota c livelli di **sodio fino a 3,75 g/1.000 kcal** e **cloruro fino a 5,87 g/1.000 kcal** considerati sicuri per cani sani; NON sono indicati come massimi nutrizionali universali e non devono essere applicati indiscriminatamente alle diete cliniche.
- FEDIAF riporta una specifica nota per il **fosforo inorganico** e per la sua biodisponibilità; in presenza di integratori di fosforo e condizioni renali, occorre controllo clinico.
- **Vitamina E e grassi polinsaturi:** controllare le note tecniche FEDIAF e le forme chimiche, oltre al numero di base.
- **Taurina e L-carnitina:** nessun target ufficiale minimo/massimo per cane adulto in III-3b; per Irish Wolfhound visualizzare attenzione individuale, senza generare soglie o supplementazione automatica.
- **Percentuale carboidrati = 0** non equivale a dieta BARF; stato crudo/cotto e sicurezza sono attributi dei singoli alimenti.

## 5. Struttura file dati
- `FEDIAF_2025_cane_adulto_nutrienti.json`: dataset strutturato e istruzioni computazionali, destinato all’importazione da parte dell’AI sviluppatrice.
- `FEDIAF_2025_cane_adulto_nutrienti.csv`: tabella importabile, con identificativi stabili.
- I limiti legali UE, i target arancioni convalidati, i valori analitici degli alimenti e le composizioni degli integratori richiedono **dataset separati**.

## 6. Provenienza e data
Fonte FEDIAF settembre 2025, tabella III-3b, pagina 16 e note pagina 21 del PDF. Data verifica: 16 ottobre 2026. URL ufficiale: https://europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025-ONLINE.pdf

**Non utilizzare questo documento come sostituto della consultazione integrale delle linee guida.**