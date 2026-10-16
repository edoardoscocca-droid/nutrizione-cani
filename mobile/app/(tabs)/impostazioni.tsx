import { useEffect, useState } from 'react';
import type { AppSettings } from '../../../src/data/model';
import { useApp } from '../../lib/AppContext';
import { ENGINE_URL, engineHealth } from '../../lib/engineClient';
import { Box, Button, Card, Disclaimer, H, Loading, NumField, Screen, T, Toggle } from '../../lib/ui';

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
        <NumField label="Tolleranza sulle kcal (±%)" value={s.energyTolerancePct} onChange={(v) => set('energyTolerancePct', v ?? 2)} />
        <NumField label="Arrotondamento alimenti (g)" value={s.roundingFoodG} onChange={(v) => set('roundingFoodG', v ?? 1)} />
        <NumField label="Arrotondamento integratori in polvere (g)" value={s.roundingSupplementG} onChange={(v) => set('roundingSupplementG', v ?? 0.1)} />
        <NumField label="Arrotondamento integratori liquidi (ml)" value={s.roundingSupplementMl} onChange={(v) => set('roundingSupplementMl', v ?? 0.1)} />
        <Toggle label="A parità di nutrienti, la combinazione meno costosa" value={s.preferLowerCost} onChange={(v) => set('preferLowerCost', v)} />
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
