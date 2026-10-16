import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import wasmUrl from 'highs/runtime?url';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadSolver } from '../engine/lp';
import { LocalRepository } from '../data/localRepository';
import type { AppSettings } from '../data/model';
import type { FullCatalog, Repository } from '../data/repository';
import { SupabaseRepository } from '../data/supabaseRepository';

// il motore usa il file WebAssembly servito dall'app
void loadSolver(() => wasmUrl);

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

const MODE_KEY = 'nutrizione-cani:modalita';

interface Ctx {
  repo: Repository | null;
  catalog: FullCatalog | null;
  settings: AppSettings | null;
  isAdmin: boolean;
  error: string | null;
  supabaseConfigured: boolean;
  /** incrementato a ogni modifica, per ricaricare le pagine. */
  version: number;
  refresh: () => Promise<void>;
  bump: () => void;
  saveSettings: (s: AppSettings) => Promise<void>;
  useLocal: () => void;
  signOut: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

function readMode(): string | null {
  try {
    return localStorage.getItem(MODE_KEY);
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [catalog, setCatalog] = useState<FullCatalog | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<string | null>(() => (supabase ? readMode() : 'local'));

  useEffect(() => {
    if (mode === 'local' || !supabase) {
      setRepo(new LocalRepository());
      return;
    }
    const client = supabase;
    const apply = (session: { user: { id: string; email?: string } } | null) => {
      setRepo(session ? new SupabaseRepository(client, session.user.id, session.user.email ?? '') : null);
    };
    client.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, [mode]);

  const refresh = useCallback(async () => {
    if (!repo) {
      setCatalog(null);
      return;
    }
    try {
      const [c, s, admin] = await Promise.all([repo.loadCatalog(), repo.getSettings(), repo.isAdmin()]);
      setCatalog(c);
      setSettings(s);
      setIsAdmin(admin);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setVersion((v) => v + 1);
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<Ctx>(
    () => ({
      repo,
      catalog,
      settings,
      isAdmin,
      error,
      version,
      supabaseConfigured: !!supabase,
      refresh,
      bump: () => setVersion((v) => v + 1),
      saveSettings: async (s) => {
        if (!repo) return;
        await repo.saveSettings(s);
        setSettings(s);
      },
      useLocal: () => {
        try {
          localStorage.setItem(MODE_KEY, 'local');
        } catch {
          /* solo memoria */
        }
        setMode('local');
      },
      signOut: async () => {
        try {
          localStorage.removeItem(MODE_KEY);
        } catch {
          /* niente */
        }
        if (supabase) await supabase.auth.signOut();
        setMode(null);
        setRepo(null);
      },
    }),
    [repo, catalog, settings, isAdmin, error, version, refresh],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider mancante');
  return c;
}

/** Carica dati asincroni e li ricarica quando cambia la versione dei dati. */
export function useData<T>(load: (repo: Repository) => Promise<T>, deps: unknown[] = []): { data: T | null; error: string | null; reload: () => void } {
  const { repo, version } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!repo) return;
    let alive = true;
    load(repo)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, version, tick, ...deps]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}
