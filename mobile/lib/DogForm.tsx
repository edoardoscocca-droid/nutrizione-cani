import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { applyDogChange, breedNotesFor, newDog, planDogChange } from '../../src/engine/dogProfile';
import { fediafReferenceKcal, mer, rer, WEIGHT_GAP_MESSAGE, weightGapNeedsWarning } from '../../src/engine/energy';
import type { LifeStage, PersonalTarget } from '../../src/engine/types';
import { KCAL_SOURCE_LABEL, type Dog, type KcalSource, type MacroPreference } from '../../src/data/model';
import { uid } from '../../src/data/repository';
import { num } from '../../src/ui/format';
import { useApp, useData } from './AppContext';
import { Box, Button, Card, Check, Choice, ErrorBox, Field, H, Loading, NumField, Row, Screen, Sheet, T, Toggle } from './ui';

const LIFE_STAGE: { value: LifeStage; label: string }[] = [
  { value: 'adult_maintenance', label: 'Adulto' },
  { value: 'growth', label: 'Cucciolo' },
  { value: 'gestation', label: 'Gestazione' },
  { value: 'lactation', label: 'Allattamento' },
  { value: 'other', label: 'Altro/clinico' },
];
const MACROS: { metric: MacroPreference['metric']; label: string }[] = [
  { metric: 'protein_energy_pct', label: 'Proteine' },
  { metric: 'fat_energy_pct', label: 'Grassi' },
  { metric: 'carb_energy_pct', label: 'Carboidrati disponibili' },
];

function confirm(title: string, message: string, buttons: { text: string; value: string; style?: 'cancel' | 'destructive' | 'default' }[]): Promise<string | null> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [...buttons.map((b) => ({ text: b.text, style: b.style, onPress: () => resolve(b.value) }))], { cancelable: true, onDismiss: () => resolve(null) }),
  );
}

export default function DogForm({ id }: { id?: string }) {
  const { repo, catalog, bump } = useApp();
  const { data: before } = useData(async (r) => (id ? ((await r.listDogs()).find((d) => d.id === id) ?? null) : null), [id]);
  const [dog, setDog] = useState<Dog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id && before) setDog(before);
    if (!id && !dog) setDog(newDog({ name: '', weightCurrentKg: 0 }, uid()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, before]);

  if (!dog || !repo || (id && !before)) return <Loading />;
  const set = <K extends keyof Dog>(k: K, v: Dog[K]) => setDog({ ...dog, [k]: v });
  const validWeights = dog.weightCurrentKg > 0 && dog.weightIdealKg > 0;
  const gap = validWeights && weightGapNeedsWarning(dog.weightCurrentKg, dog.weightIdealKg);
  const estimate = validWeights ? mer(dog.weightIdealKg, dog.activityFactor) : null;
  const notes = catalog ? breedNotesFor(dog.breed, catalog.breedNotes) : [];
  const factorsOk = catalog?.energyFactors.protein != null;

  const persist = async (next: Dog) => {
    await repo.saveDog(next);
    if (!before || before.weightCurrentKg !== next.weightCurrentKg) {
      await repo.addWeight({ id: uid(), dogId: next.id, date: new Date().toISOString(), weightKg: next.weightCurrentKg });
    }
    bump();
    router.back();
  };

  const submit = async () => {
    setError(null);
    if (!dog.name.trim()) return setError('Inserisci il nome.');
    if (!validWeights) return setError('Inserisci peso attuale e peso ideale maggiori di zero.');
    if (gap) {
      const ok = await confirm('Attenzione al peso', `${WEIGHT_GAP_MESSAGE}.\n5 kg è una soglia concordata per l’app, non un limite clinico universale.`, [
        { text: 'Annulla', value: 'no', style: 'cancel' },
        { text: 'Ho letto, continua', value: 'yes' },
      ]);
      if (ok !== 'yes') return;
    }
    setBusy(true);
    try {
      if (!before) {
        await persist({
          ...dog,
          kcalTarget: dog.kcalTarget ?? (estimate ? Math.round(estimate) : null),
          kcalSource: dog.kcalTarget ? dog.kcalSource : estimate ? 'estimated' : dog.kcalSource,
        });
        return;
      }
      const plan = planDogChange(before, dog);
      let accept = false;
      if (plan.proposeKcalUpdate && plan.newEstimate !== null) {
        const r = await confirm('Nuova stima energetica', `${num(plan.newEstimate, 0)} kcal/die (ora ${dog.kcalTarget ? num(dog.kcalTarget, 0) : '—'}, ${KCAL_SOURCE_LABEL[dog.kcalSource]}).`, [
          { text: 'Usa la nuova stima', value: 'yes' },
          { text: 'Mantieni le kcal attuali', value: 'no' },
          { text: 'Annulla', value: 'cancel', style: 'cancel' },
        ]);
        if (r === 'cancel' || r === null) return;
        accept = r === 'yes';
      }
      if (plan.formulationChanged) {
        const n = (await repo.listRecipes(dog.id)).length;
        if (n > 0) {
          const r = await confirm('Ricette da ricalcolare', `Cambiano dati che incidono sulla formulazione. Le ${n} ricette di ${before.name} saranno segnalate da ricalcolare: nessuna viene modificata finché non confermi una nuova versione.`, [
            { text: 'Annulla', value: 'no', style: 'cancel' },
            { text: 'Salva', value: 'yes' },
          ]);
          if (r !== 'yes') return;
        }
      }
      await persist(applyDogChange(before, dog, accept));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setMacro = (metric: MacroPreference['metric'], patch: Partial<MacroPreference>) => {
    const cur = dog.macroPreferences.find((m) => m.metric === metric) ?? { metric, lower: null, upper: null, locked: false };
    set('macroPreferences', [...dog.macroPreferences.filter((m) => m.metric !== metric), { ...cur, ...patch }]);
  };

  return (
    <Screen>
      <ErrorBox error={error} />
      <Card>
        <H level={3}>Dati</H>
        <Field label="Nome" value={dog.name} onChange={(v) => set('name', v)} />
        <Field label="Razza (anche «meticcio»)" value={dog.breed ?? ''} onChange={(v) => set('breed', v || null)} />
        {notes.map((n) => (
          <Box key={n.id} color="purple">
            <T small>{n.text}</T>
          </Box>
        ))}
        <Row>
          <NumField label="Età (anni)" value={dog.ageYears} onChange={(v) => set('ageYears', v)} />
          <View style={{ flex: 1, gap: 4 }}>
            <T small muted>Sesso</T>
            <Choice options={[{ value: 'M' as const, label: 'M' }, { value: 'F' as const, label: 'F' }]} value={dog.sex ?? ('' as never)} onChange={(v) => set('sex', v)} />
          </View>
        </Row>
        <Toggle label="Sterilizzato" value={!!dog.sterilized} onChange={(v) => set('sterilized', v)} />
        <T small muted>Fase di vita</T>
        <Choice options={LIFE_STAGE} value={dog.lifeStage} onChange={(v) => set('lifeStage', v)} />
        {dog.lifeStage !== 'adult_maintenance' && (
          <Box color="orange">
            <T small>I riferimenti disponibili valgono solo per l’adulto in mantenimento: per questa fase le ricette risulteranno non verificabili. Serve un veterinario nutrizionista.</T>
          </Box>
        )}
      </Card>

      <Card>
        <H level={3}>Peso ed energia</H>
        <Row>
          <NumField label="Peso attuale (kg)" value={dog.weightCurrentKg || null} onChange={(v) => setDog({ ...dog, weightCurrentKg: v ?? 0, weightIdealKg: before ? dog.weightIdealKg : (v ?? 0) })} />
          <NumField label="Peso ideale (kg)" value={dog.weightIdealKg || null} onChange={(v) => set('weightIdealKg', v ?? 0)} />
        </Row>
        {gap && (
          <Box color="orange">
            <T small bold>{WEIGHT_GAP_MESSAGE}.</T>
          </Box>
        )}
        <Row>
          <NumField label="Condizione corporea (BCS)" value={dog.bcs} onChange={(v) => set('bcs', v)} />
          <NumField label="Fattore energetico" value={dog.activityFactor} onChange={(v) => set('activityFactor', v)} placeholder="da indicare" />
        </Row>
        <T small muted>La stima usa il peso ideale (convenzione dell’app): non sempre è appropriata in sovrappeso, sottopeso o patologie.</T>
        {validWeights && (
          <View style={{ gap: 2 }}>
            <T small>RER (70 × kg^0,75): {num(rer(dog.weightIdealKg), 0)} kcal/die</T>
            <T small>MER stimata: {estimate ? `${num(estimate, 0)} kcal/die` : 'serve il fattore energetico'}</T>
            <T small muted>Riferimento FEDIAF 95 kcal/kg^0,75 (confronto): {num(fediafReferenceKcal(dog.weightIdealKg), 0)} kcal/die</T>
          </View>
        )}
        <NumField label="Obiettivo kcal/die" value={dog.kcalTarget} onChange={(v) => setDog({ ...dog, kcalTarget: v, kcalSource: dog.kcalSource === 'estimated' ? 'user' : dog.kcalSource })} />
        <T small muted>Provenienza</T>
        <Choice options={(Object.keys(KCAL_SOURCE_LABEL) as KcalSource[]).map((k) => ({ value: k, label: KCAL_SOURCE_LABEL[k] }))} value={dog.kcalSource} onChange={(v) => set('kcalSource', v)} />
        {estimate && <Button title={`Usa la stima (${num(estimate, 0)} kcal)`} kind="secondary" small onPress={() => setDog({ ...dog, kcalTarget: Math.round(estimate), kcalSource: 'estimated' })} />}
      </Card>

      <Card>
        <H level={3}>Preferenze di formulazione</H>
        <T small muted>Percentuali delle kcal, non del peso degli ingredienti. Preferenze flessibili: i limiti nutrizionali vengono prima. Nessun intervallo «ufficiale» precaricato.</T>
        {!factorsOk && (
          <Box color="grey">
            <T small>I fattori energetici non sono ancora approvati: le preferenze si salvano ma non entrano nel calcolo.</T>
          </Box>
        )}
        {MACROS.map((m) => {
          const cur = dog.macroPreferences.find((x) => x.metric === m.metric);
          return (
            <View key={m.metric} style={{ gap: 4 }}>
              <T small bold>{m.label} (% kcal)</T>
              <Row>
                <NumField placeholder="min" value={cur?.lower ?? null} onChange={(v) => setMacro(m.metric, { lower: v })} />
                <NumField placeholder="max" value={cur?.upper ?? null} onChange={(v) => setMacro(m.metric, { upper: v })} />
              </Row>
              <Check label="fissato da un professionista (rigido)" value={!!cur?.locked} onChange={(v) => setMacro(m.metric, { locked: v })} />
            </View>
          );
        })}
        <T small bold>Fibra (g/die), parametro separato</T>
        <Row>
          <NumField placeholder="min" value={dog.fiberTarget?.lower ?? null} onChange={(v) => set('fiberTarget', { lower: v, upper: dog.fiberTarget?.upper ?? null, basis: 'per_day' })} />
          <NumField placeholder="max" value={dog.fiberTarget?.upper ?? null} onChange={(v) => set('fiberTarget', { lower: dog.fiberTarget?.lower ?? null, upper: v, basis: 'per_day' })} />
        </Row>
        <Field label="Preferenze sugli ingredienti" value={dog.ingredientPreferences ?? ''} onChange={(v) => set('ingredientPreferences', v || null)} multiline />
      </Card>

      <TargetsEditor dog={dog} onChange={(tg) => set('targets', tg)} />

      <Card>
        <H level={3}>Note</H>
        <Field label="Note cliniche" value={dog.clinicalNotes ?? ''} onChange={(v) => set('clinicalNotes', v || null)} multiline />
        <Field
          label="Note di attenzione (viola, senza numeri) — una per riga"
          value={dog.notes.map((n) => n.text).join('\n')}
          onChange={(v) => set('notes', v.split('\n').filter(Boolean).map((text) => ({ text, source: 'nota individuale' })))}
          multiline
        />
      </Card>
      <Button title="Salva" busy={busy} onPress={submit} />
    </Screen>
  );
}

function TargetsEditor({ dog, onChange }: { dog: Dog; onChange: (t: PersonalTarget[]) => void }) {
  const { catalog } = useApp();
  const [picking, setPicking] = useState<number | null>(null);
  const nutrients = (catalog?.nutrients ?? []).filter((n) => n.kind !== 'composition' && n.group !== 'source_reference');
  const upd = (i: number, p: Partial<PersonalTarget>) => onChange(dog.targets.map((t, j) => (j === i ? { ...t, ...p } : t)));
  return (
    <Card>
      <H level={3}>Target personalizzati</H>
      <T small muted>Distinti dai limiti ufficiali. Rigidi solo se fissati da un professionista (indica chi). L’app non suggerisce valori.</T>
      {dog.targets.map((t, i) => {
        const n = nutrients.find((x) => x.id === t.metric);
        return (
          <View key={t.id} style={{ gap: 6, paddingVertical: 6 }}>
            <Pressable onPress={() => setPicking(i)}>
              <T bold>{n?.label ?? t.metric} ▾</T>
            </Pressable>
            <Row>
              <NumField placeholder="min" value={t.lower} onChange={(v) => upd(i, { lower: v })} />
              <NumField placeholder="max" value={t.upper} onChange={(v) => upd(i, { upper: v })} />
            </Row>
            <Choice
              options={
                n?.unit === 'ratio'
                  ? [{ value: 'ratio' as const, label: 'rapporto' }]
                  : n?.unit === '%'
                    ? [{ value: 'energy_pct' as const, label: '% kcal' }]
                    : [
                        { value: 'per_day' as const, label: `${n?.unit ?? ''}/die` },
                        { value: 'per_1000_kcal_me' as const, label: `${n?.unit ?? ''}/1000 kcal` },
                      ]
              }
              value={t.basis}
              onChange={(v) => upd(i, { basis: v })}
            />
            <Field label="Impostato da" value={t.setBy} onChange={(v) => upd(i, { setBy: v })} />
            <Check label="Professionista (vincolo rigido)" value={t.locked} onChange={(v) => upd(i, { locked: v })} />
            <Button title="Rimuovi" kind="danger" small onPress={() => onChange(dog.targets.filter((_, j) => j !== i))} />
          </View>
        );
      })}
      <Button
        title="+ Aggiungi target"
        kind="secondary"
        small
        onPress={() => onChange([...dog.targets, { id: uid(), metric: 'protein', lower: null, upper: null, unit: 'g', basis: 'per_day', locked: false, setBy: '', setAt: new Date().toISOString().slice(0, 10) }])}
      />
      <Sheet visible={picking !== null} title="Scegli il nutriente" onClose={() => setPicking(null)}>
        {nutrients.map((n) => (
          <Button
            key={n.id}
            title={n.label}
            kind="ghost"
            small
            onPress={() => {
              if (picking !== null) upd(picking, { metric: n.id, unit: n.unit, basis: n.unit === 'ratio' ? 'ratio' : n.unit === '%' ? 'energy_pct' : 'per_day' });
              setPicking(null);
            }}
          />
        ))}
      </Sheet>
    </Card>
  );
}
