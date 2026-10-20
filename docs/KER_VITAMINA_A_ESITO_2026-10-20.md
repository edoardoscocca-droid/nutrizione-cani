# Vitamina A da beta-carotene: effetto su prescrizione e generatore (caso di Ker, 20/10/2026)

Dettagli generati dall’app:
- `docs/VERIFICA_KER_2026-10-20.md`: analisi della prescrizione;
- `docs/GENERATORE_KER_2026-10-20.md`: generatore.

Unica modifica dei criteri rispetto alla prova precedente: la conversione del beta-carotene.

Invariati:
- obiettivo 1.340 kcal;
- profilo FEDIAF 95;
- limite della tabella d’impiego di QDiet nel generatore;
- 13 g esatti nell’analisi della prescrizione;
- preferenze iniziali dell’adulto sano (nessuna preferenza clinica inventata per Ker);
- nessuna ricetta salvata modificata.

## 1. Come è implementata (vale per tutto il generatore)

- **Formula**: vitamina A del cane = vitamina A preformata (dato `vitamin_a`, retinolo ed esteri, UI) + beta-carotene (dato
  `beta_carotene_ug`, in µg) / 1000 × 833.
- **Fonte**: FEDIAF 2025, tab. VII-14, p. 63. Il fattore è definito una sola volta (`src/engine/vitaminA.ts`) e usato sia dalla
  verifica sia dal generatore, per qualunque alimento o integratore.
- **Specie**: il fattore è per il cane. L’app formula solo per cani; per un eventuale gatto non va applicato.
- **Dati di fonte invariati**: il beta-carotene resta il dato originario USDA (carota 8.332 µg/100 g, FDC 170394; zucca 2.096 µg/100 g,
  FDC 168449: valori dei profili USDA, non analisi delle verdure somministrate).
- **Parti separate**: nella verifica la riga «Vitamina A» mostra come si forma il totale: preformata, beta-carotene in mg × 833, parti
  sconosciute.
- **Parti sconosciute**: se la preformata o il beta-carotene di un componente non sono noti, la parte nota conta per dimostrare un
  minimo; il resto resta sconosciuto, non zero. Il totale è incompleto e i massimi non verificabili. Esempio: la preformata della
  carota, che nel dato non è documentata.
- **Nessun doppio conteggio**:
  - le UI «per uso umano» da carotenoidi (carota 17.033 UI/100 g) restano un dato di fonte, mai sommato;
  - l’alfa-carotene non ha un fattore e non contribuisce (nel dizionario non c’è);
  - l’importatore rifiuta una vitamina A dichiarata come «carotene», perché il beta-carotene ha il suo campo e si converte una sola
    volta.
- **Controlli automatici** (`tests/vitamin-a.test.ts`):
  - fattore e fonte;
  - carota = 8,332 × 833 = 6.940,56 UI/100 g;
  - zucca = 2,096 × 833 = 1.745,97 UI/100 g;
  - manzo = 13,33 UI preformata + 0;
  - totale = preformata + beta-carotene;
  - UI umane escluse;
  - rifiuto all’importazione.
- **Lacuna del catalogo** aggiornata: il beta-carotene ora è convertito. Restano aperte la preformata della carota e della zucca e gli
  altri carotenoidi.
- **Dati di prova [TEST] (fittizi)**: hanno ora beta-carotene 0, perché la loro «vitamina A» era già un totale.

## 2. Analisi della prescrizione (quantità bloccate, QDiet 13 g)

Tutti gli apporti coincidono con il pacchetto, energia compresa, **tranne la vitamina A**. La differenza è esattamente il beta-carotene
convertito, che il pacchetto non convertiva:

| Verdura (90 g) | Preformata nota | Beta-carotene | Contributo | Totale noto app | Pacchetto |
|---|---:|---:|---:|---:|---:|
| Carota | 3.324,67 UI (QDiet + manzo) | 7,4988 mg | +6.246,50 UI | 9.571,17 UI | 3.324,67 UI |
| Zucca | 3.324,67 UI | 1,8864 mg | +1.571,37 UI | 4.896,04 UI | 3.324,67 UI |

Gli esiti dei minimi non cambiano: 38 su 38, 37 su 38 con il bovino al 10% (triptofano, per la base calorica già spiegata). Il massimo
della vitamina A resta non verificabile.

## 3. Generatore (1.340 kcal, QDiet ≤ 9 g dalla tabella)

**Esito: vincoli del modello sui contributi noti rispettati; verifica nutrizionale incompleta.**
- Il generatore ora **trova una soluzione**, alla seconda ricerca, cioè con gli ampliamenti documentati delle preferenze.
- Prima, senza il beta-carotene, il risultato era «preferenze non raggiungibili»: la vitamina A dipendeva da QDiet e dal manzo e
  richiedeva circa 753 g di carne.
- Lo stato della verifica è «bozza parziale» per i dati mancanti.

| Componente | Generatore | Prescrizione |
|---|---:|---:|
| Bovino 3% / 5% / 10% | 544 / 16 / 16 g | 560 g (max 10%) |
| Avena | 37 g | 100 g |
| Carote | 532 g | 90 g |
| Olio di cocco / lino | 0 / 40 g | 10 / 10 g |
| Farina d’ossa | 18 g | 5 g |
| QDiet | 9 g | 13 g |
| Omegor | 1 capsula | 1 capsula |
| Psillio | 0 g | 5 g |

**Apporti**:
- energia nota 1.313,2 kcal (non attestata per la farina d’ossa);
- quote 4/9/4: proteine 38,8–41,5%, grassi 40,7–43,5%, carboidrati 15–20,5%;
- fibra 15 g/1000 kcal;
- Ca/P sui noti 1,127 (non verificabile);
- vitamina D 242 UI;
- EPA+DHA 803 mg.

**Vitamina A**: preformata 2.326,8 UI + beta-carotene 44,33 mg × 833 = 36.923,8 UI → **39.250,6 UI noti**, contro un minimo di 2.350
UI. Le carote non sono scelte per la vitamina A (bastano poche decine di grammi): servono a carboidrati e fibra con poco fosforo,
perché il fosforo è al massimo. Il massimo della vitamina A (100.000 UI/1000 kcal) resta non verificabile per le parti sconosciute;
con i dati noti è 29.889 UI/1000 kcal.

**Preferenze**:
- rispettata la quota grassi;
- **non verificabili**, perché l’intervallo possibile attraversa il limite, le quote di proteine (38,8–41,5% contro il massimo 40%) e
  di carboidrati (15–20,5% contro il minimo 20%): raggiunte entro gli ampliamenti, non dimostrate negli intervalli richiesti;
- fibra al massimo, non verificabile;
- **Ca:P 1,2–1,4 non raggiunto**: impedito da triptofano (+10% senza digeribilità documentata) e dose massima di QDiet.

**Vincoli al limite**:
- fosforo massimo (4 g/1000 kcal);
- vitamina B5 minima (dati noti);
- QDiet al massimo della tabella;
- Omegor a 1 capsula.

**Controlli non verificabili**:
- cloruro (nessun dato);
- calcio, fosforo e rapporto Ca/P (Omegor non li dichiara);
- massimi di vitamine A e D;
- fibra;
- energia (farina d’ossa).

Tempo di calcolo: 3,3–3,8 s per caso su questa macchina, sopra l’obiettivo di 3 s e sotto il limite di 8 s. Da rivedere quando
proveremo altri ingredienti.

### Olio di lino: ancora elevato, non è una dose consigliata

Minimo di linoleico: 3,82 g/1000 kcal su 1.340 kcal = **5,119 g/die**.

| Ingrediente | Linoleico noto |
|---|---:|
| Olio di lino (40 g) | 5,698 g |
| Tutti gli altri | 0 g noti |

- **Linoleico sconosciuto** (non zero): bovini, avena, carote, farina d’ossa, QDiet, Omegor. Il loro 18:2 non differenziato non è
  equiparato al linoleico. L’olio di cocco (unica altra fonte identificata) non è usato.
- **Lino determinato dal vincolo**: (5,119 − 0) / 0,1425 = **35,9 g**. Il minimo di linoleico, dimostrabile solo con il lino, ne
  impone almeno 35,9 g.
- **I 4,1 g in più** non vengono da questo vincolo: il fosforo è al massimo, e l’olio è energia senza fosforo.
- **ALA**: 21,35 g/die dal lino. Nessun limite all’ALA è stato introdotto.

Il problema resta: finché il linoleico di carne, avena e verdure è sconosciuto, il generatore deve affidarsi al lino per dimostrare il
minimo. Si risolve con dati di linoleico identificato (18:2 n-6) per gli alimenti, non con un limite arbitrario.

## 4. Produzione: database di prova e database online

**Verificato sul database di prova**, con le stesse migrazioni di Supabase:
- migrazione 10 (zeri calcolati);
- pacchetto del 20/10 (`supabase/data/2026-10-20/01…04`);
- profili di confronto e psillio non utilizzabili;
- nessuna convalida;
- ricette invariate.

**Database online**: contiene ancora i dati del 16/10, finché non esegui in Supabase la migrazione 10 e i quattro file. Non posso
verificarlo da qui.

**Cosa vale online già ora** (codice pubblicato: server di calcolo e aggiornamento dell’app):
- la conversione del beta-carotene vale subito per la **carota**, che nei dati del 16/10 ha già il beta-carotene (8.332 µg/100 g);
- non vale ancora per la **zucca**, che nei dati del 16/10 non ha il beta-carotene;
- vale anche la regola dell’energia dello psillio, che però online non esiste ancora finché non è importato;
- gli altri cambiamenti dei dati (vitamina D del manzo 3 UI, avena «dried», QDiet calcio e fosforo «total», Omegor 1 g / 9 kcal, nuovi
  profili) arrivano solo con l’importazione.
