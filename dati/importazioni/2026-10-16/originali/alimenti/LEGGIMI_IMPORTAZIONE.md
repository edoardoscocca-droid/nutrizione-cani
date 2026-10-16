# Prima banca dati – menù principale Garm/Ker (16 ottobre 2026)

## Che cosa contiene
- `D_catalogo_sei_alimenti.csv`: sei ingredienti identificati da ID stabili suggeriti.
- `D_composizione_sei_alimenti.csv`: matrice lunga alimento × nutriente per tutti i parametri del precedente dataset FEDIAF, più alcune voci di fonte (es. vitamina A carotenoidi). Celle senza valore sono **sconosciute**, non zero.
- `D_anteprima_macronutrienti.csv`: sintesi leggibile per un controllo rapido.

## Precauzioni obbligatorie dell'importatore
1. Gli ID qui proposti devono essere mappati agli ID reali di Supabase tramite chiavi stabili e upsert transazionale. **Non importare alla cieca senza controllare le colonne dello schema creato dall'AI.**
2. I valori dei micronutrienti sono valori **tipici USDA di alimenti**, NON analisi del lotto effettivo (soprattutto il macinato del macellaio). I tre profili 3%, 15%, 30% sono categorie indicative.
3. `energy_food_kcal` è energia alimentare convenzionale umana. **Non mappare a `metabolizable_energy`** senza metodo ME cane validato. Valori USDA non equivalgono automaticamente a energia metabolizzabile del cane.
4. Acido linoleico: la fonte riporta 18:2 **undifferentiated**. Conservare `c18_2_undifferentiated` distinto da `linoleic_acid` finché non si valida l'identificazione chimica. Analogo per 20:4 / arachidonico. Alcuni omega-3/omega-6 totali non sono ricostruibili da una somma parziale: **rapporto omega6:omega3 NON validato**.
5. Vitamina A: i carotenoidi delle verdure sono riportati come IU secondo convenzioni nutrizionali umane; **non convertirli 1:1 in UI equivalenti al retinolo per cani**, né considerarli sufficienti per il requisito FEDIAF.
6. Vitamina E in mg alfa-tocoferolo, mentre il file FEDIAF usa IU: servono conversioni fondate sulla forma. La vitamina D è in µg: le conversioni in IU vanno fatte senza arrotondamenti inconsistenti.
7. Frutta/verdure crude vs cotte: carota USDA bollita è solo un'approssimazione per vapore. Per la zucca la cottura al vapore è confermata dall’utente; il profilo nutrizionale usa provvisoriamente una zucca bollita USDA come proxy (cultivar da chiarire).
8. Avena: la quantità si immette **in grammi secchi prima dell'ammollo**, se l'acqua non viene scolata; non usare peso idratato nella moltiplicazione. Se si perde acqua con soluti o si cuoce cambia il profilo da verificare.
9. Campo `nutrition_status=PARTIAL_RESEARCH` per rappresentare dati parziali o proxy, e `available_to_formulate=true` per consentire la selezione di tutti e sei gli alimenti nelle proposte di ricetta. **Essere selezionabile non equivale a essere completamente verificato**: i nutrienti ignoti restano ignoti e la ricetta non può essere certificata completa se mancano dati indispensabili. L’app deve applicare la stima ME canina prevista dal proprio motore prima di usare l’energia come vincolo.
10. Congelamento non elimina tutti i patogeni dei prodotti crudi. Il trattamento con abbattimento/congelamento non rende la carne cruda sterilizzata.

## Fonti di partenza (schede USDA SR Legacy ripubblicate)
- Manzo crudo 3%: https://whatyoueat.io/foods/173111-ground-beef-97-lean — FDC 173111
- Manzo crudo 15%: https://whatyoueat.io/foods/171796-ground-beef-85-lean — FDC 171796
- Manzo crudo 30%: https://whatyoueat.io/foods/168652-ground-beef-70-lean — FDC 168652
- Avena fiocchi secca non fortificata: https://whatyoueat.io/foods/173904-unfortified-oats — FDC 173904
- Carota cotta bollita scolata: https://whatyoueat.io/foods/170394 — FDC 170394
- Zucca cotta bollita scolata: https://www.cooks.com/rec/nutrition?nwal=11423 — USDA NDB 11423, FDC 168449
- Fonte primaria: https://fdc.nal.usda.gov/

Questi valori non rendono automaticamente completa o sicura una ricetta casalinga; richiedono la verifica della composizione degli integratori e le correzioni per disponibilità/digeribilità.
