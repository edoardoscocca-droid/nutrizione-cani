import '../lib/polyfills';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';
import { AppProvider, useApp } from '../lib/AppContext';
import { Button, Disclaimer, FONTS, H, Loading, Screen, T, useTheme } from '../lib/ui';
import LoginScreen from '../lib/LoginScreen';

function Onboarding() {
  const { settings, saveSettings } = useApp();
  const [busy, setBusy] = useState(false);
  if (!settings) return <Loading />;
  return (
    <Screen>
      <H level={1}>Prima di iniziare</H>
      <T>Questa app propone quantità di alimenti e integratori per le ricette del tuo cane e le confronta con riferimenti nutrizionali documentati (FEDIAF 2025, cane adulto).</T>
      <Disclaimer />
      <T small muted>
        Le ricette non vengono mai dichiarate complete se mancano dati. L’app non suggerisce ossa cotte; ingredienti crudi e ossa comportano rischi microbiologici e meccanici, anche per le persone vulnerabili in casa.
      </T>
      <Button title="Ho capito" busy={busy} onPress={async () => { setBusy(true); await saveSettings({ ...settings, disclaimerAccepted: true }); setBusy(false); }} />
    </Screen>
  );
}

function Root() {
  const { ready, repo, settings } = useApp();
  const t = useTheme();
  if (!ready) return <Loading />;
  if (!repo) return <LoginScreen />;
  if (!settings) return <Loading label="Caricamento del catalogo…" />;
  if (!settings.disclaimerAccepted) return <Onboarding />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerShadowVisible: false,
        headerTintColor: t.accent,
        headerTitleStyle: { color: t.text, fontFamily: FONTS.display, fontSize: 18 },
        headerBackTitleStyle: { fontFamily: FONTS.body },
        contentStyle: { backgroundColor: t.bg },
        headerBackTitle: 'Indietro',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function Layout() {
  // caratteri dello stile: se non si caricano, l'app parte comunque con quelli di sistema
  const [loaded, error] = useFonts({ Fraunces_600SemiBold, NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold });
  if (!loaded && !error) return null;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="auto" />
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
