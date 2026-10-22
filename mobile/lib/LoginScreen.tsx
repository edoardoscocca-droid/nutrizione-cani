import { useState } from 'react';
import { supabase, useApp } from './AppContext';
import { Button, Card, Disclaimer, ErrorBox, Field, H, Screen, T } from './ui';

export default function LoginScreen() {
  const { useLocal } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<{ error: { message: string } | null }>, after?: () => void) => {
    setBusy(true);
    setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error.message);
    else after?.();
  };
  return (
    <Screen>
      <H level={1}>Nutrizione cani</H>
      <ErrorBox error={error} />
      {supabase ? (
        <Card>
          <H level={3}>Accedi</H>
          <Field label="Email" value={email} onChange={setEmail} keyboard="email-address" autoCapitalize="none" />
          {!sent ? (
            <Button title="Invia il codice" busy={busy} disabled={!email.includes('@')} onPress={() => run(() => supabase!.auth.signInWithOtp({ email: email.trim() }), () => setSent(true))} />
          ) : (
            <>
              <Field label="Codice ricevuto via email" value={code} onChange={setCode} keyboard="number-pad" />
              <Button title="Entra" busy={busy} disabled={code.trim().length < 6} onPress={() => run(() => supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' }))} />
            </>
          )}
        </Card>
      ) : (
        <T muted>L’account non è collegato: l’app funziona con i dati salvati su questo iPhone.</T>
      )}
      <Button title="Usa senza account (dati su questo iPhone)" kind="secondary" onPress={useLocal} />
      <Disclaimer compact />
    </Screen>
  );
}
