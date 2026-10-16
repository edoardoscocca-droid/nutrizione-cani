import { useState } from 'react';
import { supabase, useApp } from '../AppContext';
import { Disclaimer, ErrorBox } from '../components';

export function LoginPage() {
  const { useLocal } = useApp();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };
  const verify = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message);
  };
  return (
    <div className="login">
      <h2>Accedi</h2>
      <ErrorBox error={error} />
      <div className="card form">
        <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {!sent ? (
          <button disabled={busy || !email.includes('@')} onClick={send}>Invia il codice</button>
        ) : (
          <>
            <label>Codice ricevuto via email<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <button disabled={busy || code.trim().length < 6} onClick={verify}>Entra</button>
          </>
        )}
      </div>
      <button className="ghost" onClick={useLocal}>Prova senza account (dati fittizi, solo su questo dispositivo)</button>
      <Disclaimer />
    </div>
  );
}
