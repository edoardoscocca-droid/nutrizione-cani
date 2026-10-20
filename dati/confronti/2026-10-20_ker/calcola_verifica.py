"""Verifica riproducibile della prescrizione: non un generatore di diete."""
import csv
import hashlib
import json
import math
import re
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
OLD = ROOT / 'output/importazione_reale_2026-10-19'
raw = json.loads((OUT/'fonti/usda_records.json').read_text())
USDA = {x['fdcId']: x for x in raw}
food_ref=OUT/'alimenti_riferimento_19ott.json'
supp_ref=OUT/'integratori_riferimento_19ott.json'
old_foods = {x['id']: x for x in json.loads((food_ref if food_ref.exists() else OLD/'alimenti_reali_2026-10-19.json').read_text())['foods']}
supps = json.loads((supp_ref if supp_ref.exists() else OLD/'integratori_reali_2026-10-19.json').read_text())['supplements']
codes = list(next(iter(old_foods.values()))['nutrients'])

# ID USDA -> codice dell'app, unità canonica, fattore di conversione.
MAP = {
 1003:('protein','g',1),1004:('fat','g',1),1079:('fiber','g',1),1051:('moisture','g',1),
 1316:('linoleic_acid','g',1),1404:('ala','g',1),1278:('epa','g',1),1272:('dha','g',1),
 1087:('calcium','g',.001),1091:('phosphorus','g',.001),1092:('potassium','g',.001),
 1093:('sodium','g',.001),1090:('magnesium','g',.001),1098:('copper','mg',1),
 1089:('iron','mg',1),1101:('manganese','mg',1),1103:('selenium_wet','µg',1),1095:('zinc','mg',1),
 1110:('vitamin_d','IU',1),1109:('vitamin_e','IU',1.49),1165:('vitamin_b1','mg',1),
 1166:('vitamin_b2','mg',1),1167:('vitamin_b3','mg',1),1170:('vitamin_b5','mg',1),
 1175:('vitamin_b6','mg',1),1177:('vitamin_b9','µg',1),1178:('vitamin_b12','µg',1),
 1180:('choline','mg',1),1162:('vitamin_c','mg',1),1185:('vitamin_k','µg',1),
 1201:('tryptophan','g',1),1202:('threonine','g',1),1203:('isoleucine','g',1),
 1204:('leucine','g',1),1205:('lysine','g',1),1206:('methionine','g',1),
 1207:('cystine','g',1),1208:('phenylalanine','g',1),1209:('tyrosine','g',1),
 1210:('valine','g',1),1211:('arginine','g',1),1212:('histidine','g',1),
 1008:('energy_food_kcal','kcal',1),1005:('carbohydrate_by_difference','g',1),
 1269:('c18_2_undifferentiated','g',1),1271:('c20_4_undifferentiated','g',1),
 1105:('vitamin_a_retinol_ug','µg',1),1107:('beta_carotene_ug','µg',1),
}
# Gli ID degli aminoacidi sono verificati per nome, non assunti dall'ordine.
AA_NAMES = {
 'Tryptophan':'tryptophan','Threonine':'threonine','Isoleucine':'isoleucine',
 'Leucine':'leucine','Lysine':'lysine','Methionine':'methionine','Cystine':'cystine',
 'Phenylalanine':'phenylalanine','Tyrosine':'tyrosine','Valine':'valine',
 'Arginine':'arginine','Histidine':'histidine',
}
for aa_id in list(MAP):
 if 1200 <= aa_id <= 1220:
  del MAP[aa_id]

def missing(): return {c:{'value':'NA'} for c in codes}
def item(value, unit, source, method, status=None, basis='per_100g', kind=None, **kw):
 n = {'value':round(value,12),'unit':unit,'status':status or ('measured' if value == 0 else 'estimated'),
      'basis':basis,'source':source,'method':method}
 if kind: n['declared_total_or_added']=kind
 n.update(kw)
 return n

def numeric(n): return isinstance(n.get('value'),(int,float))

def from_usda(ident, fdc, name=None, category=None, subcategory=None, state=None):
 f=deepcopy(old_foods[ident]) if ident in old_foods else {
  'id':ident,'name_it':name,'category':category,'subcategory':subcategory,
  'processing_state':state,'edible_portion':'100 g parte edibile',
  'available_to_formulate':False,'data_status':'estimated'}
 d=USDA[fdc]
 src=f"USDA FoodData Central SR Legacy, FDC {fdc}; API ufficiale acquisita 20/10/2026"
 url=f'https://fdc.nal.usda.gov/food-details/{fdc}/nutrients'
 ns=missing()
 lookup={n['nutrient']['id']:n for n in d['foodNutrients'] if isinstance(n.get('amount'),(int,float))}
 names={n['nutrient']['name']:n for n in d['foodNutrients'] if isinstance(n.get('amount'),(int,float))}
 for key,n in lookup.items():
  if key not in MAP: continue
  code,unit,mul=MAP[key]
  method=f"Dato della banca dati: {n['nutrient']['name']}, ID {key}, {n['amount']} {n['nutrient']['unitName']}/100 g; profilo tipico, non analisi del lotto."
  status=None
  if mul != 1:
   method+=f' Conversione ×{mul}.'
   status='calculated'
  extra={}
  if code=='vitamin_e':
   extra['form']='d_alpha_tocopherol'
   method+=' Alfa-tocoferolo alimentare naturale: conversione convenzionale 1,49 UI/mg; non tutti i tocoferoli.'
  ns[code]=item(n['amount']*mul,unit,src,method,status=status,**extra)
 for name,code in AA_NAMES.items():
  if name in names:
   n=names[name]
   ns[code]=item(n['amount'],'g',src,f'Dato USDA {name}, ID {n["nutrient"]["id"]}; per 100 g.')
 for total,a,b in [('methionine_cystine','methionine','cystine'),('phenylalanine_tyrosine','phenylalanine','tyrosine')]:
  if numeric(ns[a]) and numeric(ns[b]):
   ns[total]=item(ns[a]['value']+ns[b]['value'],'g',src,f'Somma {a}+{b}, senza doppio conteggio.',status='calculated')
 if numeric(ns['epa']) and numeric(ns['dha']):
  ns['epa_dha']=item(ns['epa']['value']+ns['dha']['value'],'g',src,'Somma EPA+DHA, sottoinsieme dei grassi.',status='calculated')
 if numeric(ns['carbohydrate_by_difference']) and numeric(ns['fiber']):
  v=ns['carbohydrate_by_difference']['value']-ns['fiber']['value']
  if v >= 0:
   ns['carbohydrate_available']=item(v,'g',src,'Carboidrati per differenza meno fibra alimentare totale: stima, non misura diretta né ENA garantiti.',status='calculated')
 # Attività preformata da retinolo: non utilizzare le UI umane dei carotenoidi.
 # Nei profili con carotenoidi positivi il totale vitaminico canino resta NA.
 carot=[names.get(s) for s in ['Carotene, beta','Carotene, alpha','Cryptoxanthin, beta']]
 ret=ns['vitamin_a_retinol_ug']
 if numeric(ret) and all(c is not None and c['amount']==0 for c in carot):
  ns['vitamin_a']=item(ret['value']/0.3,'IU',src+'; NIH/USDA DSID https://dsid.od.nih.gov/unit-conversions',
   'Retinolo preformato /0,3 µg per UI; carotenoidi specificati dalla fonte pari a zero. Non conversione di RAE vegetali.',status='calculated')
 elif names.get('Vitamin A, IU',{}).get('amount')==0 and ret.get('value')==0:
  ns['vitamin_a']=item(0,'IU',src,'Zero presente nella fonte USDA per vitamina A; non inferito da dato mancante.')
 if names.get('Vitamin A, IU',{}).get('amount',0)>0 and ret.get('value')==0:
  ns['vitamin_a_carotenoid_iu']=item(names['Vitamin A, IU']['amount'],'IU',src,
   'UI USDA per etichettatura umana da carotenoidi, conservate solo come dato di fonte; NON attività vitaminica canina.')
 p,fa,c=[ns[k]['value'] for k in ['protein','fat','carbohydrate_available']]
 e=4*p+9*fa+4*c
 if ident in ['coconut_oil','flaxseed_oil']:
  e=round(e)  # 900,26 kcal/100 g del lino -> 900: arrotondamento, non nuova analisi.
  f['preparation']='Olio alimentare pesato in grammi; aggiungere secondo prescrizione. Marca e lotto non identificati: proxy generico USDA.'
 f.update(nutrients=ns,kcal_me_per_100g=round(e,6),
  me_method='Stima di confronto 4/9/4 su proteine, grassi e carboidrati disponibili; non ME canina misurata; per oli arrotondata alle kcal intere per 100 g.',
  source=src,source_url=url,source_version=f"SR Legacy; FDC {fdc}; acquisizione API 20/10/2026",data_status='estimated',
  uncertainty='Proxy generico USDA: composizione tipica, non lotto; cloruro e iodio non disponibili; non si sommano acidi grassi alle masse dei grassi.',
  notes=f"Fonte primaria: {d['description']}. Energia USDA per uso umano conservata separatamente. Vitamina D: usare UI native USDA; µg arrotondati possono dare una conversione diversa. Linoleico solo se 18:2 n-6 cis,cis presente; 18:2 non differenziato resta separato. Questo aggiornamento non convalida il prodotto.")
 return f

specs=[('beef_03',173111),('beef_15',171796),('beef_30',168652),('oat_dry',173904),
 ('carrot_cooked',170394),('pumpkin_cooked',168449),
 ('beef_05',171790,'Macinato di manzo crudo 5% grassi — proxy USDA','animal','muscle','raw'),
 ('beef_10',174030,'Macinato di manzo crudo 10% grassi — proxy USDA','animal','muscle','raw'),
 ('coconut_oil',171412,'Olio di cocco alimentare — proxy USDA','other','fat_oil','raw'),
 ('flaxseed_oil',167702,'Olio di lino alimentare spremuto a freddo — proxy USDA','other','fat_oil','raw')]
foods=[from_usda(*s) for s in specs]
by={x['id']:x for x in foods}

PSRC='Erbavoglio, Cuticola di Psillio Bio, EAN 8021354007639; https://erbavoglio.it/shop/cuticola-di-psillio-bio/ ; scheda consultata 20/10/2026'
psy={'id':'psyllium_erbavoglio_husk_bio','name_it':'Erbavoglio — Cuticola di Psillio Bio (EAN 8021354007639)',
 'brand':'Erbavoglio','product_variant':'Cuticola Bio, 200 g; EAN 8021354007639; NON polvere di cuticola Bio',
 'class':'fiber','dose_unit':'g','integer_dose':False,
 'label_source':PSRC,'source_url':'https://erbavoglio.it/shop/cuticola-di-psillio-bio/',
 'product_version':'Scheda produttore consultata 20/10/2026; confezione del 2025 non verificata',
 'data_status':'review_required','label_added_only':False,'usable_for_optimization':False,
 'notes':'Profilo di confronto, non identificazione certa del prodotto usato nel 2025. La prescrizione dice cuticole Erbavoglio ma non EAN. Etichetta 194 kcal/100 g per uso umano (811 kJ), NON ME canina. Energia per dose omessa perché non documentata per il cane. L’eventuale 4/9/4 sui soli macro non fibrosi darebbe 0,1404 kcal/g ma omette la fermentazione della fibra: il motore non deve farne una ME completa attestata. Non trasferire al cane la dose umana. Sale etichetta arrotondato a 0 non diventa sodio/cloruro zero. Variante polvere Bio diversa: proteine5%, grassi1,25%, carboidrati0,2%, fibra85%; energia pubblicata incoerente tra kJ e kcal. Non mescolare i due profili.',
 'nutrients':missing()}
for code,value in [('protein',.80),('fat',.24),('carbohydrate_available',2.17),('fiber',89.80)]:
 psy['nutrients'][code]=item(value,'g',PSRC,'Etichetta del produttore per 100 g; profilo specifico Cuticola Bio.',status='label',kind='total')
psy['nutrients']['energy_food_kcal']=item(194,'kcal',PSRC,'Energia etichetta uso umano, NON ME cane.',status='label',kind='total')

# Aggiornamenti esistenti tenuti separati dai prodotti nuovi.
updates=[x for x in foods if x['id'] in old_foods]
new=[x for x in foods if x['id'] not in old_foods]
for name,data in [('alimenti_esistenti_aggiornati.json',{'foods':updates}),('alimenti_nuovi_confronto.json',{'foods':new}),
 ('psillio_confronto.json',{'supplements':[psy]})]:
 (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

# Riferimenti minimi: tabella III-3b, FEDIAF2025, valori per 1000 kcal.
MINS={
 'protein':(52.1,45),'fat':(13.75,13.75),'linoleic_acid':(3.82,3.27),
 'calcium':(1.45,1.25),'phosphorus':(1.16,1),'potassium':(1.45,1.25),
 'sodium':(.29,.25),'chloride':(.43,.38),'magnesium':(.20,.18),
 'copper':(2.08,1.80),'iodine':(.30,.26),'iron':(10.4,9),'manganese':(1.67,1.44),
 'selenium_wet':(67.5,57.5),'zinc':(20.8,18),'vitamin_a':(1754,1515),'vitamin_d':(159,138),
 'vitamin_e':(10.4,9),'vitamin_b1':(.62,.54),'vitamin_b2':(1.74,1.5),'vitamin_b3':(4.74,4.09),
 'vitamin_b5':(4.11,3.55),'vitamin_b6':(.42,.36),'vitamin_b9':(74.7,64.5),
 'vitamin_b12':(9.68,8.36),'choline':(474,409),
 'arginine':(1.51,1.30),'histidine':(.67,.58),'isoleucine':(1.33,1.15),'leucine':(2.37,2.05),
 'lysine':(1.22,1.05),'methionine':(1.16,1),'methionine_cystine':(2.21,1.91),
 'phenylalanine':(1.56,1.35),'phenylalanine_tyrosine':(2.58,2.23),'threonine':(1.51,1.30),
 'tryptophan':(.49,.43),'valine':(1.71,1.48)}
MAXS={'calcium':6.25,'phosphorus':4,'vitamin_a':100000,'vitamin_d':800}
AA=set(AA_NAMES.values())|{'methionine_cystine','phenylalanine_tyrosine'}
CANON={v[0]:v[1] for v in MAP.values()}
CANON.update({x:'g' for x in AA});CANON.update({'vitamin_a':'IU','epa_dha':'g','omega3_total':'g','omega6_total':'g'})

def per_unit(x,code):
 n=x['nutrients'].get(code,{})
 if not numeric(n): return None
 value=n['value'];unit=n['unit'];desired=CANON.get(code,unit)
 mass={'g':1,'mg':.001,'µg':.000001}
 if code=='choline' and n.get('form')=='choline_chloride':
  value*=.746
 if code=='vitamin_e' and unit=='mg' and desired=='IU':
  value*={'d_alpha_tocopherol':1.49,'all_rac_alpha_tocopheryl_acetate':1,'d_alpha_tocopheryl_acetate':1.36}[n['form']]
 elif unit in mass and desired in mass: value*=mass[unit]/mass[desired]
 elif unit != desired: raise ValueError((x['id'],code,unit,desired))
 base=n.get('basis','per_100g' if 'category' in x else 'per_dose')
 value/=({'per_100g':100,'per_kg':1000,'per_g':1,'per_dose':n.get('per_dose',1)})[base]
 return value

def scenario(meat,veg='carrot_cooked'):
 parts=[(by[meat],560),(by['oat_dry'],100),(by['coconut_oil'],10),(by['flaxseed_oil'],10),
  (by[veg],90),(next(x for x in supps if x['id']=='bone_meal'),5),
  (next(x for x in supps if x['id']=='qdiet'),13),
  (next(x for x in supps if x['id']=='omegor_vitality'),1),(psy,5)]
 totals={};unknown={};added={};contr={}
 for code in codes:
  values=[];missing_ids=[];added_ids=[];contributors={}
  for x,dose in parts:
   v=per_unit(x,code)
   if v is None:missing_ids.append(x['id']);continue
   values.append(v*dose);contributors[x['id']]=v*dose
   if x['nutrients'][code].get('declared_total_or_added')=='added':added_ids.append(x['id'])
  totals[code]=sum(values);unknown[code]=missing_ids;added[code]=added_ids;contr[code]=contributors
 energy_parts={x['id']:dose*(x['kcal_me_per_100g']/100 if 'category' in x else x.get('kcal_per_unit',0)) for x,dose in parts}
 energy=sum(energy_parts.values())
 macro={c:totals[c]*v for c,v in [('protein',4),('fat',9),('carbohydrate_available',4)]}
 shares={c:v/sum(macro.values())*100 for c,v in macro.items()}
 controls=[]
 for c,(m95,m110) in MINS.items():
  mult=1.1 if c in AA else 1
  row={'nutrient':c,'unit':CANON.get(c,'g'),'known_daily':totals[c],
   'min95_1340':m95*1.34*mult,'min110_1340':m110*1.34*mult,
   'missing':unknown[c],'added':added[c]}
  for key in ['95','110']:
   low=row['min'+key+'_1340']
   row['result'+key]=('minimo coperto dal contributo noto' if totals[c]>=low-1e-10 else
    'copertura non verificabile' if unknown[c] else 'sotto riferimento del modello')
  if c in MAXS:
   row['max_1340']=MAXS[c]*1.34
   row['max_result']=('oltre massimo nominale' if totals[c]>row['max_1340'] else
    'massimo non verificabile' if unknown[c] or added[c] else 'entro massimo nominale')
  controls.append(row)
 return {'scenario':meat+'_'+veg,'target_prescritto_kcal':1340,'energy_model_partial_kcal':energy,
  'energy_unknown_sources':['bone_meal','psyllium_erbavoglio_husk_bio'],
  'energy_qualification':'Totale parziale stimato; involucro Omegor non quantificato; metodi 4/9/4 e ME dichiarata distinti.',
  'energy_parts':energy_parts,'known_totals':totals,'unknown':unknown,'added':added,
  'contributors':contr,'macro_shares_partial_4_9_4':shares,
  'cap_known_ratio':totals['calcium']/totals['phosphorus'], 'controls':controls,
  'recipe':[{'id':x['id'],'quantity':dose,'unit':'g' if 'category' in x else x['dose_unit']} for x,dose in parts]}

scenarios=[scenario(m,v) for m in ['beef_03','beef_05','beef_10'] for v in ['carrot_cooked','pumpkin_cooked']]
(OUT/'risultati_dettagliati.json').write_text(json.dumps(scenarios,ensure_ascii=False,indent=2)+'\n')

# B5: conversione chimica documentata, assunzione sulla forma del prodotto ancora distinta.
mw=json.loads((OUT/'fonti/pubchem_pantotenato.json').read_text())['PropertyTable']['Properties']
weights={x['CID']:float(x['MolecularWeight']) for x in mw}
b5_factor=2*weights[6613]/weights[443753]
b5_per_kg=450*b5_factor
patch_b5={'supplements':[{
 'id':'qdiet','dose_unit':'g','label_source':supps[0]['label_source'],
 'nutrients':{'vitamin_b5':item(b5_per_kg,'mg',
  supps[0]['source_url']+' ; PubChem CID443753 e CID6613',
  f'Stima CONDIZIONALE: originale 450 mg/kg di calcio D-pantotenato; assumendo sale anidro e massa riferita al sale attivo, fattore=2×219,23/476,5={b5_factor:.12f}. Non sommare ai 450 mg originari. La forma/purezza dell’additivo nel prodotto non è documentata; non analisi totale.',
  status='estimated',basis='per_kg',kind='added',form='calcium_d_pantothenate')}
 }]}
pending=OUT/'non_importare_automaticamente';pending.mkdir(exist_ok=True)
(pending/'qdiet_b5_condizionale.json').write_text(json.dumps(patch_b5,ensure_ascii=False,indent=2)+'\n')
source_pdf=ROOT/'upload/TRIVISANI, KER.pdf'
source_document=({'filename':source_pdf.name,'sha256':hashlib.sha256(source_pdf.read_bytes()).hexdigest(),'page':2,'prescription_date':'2025-10-01'}
 if source_pdf.exists() else json.loads((OUT/'caso_prescritto_non_importare_come_catalogo.json').read_text())['source_document'])
bench={
 'purpose':'Analisi prescrizione a quantità fisse; NON file del catalogo e NON schema importatore ricette.',
 'source_document':source_document,
 'patient_at_prescription':{'name':'Ker','species':'dog','sex':'female','age_years':6,'weight_current_kg':30.2,'weight_reference_kg':27.2,'bcs_9':6},
 'target_prescribed_kcal':1340,'fixed_quantities':scenarios[2]['recipe'],
 'scenario_assumptions':['Il bovino5% è un proxy esemplificativo, NON la carne identificata dalla prescrizione: confrontare anche3% e10%.',
  'Scelte esplicite fra alternative: carote e olio di lino; non canapa o zucca in contemporanea.',
  'Verdure90g considerate pesate cotte nel confronto; il documento non rende esplicita questa convenzione di pesata.',
  'Avena100g considerata pesata secca prima dell’ammollo indicato nelle istruzioni.',
  'Psillio: variante Cuticola Bio attuale assunta, non confezione2025 identificata; confronto con polvere Bio separato.',
  'Grau: profilo trascritto22,6%Ca/17,7%P, non nuova formulazione.',
  'Tutte le quantità bloccate. QDiet13g da prescrizione, tabella d’impiego come avviso: nessun cambiamento automatico del limite del generatore.'],
 'b5_conditional':{'factor':b5_factor,'mg_per_g_qdiet':b5_per_kg/1000,'mg_at_13g':b5_per_kg*.013,
  'import_status':'non applicata nel calcolo principale; stima condizionale separata'},
 'independent_results_file':'risultati_dettagliati.json'}
(OUT/'caso_prescritto_non_importare_come_catalogo.json').write_text(json.dumps(bench,ensure_ascii=False,indent=2)+'\n')
with (OUT/'confronto_nutrienti.csv').open('w',newline='') as h:
 w=csv.writer(h,delimiter=';');w.writerow(['scenario','nutriente','unita','contributo_noto_giorno','min95_su1340','min110_su1340','esito95','esito110','fonti_mancanti','fonti_added'])
 for s in scenarios:
  for r in s['controls']:
   w.writerow([s['scenario'],r['nutrient'],r['unit'],f"{r['known_daily']:.9g}",f"{r['min95_1340']:.9g}",f"{r['min110_1340']:.9g}",r['result95'],r['result110'],','.join(r['missing']),','.join(r['added'])])

# Verifiche significative di unità e contabilizzazione.
assert abs(per_unit(supps[0],'vitamin_d')*13-325)<1e-9
assert abs(per_unit(supps[0],'calcium')*13-2.34)<1e-9
assert abs(per_unit(supps[0],'choline')*13-872.82)<1e-8
assert abs(per_unit(supps[2],'phosphorus')*5-.885)<1e-9
assert abs(per_unit(by['flaxseed_oil'],'ala')*10-5.3368)<1e-9
assert abs(per_unit(by['flaxseed_oil'],'linoleic_acid')*10-1.4246)<1e-9
assert abs(per_unit(psy,'fiber')*5-4.49)<1e-9
assert abs(per_unit(supps[1],'epa_dha')-.803)<1e-9
for s in scenarios:
 assert abs(s['known_totals']['vitamin_d']-341.8)<1e-8
 assert s['known_totals']['epa_dha']>=.803
 assert abs(sum(s['macro_shares_partial_4_9_4'].values())-100)<1e-8
for payload in [{'foods':updates},{'foods':new},{'supplements':[psy]}]:
 for arr in payload.values():
  for x in arr:
   assert not x['id'].startswith('test_')
   for code,n in x['nutrients'].items():
    assert code in codes
    if numeric(n):
     assert n['value']>=0 and n['status'] and n['source']
     assert not (n['value']==0 and n['status']=='estimated')
   if 'category' in x: assert 0<=x['kcal_me_per_100g']<=900

for s in scenarios:
 print(s['scenario'],'E_model',round(s['energy_model_partial_kcal'],2),
  'Ca/P',round(s['cap_known_ratio'],4),'D',s['known_totals']['vitamin_d'],
  'fibra',round(s['known_totals']['fiber'],3),'ALA_noto',round(s['known_totals']['ala'],3),
  'macro', {k:round(v,2) for k,v in s['macro_shares_partial_4_9_4'].items()})
 print('sotto/noncoperti95:',[(r['nutrient'],round(r['known_daily'],4),round(r['min95_1340'],4),r['result95']) for r in s['controls'] if not r['result95'].startswith('minimo coperto')])
print('Controlli aritmetici e strutturali locali superati. Non eseguito nell’importatore o nel motore iPhone.')
