import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { STATUS_LABEL } from '../../../../src/engine/audit';
import { breedNotesFor } from '../../../../src/engine/dogProfile';
import { mer, rer, WEIGHT_GAP_MESSAGE, weightGapNeedsWarning } from '../../../../src/engine/energy';
import { KCAL_SOURCE_LABEL, MAX_RECIPES_PER_DOG, type Recipe } from '../../../../src/data/model';
import { activeRecipeCount, staleFor } from '../../../../src/data/recipeService';
import { num } from '../../../../src/ui/format';
import { useApp, useData } from '../../../lib/AppContext';
import { Badge, Box, Button, Card, ErrorBox, Field, H, Loading, Row, Screen, Sheet, T } from '../../../lib/ui';

export default function DogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repo, catalog, bump } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Recipe | null>(null);
  const [newName, setNewName] = useState('');
  const { data } = useData(
    async (r) => {
      const dog = (await r.listDogs()).find((d) => d.id === id) ?? null;
      const recipes = await r.listRecipes(id);
      const versions = Object.fromEntries(await Promise.all(recipes.map(async (rc) => [rc.id, await r.listVersions(rc.id)] as const)));
      const weights = await r.listWeights(id);
      return { dog, recipes, versions, weights };
    },
    [id],
  );
  if (!data || !repo) return <Loading />;
  const { dog, recipes, versions, weights } = data;
  if (!dog) return <Screen><T>Cane non trovato.</T></Screen>;
  const notes = catalog ? breedNotesFor(dog.breed, catalog.breedNotes) : [];
  const active = activeRecipeCount(recipes);
  const full = active >= MAX_RECIPES_PER_DOG;
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const menu = (r: Recipe) =>
    Alert.alert(r.name, undefined, [
      ...(!r.isPrimary ? [{ text: 'Rendi principale', onPress: () => act(() => repo.updateRecipe({ ...r, isPrimary: true })) }] : []),
      { text: 'Rinomina', onPress: () => { setNewName(r.name); setRenaming(r); } },
      ...(!full ? [{ text: 'Duplica / sostituisci ingredienti', onPress: () => router.push(`/cane/${dog.id}/nuova-ricetta?da=${r.id}`) }] : []),
      { text: r.archived ? 'Ripristina' : 'Archivia', onPress: () => act(() => repo.updateRecipe({ ...r, archived: !r.archived, isPrimary: r.archived ? r.isPrimary : false })) },
      {
        text: 'Elimina',
        style: 'destructive' as const,
        onPress: () => Alert.alert('Eliminare la ricetta?', `«${r.name}» e tutto il suo storico verranno eliminati.`, [{ text: 'Annulla', style: 'cancel' }, { text: 'Elimina', style: 'destructive', onPress: () => act(() => repo.deleteRecipe(r.id)) }]),
      },
      { text: 'Annulla', style: 'cancel' as const },
    ]);
  return (
    <Screen>
      <Stack.Screen options={{ title: dog.name, headerRight: () => <Button title="Modifica" kind="ghost" small onPress={() => router.push(`/cane/${dog.id}/modifica`)} /> }} />
      <ErrorBox error={error} />
      {[...notes.map((n) => n.text), ...dog.notes.map((n) => n.text)].map((t) => (
        <Box key={t} color="purple">
          <T small>{t}</T>
        </Box>
      ))}
      {weightGapNeedsWarning(dog.weightCurrentKg, dog.weightIdealKg) && (
        <Box color="orange">
          <T small>{WEIGHT_GAP_MESSAGE}.</T>
        </Box>
      )}
      <Card>
        <T>Razza: {dog.breed || '—'}</T>
        <T>Peso attuale / ideale: {num(dog.weightCurrentKg, 1)} / {num(dog.weightIdealKg, 1)} kg</T>
        <T>RER (peso ideale): {num(rer(dog.weightIdealKg), 0)} kcal</T>
        <T>MER stimata: {dog.activityFactor ? `${num(mer(dog.weightIdealKg, dog.activityFactor), 0)} kcal (fattore ${num(dog.activityFactor, 2)})` : 'fattore non indicato'}</T>
        <T bold>Obiettivo: {dog.kcalTarget ? `${num(dog.kcalTarget, 0)} kcal/die — ${KCAL_SOURCE_LABEL[dog.kcalSource]}` : 'da impostare'}</T>
        {weights.length > 1 && <T small muted>Storico peso: {weights.map((w) => `${new Date(w.date).toLocaleDateString('it-IT')} ${num(w.weightKg, 1)} kg`).join(' · ')}</T>}
      </Card>
      <Button title="Diario: cosa ha mangiato →" kind="secondary" onPress={() => router.push(`/cane/${dog.id}/diario`)} />
      <Row style={{ justifyContent: 'space-between' }}>
        <H level={2}>Ricette ({active}/{MAX_RECIPES_PER_DOG}{recipes.length > active ? ` + ${recipes.length - active} archiviate` : ''})</H>
      </Row>
      {full ? (
        <Box color="orange"><T small>Limite di {MAX_RECIPES_PER_DOG} ricette attive raggiunto: archivia o elimina una ricetta per crearne una nuova.</T></Box>
      ) : (
        <Button title="+ Nuova ricetta" onPress={() => router.push(`/cane/${dog.id}/nuova-ricetta`)} disabled={!dog.kcalTarget} />
      )}
      {!dog.kcalTarget && <T small muted>Imposta prima l’obiettivo kcal nel profilo.</T>}
      {active === MAX_RECIPES_PER_DOG - 1 && <T small muted>Puoi salvare ancora una sola ricetta.</T>}
      {[...recipes]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Number(a.archived) - Number(b.archived))
        .map((r) => {
          const vs = versions[r.id] ?? [];
          const cur = vs.find((v) => v.id === r.currentVersionId) ?? vs[vs.length - 1];
          const stale = cur && catalog ? staleFor(cur, dog, catalog) : [];
          return (
            <Card key={r.id} onPress={() => router.push(`/ricetta/${r.id}`)} style={r.archived ? { opacity: 0.6 } : undefined}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T bold style={{ flex: 1 }}>{r.name}</T>
                <Button title="⋯" kind="ghost" small onPress={() => menu(r)} />
              </Row>
              <Row wrap>
                {r.isPrimary && <Badge label="principale" />}
                {r.archived && <Badge label="archiviata" color="grey" />}
                {cur?.audit.dataFlags.testData && <Badge label="PROVA" color="orange" />}
                {stale.length > 0 && <Badge label="da ricalcolare" color="orange" />}
              </Row>
              <T small muted>{cur ? `${(cur.audit.statusLabel ?? STATUS_LABEL[cur.audit.status])} · versione ${cur.revision}` : 'nessuna versione'}</T>
            </Card>
          );
        })}
      <T small muted>Le ricette archiviate restano salvate e non contano nel limite di {MAX_RECIPES_PER_DOG}.</T>
      <View style={{ height: 12 }} />
      <Button
        title="Elimina cane"
        kind="danger"
        onPress={() =>
          Alert.alert(`Eliminare ${dog.name}?`, 'Verranno eliminate anche tutte le sue ricette.', [
            { text: 'Annulla', style: 'cancel' },
            { text: 'Elimina', style: 'destructive', onPress: () => act(async () => { await repo.deleteDog(dog.id); router.back(); }) },
          ])
        }
      />
      <Sheet visible={!!renaming} title="Rinomina ricetta" onClose={() => setRenaming(null)}>
        <Field label="Nome" value={newName} onChange={setNewName} />
        <Button title="Salva" disabled={!newName.trim()} onPress={() => { const r = renaming!; setRenaming(null); void act(() => repo.updateRecipe({ ...r, name: newName.trim() })); }} />
      </Sheet>
    </Screen>
  );
}
