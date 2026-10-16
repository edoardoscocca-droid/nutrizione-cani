import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOCAL_STORE_KEY, LocalRepository } from '../../src/data/localRepository';
import type { AppSettings } from '../../src/data/model';
import type { FullCatalog, Repository } from '../../src/data/repository';
import { SupabaseRepository } from '../../src/data/supabaseRepository';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }) : null;

const MODE_KEY = 'nutrizione-cani:modalita';

/** Archivio di prova sul telefono: AsyncStorage è asincrono, quindi si carica una volta e poi si scrive in background. */
async function localRepository(): Promise<LocalRepository> {
  const raw = await AsyncStorage.getItem(LOCAL_STORE_KEY);
  const cache = new Map<string, string>();
  if (raw) cache.set(LOCAL_STORE_KEY, raw);
  return new LocalRepository({
    getItem: (k) => cache.get(k) ?? null,
    setItem: (k, v) => {
      cache.set(k, v);
      void AsyncStorage.setItem(k, v);
    },
  });
}

interface Ctx {
  ready: boolean;
  repo: Repository | null;
  catalog: FullCatalog | null;
  settings: AppSettings | null;
  isAdmin: boolean;
  error: string | null;
  version: number;
  supabaseConfigured: boolean;
  refresh: () => Promise<void>;
  bump: () => void;
  saveSettings: (s: AppSettings) => Promise<void>;
  useLocal: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [catalog, setCatalog] = useState<FullCatalog | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY).then((m) => setMode(supabase ? m : 'local'));
  }, []);

  useEffect(() => {
    if (mode === undefined) return;
    if (mode === 'local' || !supabase) {
      localRepository().then((r) => {
        setRepo(r);
        setReady(true);
      });
      return;
    }
    const client = supabase;
    const apply = (session: { user: { id: string; email?: string } } | null) => {
      setRepo(session ? new SupabaseRepository(client, session.user.id, session.user.email ?? '') : null);
      setReady(true);
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
      ready,
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
      useLocal: async () => {
        await AsyncStorage.setItem(MODE_KEY, 'local');
        setMode('local');
      },
      signOut: async () => {
        await AsyncStorage.removeItem(MODE_KEY);
        if (supabase) await supabase.auth.signOut();
        setRepo(null);
        setMode(null);
      },
    }),
    [ready, repo, catalog, settings, isAdmin, error, version, refresh],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider mancante');
  return c;
}

/** Carica dati e li ricarica quando cambiano (dopo un salvataggio). */
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
