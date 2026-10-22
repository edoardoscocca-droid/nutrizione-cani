import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { isTestFixture } from '../../../../src/data/catalogVisibility';
import { resolveConfig } from '../../../../src/engine/configV2';
import { dateRange, dayProfileOf, diarySuggestions, periodSummary, type DiarySuggestion, type PeriodCheck } from '../../../../src/engine/diary';
import { toFormulationProfile } from '../../../../src/engine/dogProfile';
import type { Color } from '../../../../src/engine/types';
import type { DiaryEntry, Recipe, RecipeVersion } from '../../../../src/data/model';
import { activeLimits } from '../../../../src/data/recipeService';
import { uid } from '../../../../src/data/repository';
import { num } from '../../../../src/ui/format';
import { useApp, useData } from '../../../lib/AppContext';
import { Box, Bullets, Button, Card, Choice, Dot, ErrorBox, Field, H, Loading, NumField, Row, Screen, T } from '../../../lib/ui';

/** data di oggi nel fuso del telefono, AAAA-MM-GG */
function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const it = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
const RANK: Record<Color, number> = { red: 0, orange: 1, grey: 2, yellow: 3, green: 4, blue: 5, purple: 6 };

export default function DiaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, catalog, settings, bump } = useApp();
  const { data } = useData(
    async (r) => {
      const dog = (await r.listDogs()).find((d) => d.id === id) ?? null;
      const recipes = await r.listRecipes(id);
      const versions: Record<string, RecipeVersion[]> = Object.fromEntries(await Promise.all(recipes.map(async (rc) => [rc.id, await r.listVersions(rc.id)] as const)));
      const entries = await r.listDiary(id);
      return { dog, recipes, versions, entries };
    },
    [id],
  );
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [from, setFrom] = useState(today());
  const [days, setDays] = useState<number | null>(1);
  const [window, setWindow] = useState<'7' | '14'>('14');
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sugg, setSugg] = useState<DiarySuggestion[] | null>(null);

  const cfg = useMemo(() => resolveConfig(settings?.formulationV2), [settings]);
  const summary = useMemo(() => {
    if (!data?.dog || !catalog) return null;
    const dog = { ...toFormulationProfile(data.dog, catalog.breedNotes, catalog.recommendedTargets, catalog.nutrients), eaaMarginPct: 10 };
    return periodSummary({
      entries: data.entries.map((e) => ({ date: e.date, recipeName: e.recipeName, revision: e.revision, day: e.day })),
      endDate: today(),
      windowDays: Number(window),
      dog,
      nutrients: catalog.nutrients,
      limits: activeLimits(catalog),
      config: cfg,
    });
  }, [data, catalog, window, cfg]);

  if (!data || !repo || !catalog || !settings) return <Loading />;
  const { dog, recipes, versions, entries } = data;
  if (!dog) return <Screen><T>Cane non trovato.</T></Screen>;
  const usable = recipes.filter((r) => !r.archived && (versions[r.id] ?? []).length > 0);
  const currentOf = (r: Recipe) => {
    const vs = versions[r.id] ?? [];
    return vs.find((v) => v.id === r.currentVersionId) ?? vs[vs.length - 1];
  };
  const chosen = usable.find((r) => r.id === recipeId) ?? null;
  const chosenVersion = chosen ? currentOf(chosen) : null;

  const register = async () => {
    setError(null);
    if (!chosen || !chosenVersion) return setError('Scegli una ricetta.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return setError('Data non valida: usa il formato AAAA-MM-GG.');
    const dates = dateRange(from, days ?? 1);
    if (!dates.length) return setError('Indica almeno un giorno.');
    const replaced = entries.filter((e) => dates.includes(e.date));
    const go = async () => {
      setBusy(true);
      try {
        const day = dayProfileOf(chosenVersion, cfg);
        const now = new Date().toISOString();
        const list: DiaryEntry[] = dates.map((date) => ({ id: uid(), dogId: dog.id, date, recipeId: chosen.id, versionId: chosenVersion.id, recipeName: chosen.name, revision: chosenVersion.revision, day, note: null, createdAt: now }));
        await repo.saveDiaryEntries(list);
        setSugg(null);
        bump();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setBusy(false);
    };
    if (replaced.length) {
      const list = replaced.map((e) => `${it(e.date)}: ${e.recipeName}`).join('\n');
      Alert.alert(
        replaced.length === 1 ? 'Sostituire l’intera giornata?' : `Sostituire ${replaced.length} giornate intere?`,
        `Già registrato:\n${list}\n\nLa ricetta di ogni data è la razione dell’intero giorno: «${chosen.name}» la sostituisce per intero (gli apporti registrati prima per quelle date non contano più).`,
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Sostituisci', style: 'destructive', onPress: () => void go() },
        ],
      );
    } else await go();
  };

  const suggest = () => {
    setError(null);
    if (!summary) return;
    // ricetta registrata più di recente nella finestra, con la sua versione
    const last = [...entries].filter((e) => e.date >= summary.from && e.date <= summary.to && e.recipeId && e.versionId).sort((a, b) => b.date.localeCompare(a.date))[0];
    const rc = last && recipes.find((r) => r.id === last.recipeId);
    const v = rc && (versions[rc.id] ?? []).find((x) => x.id === last.versionId);
    if (!v) return setError('Nessuna ricetta registrata con versione disponibile per simulare l’aggiunta.');
    const metrics = summary.checks.filter((c) => (c.kind === 'min' || c.kind === 'recommended') && (c.color === 'red' || c.color === 'orange' || c.color === 'yellow') && (c.pctOfMin ?? 100) < 100).map((c) => c.metric).slice(0, 4);
    if (!metrics.length) return setSugg([]);
    setSugg(diarySuggestions({ metrics, version: v, catalog: { foods: catalog.foods.filter((f) => !isTestFixture(f)), supplements: catalog.supplements.filter((x) => !isTestFixture(x)), nutrients: catalog.nutrients }, config: cfg }));
  };

  const sorted = [...(summary?.checks ?? [])].sort((a, b) => RANK[a.color] - RANK[b.color]);
  const shown = showAll ? sorted : sorted.filter((c) => c.color !== 'green');
  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <Screen>
      <Stack.Screen options={{ title: `Diario di ${dog.name}` }} />
      {repo.mode === 'local' && <T small muted>Il diario è salvato su questo iPhone.</T>}
      <ErrorBox error={error} />
      <Card>
        <H level={3}>Registra cosa ha mangiato</H>
        <T small muted>Ogni ricetta è la razione dell’intero giorno, integratori compresi: puoi dividerla fra pranzo e cena o in più pasti, ma si registra una sola volta. Ogni data ha una sola ricetta: registrarne un’altra nella stessa data sostituisce l’intera giornata (ti viene chiesta conferma).</T>
        {usable.length === 0 ? (
          <T small>Nessuna ricetta salvata da registrare.</T>
        ) : (
          <Choice options={usable.map((r) => ({ value: r.id, label: r.name }))} value={recipeId} onChange={(v) => setRecipeId(v)} />
        )}
        {chosenVersion && (
          <T small muted>
            Versione {chosenVersion.revision}: {num(chosenVersion.audit.kcal ?? chosenVersion.audit.totals.energy.known, 0)} kcal al giorno · {chosenVersion.chosenItems.filter((i) => i.qty > 0).length} componenti (grammi per l’intero giorno)
          </T>
        )}
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Dal giorno (AAAA-MM-GG)" value={from} onChange={setFrom} />
          </View>
          <View style={{ flex: 1 }}>
            <NumField label="Per quanti giorni" value={days} onChange={setDays} />
          </View>
        </Row>
        <Button title="Registra" busy={busy} disabled={!chosen} onPress={register} />
      </Card>

      <Choice options={[{ value: '7' as const, label: 'Ultimi 7 giorni' }, { value: '14' as const, label: 'Ultimi 14 giorni' }]} value={window} onChange={(v) => { setWindow(v); setSugg(null); }} />
      {summary && (
        <>
          <Card>
            <H level={3}>Registrati {summary.registered} giorni su {summary.windowDays}</H>
            <T small>{summary.text}</T>
            <T small muted>Apporti calcolati come totale dei giorni registrati diviso le loro kcal (non la media delle singole ricette). I giorni non registrati sono esclusi. Il monitoraggio nel tempo è una scelta operativa dell’app, non un’equivalenza scientifica validata: l’app non dichiara mai una «dieta completa».</T>
            {summary.missingDates.length > 0 && summary.missingDates.length <= 14 && <T small muted>Giorni mancanti: {summary.missingDates.map(it).join(', ')}.</T>}
          </Card>
          {summary.alerts.length > 0 && (
            <Box color="red">
              <T bold small>Avvisi immediati (livello A, nei singoli giorni)</T>
              <Bullets small items={summary.alerts.map((a) => `${it(a.date)}: ${a.text}`)} />
            </Box>
          )}
          {summary.registered > 0 && (
            <Card>
              <H level={3}>Apporti nel periodo</H>
              {shown.map((c) => <CheckLine key={`${c.metric}-${c.kind}`} c={c} />)}
              {!shown.length && <T small>Niente da segnalare nei controlli disponibili.</T>}
              <Button title={showAll ? 'Mostra solo ciò che va controllato' : `Mostra tutti (${sorted.length})`} kind="ghost" small onPress={() => setShowAll(!showAll)} />
              <Button title="Suggerimenti (simulati sul livello A)" kind="secondary" small onPress={suggest} />
              {sugg && !sugg.length && <T small muted>Nessun nutriente con tutti i dati noti risulta sotto riferimento: nessun suggerimento.</T>}
              {sugg && sugg.length > 0 && (
                <>
                  <Bullets small items={sugg.map((x) => x.text)} />
                  <T small muted>L’aggiunta è solo simulata sulla ricetta registrata più di recente: non viene applicato nulla. Per i nutrienti grigi serve prima il dato mancante.</T>
                </>
              )}
            </Card>
          )}
        </>
      )}

      <H level={3}>Giorni registrati</H>
      {recent.map((e) => (
        <Card key={e.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T bold style={{ flex: 1 }}>{it(e.date)}</T>
            <Button title="Togli" kind="ghost" small onPress={() => Alert.alert('Togliere questo giorno?', it(e.date), [{ text: 'Annulla', style: 'cancel' }, { text: 'Togli', style: 'destructive', onPress: () => void repo.deleteDiaryEntry(e.id).then(bump) }])} />
          </Row>
          <T small>{e.recipeName} · versione {e.revision} · {num(e.day.kcal, 0)} kcal{e.day.kcalComplete ? '' : ' (parziali)'}{e.recipeId ? '' : ' · ricetta eliminata, apporti conservati'}</T>
          {e.day.alerts.length > 0 && <T small style={{ color: '#b3261e' }}>{e.day.alerts.length} avvisi di livello A</T>}
        </Card>
      ))}
      {!recent.length && <T small muted>Ancora nessun giorno registrato.</T>}
    </Screen>
  );
}

function CheckLine({ c }: { c: PeriodCheck }) {
  return (
    <View style={{ paddingVertical: 4, gap: 2 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ marginTop: 5 }}>
          <Dot color={c.color} />
        </View>
        <T small style={{ flex: 1 }}>
          <T small bold>{c.label} </T>
          ({c.reference}{c.unit ? ` ${c.unit.split(' ')[0]}` : ''}): {c.message}
        </T>
      </Row>
      {c.trend && <T small muted style={{ marginLeft: 20 }}>{c.trend}</T>}
    </View>
  );
}
