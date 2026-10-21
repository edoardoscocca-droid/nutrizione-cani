import { useEffect, useState } from 'react';
import type { AppSettings } from '../../../src/data/model';
import { DEFAULT_CONFIG, resolveConfig } from '../../../src/engine/configV2';
import { useApp } from '../../lib/AppContext';
import { ENGINE_URL, engineHealth } from '../../lib/engineClient';
import { Box, Button, Card, Disclaimer, H, Loading, NumField, Row, Screen, T, Toggle } from '../../lib/ui';

export default function SettingsScreen() {
  const { settings, saveSettings, repo, signOut, supabaseConfigured } = useApp();
  const [s, setS] = useState<AppSettings | null>(settings);
  const [saved, setSaved] = useState(false);
  const [engine, setEngine] = useState<'?' | 'ok' | 'ko'>('?');
  useEffect(() => {
    engineHealth().then((ok) => setEngine(ok ? 'ok' : 'ko'));
  }, []);
  if (!s || !repo) return <Loading />;
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setSaved(false);
    setS({ ...s, [k]: v });
  };
  return (
    <Screen>
      <Card>
        <H level={3}>Parametri tecnici del motore</H>
        <T small muted>Non sono regole nutrizionali: tolleranza e praticità delle dosi (decisioni D5 e D14 da confermare).</T>
        <NumField label="Tolleranza sulle kcal (±%), livello A" value={resolveConfig(s.formulationV2).energyTolerancePct} onChange={(v) => set('formulationV2', { ...s.formulationV2, energyTolerancePct: v ?? DEFAULT_CONFIG.energyTolerancePct })} />
        <NumField label="Arrotondamento alimenti (g)" value={s.roundingFoodG} onChange={(v) => set('roundingFoodG', v ?? 1)} />
        <NumField label="Arrotondamento integratori in polvere (g)" value={s.roundingSupplementG} onChange={(v) => set('roundingSupplementG', v ?? 0.1)} />
        <NumField label="Arrotondamento integratori liquidi (ml)" value={s.roundingSupplementMl} onChange={(v) => set('roundingSupplementMl', v ?? 0.1)} />
        <Toggle label="A parità di nutrienti, la combinazione meno costosa" value={s.preferLowerCost} onChange={(v) => set('preferLowerCost', v)} />
        <Button title={saved ? 'Salvato' : 'Salva'} onPress={async () => { await saveSettings(s); setSaved(true); }} />
      </Card>
      <Card>
        <H level={3}>Struttura del pasto</H>
        <T small muted>Intervalli in % delle kcal della razione [PROPOSTA]: scelte operative iniziali, non valori FEDIAF; da rivedere con un veterinario nutrizionista. Valgono per le nuove ricette (quelle salvate conservano i propri).</T>
        {resolveConfig(s.formulationV2).groups.map((g) => {
          const setG = (k: 'minPctKcal' | 'maxPctKcal', v: number | null) => {
            const cur = resolveConfig(s.formulationV2).groups.map((x) => ({ id: x.id, minPctKcal: x.minPctKcal, maxPctKcal: x.maxPctKcal }));
            set('formulationV2', { ...s.formulationV2, groups: cur.map((x) => (x.id === g.id ? { ...x, [k]: v ?? (DEFAULT_CONFIG.groups.find((d) => d.id === g.id) as typeof g)[k] } : x)) });
          };
          return (
            <Row key={g.id}>
              <T style={{ flex: 1 }}>{g.label}</T>
              <NumField label="min %" value={g.minPctKcal} onChange={(v) => setG('minPctKcal', v)} />
              <NumField label="max %" value={g.maxPctKcal} onChange={(v) => setG('maxPctKcal', v)} />
            </Row>
          );
        })}
        <T small muted>Tetti per alimento: verdure ≤ 20% del peso fresco, olio ≤ 12% delle kcal, frattaglie secernenti ≤ 10% del peso (quest’ultimo è una proposta della sviluppatrice da confermare). Un campo del catalogo per alimento li sostituisce.</T>
        <Button title="Ripristina i valori proposti" kind="ghost" small onPress={() => set('formulationV2', null)} />
        <Button title={saved ? 'Salvato' : 'Salva'} onPress={async () => { await saveSettings(s); setSaved(true); }} />
      </Card>
      <Card>
        <H level={3}>Server di calcolo</H>
        <T small muted>{ENGINE_URL}</T>
        {engine === 'ok' && <Box color="green"><T small>Raggiungibile.</T></Box>}
        {engine === 'ko' && <Box color="orange"><T small>Non risponde adesso: può essere in avvio (fino a un minuto) o manca la connessione.</T></Box>}
      </Card>
      <Card>
        <H level={3}>Account</H>
        <T>{repo.mode === 'supabase' ? `Connesso come ${repo.userLabel()}` : `${repo.userLabel()}: dati solo su questo telefono.`}</T>
        {(repo.mode === 'supabase' || supabaseConfigured) && <Button title={repo.mode === 'supabase' ? 'Esci' : 'Accedi con account'} kind="secondary" onPress={signOut} />}
      </Card>
      <Disclaimer />
    </Screen>
  );
}
