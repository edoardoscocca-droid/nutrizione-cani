import { useState } from 'react';
import type { AppSettings } from '../../data/model';
import { useApp } from '../AppContext';
import { Disclaimer, NumberInput } from '../components';

export function SettingsPage() {
  const { settings, saveSettings, repo, signOut, supabaseConfigured } = useApp();
  const [s, setS] = useState<AppSettings | null>(settings);
  const [saved, setSaved] = useState(false);
  if (!s || !repo) return <p>Caricamento…</p>;
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setSaved(false);
    setS({ ...s, [k]: v });
  };
  return (
    <div>
      <h2>Impostazioni</h2>
      <div className="card form">
        <h3>Parametri tecnici del motore</h3>
        <p className="small muted">Non sono regole nutrizionali: decidono la tolleranza e la praticità delle dosi (decisioni D5 e D14 da confermare).</p>
        <label>Tolleranza sulle kcal (±%)<NumberInput value={s.energyTolerancePct} step="0.5" min={0.5} onChange={(v) => set('energyTolerancePct', v ?? 2)} /></label>
        <label>Arrotondamento alimenti (g)<NumberInput value={s.roundingFoodG} step="0.5" min={0.1} onChange={(v) => set('roundingFoodG', v ?? 1)} /></label>
        <label>Arrotondamento integratori in polvere (g)<NumberInput value={s.roundingSupplementG} step="0.05" min={0.01} onChange={(v) => set('roundingSupplementG', v ?? 0.1)} /></label>
        <label>Arrotondamento integratori liquidi (ml)<NumberInput value={s.roundingSupplementMl} step="0.05" min={0.01} onChange={(v) => set('roundingSupplementMl', v ?? 0.1)} /></label>
        <label>Tempo massimo di calcolo (secondi)<NumberInput value={s.timeLimitSeconds} min={1} onChange={(v) => set('timeLimitSeconds', v ?? 10)} /></label>
        <label className="check">
          <input type="checkbox" checked={s.preferLowerCost} onChange={(e) => set('preferLowerCost', e.target.checked)} /> A parità di nutrienti, preferisci la combinazione meno costosa (se tutti i prezzi sono noti)
        </label>
        <button onClick={async () => { await saveSettings(s); setSaved(true); }}>Salva</button>
        {saved && <span className="small"> Salvato.</span>}
      </div>
      <div className="card">
        <h3>Account</h3>
        <p>{repo.mode === 'supabase' ? `Connesso come ${repo.userLabel()} (dati su Supabase)` : `${repo.userLabel()}: dati di prova fittizi, solo su questo dispositivo.`}</p>
        {(repo.mode === 'supabase' || supabaseConfigured) && <button className="secondary" onClick={signOut}>{repo.mode === 'supabase' ? 'Esci' : 'Passa all’accesso con account'}</button>}
      </div>
      <Disclaimer />
    </div>
  );
}
