# Verifica della prescrizione di Ker nel motore dell’app — 20/10/2026

Analisi a **quantità bloccate** (la stessa analisi di una ricetta modificata a mano: `auditRecipe`), **non** il generatore e non il collaudo da 1.800 kcal.
Catalogo in copia in memoria; nessuna modifica a catalogo, database, ricette o prescrizione; nessun prodotto marcato come convalidato.
Generato con `npx tsx scripts/collaudo/ker-prescrizione.ts <pacchetto>`. Fonte della prescrizione: TRIVISANI, KER.pdf, pagina 2, sha256 0c94804fb86cb5d5… (il PDF non è nel pacchetto).

## Importazione (importatore normale, schema definitivo JSON, modalità strict)

- `alimenti_esistenti_aggiornati.json` (sha256 41d447c8d3629033…): json/strict, 0 nuovi, 6 aggiornati, 309 valori, errori 0, conversioni in sospeso 0
- `alimenti_nuovi_confronto.json` (sha256 dd4f4af6f9f3e9fa…): json/strict, 4 nuovi, 0 aggiornati, 195 valori, errori 0, conversioni in sospeso 0
- `psillio_confronto.json` (sha256 b717e7f0e85edebb…): json/strict, 1 nuovi, 0 aggiornati, 5 valori, errori 0, conversioni in sospeso 0
- `integratori_riferimento_19ott.json` (sha256 56a4357c6c869c47…): json/strict, 0 nuovi, 3 aggiornati, 41 valori, errori 0, conversioni in sospeso 0
- `non_importare_automaticamente/qdiet_b5_condizionale.json`: **non importato** (stima condizionale, come indicato).

Cane: femmina, 6 anni, 30.2 kg (riferimento 27.2 kg), BCS 6/9; richiesta energetica scritta **1340 kcal/die**.
Limiti applicati: FEDIAF 2025 tab. III-3b, adulto **95 kcal/kg^0,75** (l’app non contiene la colonna 110: i confronti «110» del pacchetto non sono riproducibili nel motore). Minimi per 1000 kcal su max(1.340, energia calcolata).
Digeribilità proteica della dieta non documentata → minimi degli aminoacidi essenziali +10% (come nel pacchetto). Preferenze: quelle iniziali dell’adulto sano (solo per mostrare gli scostamenti, nessun effetto sulle quantità).

## Scenario beef_03_carrot_cooked (sensibilità)

Quantità bloccate: Macinato di manzo crudo 3% grassi 560 g; Avena in fiocchi secca non fortificata 100 g; Olio di cocco alimentare — proxy USDA 10 g; Olio di lino alimentare spremuto a freddo — proxy USDA 10 g; Carota cotta al vapore (proxy USDA bollita) 90 g; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g; Q.Diet Compensa (standard, NON Crescita/Ultra) 13 g; Omegor Vitality 1000 (capsula) 1 capsule; Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) 5 g.

**Stato dell’analisi: Bozza parziale: dati mancanti, non interamente verificabile** — vincoli sui contributi noti; verifica nutrizionale incompleta.

### Apporti noti giornalieri: pacchetto contro app

| Grandezza | Pacchetto | App | Differenza | Dati sconosciuti o parziali (app) |
|---|---:|---:|---:|---|
| Energia parziale del modello (kcal) | 1208,898 | 1209,6 | 0,702 | sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Proteine (g) | 137,5555 | 137,5555 | 0 | non dichiarato da Omegor Vitality 1000 (capsula) |
| Grassi totali (g) | 44,4221 | 44,4221 | 0 | — |
| Carboidrati disponibili (g) | 62,4065 | 62,4065 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Fibra alimentare (g) | 17,29 | 17,29 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Umidità (g) | 512,043 | 512,043 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido linoleico omega-6 (g) | 1,5922 | 1,5922 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido alfa-linolenico ALA (g) | 5,4787 | 5,4787 | 0 | mancante in Avena in fiocchi secca non fortificata, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA (g) | 0,535 | 0,535 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| DHA (g) | 0,268 | 0,268 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA + DHA (g) | 0,803 | 0,803 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-3 totali (g) | 0,9 | 0,9 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-6 totali (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido arachidonico (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Calcio (g) | 3,594 | 3,594 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fosforo (g) | 3,3039 | 3,3039 | -0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Potassio (g) | 3,5477 | 3,5477 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Sodio (g) | 0,6893 | 0,6893 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cloruro (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Magnesio (g) | 0,4652 | 0,4652 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Rame (mg) | 4,1043 | 4,1043 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Iodio (mg) | 0,585 | 0,585 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Ferro (mg) | 34,475 | 34,475 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Manganese (mg) | 7,7255 | 7,7255 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Selenio (diete umide) (µg) | 180,65 | 180,65 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Zinco (mg) | 59,005 | 59,005 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina A (IU) | 3324,6667 | 3324,6667 | 0 | mancante in Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina D (IU) | 341,8 | 341,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina E (IU) | 44,4119 | 44,4119 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B1 / tiamina (mg) | 1,724 | 1,724 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B2 / riboflavina (mg) | 4,2902 | 4,2902 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B3 / niacina (mg) | 34,0683 | 34,0683 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B5 / acido pantotenico (mg) | 5,0976 | 5,0976 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina B6 / piridossina (mg) | 3,1333 | 3,1333 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B9 / folati (µg) | 197 | 197 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B12 (µg) | 25,656 | 25,656 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Colina (mg) | 1328,87 | 1328,87 | -0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina C (mg) | 19,49 | 19,49 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Biotina / vitamina B7 (µg) | 32,5 | 32,5 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina K (µg) | 15,88 | 15,88 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Arginina (g) | 8,9367 | 8,9367 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Istidina (g) | 4,3087 | 4,3087 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Isoleucina (g) | 6,0029 | 6,0029 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Leucina (g) | 10,6596 | 10,6596 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Lisina (g) | 10,9149 | 10,9149 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina (g) | 3,3919 | 3,3919 | -0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina + cistina (g) | 5,1737 | 5,1737 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina (g) | 5,5148 | 5,5148 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina + tirosina (g) | 9,7325 | 9,7325 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Treonina (g) | 5,2889 | 5,2889 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Triptofano (g) | 0,8182 | 0,8182 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Valina (g) | 6,792 | 6,792 | -0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Taurina (mg) | 650 | 650 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| L-carnitina (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cistina (g) | 1,7818 | 1,7818 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Tirosina (g) | 4,2177 | 4,2177 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Energia alimentare (uomo, NON EM cane) (kcal) | 1275,4 | 1275,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Carboidrati per differenza (fonte) (g) | 75,098 | 75,098 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 18:2 non differenziato (fonte) (g) | 4,7417 | 4,7417 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 20:4 non differenziato (fonte) (g) | 0,196 | 0,196 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Retinolo (fonte, µg) (µg) | 22,4 | 22,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina A da carotenoidi (UI per uso umano) (IU (carotenoids; human labeling)) | 15.329,7 | 15.329,7 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Beta-carotene (fonte) (µg) | 7498,8 | 7498,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |

Rapporto Ca/P sui valori noti: pacchetto 1,08780532, app 1,08780532; giudizio dell’app sul rapporto: non verificabile (calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero)).
Quote 4/9/4 parziali: pacchetto P 45,87% · G 33,33% · C 20,81%; app P 45,87% · G 33,33% · C 20,81% (intervalli possibili dell’app: P 43,55–45,87, G 31,64–33,33, C 20,81–24,81).

### Minimi FEDIAF 95 sulla richiesta di 1.340 kcal

Esiti coincidenti: 38 su 38.

| Nutriente | Minimo pacchetto | Minimo app | Esito pacchetto | Esito app |
|---|---:|---:|---|---|
| Proteine | 69,814 | 69,814 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Grassi totali | 18,425 | 18,425 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Acido linoleico omega-6 | 5,1188 | 5,1188 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 3,82 g/1000 kcal): copertura non verificabile — con i dati noti 1,188 g/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo  |
| Calcio | 1,943 | 1,943 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fosforo | 1,5544 | 1,5544 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Potassio | 1,943 | 1,943 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Sodio | 0,3886 | 0,3886 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Cloruro | 0,5762 | 0,5762 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Magnesio | 0,268 | 0,268 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Rame | 2,7872 | 2,7872 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Iodio | 0,402 | 0,402 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Ferro | 13,936 | 13,936 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Manganese | 2,2378 | 2,2378 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Selenio (diete umide) | 90,45 | 90,45 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Zinco | 27,872 | 27,872 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina A | 2350,36 | 2350,36 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina D | 213,06 | 213,06 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina E | 13,936 | 13,936 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B1 / tiamina | 0,8308 | 0,8308 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B2 / riboflavina | 2,3316 | 2,3316 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B3 / niacina | 6,3516 | 6,3516 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B5 / acido pantotenico | 5,5074 | 5,5074 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 4,11 mg/1000 kcal): copertura non verificabile — con i dati noti 3,804 mg/1000 kcal; dato sconosciuto (non zero) in Olio di lino alimentar |
| Vitamina B6 / piridossina | 0,5628 | 0,5628 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B9 / folati | 100,098 | 100,098 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B12 | 12,9712 | 12,9712 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Colina | 635,16 | 635,16 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Arginina | 2,2257 | 2,2257 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Istidina | 0,9876 | 0,9876 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Isoleucina | 1,9604 | 1,9604 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Leucina | 3,4934 | 3,4934 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Lisina | 1,7983 | 1,7983 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina | 1,7098 | 1,7098 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina + cistina | 3,2575 | 3,2575 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina | 2,2994 | 2,2994 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina + tirosina | 3,8029 | 3,8029 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Treonina | 2,2257 | 2,2257 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Triptofano | 0,7223 | 0,7223 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Valina | 2,5205 | 2,5205 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |

Massimi non verificabili nell’app: Calcio, Fosforo, Rapporto calcio/fosforo, Vitamina A, Vitamina D. Massimi superati in modo dimostrato: nessuno.
Energia rispetto a 1.340 kcal: 1209,6 kcal su obiettivo 1340 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g (0,6% del peso della razione): totale parziale, la tolleranza energetica non è attestata. (controllo mostrato, non requisito per analizzare o conservare la prescrizione).
Tabella d’impiego — Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g; Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g/die supera la dose massima consigliata (intervallo consigliato dal produttore 30,2 kg: 4,53–9,06 (interpolato tra 30 e 40 kg) g/die per il peso attuale di 30,2 kg). Serve una valutazione veterinaria. (avviso; dose prescritta non modificata).
Preferenze e soglie non ufficiali non rispettate o non verificabili (non sono carenze): 
- Fibra alimentare: preferenza (min 5 · max 15 g/1000 kcal): massimo non verificabile — con i dati noti 14,3 g/1000 kcal; dato sconosciuto in Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%
- Rapporto calcio/fosforo: soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psill
- Quota energia da proteine: preferenza (min 25 · max 40 % energia macro (4/9/4)): superato in tutto l’intervallo possibile (43,5–45,9 % energia macro (4/9/4)) — richiesto 25–40 % energia macro (4/9/
Lacune del catalogo segnalate per questi prodotti: 16.

## Scenario beef_03_pumpkin_cooked (sensibilità)

Quantità bloccate: Macinato di manzo crudo 3% grassi 560 g; Avena in fiocchi secca non fortificata 100 g; Olio di cocco alimentare — proxy USDA 10 g; Olio di lino alimentare spremuto a freddo — proxy USDA 10 g; Zucca cotta al vapore (proxy USDA bollita) 90 g; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g; Q.Diet Compensa (standard, NON Crescita/Ultra) 13 g; Omegor Vitality 1000 (capsula) 1 capsule; Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) 5 g.

**Stato dell’analisi: Bozza parziale: dati mancanti, non interamente verificabile** — vincoli sui contributi noti; verifica nutrizionale incompleta.

### Apporti noti giornalieri: pacchetto contro app

| Grandezza | Pacchetto | App | Differenza | Dati sconosciuti o parziali (app) |
|---|---:|---:|---:|---|
| Energia parziale del modello (kcal) | 1202,751 | 1203,453 | 0,702 | sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Proteine (g) | 137,5195 | 137,5195 | 0 | non dichiarato da Omegor Vitality 1000 (capsula) |
| Grassi totali (g) | 44,3231 | 44,3231 | 0 | — |
| Carboidrati disponibili (g) | 61,1285 | 61,1285 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Fibra alimentare (g) | 15,58 | 15,58 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Umidità (g) | 515,211 | 515,211 | -0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido linoleico omega-6 (g) | 1,5922 | 1,5922 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido alfa-linolenico ALA (g) | 5,4787 | 5,4787 | 0 | mancante in Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA (g) | 0,535 | 0,535 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| DHA (g) | 0,268 | 0,268 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA + DHA (g) | 0,803 | 0,803 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-3 totali (g) | 0,9 | 0,9 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-6 totali (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido arachidonico (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Calcio (g) | 3,5805 | 3,5805 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fosforo (g) | 3,3039 | 3,3039 | -0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Potassio (g) | 3,5432 | 3,5432 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Sodio (g) | 0,638 | 0,638 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cloruro (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Magnesio (g) | 0,4643 | 0,4643 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Rame (mg) | 4,1709 | 4,1709 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Iodio (mg) | 0,585 | 0,585 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Ferro (mg) | 34,682 | 34,682 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Manganese (mg) | 7,6661 | 7,6661 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Selenio (diete umide) (µg) | 180,2 | 180,2 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Zinco (mg) | 59,032 | 59,032 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina A (IU) | 3324,6667 | 3324,6667 | 0 | mancante in Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina D (IU) | 341,8 | 341,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina E (IU) | 44,1035 | 44,1035 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B1 / tiamina (mg) | 1,6925 | 1,6925 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B2 / riboflavina (mg) | 4,3208 | 4,3208 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B3 / niacina (mg) | 33,8595 | 33,8595 | -0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B5 / acido pantotenico (mg) | 5,0697 | 5,0697 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina B6 / piridossina (mg) | 3,0352 | 3,0352 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B9 / folati (µg) | 192,5 | 192,5 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B12 (µg) | 25,656 | 25,656 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Colina (mg) | 1326,53 | 1326,53 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina C (mg) | 20,48 | 20,48 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Biotina / vitamina B7 (µg) | 32,5 | 32,5 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina K (µg) | 4,27 | 4,27 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Arginina (g) | 8,9043 | 8,9043 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Istidina (g) | 4,2889 | 4,2889 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Isoleucina (g) | 5,9669 | 5,9669 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Leucina (g) | 10,6146 | 10,6146 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Lisina (g) | 10,8753 | 10,8753 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina (g) | 3,3838 | 3,3838 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina + cistina (g) | 5,1062 | 5,1062 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina (g) | 5,4905 | 5,4905 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina + tirosina (g) | 9,7037 | 9,7037 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Treonina (g) | 5,1665 | 5,1665 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Triptofano (g) | 0,8173 | 0,8173 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Valina (g) | 6,7641 | 6,7641 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Taurina (mg) | 650 | 650 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| L-carnitina (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cistina (g) | 1,7224 | 1,7224 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Tirosina (g) | 4,2132 | 4,2132 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Energia alimentare (uomo, NON EM cane) (kcal) | 1261,9 | 1261,9 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Carboidrati per differenza (fonte) (g) | 72,11 | 72,11 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 18:2 non differenziato (fonte) (g) | 4,6652 | 4,6652 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 20:4 non differenziato (fonte) (g) | 0,196 | 0,196 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Retinolo (fonte, µg) (µg) | 22,4 | 22,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina A da carotenoidi (UI per uso umano) (IU (carotenoids; human labeling)) | 5179,5 | 5179,5 | 0 | mancante in Macinato di manzo crudo 3% grassi, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Beta-carotene (fonte) (µg) | 1886,4 | 1886,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |

Rapporto Ca/P sui valori noti: pacchetto 1,08371924, app 1,08371924; giudizio dell’app sul rapporto: non verificabile (calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero)).
Quote 4/9/4 parziali: pacchetto P 46,09% · G 33,42% · C 20,49%; app P 46,09% · G 33,42% · C 20,49% (intervalli possibili dell’app: P 43,75–46,09, G 31,73–33,42, C 20,49–24,52).

### Minimi FEDIAF 95 sulla richiesta di 1.340 kcal

Esiti coincidenti: 38 su 38.

| Nutriente | Minimo pacchetto | Minimo app | Esito pacchetto | Esito app |
|---|---:|---:|---|---|
| Proteine | 69,814 | 69,814 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Grassi totali | 18,425 | 18,425 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Acido linoleico omega-6 | 5,1188 | 5,1188 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 3,82 g/1000 kcal): copertura non verificabile — con i dati noti 1,188 g/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo  |
| Calcio | 1,943 | 1,943 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fosforo | 1,5544 | 1,5544 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Potassio | 1,943 | 1,943 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Sodio | 0,3886 | 0,3886 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Cloruro | 0,5762 | 0,5762 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Magnesio | 0,268 | 0,268 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Rame | 2,7872 | 2,7872 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Iodio | 0,402 | 0,402 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Ferro | 13,936 | 13,936 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Manganese | 2,2378 | 2,2378 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Selenio (diete umide) | 90,45 | 90,45 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Zinco | 27,872 | 27,872 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina A | 2350,36 | 2350,36 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina D | 213,06 | 213,06 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina E | 13,936 | 13,936 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B1 / tiamina | 0,8308 | 0,8308 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B2 / riboflavina | 2,3316 | 2,3316 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B3 / niacina | 6,3516 | 6,3516 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B5 / acido pantotenico | 5,5074 | 5,5074 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 4,11 mg/1000 kcal): copertura non verificabile — con i dati noti 3,783 mg/1000 kcal; dato sconosciuto (non zero) in Olio di lino alimentar |
| Vitamina B6 / piridossina | 0,5628 | 0,5628 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B9 / folati | 100,098 | 100,098 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B12 | 12,9712 | 12,9712 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Colina | 635,16 | 635,16 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Arginina | 2,2257 | 2,2257 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Istidina | 0,9876 | 0,9876 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Isoleucina | 1,9604 | 1,9604 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Leucina | 3,4934 | 3,4934 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Lisina | 1,7983 | 1,7983 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina | 1,7098 | 1,7098 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina + cistina | 3,2575 | 3,2575 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina | 2,2994 | 2,2994 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina + tirosina | 3,8029 | 3,8029 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Treonina | 2,2257 | 2,2257 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Triptofano | 0,7223 | 0,7223 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Valina | 2,5205 | 2,5205 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |

Massimi non verificabili nell’app: Calcio, Fosforo, Rapporto calcio/fosforo, Vitamina A, Vitamina D. Massimi superati in modo dimostrato: nessuno.
Energia rispetto a 1.340 kcal: 1203,453 kcal su obiettivo 1340 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g (0,6% del peso della razione): totale parziale, la tolleranza energetica non è attestata. (controllo mostrato, non requisito per analizzare o conservare la prescrizione).
Tabella d’impiego — Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g; Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g/die supera la dose massima consigliata (intervallo consigliato dal produttore 30,2 kg: 4,53–9,06 (interpolato tra 30 e 40 kg) g/die per il peso attuale di 30,2 kg). Serve una valutazione veterinaria. (avviso; dose prescritta non modificata).
Preferenze e soglie non ufficiali non rispettate o non verificabili (non sono carenze): 
- Fibra alimentare: preferenza (min 5 · max 15 g/1000 kcal): massimo non verificabile — con i dati noti 12,9 g/1000 kcal; dato sconosciuto in Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%
- Rapporto calcio/fosforo: soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psill
- Quota energia da proteine: preferenza (min 25 · max 40 % energia macro (4/9/4)): superato in tutto l’intervallo possibile (43,7–46,1 % energia macro (4/9/4)) — richiesto 25–40 % energia macro (4/9/
Lacune del catalogo segnalate per questi prodotti: 16.

## Scenario beef_05_carrot_cooked (confronto numerico principale)

Quantità bloccate: Macinato di manzo crudo 5% grassi — proxy USDA 560 g; Avena in fiocchi secca non fortificata 100 g; Olio di cocco alimentare — proxy USDA 10 g; Olio di lino alimentare spremuto a freddo — proxy USDA 10 g; Carota cotta al vapore (proxy USDA bollita) 90 g; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g; Q.Diet Compensa (standard, NON Crescita/Ultra) 13 g; Omegor Vitality 1000 (capsula) 1 capsule; Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) 5 g.

**Stato dell’analisi: Bozza parziale: dati mancanti, non interamente verificabile** — vincoli sui contributi noti; verifica nutrizionale incompleta.

### Apporti noti giornalieri: pacchetto contro app

| Grandezza | Pacchetto | App | Differenza | Dati sconosciuti o parziali (app) |
|---|---:|---:|---:|---|
| Energia parziale del modello (kcal) | 1296,93 | 1297,632 | 0,702 | sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Proteine (g) | 134,3635 | 134,3635 | 0 | non dichiarato da Omegor Vitality 1000 (capsula) |
| Grassi totali (g) | 55,6221 | 55,6221 | -0 | — |
| Carboidrati disponibili (g) | 62,4065 | 62,4065 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Fibra alimentare (g) | 17,29 | 17,29 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Umidità (g) | 503,587 | 503,587 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido linoleico omega-6 (g) | 1,5922 | 1,5922 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido alfa-linolenico ALA (g) | 5,5011 | 5,5011 | 0 | mancante in Avena in fiocchi secca non fortificata, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA (g) | 0,535 | 0,535 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| DHA (g) | 0,268 | 0,268 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA + DHA (g) | 0,803 | 0,803 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-3 totali (g) | 0,9 | 0,9 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-6 totali (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido arachidonico (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Calcio (g) | 3,5996 | 3,5996 | -0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fosforo (g) | 3,2759 | 3,2759 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Potassio (g) | 3,4861 | 3,4861 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Sodio (g) | 0,6893 | 0,6893 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cloruro (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Magnesio (g) | 0,4652 | 0,4652 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Rame (mg) | 4,0931 | 4,0931 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Iodio (mg) | 0,585 | 0,585 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Ferro (mg) | 34,139 | 34,139 | -0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Manganese (mg) | 7,7255 | 7,7255 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Selenio (diete umide) (µg) | 178,97 | 178,97 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Zinco (mg) | 58,333 | 58,333 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina A (IU) | 3324,6667 | 3324,6667 | 0 | mancante in Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina D (IU) | 341,8 | 341,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina E (IU) | 44,4119 | 44,4119 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B1 / tiamina (mg) | 1,724 | 1,724 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B2 / riboflavina (mg) | 4,2902 | 4,2902 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B3 / niacina (mg) | 33,1219 | 33,1219 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B5 / acido pantotenico (mg) | 4,98 | 4,98 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina B6 / piridossina (mg) | 3,0829 | 3,0829 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B9 / folati (µg) | 202,6 | 202,6 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B12 (µg) | 25,544 | 25,544 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Colina (mg) | 1318,23 | 1318,23 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina C (mg) | 19,49 | 19,49 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Biotina / vitamina B7 (µg) | 32,5 | 32,5 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina K (µg) | 17 | 17 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Arginina (g) | 8,7295 | 8,7295 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Istidina (g) | 4,2023 | 4,2023 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Isoleucina (g) | 5,8629 | 5,8629 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Leucina (g) | 10,4132 | 10,4132 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Lisina (g) | 10,6517 | 10,6517 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina (g) | 3,3079 | 3,3079 | -0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina + cistina (g) | 5,0617 | 5,0617 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina (g) | 5,3916 | 5,3916 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina + tirosina (g) | 9,5085 | 9,5085 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Treonina (g) | 5,1657 | 5,1657 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Triptofano (g) | 0,8014 | 0,8014 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Valina (g) | 6,6352 | 6,6352 | -0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Taurina (mg) | 650 | 650 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| L-carnitina (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cistina (g) | 1,7538 | 1,7538 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Tirosina (g) | 4,1169 | 4,1169 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Energia alimentare (uomo, NON EM cane) (kcal) | 1365 | 1365 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Carboidrati per differenza (fonte) (g) | 75,098 | 75,098 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 18:2 non differenziato (fonte) (g) | 4,9153 | 4,9153 | -0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 20:4 non differenziato (fonte) (g) | 0,196 | 0,196 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Retinolo (fonte, µg) (µg) | 22,4 | 22,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina A da carotenoidi (UI per uso umano) (IU (carotenoids; human labeling)) | 15.329,7 | 15.329,7 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Beta-carotene (fonte) (µg) | 7498,8 | 7498,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |

Rapporto Ca/P sui valori noti: pacchetto 1,09881254, app 1,09881254; giudizio dell’app sul rapporto: non verificabile (calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero)).
Quote 4/9/4 parziali: pacchetto P 41,74% · G 38,88% · C 19,39%; app P 41,74% · G 38,88% · C 19,39% (intervalli possibili dell’app: P 39,77–41,74, G 37,04–38,88, C 19,39–23,19).

### Minimi FEDIAF 95 sulla richiesta di 1.340 kcal

Esiti coincidenti: 38 su 38.

| Nutriente | Minimo pacchetto | Minimo app | Esito pacchetto | Esito app |
|---|---:|---:|---|---|
| Proteine | 69,814 | 69,814 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Grassi totali | 18,425 | 18,425 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Acido linoleico omega-6 | 5,1188 | 5,1188 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 3,82 g/1000 kcal): copertura non verificabile — con i dati noti 1,188 g/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo  |
| Calcio | 1,943 | 1,943 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fosforo | 1,5544 | 1,5544 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Potassio | 1,943 | 1,943 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Sodio | 0,3886 | 0,3886 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Cloruro | 0,5762 | 0,5762 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Magnesio | 0,268 | 0,268 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Rame | 2,7872 | 2,7872 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Iodio | 0,402 | 0,402 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Ferro | 13,936 | 13,936 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Manganese | 2,2378 | 2,2378 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Selenio (diete umide) | 90,45 | 90,45 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Zinco | 27,872 | 27,872 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina A | 2350,36 | 2350,36 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina D | 213,06 | 213,06 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina E | 13,936 | 13,936 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B1 / tiamina | 0,8308 | 0,8308 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B2 / riboflavina | 2,3316 | 2,3316 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B3 / niacina | 6,3516 | 6,3516 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B5 / acido pantotenico | 5,5074 | 5,5074 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 4,11 mg/1000 kcal): copertura non verificabile — con i dati noti 3,716 mg/1000 kcal; dato sconosciuto (non zero) in Olio di lino alimentar |
| Vitamina B6 / piridossina | 0,5628 | 0,5628 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B9 / folati | 100,098 | 100,098 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B12 | 12,9712 | 12,9712 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Colina | 635,16 | 635,16 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Arginina | 2,2257 | 2,2257 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Istidina | 0,9876 | 0,9876 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Isoleucina | 1,9604 | 1,9604 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Leucina | 3,4934 | 3,4934 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Lisina | 1,7983 | 1,7983 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina | 1,7098 | 1,7098 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina + cistina | 3,2575 | 3,2575 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina | 2,2994 | 2,2994 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina + tirosina | 3,8029 | 3,8029 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Treonina | 2,2257 | 2,2257 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Triptofano | 0,7223 | 0,7223 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Valina | 2,5205 | 2,5205 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |

Massimi non verificabili nell’app: Calcio, Fosforo, Rapporto calcio/fosforo, Vitamina A, Vitamina D. Massimi superati in modo dimostrato: nessuno.
Energia rispetto a 1.340 kcal: 1297,632 kcal su obiettivo 1340 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g (0,6% del peso della razione): totale parziale, la tolleranza energetica non è attestata. (controllo mostrato, non requisito per analizzare o conservare la prescrizione).
Tabella d’impiego — Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g; Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g/die supera la dose massima consigliata (intervallo consigliato dal produttore 30,2 kg: 4,53–9,06 (interpolato tra 30 e 40 kg) g/die per il peso attuale di 30,2 kg). Serve una valutazione veterinaria. (avviso; dose prescritta non modificata).
Preferenze e soglie non ufficiali non rispettate o non verificabili (non sono carenze): 
- Fibra alimentare: preferenza (min 5 · max 15 g/1000 kcal): massimo non verificabile — con i dati noti 13,3 g/1000 kcal; dato sconosciuto in Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%
- Rapporto calcio/fosforo: soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psill
- Quota energia da proteine: preferenza (min 25 · max 40 % energia macro (4/9/4)): non verificabile — intervallo possibile 39,8–41,7 % energia macro (4/9/4); quota parziale: macronutrienti non dichia
- Quota energia da carboidrati disponibili: preferenza (min 20 · max 50 % energia macro (4/9/4)): non verificabile — intervallo possibile 19,4–23,2 % energia macro (4/9/4); quota parziale: macronutrienti non dichia
Lacune del catalogo segnalate per questi prodotti: 12.

## Scenario beef_05_pumpkin_cooked (sensibilità)

Quantità bloccate: Macinato di manzo crudo 5% grassi — proxy USDA 560 g; Avena in fiocchi secca non fortificata 100 g; Olio di cocco alimentare — proxy USDA 10 g; Olio di lino alimentare spremuto a freddo — proxy USDA 10 g; Zucca cotta al vapore (proxy USDA bollita) 90 g; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g; Q.Diet Compensa (standard, NON Crescita/Ultra) 13 g; Omegor Vitality 1000 (capsula) 1 capsule; Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) 5 g.

**Stato dell’analisi: Bozza parziale: dati mancanti, non interamente verificabile** — vincoli sui contributi noti; verifica nutrizionale incompleta.

### Apporti noti giornalieri: pacchetto contro app

| Grandezza | Pacchetto | App | Differenza | Dati sconosciuti o parziali (app) |
|---|---:|---:|---:|---|
| Energia parziale del modello (kcal) | 1290,783 | 1291,485 | 0,702 | sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Proteine (g) | 134,3275 | 134,3275 | -0 | non dichiarato da Omegor Vitality 1000 (capsula) |
| Grassi totali (g) | 55,5231 | 55,5231 | -0 | — |
| Carboidrati disponibili (g) | 61,1285 | 61,1285 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Fibra alimentare (g) | 15,58 | 15,58 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Umidità (g) | 506,755 | 506,755 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido linoleico omega-6 (g) | 1,5922 | 1,5922 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido alfa-linolenico ALA (g) | 5,5011 | 5,5011 | 0 | mancante in Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA (g) | 0,535 | 0,535 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| DHA (g) | 0,268 | 0,268 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA + DHA (g) | 0,803 | 0,803 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-3 totali (g) | 0,9 | 0,9 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-6 totali (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido arachidonico (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Calcio (g) | 3,5861 | 3,5861 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fosforo (g) | 3,2759 | 3,2759 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Potassio (g) | 3,4816 | 3,4816 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Sodio (g) | 0,638 | 0,638 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cloruro (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Magnesio (g) | 0,4643 | 0,4643 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Rame (mg) | 4,1597 | 4,1597 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Iodio (mg) | 0,585 | 0,585 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Ferro (mg) | 34,346 | 34,346 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Manganese (mg) | 7,6661 | 7,6661 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Selenio (diete umide) (µg) | 178,52 | 178,52 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Zinco (mg) | 58,36 | 58,36 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina A (IU) | 3324,6667 | 3324,6667 | 0 | mancante in Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina D (IU) | 341,8 | 341,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina E (IU) | 44,1035 | 44,1035 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B1 / tiamina (mg) | 1,6925 | 1,6925 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B2 / riboflavina (mg) | 4,3208 | 4,3208 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B3 / niacina (mg) | 32,9131 | 32,9131 | -0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B5 / acido pantotenico (mg) | 4,9521 | 4,9521 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina B6 / piridossina (mg) | 2,9848 | 2,9848 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B9 / folati (µg) | 198,1 | 198,1 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B12 (µg) | 25,544 | 25,544 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Colina (mg) | 1315,89 | 1315,89 | -0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina C (mg) | 20,48 | 20,48 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Biotina / vitamina B7 (µg) | 32,5 | 32,5 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina K (µg) | 5,39 | 5,39 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Arginina (g) | 8,6971 | 8,6971 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Istidina (g) | 4,1825 | 4,1825 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Isoleucina (g) | 5,8269 | 5,8269 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Leucina (g) | 10,3682 | 10,3682 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Lisina (g) | 10,6121 | 10,6121 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina (g) | 3,2998 | 3,2998 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina + cistina (g) | 4,9942 | 4,9942 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina (g) | 5,3673 | 5,3673 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina + tirosina (g) | 9,4797 | 9,4797 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Treonina (g) | 5,0433 | 5,0433 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Triptofano (g) | 0,8005 | 0,8005 | -0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Valina (g) | 6,6073 | 6,6073 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Taurina (mg) | 650 | 650 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| L-carnitina (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cistina (g) | 1,6944 | 1,6944 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Tirosina (g) | 4,1124 | 4,1124 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Energia alimentare (uomo, NON EM cane) (kcal) | 1351,5 | 1351,5 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Carboidrati per differenza (fonte) (g) | 72,11 | 72,11 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 18:2 non differenziato (fonte) (g) | 4,8388 | 4,8388 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 20:4 non differenziato (fonte) (g) | 0,196 | 0,196 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Retinolo (fonte, µg) (µg) | 22,4 | 22,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina A da carotenoidi (UI per uso umano) (IU (carotenoids; human labeling)) | 5179,5 | 5179,5 | 0 | mancante in Macinato di manzo crudo 5% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Beta-carotene (fonte) (µg) | 1886,4 | 1886,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |

Rapporto Ca/P sui valori noti: pacchetto 1,09469154, app 1,09469154; giudizio dell’app sul rapporto: non verificabile (calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero)).
Quote 4/9/4 parziali: pacchetto P 41,93% · G 38,99% · C 19,08%; app P 41,93% · G 38,99% · C 19,08% (intervalli possibili dell’app: P 39,94–41,93, G 37,14–38,99, C 19,08–22,92).

### Minimi FEDIAF 95 sulla richiesta di 1.340 kcal

Esiti coincidenti: 38 su 38.

| Nutriente | Minimo pacchetto | Minimo app | Esito pacchetto | Esito app |
|---|---:|---:|---|---|
| Proteine | 69,814 | 69,814 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Grassi totali | 18,425 | 18,425 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Acido linoleico omega-6 | 5,1188 | 5,1188 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 3,82 g/1000 kcal): copertura non verificabile — con i dati noti 1,188 g/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo  |
| Calcio | 1,943 | 1,943 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fosforo | 1,5544 | 1,5544 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Potassio | 1,943 | 1,943 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Sodio | 0,3886 | 0,3886 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Cloruro | 0,5762 | 0,5762 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Magnesio | 0,268 | 0,268 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Rame | 2,7872 | 2,7872 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Iodio | 0,402 | 0,402 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Ferro | 13,936 | 13,936 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Manganese | 2,2378 | 2,2378 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Selenio (diete umide) | 90,45 | 90,45 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Zinco | 27,872 | 27,872 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina A | 2350,36 | 2350,36 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina D | 213,06 | 213,06 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina E | 13,936 | 13,936 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B1 / tiamina | 0,8308 | 0,8308 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B2 / riboflavina | 2,3316 | 2,3316 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B3 / niacina | 6,3516 | 6,3516 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B5 / acido pantotenico | 5,5074 | 5,5074 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 4,11 mg/1000 kcal): copertura non verificabile — con i dati noti 3,696 mg/1000 kcal; dato sconosciuto (non zero) in Olio di lino alimentar |
| Vitamina B6 / piridossina | 0,5628 | 0,5628 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B9 / folati | 100,098 | 100,098 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B12 | 12,9712 | 12,9712 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Colina | 635,16 | 635,16 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Arginina | 2,2257 | 2,2257 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Istidina | 0,9876 | 0,9876 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Isoleucina | 1,9604 | 1,9604 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Leucina | 3,4934 | 3,4934 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Lisina | 1,7983 | 1,7983 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina | 1,7098 | 1,7098 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina + cistina | 3,2575 | 3,2575 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina | 2,2994 | 2,2994 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina + tirosina | 3,8029 | 3,8029 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Treonina | 2,2257 | 2,2257 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Triptofano | 0,7223 | 0,7223 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Valina | 2,5205 | 2,5205 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |

Massimi non verificabili nell’app: Calcio, Fosforo, Rapporto calcio/fosforo, Vitamina A, Vitamina D. Massimi superati in modo dimostrato: nessuno.
Energia rispetto a 1.340 kcal: 1291,485 kcal su obiettivo 1340 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g (0,6% del peso della razione): totale parziale, la tolleranza energetica non è attestata. (controllo mostrato, non requisito per analizzare o conservare la prescrizione).
Tabella d’impiego — Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g; Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g/die supera la dose massima consigliata (intervallo consigliato dal produttore 30,2 kg: 4,53–9,06 (interpolato tra 30 e 40 kg) g/die per il peso attuale di 30,2 kg). Serve una valutazione veterinaria. (avviso; dose prescritta non modificata).
Preferenze e soglie non ufficiali non rispettate o non verificabili (non sono carenze): 
- Fibra alimentare: preferenza (min 5 · max 15 g/1000 kcal): massimo non verificabile — con i dati noti 12,1 g/1000 kcal; dato sconosciuto in Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%
- Rapporto calcio/fosforo: soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psill
- Quota energia da proteine: preferenza (min 25 · max 40 % energia macro (4/9/4)): non verificabile — intervallo possibile 39,9–41,9 % energia macro (4/9/4); quota parziale: macronutrienti non dichia
- Quota energia da carboidrati disponibili: preferenza (min 20 · max 50 % energia macro (4/9/4)): non verificabile — intervallo possibile 19,1–22,9 % energia macro (4/9/4); quota parziale: macronutrienti non dichia
Lacune del catalogo segnalate per questi prodotti: 12.

## Scenario beef_10_carrot_cooked (sensibilità)

Quantità bloccate: Macinato di manzo crudo 10% grassi — proxy USDA 560 g; Avena in fiocchi secca non fortificata 100 g; Olio di cocco alimentare — proxy USDA 10 g; Olio di lino alimentare spremuto a freddo — proxy USDA 10 g; Carota cotta al vapore (proxy USDA bollita) 90 g; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g; Q.Diet Compensa (standard, NON Crescita/Ultra) 13 g; Omegor Vitality 1000 (capsula) 1 capsule; Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) 5 g.

**Stato dell’analisi: Bozza parziale: dati mancanti, non interamente verificabile** — vincoli sui contributi noti; verifica nutrizionale incompleta.

### Apporti noti giornalieri: pacchetto contro app

| Grandezza | Pacchetto | App | Differenza | Dati sconosciuti o parziali (app) |
|---|---:|---:|---:|---|
| Energia parziale del modello (kcal) | 1517,346 | 1518,048 | 0,702 | sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Proteine (g) | 126,4675 | 126,4675 | 0 | non dichiarato da Omegor Vitality 1000 (capsula) |
| Grassi totali (g) | 83,6221 | 83,6221 | 0 | — |
| Carboidrati disponibili (g) | 62,4065 | 62,4065 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Fibra alimentare (g) | 17,29 | 17,29 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Umidità (g) | 482,363 | 482,363 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido linoleico omega-6 (g) | 1,5922 | 1,5922 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido alfa-linolenico ALA (g) | 5,5403 | 5,5403 | 0 | mancante in Avena in fiocchi secca non fortificata, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA (g) | 0,535 | 0,535 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| DHA (g) | 0,268 | 0,268 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA + DHA (g) | 0,803 | 0,803 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-3 totali (g) | 0,9 | 0,9 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-6 totali (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido arachidonico (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Calcio (g) | 3,6164 | 3,6164 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fosforo (g) | 3,1975 | 3,1975 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Potassio (g) | 3,3461 | 3,3461 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Sodio (g) | 0,6893 | 0,6893 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cloruro (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Magnesio (g) | 0,454 | 0,454 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Rame (mg) | 4,0595 | 4,0595 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Iodio (mg) | 0,585 | 0,585 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Ferro (mg) | 33,355 | 33,355 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Manganese (mg) | 7,7255 | 7,7255 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Selenio (diete umide) (µg) | 174,49 | 174,49 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Zinco (mg) | 56,653 | 56,653 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina A (IU) | 3324,6667 | 3324,6667 | 0 | mancante in Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina D (IU) | 341,8 | 341,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina E (IU) | 44,4119 | 44,4119 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B1 / tiamina (mg) | 1,7296 | 1,7296 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B2 / riboflavina (mg) | 4,2902 | 4,2902 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B3 / niacina (mg) | 30,7587 | 30,7587 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B5 / acido pantotenico (mg) | 4,6944 | 4,6944 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina B6 / piridossina (mg) | 2,9541 | 2,9541 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B9 / folati (µg) | 208,2 | 208,2 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B12 (µg) | 25,376 | 25,376 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Colina (mg) | 1291,35 | 1291,35 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina C (mg) | 19,49 | 19,49 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Biotina / vitamina B7 (µg) | 32,5 | 32,5 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina K (µg) | 19,8 | 19,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Arginina (g) | 8,2087 | 8,2087 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Istidina (g) | 3,9447 | 3,9447 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Isoleucina (g) | 5,5157 | 5,5157 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Leucina (g) | 9,7916 | 9,7916 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Lisina (g) | 9,9965 | 9,9965 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina (g) | 3,1063 | 3,1063 | -0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina + cistina (g) | 4,7761 | 4,7761 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina (g) | 5,0836 | 5,0836 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina + tirosina (g) | 8,9597 | 8,9597 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Treonina (g) | 4,8633 | 4,8633 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Triptofano (g) | 0,7622 | 0,7622 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Valina (g) | 6,2432 | 6,2432 | -0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Taurina (mg) | 650 | 650 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| L-carnitina (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Carota cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cistina (g) | 1,6698 | 1,6698 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Tirosina (g) | 3,8761 | 3,8761 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Energia alimentare (uomo, NON EM cane) (kcal) | 1583,4 | 1583,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Carboidrati per differenza (fonte) (g) | 75,098 | 75,098 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 18:2 non differenziato (fonte) (g) | 5,3521 | 5,3521 | -0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 20:4 non differenziato (fonte) (g) | 0,196 | 0,196 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Retinolo (fonte, µg) (µg) | 22,4 | 22,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina A da carotenoidi (UI per uso umano) (IU (carotenoids; human labeling)) | 15.329,7 | 15.329,7 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Beta-carotene (fonte) (µg) | 7498,8 | 7498,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |

Rapporto Ca/P sui valori noti: pacchetto 1,1310086, app 1,1310086; giudizio dell’app sul rapporto: non verificabile (calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero)).
Quote 4/9/4 parziali: pacchetto P 33,54% · G 49,9% · C 16,55%; app P 33,54% · G 49,9% · C 16,55% (intervalli possibili dell’app: P 32,18–33,54, G 47,88–49,9, C 16,55–19,94).

### Minimi FEDIAF 95 sulla richiesta di 1.340 kcal

Esiti coincidenti: 37 su 38.

| Nutriente | Minimo pacchetto | Minimo app | Esito pacchetto | Esito app |
|---|---:|---:|---|---|
| Proteine | 69,814 | 79,0903 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Grassi totali | 18,425 | 20,8732 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Acido linoleico omega-6 | 5,1188 | 5,7989 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 3,82 g/1000 kcal): copertura non verificabile — con i dati noti 1,049 g/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo  |
| Calcio | 1,943 | 2,2012 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fosforo | 1,5544 | 1,7609 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Potassio | 1,943 | 2,2012 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Sodio | 0,3886 | 0,4402 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Cloruro | 0,5762 | 0,6528 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Magnesio | 0,268 | 0,3036 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Rame | 2,7872 | 3,1575 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Iodio | 0,402 | 0,4554 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Ferro | 13,936 | 15,7877 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Manganese | 2,2378 | 2,5351 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Selenio (diete umide) | 90,45 | 102,4682 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Zinco | 27,872 | 31,5754 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina A | 2350,36 | 2662,6562 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina D | 213,06 | 241,3696 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina E | 13,936 | 15,7877 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B1 / tiamina | 0,8308 | 0,9412 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B2 / riboflavina | 2,3316 | 2,6414 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B3 / niacina | 6,3516 | 7,1955 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B5 / acido pantotenico | 5,5074 | 6,2392 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 4,11 mg/1000 kcal): copertura non verificabile — con i dati noti 3,092 mg/1000 kcal; dato sconosciuto (non zero) in Olio di lino alimentar |
| Vitamina B6 / piridossina | 0,5628 | 0,6376 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B9 / folati | 100,098 | 113,3982 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B12 | 12,9712 | 14,6947 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Colina | 635,16 | 719,5548 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Arginina | 2,2257 | 2,5215 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Istidina | 0,9876 | 1,1188 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Isoleucina | 1,9604 | 2,2209 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Leucina | 3,4934 | 3,9576 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Lisina | 1,7983 | 2,0372 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina | 1,7098 | 1,937 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina + cistina | 3,2575 | 3,6904 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina | 2,2994 | 2,605 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina + tirosina | 3,8029 | 4,3082 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Treonina | 2,2257 | 2,5215 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| **Triptofano** | 0,7223 | 0,8182 | minimo coperto dal contributo noto | copertura non verificabile — minimo ufficiale (min 0,539 g/1000 kcal): copertura non verificabile — con i dati noti 0,502 g/1000 kcal; dato sconosciuto (non zero) in Olio di lino alimentare |
| Valina | 2,5205 | 2,8554 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |

Massimi non verificabili nell’app: Calcio, Fosforo, Rapporto calcio/fosforo, Vitamina A, Vitamina D. Massimi superati in modo dimostrato: nessuno.
Energia rispetto a 1.340 kcal: 1518,048 kcal su obiettivo 1340 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g (0,6% del peso della razione): totale parziale, la tolleranza energetica non è attestata. (controllo mostrato, non requisito per analizzare o conservare la prescrizione).
Tabella d’impiego — Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g; Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g/die supera la dose massima consigliata (intervallo consigliato dal produttore 30,2 kg: 4,53–9,06 (interpolato tra 30 e 40 kg) g/die per il peso attuale di 30,2 kg). Serve una valutazione veterinaria. (avviso; dose prescritta non modificata).
Preferenze e soglie non ufficiali non rispettate o non verificabili (non sono carenze): 
- Fibra alimentare: preferenza (min 5 · max 15 g/1000 kcal): massimo non verificabile — con i dati noti 11,4 g/1000 kcal; dato sconosciuto in Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%
- Rapporto calcio/fosforo: soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psill
- Quota energia da grassi: preferenza (min 25 · max 45 % energia macro (4/9/4)): superato in tutto l’intervallo possibile (47,9–49,9 % energia macro (4/9/4)) — richiesto 25–45 % energia macro (4/9/
- Quota energia da carboidrati disponibili: preferenza (min 20 · max 50 % energia macro (4/9/4)): non raggiunto in tutto l’intervallo possibile (16,6–19,9 % energia macro (4/9/4)) — richiesto 20–50 % energia macro 
Lacune del catalogo segnalate per questi prodotti: 12.

## Scenario beef_10_pumpkin_cooked (sensibilità)

Quantità bloccate: Macinato di manzo crudo 10% grassi — proxy USDA 560 g; Avena in fiocchi secca non fortificata 100 g; Olio di cocco alimentare — proxy USDA 10 g; Olio di lino alimentare spremuto a freddo — proxy USDA 10 g; Zucca cotta al vapore (proxy USDA bollita) 90 g; Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g; Q.Diet Compensa (standard, NON Crescita/Ultra) 13 g; Omegor Vitality 1000 (capsula) 1 capsule; Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) 5 g.

**Stato dell’analisi: Bozza parziale: dati mancanti, non interamente verificabile** — vincoli sui contributi noti; verifica nutrizionale incompleta.

### Apporti noti giornalieri: pacchetto contro app

| Grandezza | Pacchetto | App | Differenza | Dati sconosciuti o parziali (app) |
|---|---:|---:|---:|---|
| Energia parziale del modello (kcal) | 1511,199 | 1511,901 | 0,702 | sconosciuta: Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) |
| Proteine (g) | 126,4315 | 126,4315 | 0 | non dichiarato da Omegor Vitality 1000 (capsula) |
| Grassi totali (g) | 83,5231 | 83,5231 | 0 | — |
| Carboidrati disponibili (g) | 61,1285 | 61,1285 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Fibra alimentare (g) | 15,58 | 15,58 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Umidità (g) | 485,531 | 485,531 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido linoleico omega-6 (g) | 1,5922 | 1,5922 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido alfa-linolenico ALA (g) | 5,5403 | 5,5403 | 0 | mancante in Avena in fiocchi secca non fortificata, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA (g) | 0,535 | 0,535 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| DHA (g) | 0,268 | 0,268 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| EPA + DHA (g) | 0,803 | 0,803 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-3 totali (g) | 0,9 | 0,9 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Omega-6 totali (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido arachidonico (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Calcio (g) | 3,6029 | 3,6029 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fosforo (g) | 3,1975 | 3,1975 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Potassio (g) | 3,3416 | 3,3416 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Sodio (g) | 0,638 | 0,638 | 0 | non dichiarato da Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cloruro (g) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Magnesio (g) | 0,4531 | 0,4531 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Rame (mg) | 4,1261 | 4,1261 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Iodio (mg) | 0,585 | 0,585 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Ferro (mg) | 33,562 | 33,562 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Manganese (mg) | 7,6661 | 7,6661 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Selenio (diete umide) (µg) | 174,04 | 174,04 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Zinco (mg) | 56,68 | 56,68 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina A (IU) | 3324,6667 | 3324,6667 | 0 | mancante in Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina D (IU) | 341,8 | 341,8 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina E (IU) | 44,1035 | 44,1035 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B1 / tiamina (mg) | 1,6981 | 1,6981 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B2 / riboflavina (mg) | 4,3208 | 4,3208 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B3 / niacina (mg) | 30,5499 | 30,5499 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B5 / acido pantotenico (mg) | 4,6665 | 4,6665 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina B6 / piridossina (mg) | 2,856 | 2,856 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B9 / folati (µg) | 203,7 | 203,7 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina B12 (µg) | 25,376 | 25,376 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Colina (mg) | 1289,01 | 1289,01 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina C (mg) | 20,48 | 20,48 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Biotina / vitamina B7 (µg) | 32,5 | 32,5 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| Vitamina K (µg) | 8,19 | 8,19 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Arginina (g) | 8,1763 | 8,1763 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Istidina (g) | 3,9249 | 3,9249 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Isoleucina (g) | 5,4797 | 5,4797 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Leucina (g) | 9,7466 | 9,7466 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Lisina (g) | 9,9569 | 9,9569 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina (g) | 3,0982 | 3,0982 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Metionina + cistina (g) | 4,7086 | 4,7086 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina (g) | 5,0593 | 5,0593 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Fenilalanina + tirosina (g) | 8,9309 | 8,9309 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Treonina (g) | 4,7409 | 4,7409 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Triptofano (g) | 0,7613 | 0,7613 | -0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Valina (g) | 6,2153 | 6,2153 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Taurina (mg) | 650 | 650 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639); solo «added»: Q.Diet Compensa (standard, NON Crescita/Ultra) |
| L-carnitina (mg) | 0 | 0 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA, Zucca cotta al vapore (proxy USDA bollita); non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Cistina (g) | 1,6104 | 1,6104 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Tirosina (g) | 3,8716 | 3,8716 | 0 | mancante in Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Energia alimentare (uomo, NON EM cane) (kcal) | 1569,9 | 1569,9 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula) |
| Carboidrati per differenza (fonte) (g) | 72,11 | 72,11 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 18:2 non differenziato (fonte) (g) | 5,2756 | 5,2756 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Acido grasso 20:4 non differenziato (fonte) (g) | 0,196 | 0,196 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Retinolo (fonte, µg) (µg) | 22,4 | 22,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Vitamina A da carotenoidi (UI per uso umano) (IU (carotenoids; human labeling)) | 5179,5 | 5179,5 | 0 | mancante in Macinato di manzo crudo 10% grassi — proxy USDA, Avena in fiocchi secca non fortificata, Olio di cocco alimentare — proxy USDA, Olio di lino alimentare spremuto a freddo — proxy USDA; non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |
| Beta-carotene (fonte) (µg) | 1886,4 | 1886,4 | 0 | non dichiarato da Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%), Q.Diet Compensa (standard, NON Crescita/Ultra), Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) |

Rapporto Ca/P sui valori noti: pacchetto 1,12678655, app 1,12678655; giudizio dell’app sul rapporto: non verificabile (calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639) non dichiara un termine (sconosciuto, non zero)).
Quote 4/9/4 parziali: pacchetto P 33,67% · G 50,05% · C 16,28%; app P 33,67% · G 50,05% · C 16,28% (intervalli possibili dell’app: P 32,3–33,67, G 48,01–50,05, C 16,28–19,69).

### Minimi FEDIAF 95 sulla richiesta di 1.340 kcal

Esiti coincidenti: 37 su 38.

| Nutriente | Minimo pacchetto | Minimo app | Esito pacchetto | Esito app |
|---|---:|---:|---|---|
| Proteine | 69,814 | 78,77 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Grassi totali | 18,425 | 20,7886 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Acido linoleico omega-6 | 5,1188 | 5,7755 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 3,82 g/1000 kcal): copertura non verificabile — con i dati noti 1,053 g/1000 kcal; dato sconosciuto (non zero) in Macinato di manzo crudo  |
| Calcio | 1,943 | 2,1923 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fosforo | 1,5544 | 1,7538 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Potassio | 1,943 | 2,1923 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Sodio | 0,3886 | 0,4385 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Cloruro | 0,5762 | 0,6501 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 0,43 g/1000 kcal): non verificabile — nessun dato disponibile |
| Magnesio | 0,268 | 0,3024 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Rame | 2,7872 | 3,1448 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Iodio | 0,402 | 0,4536 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Ferro | 13,936 | 15,7238 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Manganese | 2,2378 | 2,5249 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Selenio (diete umide) | 90,45 | 102,0533 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Zinco | 27,872 | 31,4475 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina A | 2350,36 | 2651,8744 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina D | 213,06 | 240,3923 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina E | 13,936 | 15,7238 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B1 / tiamina | 0,8308 | 0,9374 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B2 / riboflavina | 2,3316 | 2,6307 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B3 / niacina | 6,3516 | 7,1664 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B5 / acido pantotenico | 5,5074 | 6,2139 | copertura non verificabile | copertura non verificabile — minimo ufficiale (min 4,11 mg/1000 kcal): copertura non verificabile — con i dati noti 3,087 mg/1000 kcal; dato sconosciuto (non zero) in Olio di lino alimentar |
| Vitamina B6 / piridossina | 0,5628 | 0,635 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B9 / folati | 100,098 | 112,939 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Vitamina B12 | 12,9712 | 14,6352 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Colina | 635,16 | 716,6411 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Arginina | 2,2257 | 2,5113 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Istidina | 0,9876 | 1,1143 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Isoleucina | 1,9604 | 2,2119 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Leucina | 3,4934 | 3,9415 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Lisina | 1,7983 | 2,029 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina | 1,7098 | 1,9292 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Metionina + cistina | 3,2575 | 3,6754 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina | 2,2994 | 2,5944 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Fenilalanina + tirosina | 3,8029 | 4,2908 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| Treonina | 2,2257 | 2,5113 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |
| **Triptofano** | 0,7223 | 0,8149 | minimo coperto dal contributo noto | copertura non verificabile — minimo ufficiale (min 0,539 g/1000 kcal): copertura non verificabile — con i dati noti 0,504 g/1000 kcal; dato sconosciuto (non zero) in Olio di lino alimentare |
| Valina | 2,5205 | 2,8439 | minimo coperto dal contributo noto | minimo coperto dal contributo noto |

Massimi non verificabili nell’app: Calcio, Fosforo, Rapporto calcio/fosforo, Vitamina A, Vitamina D. Massimi superati in modo dimostrato: nessuno.
Energia rispetto a 1.340 kcal: 1511,901 kcal su obiettivo 1340 (tolleranza ±2%). Energia sconosciuta per Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%) 5 g (0,6% del peso della razione): totale parziale, la tolleranza energetica non è attestata. (controllo mostrato, non requisito per analizzare o conservare la prescrizione).
Tabella d’impiego — Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g; Q.Diet Compensa (standard, NON Crescita/Ultra): 13 g/die supera la dose massima consigliata (intervallo consigliato dal produttore 30,2 kg: 4,53–9,06 (interpolato tra 30 e 40 kg) g/die per il peso attuale di 30,2 kg). Serve una valutazione veterinaria. (avviso; dose prescritta non modificata).
Preferenze e soglie non ufficiali non rispettate o non verificabili (non sono carenze): 
- Fibra alimentare: preferenza (min 5 · max 15 g/1000 kcal): massimo non verificabile — con i dati noti 10,3 g/1000 kcal; dato sconosciuto in Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%
- Rapporto calcio/fosforo: soglia di attenzione NON ufficiale (min 1,2 · max 1,4): non verificabile — calcio/fosforo non verificabile: Omegor Vitality 1000 (capsula), Erbavoglio — Cuticola di Psill
- Quota energia da grassi: preferenza (min 25 · max 45 % energia macro (4/9/4)): superato in tutto l’intervallo possibile (48–50 % energia macro (4/9/4)) — richiesto 25–45 % energia macro (4/9/4), 
- Quota energia da carboidrati disponibili: preferenza (min 20 · max 50 % energia macro (4/9/4)): non raggiunto in tutto l’intervallo possibile (16,3–19,7 % energia macro (4/9/4)) — richiesto 20–50 % energia macro 
Lacune del catalogo segnalate per questi prodotti: 12.

## Cosa cambierebbe nel catalogo importando questi file (non fatto)

Valori canonici dei prodotti già presenti, prima (catalogo attuale della prova = dati 16/10, o 19/10 per gli integratori già confrontati) → dopo:

| Prodotto | Cambiamenti |
|---|---|
| beef_03 | kcalMePer100g: 114,9 → 114,92; EPA + DHA: — → 0 g; Vitamina A: — → 13,3333 IU; Vitamina D: 4 → 3 IU; Vitamina K: — → 0,1 µg; Metionina + cistina: — → 0,792 g; Fenilalanina + tirosina: — → 1,535 g; Beta-carotene (fonte): — → 0 µg |
| beef_15 | kcalMePer100g: 209,4 → 209,36; EPA + DHA: — → 0,003 g; Vitamina A: — → 13,3333 IU; Vitamina D: 4 → 3 IU; Vitamina K: — → 1,3 µg; Metionina + cistina: — → 0,669 g; Fenilalanina + tirosina: — → 1,297 g; Beta-carotene (fonte): — → 0 µg |
| beef_30 | EPA + DHA: — → 0 g; Vitamina A: — → 13,3333 IU; Vitamina D: 4 → 3 IU; Vitamina K: — → 2,9 µg; Metionina + cistina: — → 0,517 g; Fenilalanina + tirosina: — → 1 g; Beta-carotene (fonte): — → 0 µg |
| oat_dry | processingState: raw → dried; kcalMePer100g: 341,7 → 341,68; EPA + DHA: — → 0 g; Vitamina A: — → 0 IU; Vitamina K: — → 2 µg; Metionina + cistina: — → 0,662 g; Fenilalanina + tirosina: — → 1,06 g; Acido grasso 20:4 non differenziato (fonte): — → 0 g; Retinolo (fonte, µg): — → 0 µg; Beta-carotene (fonte): — → 0 µg |
| carrot_cooked | kcalMePer100g: 25,5 → 25,54; EPA + DHA: — → 0 g; Vitamina K: — → 13,7 µg; Metionina + cistina: — → 0,085 g; Fenilalanina + tirosina: — → 0,085 g; Acido grasso 20:4 non differenziato (fonte): — → 0 g; Retinolo (fonte, µg): — → 0 µg |
| pumpkin_cooked | kcalMePer100g: 18,7 → 18,71; Carboidrati disponibili: 3,79 → 3,8 g; EPA: — → 0 g; DHA: — → 0 g; EPA + DHA: — → 0 g; Vitamina D: — → 0 IU; Vitamina E: 1,5794 → 1,192 IU; Vitamina B9 / folati: 8,5 → 9 µg; Vitamina B12: — → 0 µg; Colina: — → 6,2 mg; Vitamina K: — → 0,8 µg; Metionina + cistina: — → 0,01 g; Fenilalanina + tirosina: — → 0,053 g; Carboidrati per differenza (fonte): 4,89 → 4,9 g; Acido grasso 20:4 non differenziato (fonte): — → 0 g; Retinolo (fonte, µg): — → 0 µg; Vitamina A da carotenoidi (UI per uso umano): 1082 → 5755 IU (carotenoids; human labeling); Beta-carotene (fonte): — → 2096 µg |
| qdiet | Fibra alimentare: 0,0001 → — g |
| omegor_vitality | massPerUnitG: — → 1; kcalPerUnit: — → 9; EPA + DHA: — → 0,803 g |
| bone_meal | name: Farina d ossa (marca/prodotto NON confermato) → Grau — Farina d’ossa naturale (Ca 22,6%, P 17,7%); Fibra alimentare: 0,003 → — g |

## Riepilogo dei sei scenari

| Scenario | Energia app (kcal) | Δ energia | Differenze negli apporti noti (app − pacchetto) | Esiti dei minimi coincidenti | Stato dell’analisi |
|---|---:|---:|---|---:|---|
| beef_03_carrot_cooked | 1209,6 | 0,702 | energia 0,702 kcal | 38/38 | Bozza parziale: dati mancanti, non interamente verificabile |
| beef_03_pumpkin_cooked | 1203,45 | 0,702 | energia 0,702 kcal | 38/38 | Bozza parziale: dati mancanti, non interamente verificabile |
| beef_05_carrot_cooked | 1297,63 | 0,702 | energia 0,702 kcal | 38/38 | Bozza parziale: dati mancanti, non interamente verificabile |
| beef_05_pumpkin_cooked | 1291,49 | 0,702 | energia 0,702 kcal | 38/38 | Bozza parziale: dati mancanti, non interamente verificabile |
| beef_10_carrot_cooked | 1518,05 | 0,702 | energia 0,702 kcal | 37/38 | Bozza parziale: dati mancanti, non interamente verificabile |
| beef_10_pumpkin_cooked | 1511,9 | 0,702 | energia 0,702 kcal | 37/38 | Bozza parziale: dati mancanti, non interamente verificabile |
