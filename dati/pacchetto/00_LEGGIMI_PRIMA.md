# CONFEZIONE COMPLETA - APP NUTRIZIONE CANI

Questo archivio contiene FILE DIRETTAMENTE VISIBILI, senza ZIP annidati.

## Indice
- `01_Specifiche_App_Nutrizione_Cani.md`: specifica dell’app.
- `02_Riferimenti_FEDIAF/`: guida, JSON e CSV di riferimento.
- `03_Allegati_A_F/`: dizionario nutrienti (A), integrazioni standard (B), soglie (C), alimenti (D), integratori (E), formulazione (F), schema SQL, test e incarico per l’AI.

## IMPORTANTE: cosa NON è compilato
I file `D_catalogo_alimenti_seed.*` elencano alimenti ma NON contengono profili completi validati. Il file `D_template_composizione_alimenti.csv` è un MODELLO vuoto per i valori per 100 g.
I file `E_catalogo_integratori_seed.*` elencano prodotti ma NON contengono tutte le composizioni certificate di Q-Diet, Omegor o farina d’ossa. `E_template_composizione_integratori.csv` è un MODELLO vuoto.
Il file `F_modello_formulazione_e_regole.json` espone REGOLE e requisiti del calcolo, non un motore software già eseguibile.
Non presentare questi dati come completati o come prescrizioni. L’app può essere sviluppata, ma la validazione delle ricette reali richiede i profili mancanti e i necessari controlli veterinari.

## Ordine di lettura per l’AI
1. Specifiche; 2. `03_Allegati_A_F/README_CONSEGNA_AI.md`; 3. riferimenti FEDIAF; 4. allegati A–F; 5. SQL e test.
