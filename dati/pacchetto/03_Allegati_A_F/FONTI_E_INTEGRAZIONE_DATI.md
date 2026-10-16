# Fonte alimenti, integratori e qualità dei dati

**Fonti suggerite:** USDA FoodData Central (FDC), banca dati CREA Alimenti e schede ufficiali del produttore con versione/lotto. Le linee guida FEDIAF forniscono i **fabbisogni**, non il database della composizione degli ingredienti.

- USDA FDC: https://fdc.nal.usda.gov/download-datasets/ (Foundation Foods release aprile 2026 disponibile; CSV/JSON); https://fdc.nal.usda.gov/api-guide/ . Le categorie Foundation, SR Legacy e Branded non sono equivalenti: conservare `data_type`, `fdc_id`, data, alimento e forma descritta.
- Per ogni alimento: definire **taglio**, percentuale di grasso se possibile, crudo/cotto, componente commestibile, unità e identificativo esatto della fonte. La carne macinata del macellaio priva di analisi è **stima**, non equivalente a macinato standard di preciso tenore lipidico.
- Gli alimenti preparati richiedono peso di partenza, resa dopo cottura e eventuali fattori di ritenzione: non cambiare 'crudo' in 'cotto' modificando solo l'etichetta.
- Non confondere energia generale per uomo e energia metabolizzabile del cane; usare una modalità di calcolo dog-specific documentata e validata o fonte già adatta, senza fare affidamento su conversioni non approvate.
- Regola campi nutrienti: `source_value`, `source_unit`, `source_basis`, `canonical_value`, `canonical_unit`, `conversion_rule`, `data_quality`, `verified_by`, `verified_at`, `source_url`, `source_version`.
- Integratori: usare **esatta variante** e dose per capsula/g/ml; Q-Diet, Omegor e farina d'ossa hanno composizioni dipendenti dal prodotto. Se l'etichetta dichiara soltanto quantità aggiunte, non trattarle come analisi completa dei micronutrienti. Il valore 0 è consentito soltanto se la fonte supporta proprio 0.
- Non tutte le fonti riportano cloruro, iodio, taurina, L-carnitina o tutti gli aminoacidi; avvisare per mancanze materiali.
- Eventuali riferimenti legali UE per additivi sono **distinti** dai massimi nutrizionali FEDIAF: alcuni espressi per kg di alimento 12% umidità o per sostanza secca, forma chimica, classe di mangime, legislazione vigente. `B` deliberatamente non riporta numeri legali senza verifica normativa puntuale.
- Qualora l'AI sviluppatrice sia connessa a internet, può proporre importazione da FDC (con mapping manualmente approvabile), ma **non autocertificare** che i dati caricati siano completi. Tracciare tutti i `fdc_id` e revisioni.

## Cosa serve dall'utente prima dei primi menu reali
1. Etichetta integrale/composizione o scheda tecnica verificabile di Q-Diet, Omegor (variante), farina d'ossa.
2. Descrizione e, se possibile, analisi della carne macinata (tenore di grasso), altrimenti selezione consapevole di profilo stimato con grado di incertezza.
3. Formulazione veterinaria attuale per confronto e validazione.
4. Eventuali target macro personalizzati e/o clinici firmati dalla professionista.

**Blocchi di rilascio**: finché manca il mapping ingredienti o etichette, app navigabile e testabile ma formule reali = NON VALIDATE, non 'complete'.
