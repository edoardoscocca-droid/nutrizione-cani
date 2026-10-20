# Generatore automatico sul caso di Ker — 20/10/2026

Generato con `npx tsx scripts/collaudo/ker-generatore.ts`, motore `motore-2.0.0`. Nessuna ricetta, prescrizione o preferenza salvata è stata modificata.
Catalogo: modalità prova con il pacchetto del 20/10 (gli stessi file preparati per Supabase). Nella sola copia in memoria sono resi utilizzabili
i profili di confronto (bovino 5% e 10%, olio di cocco, olio di lino), lo psillio e i tre integratori; nel catalogo restano come sono.

## Impostazioni

- Cane alla visita: femmina, 6 anni, **30,2 kg** (riferimento 27,2 kg), BCS 6/9; obiettivo **1.340 kcal/die** (richiesta della veterinaria); tolleranza ±2%.
- Profilo FEDIAF 2025 adulto **95 kcal/kg^0,75** (il 110 non è usato). Minimi per 1000 kcal su max(1.340, calorie calcolate).
- Dieta casalinga: selenio sul riferimento più alto. Digeribilità proteica non documentata → aminoacidi essenziali +10%.
- EPA+DHA: apporto raccomandato NRC su peso attuale (vincolo necessario). Limite QDiet dalla tabella d’impiego al peso attuale: 9 g (i 13 g prescritti **non** aumentano il limite del generatore).
- Psillio: profilo Erbavoglio Cuticola Bio **assunto per il confronto** (la prescrizione non identifica la variante); EM completa sconosciuta, 0,1404 kcal/g dai macronutrienti mostrati solo come contributo parziale.
- Preferenze: quelle iniziali dell’adulto sano (nessuna preferenza salvata per Ker è stata usata o modificata):
  - protein_energy_pct: 25–40 % energia 4/9/4 (seconda ricerca: minimo ampliato 20 % energia macro stimata (4/9/4); massimo ampliato 45 % energia macro stimata (4/9/4))
  - fat_energy_pct: 25–45 % energia 4/9/4 (seconda ricerca: minimo ampliato 20 % energia macro stimata (4/9/4); massimo ampliato 50 % energia macro stimata (4/9/4))
  - carb_energy_pct: 20–50 % energia 4/9/4 (seconda ricerca: minimo ampliato 15 % energia macro stimata (4/9/4); massimo ampliato 55 % energia macro stimata (4/9/4))
  - fiber: 5–15 g/1000 kcal (seconda ricerca: minimo ampliato 4 g/1000 kcal; massimo ampliato 18 g/1000 kcal)
  - Ca:P 1,2–1,4 (seconda ricerca 1,1–1,5); vincolo necessario 1–2.
- Componenti disponibili: Macinato di manzo crudo 3% grassi; Macinato di manzo crudo 5% grassi — proxy USDA; Macinato di manzo crudo 10% grassi — proxy USDA; Avena in fiocchi secca non fortificata; Carota cotta al vapore (proxy USDA bollita); Olio di cocco alimentare — proxy USDA; Olio di lino alimentare spremuto a freddo — proxy USDA; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%); Q.Diet Compensa (standard, NON Crescita/Ultra); Omegor Vitality 1000 (capsula); Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639). Nessuna quantità bloccata, nessun minimo obbligatorio.

## Esito: Preferenze non raggiungibili: vincoli del modello sui contributi noti rispettati, preferenze no; non è un menù

`preferences_unreachable` · 1,98 s · ricerca P1: nessuna riuscita · stato della verifica: Bozza parziale: dati mancanti, non interamente verificabile.
Messaggio del motore: Preferenze non raggiungibili nemmeno con gli ampliamenti documentati. Le quantità mostrate sono solo diagnostiche (vincoli del modello sui contributi noti rispettati; verifica nutrizionale incompleta): non è un menù generato.

### Quantità diagnostiche (non è un menù) e confronto con la prescrizione

| Componente | Generatore | Prescrizione |
|---|---:|---:|
| Macinato di manzo crudo 3% grassi | 690 g | — |
| Macinato di manzo crudo 5% grassi — proxy USDA | 0 g | 560 g (grasso massimo 10%) (un solo bovino) |
| Macinato di manzo crudo 10% grassi — proxy USDA | 63 g | — |
| Avena in fiocchi secca non fortificata | 0 g | 100 g |
| Carota cotta al vapore (proxy USDA bollita) | 280 g | 90 g |
| Olio di cocco alimentare — proxy USDA | 0 g | 10 g |
| Olio di lino alimentare spremuto a freddo — proxy USDA | 36 g | 10 g |
| Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) | 17,3 g | 5 g |
| Q.Diet Compensa (standard, NON Crescita/Ultra) | 9 g | 13 g |
| Omegor Vitality 1000 (capsula) | 1 capsule | 1 capsula |
| Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) | 12,5 g | 5 g |

### Apporti

- Energia: 1313,2 kcal su 1.340 (±2%: 1.313,2–1.366,8); 1313,2 kcal su obiettivo 1340 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 17,3 g, Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) 12,5 g (2,7% del peso della razione): totale parziale, la tolleranza energetica non è attestata. Contributo parziale dai macronutrienti dichiarati, escluso dal totale: Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) 1,755 kcal (fermentazione della fibra non stimata).
- Minimi per 1000 kcal applicati su 1340 kcal: il maggiore fra obiettivo (1340 kcal) e calorie calcolate (1313,2 kcal).
- Quote 4/9/4: proteine 51%, grassi 44,4%, carboidrati 4,5% (intervalli possibili: P 47,8–51, G 41,6–44,4, C 4,5–10,5).
- Noti: proteine 167 g; grassi 64,6 g; fibra 19,6 g; calcio 5,677 g; fosforo 5,248 g (Ca/P sui noti 1,082; rapporto non verificabile); vitamina D 247,6 UI; iodio 0,405 mg; EPA+DHA 803 mg; linoleico identificato 5,13 g; ALA 19,41 g.
- Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639): EM completa sconosciuta; dai macronutrienti dichiarati 0,1404 kcal/g (contributo parziale escluso dal totale).
- Tabella d’impiego — Q.Diet Compensa (standard, NON Crescita/Ultra): 9 g/die entro l’intervallo consigliato dal produttore 30,2 kg: 4,53–9,06 (interpolato tra 30 e 40 kg) g/die per il peso attuale di 30,2 kg.

### Controlli: preferenze, non verificabili, non rispettati

| Nutriente | Controllo | Esito | Dettaglio |
|---|---|---|---|
| Fibra alimentare | PERSONAL_TARGET | non verificabile | preferenza (min 5 · max 15 g/1000 kcal): massimo non verificabile — con i dati noti 14,9 g/1000 kcal; dato sconosciuto in Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Calcio | OFFICIAL_NUTRITIONAL_MAX | non verificabile | massimo nutrizionale ufficiale (max 6,25 g/1000 kcal): massimo non verificabile — con i dati noti 4,323 g/1000 kcal; dato sconosciuto in Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fosforo | OFFICIAL_NUTRITIONAL_MAX | non verificabile | massimo nutrizionale ufficiale (max 4 g/1000 kcal): massimo non verificabile — con i dati noti 3,996 g/1000 kcal; dato sconosciuto in Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cloruro | OFFICIAL_MIN | non verificabile | minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Rapporto calcio/fosforo | OFFICIAL_MIN | non verificabile | minimo ufficiale (min 1): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,082, non usato per il giudizio) |
| Rapporto calcio/fosforo | OFFICIAL_NUTRITIONAL_MAX | non verificabile | massimo nutrizionale ufficiale (max 2): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,082, non usato per il giudizio) |
| Rapporto calcio/fosforo | NON_OFFICIAL_ATTENTION | non verificabile | soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero) (con i soli valori noti 1,082, non usato per il giudizio) |
| Vitamina A | OFFICIAL_NUTRITIONAL_MAX | non verificabile | massimo nutrizionale ufficiale (max 100.000 IU/1000 kcal): massimo non verificabile — con i dati noti 1789,8 IU/1000 kcal; dato sconosciuto in Carota cotta al vapore (proxy USDA bollita), Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); Q.Diet Compensa (standard, NON Crescita/Ultra) dichiara solo quantità aggiunte (totale incerto) |
| Vitamina D | OFFICIAL_NUTRITIONAL_MAX | non verificabile | massimo nutrizionale ufficiale (max 800 IU/1000 kcal): massimo non verificabile — con i dati noti 188,5 IU/1000 kcal; dato sconosciuto in Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); Q.Diet Compensa (standard, NON Crescita/Ultra) dichiara solo quantità aggiunte (totale incerto) |
| Quota energia da proteine | PERSONAL_TARGET | preferenza non rispettata | preferenza (min 25 · max 40 % energia macro (4/9/4)): superato in tutto l’intervallo possibile (47,8–51 % energia macro (4/9/4)) — richiesto 25–40 % energia macro (4/9/4), risultato 47,8 % energia macro (4/9/4), scostamento +7,8 % energia macro (4/9/4) |
| Quota energia da carboidrati disponibili | PERSONAL_TARGET | preferenza non rispettata | preferenza (min 20 · max 50 % energia macro (4/9/4)): non raggiunto in tutto l’intervallo possibile (4,5–10,5 % energia macro (4/9/4)) — richiesto 20–50 % energia macro (4/9/4), risultato 10,5 % energia macro (4/9/4), scostamento -9,5 % energia macro (4/9/4) |

Preferenze rispettate (dimostrate sui dati noti): Quota energia da grassi.
Minimi e massimi ufficiali: 33 dimostrati, 0 non rispettati, 6 non verificabili (Calcio, Fosforo, Cloruro, Rapporto calcio/fosforo, Vitamina A, Vitamina D).

### Vincoli necessari al limite nella soluzione

- Acido linoleico omega-6: minimo 3,82 g/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1340 kcal obiettivo (coperto con i dati noti)
- Fosforo: massimo 4 g/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75))
- Vitamina A: minimo 1754 IU/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1340 kcal obiettivo (coperto con i dati noti)
- Q.Diet Compensa (standard, NON Crescita/Ultra): al massimo consentito (9)
- Omegor Vitality 1000 (capsula): al massimo consentito (1)

### Incompatibilità (diagnosi del modello)

Violazione minima necessaria con le preferenze ampliate trattate come vincoli, insieme ai vincoli necessari:

- Vitamina A: minimo 1754 IU/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75)) — anche su 1340 kcal obiettivo — coperto con i soli dati noti (livello H) — scarto minimo 16,348 IU/die
- Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) non oltre 9 — raggiunto, contribuisce al conflitto

### Preferenze non raggiunte: cosa le impedisce (una alla volta)

- Rapporto calcio/fosforo: minimo 1,2 (Allegato C — preferenza formulativa NON FEDIAF, bozza da rivedere): impedita da Triptofano: minimo 0,539 g/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75) + 10% (digeribilità proteica della dieta ≥ 80% non documentata)) — coperto con i soli dati noti (livello H); Triptofano: minimo 0,539 g/1000 kcal (FEDIAF 2025 tab. III-3b (adulto, 95 kcal/kg^0,75) + 10% (digeribilità proteica della dieta ≥ 80% non documentata)) — anche su 1340 kcal obiettivo — coperto con i soli dati noti (livello H); Dose massima del produttore: Q.Diet Compensa (standard, NON Crescita/Ultra) 9 (superarla richiede una valutazione veterinaria)
- Quota energia da proteine: massimo 40 % energia macro stimata (4/9/4) (Target personale — preferenza utente (2026-10-20)): raggiungibile da sola: il conflitto nasce solo insieme alle altre preferenze o vincoli
- Quota energia da carboidrati disponibili: minimo 20 % energia macro stimata (4/9/4) (Target personale — preferenza utente (2026-10-20)): raggiungibile da sola: il conflitto nasce solo insieme alle altre preferenze o vincoli

### Dati insufficienti (separati dalle incompatibilità)

- Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%): Fibra alimentare, Cloruro, Vitamina A, Vitamina D
- Q.Diet Compensa (standard, NON Crescita/Ultra): Fibra alimentare, Cloruro
- Omegor Vitality 1000 (capsula): Fibra alimentare, Calcio, Fosforo, Cloruro, Vitamina A, Vitamina D
- Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639): Calcio, Fosforo, Cloruro, Vitamina A, Vitamina D
- Macinato di manzo crudo 3% grassi: Cloruro
- Macinato di manzo crudo 10% grassi — proxy USDA: Cloruro
- Carota cotta al vapore (proxy USDA bollita): Cloruro, Vitamina A
- Olio di lino alimentare spremuto a freddo — proxy USDA: Cloruro
- Energia sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Macinato di manzo crudo 3% grassi: cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Carota cotta al vapore (proxy USDA bollita): energia stimata con 4/9/4 da carboidrati disponibili ottenuti per differenza meno fibra: non sono gli ENA della formula FEDIAF, la stima non è una EM misurata
- Lacuna del catalogo non risolta — Carota cotta al vapore (proxy USDA bollita): acido linoleico: la fonte riporta solo l’acido grasso 18:2 non differenziato; serve 18:2 n-6 cis,cis o un proxy documentato (stimato, con metodo e limiti)
- Lacuna del catalogo non risolta — Carota cotta al vapore (proxy USDA bollita): vitamina A: retinolo e carotenoidi presenti solo come dati di fonte; conversione e attività per il cane da verificare (non si copiano le UI alimentari umane)
- Lacuna del catalogo non risolta — Carota cotta al vapore (proxy USDA bollita): cloruro e iodio non disponibili: completare da fonti compatibili
- Lacuna del catalogo non risolta — Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%): variante trascritta dall’utente (Ca 22,6%, P 17,7%) diversa dal profilo attuale del produttore: confermare la confezione reale; energia ignota (non zero)
- Lacuna del catalogo non risolta — Q.Diet Compensa (standard, NON Crescita/Ultra): B5 come sale e colina da cloruro di colina richiedono documentazione chimica; additivi dichiarati solo come aggiunti (totale incerto)
- Lacuna del catalogo non risolta — Omegor Vitality 1000 (capsula): potenza per capsula e stima energetica dell’olio (9 kcal/capsula) da controllare; massa del contenuto per capsula non indicata

