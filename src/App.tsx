import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './ui/AppContext';
import { Disclaimer, ErrorBox } from './ui/components';
import { CatalogPage } from './ui/pages/CatalogPage';
import { DogFormPage } from './ui/pages/DogFormPage';
import { DogPage } from './ui/pages/DogPage';
import { DogsPage } from './ui/pages/DogsPage';
import { LoginPage } from './ui/pages/LoginPage';
import { PricesPage } from './ui/pages/PricesPage';
import { RecipePage } from './ui/pages/RecipePage';
import { RecipeWizard } from './ui/pages/RecipeWizard';
import { SettingsPage } from './ui/pages/SettingsPage';

function Onboarding() {
  const { settings, saveSettings } = useApp();
  if (!settings || settings.disclaimerAccepted) return null;
  return (
    <div className="modal-back">
      <div className="modal">
        <h3>Prima di iniziare</h3>
        <p>Questa app propone quantità di alimenti e integratori per le ricette del tuo cane e le confronta con riferimenti nutrizionali documentati (FEDIAF 2025, cane adulto).</p>
        <Disclaimer />
        <p className="small">Le ricette non vengono mai dichiarate complete se mancano dati. Non suggerisce ossa cotte; ingredienti crudi e ossa comportano rischi microbiologici e meccanici, anche per le persone vulnerabili in casa.</p>
        <button onClick={() => saveSettings({ ...settings, disclaimerAccepted: true })}>Ho capito</button>
      </div>
    </div>
  );
}

function Shell() {
  const { repo, catalog, error } = useApp();
  if (!repo) return <LoginPage />;
  return (
    <>
      <header className="top no-print">
        <h1>Nutrizione cani</h1>
        {repo.mode === 'local' && <span className="tag orange">PROVA</span>}
      </header>
      <nav className="tabs-nav no-print">
        <NavLink to="/" end>Cani</NavLink>
        <NavLink to="/prezzi">Prezzi</NavLink>
        <NavLink to="/catalogo">Catalogo</NavLink>
        <NavLink to="/impostazioni">Impostazioni</NavLink>
      </nav>
      <main>
        <ErrorBox error={error} />
        {!catalog ? (
          <p>Caricamento del catalogo…</p>
        ) : (
          <Routes>
            <Route path="/" element={<DogsPage />} />
            <Route path="/cani/nuovo" element={<DogFormPage />} />
            <Route path="/cani/:id" element={<DogPage />} />
            <Route path="/cani/:id/modifica" element={<DogFormPage />} />
            <Route path="/cani/:id/ricette/nuova" element={<RecipeWizard />} />
            <Route path="/ricette/:id" element={<RecipePage />} />
            <Route path="/prezzi" element={<PricesPage />} />
            <Route path="/catalogo" element={<CatalogPage />} />
            <Route path="/impostazioni" element={<SettingsPage />} />
          </Routes>
        )}
      </main>
      <Onboarding />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  );
}
