# Verifica di CATALOGO_CANI_UNICO_IMPORTABILE_2026-10-22.json — 22/10/2026

Solo verifica: il file **non è stato importato** e nessun dato dell'app è cambiato.

## 1. Esito generale

Il file è passato nell'importatore dell'app in modalità rigorosa, la stessa che si usa per le importazioni vere:

- formato, identificativi, unità e conversioni sono corretti: **0 errori, 0 conversioni in sospeso**;
- **94 alimenti nuovi** e **8 aggiornati**: olive_oil, coconut_oil, beef_03, beef_15, beef_30, oat_dry, carrot_cooked, pumpkin_cooked;
- negli aggiornamenti nessun valore già noto va perso; le kcal cambiano di pochissimo. L'olio d'oliva riceve le kcal (900) e diventa utilizzabile;
- dopo l'importazione: 101 profili «parziali» e 1 «da completare» (rapeseed_oil);
- l'energia dichiarata è coerente con proteine, grassi e carboidrati (4/9/4), tranne i casi del punto 2.4.

**Il file si può importare così com'è.** I problemi qui sotto non lo bloccano, ma alcuni falserebbero i calcoli (2.1) o lascerebbero grigi controlli importanti (2.2–2.3). Conviene correggerli prima.

## 2. Correzioni necessarie, per prodotto e campo

### 2.1 Da correggere prima dell'uso: vitamina A contata due volte (17 verdure)

**Prodotti:** sweet_potato, zucchini, broccoli, cauliflower, chard, spinach, green_bean, pea, celery, beetroot, cabbage, asparagus, lettuce, carrot_raw, zucchini_raw, carrot_cooked, pumpkin_cooked (tutte le varianti presenti nel file).

**Cosa succede:**
- `vitamin_a` (UI) contiene già il beta-carotene convertito (metodo «1 mg beta-carotene = 833 UI … solo beta-carotene»);
- `vitamin_a_retinol_ug` = 0;
- c'è anche `beta_carotene_ug`;
- il motore calcola *vitamina A preformata + beta-carotene × 0,833*, quindi il beta-carotene risulta **contato due volte**.

**Correzione:** in queste verdure `vitamin_a` deve essere **0**, cioè solo la vitamina A preformata, con `vitamin_a_retinol_ug` = 0 documentato. Il beta-carotene resta in `beta_carotene_ug`.

### 2.2 Acido linoleico assente in tutti i 102 prodotti

**Cosa manca:** `linoleic_acid` non è in nessun prodotto, nemmeno negli oli. C'è solo `c18_2_undifferentiated` (18:2 indifferenziato), per esempio girasole 65,7 g, lino 14,3 g, oliva 9,76 g.

**Conseguenze:**
- il linoleico resta grigio in ogni ricetta;
- nessun alimento nuovo può coprire il minimo FEDIAF del linoleico.

**Correzione:**
- servono i valori **18:2 n-6 c,c (linoleico)**, in USDA ID 1316, e **18:3 n-3 (ALA)**;
- se disponibili servono anche **omega-6 totali** e **omega-3 totali**;
- non si può copiare il 18:2 indifferenziato nel linoleico: non è la stessa cosa e il dato non si inventa.

### 2.3 Cloro e iodio assenti in tutti i prodotti

- **Effetto:** restano grigi in ogni ricetta. Lo iodio pesa anche sul controllo dei limiti legali quando c'è il QDiet.
- **Correzione:** se le banche dati non li riportano, vanno lasciati vuoti, come oggi. Segnalo solo che questi due nutrienti non saranno mai verificabili con questi alimenti.

### 2.4 Carboidrati mancanti con energia che non torna

| Prodotto | Campo | Problema | Correzione |
|---|---|---|---|
| rice_white_cooked | `carbohydrate_available`, `fiber` | mancano, ma l'energia è 130 kcal: macronutrienti + acqua = 71,2 g, **mancano circa 28,8 g** | inserire carboidrati e fibra (USDA li riporta). Mancano anche selenio, vitamina E e colina |
| cucumber_raw | `carbohydrate_available`, `fiber` | mancano; energia 15,9 kcal contro 4,1 da proteine e grassi | inserire carboidrati e fibra |
| beef_mid_10, pollock_raw, pollock_cooked | `carbohydrate_available` | mancano | probabilmente **0 documentato** (carne e pesce) |

### 2.5 Olio di colza incompleto

**Prodotto:** `rapeseed_oil`.

**Cosa manca:**
- `protein`: serve uno 0 documentato;
- altri 36 nutrienti richiesti;
- tutti gli acidi grassi.

**Effetto:** resta «da completare» e non utilizzabile.

### 2.6 Profili molto incompleti (utilizzabili, ma con molti valori grigi)

| Prodotto | Nutrienti richiesti mancanti | Quali, in sintesi |
|---|---|---|
| beef_mid_10, pollock_raw, pollock_cooked | 27 ciascuno | selenio, vitamine A, D, E, gruppo B, colina, aminoacidi essenziali |
| fennel_raw, fennel_steamed | 26 ciascuno | |
| cucumber_raw | 27 | |
| rabbit | rame, manganese, zinco e altri | |

### 2.7 Beta-carotene mancante: vitamina A non calcolabile

**Prodotti:** lamb_lean, lamb_medium, rabbit, horse, guinea_fowl, chicken_heart, lamb_heart, milze, polmone, pancreas, reni, buckwheat, millet, pasta dry, rice_white_cooked, salmon_oil, **lamb_liver_raw**.

**Effetto:**
- senza `beta_carotene_ug` la vitamina A totale è incompleta, quindi il controllo del **massimo** di vitamina A (livello A) diventa grigio;
- **lamb_liver_raw** resta escluso dalla generazione: per il fegato servono vitamina A completa e rame.

**Correzione:** se la fonte non riporta il beta-carotene ed è plausibile che sia zero (carni, oli di pesce), indicarlo come **0 documentato**, con una nota. Altrimenti lasciarlo vuoto.

### 2.8 Aminoacidi essenziali mancanti

**Prodotti:** beef_heart, beef_kidney, beef_tripe, flax_oil, salmon_oil, chard. Mancano i composti, per esempio metionina+cistina e fenilalanina+tirosina.

**Correzione:** per gli oli sono plausibili zeri documentati. Per cuore, rene e trippa servono i valori.

### 2.9 Altre lacune puntuali

- **vitamina D:** agnelli, organi, acciuga;
- **colina:** molti prodotti;
- **B5:** chicken_thigh, quinoa_cooked, lamb_spleen, horse, rabbit;
- **manganese:** sunflower_oil.

### 2.10 Cereali secchi senza resa di cottura

**Prodotti:** rice_white_dry, rice_brown_dry, buckwheat_dry, millet_dry, quinoa_dry, barley_dry, pasta_wheat_dry, oat_dry.

**Effetto:**
- senza `prepared_yield` (con fonte) i tetti in % del peso risultano «non verificabili»;
- funzionano comunque: esistono le versioni cotte.

**Correzione:** se volete usarli pesati secchi, aggiungete resa e fonte. La resa non si inventa.

### 2.11 Rapporto vitamina A UI / retinolo fuori tolleranza (prodotti animali)

| Prodotto | Rapporto | Atteso | Possibile causa |
|---|---|---|---|
| turkey_heart_raw | 1,14 | 1,00 | UI che includono carotenoidi «umani» |
| egg_yolk_raw | 1,16 | 1,00 | UI che includono carotenoidi «umani» |
| trout_cooked | 0,90 | 1,00 | arrotondamento |

L'atteso è UI = retinolo / 0,3. **Correzione:** controllare la fonte. Se le UI includono carotenoidi, lasciare solo il retinolo (`vitamin_a_retinol_ug`) e togliere `vitamin_a`: il motore lo ricava da sé.

## 3. Doppioni

### 3.1 Con alimenti già nell'app (stessa fonte USDA)

| Nuovo | Esistente | Fonte |
|---|---|---|
| beef_lean_5 | beef_05 | FDC 171790 |
| flax_oil | flaxseed_oil | FDC 167702 |

Con id diversi l'app li tratterebbe come due prodotti distinti. **Correzione:** usare gli id esistenti (`beef_05`, `flaxseed_oil`) oppure togliere i due nuovi. Nota: `flaxseed_oil` ha già il linoleico (14,246 g), il nuovo no.

`beef_mid_10` (FDC 2514743) **non** è un doppione di `beef_10` (FDC 174030): fonte diversa.

### 3.2 Dentro il file (stessi valori, nomi diversi)

| Coppia | Fonte | Valori diversi |
|---|---|---|
| potato_yellow_cooked / potato_white_cooked | FDC 170440 | 0 su 48 |
| sole_raw / plaice_raw | FDC 174196 | 0 su 49 |
| haddock_raw / white_fish_generic_reference | FDC 171964 | 0 su 49 (dichiarato «riferimento indicativo») |
| fennel_raw / fennel_steamed | FDC 2747655 | 0 su 16 (il «vapore» usa i valori del crudo) |
| green_bean_cooked / green_bean_steamed | FDC 169141 | 1 su 49 |
| pea_cooked / pea_steamed | FDC 170420 | 1 su 49 |

Non sono errori di formato, ma nella lista sembrerebbero alimenti diversi. Conviene tenerne uno per coppia, oppure scrivere chiaramente nel nome che è lo stesso profilo.

### 3.3 Vecchie voci con solo il nome

`lamb_meat`, `chicken_meat`, `rice`, `potato`, `cod`, `beef_liver`… restano nel catalogo accanto ai nuovi profili.
- Non sono usate per generare: hanno solo il nome.
- Affollano la lista.

Con l'integrazione si possono nascondere, senza cancellarle.

## 4. Modalità di integrazione consigliata: dentro l'app, con un aggiornamento

**Come funzionerebbe:**
1. Il file entra nel codice dell'app come «importazione inclusa», come i file del 16/10 e del 20/10.
2. A ogni avvio l'app lo applica con **lo stesso importatore** usato per le importazioni manuali, quindi con gli stessi controlli.
3. Pubblico un aggiornamento: all'avvio successivo l'iPhone lo scarica e il catalogo nuovo c'è. Tu non devi fare nulla.
4. Le modifiche fatte a mano sul telefono restano: hanno la precedenza.
5. Le ricette esistenti non cambiano. Quelle con alimenti aggiornati risultano «da ricalcolare» finché non le ricalcoli tu.

**Perché è meglio dell'importazione manuale dall'iPhone:**
- il catalogo fa parte dell'app e non dipende dalla memoria del telefono: se reinstalli l'app o cancelli i dati, torna da solo;
- prima di pubblicare lo collaudo qui: doppioni, prodotti utilizzabili, sconosciuti, menù v2 ricalcolati;
- le correzioni future si fanno con un nuovo file e un nuovo aggiornamento.

L'importazione manuale (Catalogo → Importa) resta disponibile per aggiunte veloci o prove. Se reinstalli l'app, però, quei dati vanno persi.

## 5. Modalità Prova → modalità locale normale

Bastano interventi sulle **scritte**, non serve spostare dati:
- il badge «PROVA» diventa per esempio «Dati su questo iPhone»;
- i testi di Impostazioni e della schermata iniziale non parlano più di prova;
- i dati di prova fittizi `[TEST]` (agnello, pollo, merluzzo, sardine, patata, riso, olio e integratori di prova) vengono **nascosti** dal catalogo: servono solo ai collaudi automatici;
- i dati restano dove sono, con lo stesso nome di archivio: cani, ricette e diario non si toccano;
- Supabase, backup e sincronizzazione non vengono toccati.
