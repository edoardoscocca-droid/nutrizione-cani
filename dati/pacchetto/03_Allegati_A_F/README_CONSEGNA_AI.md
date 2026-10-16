# PACCHETTO FINALE — ALLEGATI A–F, MOTORE E CATALOGHI
**Data:** 16 ottobre 2026 · **Destinatario:** AI sviluppatrice e responsabile tecnico

## Consegna completa in tre parti
1. `Specifiche_App_Nutrizione_Cani_v1.md` — requisiti e UX.
2. `Pacchetto_FEDIAF_Nutrizione_Cani_2025.zip` — valori minimi/massimi FEDIAF 2025, guida, JSON, CSV.
3. **Questo ZIP** — allegati A–F, cataloghi iniziali, regole, SQL di riferimento e test.

**ISTRUZIONE:** i tre elementi vanno forniti insieme. Questo archivio integra, non sostituisce, il precedente dataset FEDIAF. Gli ID nutrienti dei file A/C/D/E/F devono essere risolti contro il file FEDIAF JSON.

## Significato di completo
Completo come **specifica implementativa, strutture e test**: consente di programmare UI, Supabase, flussi e solver senza inventare logica. **Non completo come catalogo analitico pronto a prescrivere ricette**: non sono disponibili composizioni verificate per ogni alimento, né l'etichetta completa dei singoli Q-Diet/Omegor/farina d'ossa. I record senza valori certificati devono restare `NOT_VERIFIED`, quindi inutilizzabili per il calcolo di ricette dichiarate complete. Questa è una barriera di qualità deliberata, non un invito a inferire numeri.

## Mappatura allegati
- **A** `A_dizionario_nutrienti.json`: codici e unità; popolazione dal dataset FEDIAF.
- **B** `B_standard_estensioni_e_limiti_legali.json`: ambito e limiti legali da verificare; i min/max FEDIAF sono nel precedente ZIP.
- **C** `C_target_e_semaforo.json`: alert, soglie personali e semantica dei livelli; NON presentare soglie nostre come normative.
- **D** `D_catalogo_alimenti_seed.json/.csv` + template: categorie, sottocategorie, frattaglie e prodotti iniziali; composizioni da importare verificandole.
- **E** `E_catalogo_integratori_seed.json/.csv` + template: integratori iniziali, DISABLED fino a inserimento etichette valide.
- **F** `F_modello_formulazione_e_regole.json`: vincoli, obiettivi, energie, rapporti, aggiornamenti.
- **ALTRO** `supabase_schema.sql`, `TEST_accettazione.csv`, `FONTI_E_INTEGRAZIONE_DATI.md`, `INCARICO_OPERATIVO_PER_AI.md`.

## Ordine raccomandato
1. Importare standard FEDIAF e A usando ID stabili; realizzare RLS e schema.
2. Realizzare editing solo da Supabase per alimenti, integratori, standard. I prezzi privati editabili nell'app.
3. Implementare RER/MER, profilo cane, 10 ricette, preferenze macro, formula delle somme e rapporti.
4. Implementare optimizer con report di fattibilità, stima preliminare integratori e controllo indipendente.
5. Agganciare D ed E ai dati reali verificati e testare 3 diete campione validate da un nutrizionista.
6. Bloccare 'ricetta verificata' se nutrienti critici o integratori non sono completamente documentati.

## Principi non negoziabili
- `null ≠ 0`; un range non ufficiale non è un limite tossicologico.
- L'intervallo Ca:P 1,2–1,4 è **preferenza nostra da rivedere**, non il limite FEDIAF.
- Proteine/grassi/carboidrati: percentuali **di energia**, non di peso ingrediente.
- Omega-6/omega-3 richiede profili completi, non un rapporto forzato o doppi conteggi.
- Supplementi entrano nel solver come variabili simultanee, non a correzione iterativa senza limite.
- Se il prodotto non è caratterizzato, non stimare quantità e non dichiarare copertura completa.
- Nessuna diagnosi o prescrizione clinica derivata da app generica.
