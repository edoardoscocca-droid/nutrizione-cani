import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { KCAL_SOURCE_LABEL } from '../../../src/data/model';
import { staleFor } from '../../../src/data/recipeService';
import { num } from '../../../src/ui/format';
import { useApp, useData } from '../../lib/AppContext';
import { Badge, Box, Button, Card, ErrorBox, FONTS, Row, Screen, T, useTheme } from '../../lib/ui';

export default function DogsScreen() {
  const { catalog, repo } = useApp();
  const t = useTheme();
  const { data, error } = useData(async (r) => {
    const [dogs, recipes] = await Promise.all([r.listDogs(), r.listRecipes()]);
    const current = await Promise.all(
      recipes.map(async (rc) => {
        const vs = await r.listVersions(rc.id);
        return [rc.id, vs.find((v) => v.id === rc.currentVersionId) ?? vs[vs.length - 1]] as const;
      }),
    );
    return { dogs, recipes, current: new Map(current) };
  });
  const stale =
    data && catalog
      ? data.recipes.filter((r) => {
          const v = data.current.get(r.id);
          const dog = data.dogs.find((d) => d.id === r.dogId);
          return v && dog && !r.archived && staleFor(v, dog, catalog).length > 0;
        })
      : [];
  return (
    <Screen>
      {repo?.mode === 'local' && <Badge label="PROVA · dati su questo telefono" color="orange" />}
      <ErrorBox error={error} />
      {stale.length > 0 && (
        <Box color="orange">
          <T bold>{stale.length === 1 ? '1 ricetta da ricalcolare' : `${stale.length} ricette da ricalcolare`}</T>
          <T small>Sono cambiati dati del catalogo o del profilo. Nessuna è stata modificata: aprila per vedere l’anteprima e confermare.</T>
          {stale.map((r) => (
            <Button key={r.id} title={r.name} kind="ghost" small onPress={() => router.push(`/ricetta/${r.id}`)} />
          ))}
        </Box>
      )}
      <Button title="+ Nuovo cane" onPress={() => router.push('/cane/nuovo')} />
      {data && data.dogs.length === 0 && <T muted>Nessun cane ancora. Crea il primo profilo per iniziare a formulare le ricette.</T>}
      {data?.dogs.map((d) => {
        const rs = data.recipes.filter((r) => r.dogId === d.id);
        const primary = rs.find((r) => r.isPrimary);
        return (
          <Card key={d.id} onPress={() => router.push(`/cane/${d.id}`)}>
            <Row>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.peach, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#14141f', fontFamily: FONTS.display, fontSize: 24 }}>{d.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <T bold>
                  {d.name} <T muted>{d.breed || ''}</T>
                </T>
                <T small muted>
                  {num(d.weightCurrentKg, 1)} kg attuali · {num(d.weightIdealKg, 1)} kg ideali
                </T>
                <T small muted>
                  {d.kcalTarget ? `${num(d.kcalTarget, 0)} kcal/die (${KCAL_SOURCE_LABEL[d.kcalSource]})` : 'kcal da impostare'}
                </T>
                <T small muted>
                  {rs.length}/10 ricette{primary ? ` · principale: ${primary.name}` : ''}
                </T>
              </View>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
