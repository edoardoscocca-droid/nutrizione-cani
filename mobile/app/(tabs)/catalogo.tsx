import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { CATALOG_STATUS_LABEL, foodStatus, supplementStatus, type CatalogStatus } from '../../../src/engine/catalogStatus';
import { PROCESSING_LABEL } from '../../../src/data/packageCatalog';
import { useApp } from '../../lib/AppContext';
import { CatalogBadge } from '../../lib/result';
import { Badge, Button, Card, Choice, Field, Loading, Row, Screen, T } from '../../lib/ui';

export default function CatalogScreen() {
  const { catalog, isAdmin, repo } = useApp();
  const [tab, setTab] = useState<'foods' | 'supplements'>('foods');
  const [filter, setFilter] = useState<CatalogStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  if (!catalog || !repo) return <Loading />;
  const q = query.trim().toLowerCase();
  const items =
    tab === 'foods'
      ? catalog.foods.map((f) => ({ id: f.id, name: f.name, sub: `${catalog.categories.find((c) => c.id === f.subcategoryId)?.label ?? ''} · ${PROCESSING_LABEL[f.processingState]}`, st: foodStatus(f, catalog.nutrients), test: f.dataStatus === 'test_fixture', active: f.availableToFormulate }))
      : catalog.supplements.map((s) => ({ id: s.id, name: s.name, sub: `per ${s.doseUnit}`, st: supplementStatus(s, catalog.nutrients), test: s.status === 'test_fixture', active: s.usableForOptimization }));
  const count = (st: CatalogStatus) => items.filter((i) => i.st.status === st).length;
  return (
    <Screen>
      <T small muted>
        {repo.mode === 'supabase'
          ? isAdmin
            ? 'Sei amministratore: puoi importare, convalidare e attivare i prodotti.'
            : 'Consultazione: il catalogo lo modificano solo gli amministratori.'
          : 'Prova: il catalogo si modifica solo su questo telefono. Con l’account condiviso solo gli amministratori possono farlo.'}
      </T>
      {isAdmin && (
        <Row wrap>
          <Button title="Importa CSV/JSON" small kind="secondary" onPress={() => router.push('/catalogo/importa')} />
          <Button title="Riferimenti ed energia" small kind="secondary" onPress={() => router.push('/catalogo/riferimenti')} />
        </Row>
      )}
      <Choice options={[{ value: 'foods' as const, label: 'Alimenti' }, { value: 'supplements' as const, label: 'Integratori' }]} value={tab} onChange={setTab} />
      <Choice
        options={[
          { value: 'all' as const, label: `Tutti (${items.length})` },
          { value: 'verified' as const, label: `${CATALOG_STATUS_LABEL.verified} (${count('verified')})` },
          { value: 'partial' as const, label: `${CATALOG_STATUS_LABEL.partial} (${count('partial')})` },
          { value: 'to_complete' as const, label: `${CATALOG_STATUS_LABEL.to_complete} (${count('to_complete')})` },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <Field placeholder="Cerca…" value={query} onChange={setQuery} />
      {items
        .filter((i) => (filter === 'all' || i.st.status === filter) && (!q || i.name.toLowerCase().includes(q)))
        .map((i) => (
          <Card key={i.id} onPress={() => router.push(`/catalogo/${tab === 'foods' ? 'food' : 'supplement'}/${i.id}`)}>
            <T bold>{i.name}</T>
            <T small muted>{i.sub}</T>
            <Row wrap>
              <CatalogBadge status={i.st.status} test={i.test} />
              {i.active ? <Badge label="attivo" /> : <Badge label="non attivo" color="grey" />}
            </Row>
            {i.st.status !== 'verified' && (
              <View>
                <T small muted>{i.st.reasons.slice(0, 2).join(' · ')}</T>
              </View>
            )}
          </Card>
        ))}
    </Screen>
  );
}
