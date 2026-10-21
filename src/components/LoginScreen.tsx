import { useEffect, useState } from 'react';
import { Loader2, UtensilsCrossed } from 'lucide-react';
import { getAuthStatus, login, setPassword, setupFirstAccount } from '../lib/api';

interface Props {
  /** Nach erfolgreicher Anmeldung: App neu laden */
  onDone: () => void;
}

const input =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

/**
 * Anmeldung mit E-Mail und Passwort. Gibt es noch keine Zugänge, legt man hier den ersten an
 * (bestätigt mit dem bisherigen Familien-Passwort) – danach gilt nur noch die Anmeldung.
 */
export default function LoginScreen({ onDone }: Props) {
  const [mode, setMode] = useState<'loading' | 'login' | 'setup'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPw] = useState('');
  const [name, setName] = useState('');
  const [familyPassword, setFamilyPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuthStatus()
      .then((s) => setMode(s.needsSetup ? 'setup' : 'login'))
      .catch(() => setMode('login'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'setup') await setupFirstAccount({ familyPassword, name, email, password });
      else await login(email, password);
      setPassword('');
      onDone();
    } catch (err) {
      setError((err as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-xs bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center" aria-hidden="true">
            <UtensilsCrossed size={18} className="text-white" />
          </div>
          <h1 className="text-base font-semibold text-gray-900">Familien-Speiseplaner</h1>
        </div>

        {mode === 'loading' ? (
          <div className="flex justify-center py-4" role="status" aria-label="Wird geladen">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {mode === 'setup' && (
              <>
                <p className="text-xs text-gray-600">
                  Neu: Jeder meldet sich mit eigener E-Mail und eigenem Passwort an. Lege zuerst deinen Zugang an – zur
                  Bestätigung mit dem bisherigen Familien-Passwort. Weitere Zugänge legst du danach in den Einstellungen an.
                </p>
                <input
                  type="password"
                  value={familyPassword}
                  onChange={(e) => setFamilyPassword(e.target.value)}
                  placeholder="Bisheriges Familien-Passwort"
                  aria-label="Bisheriges Familien-Passwort"
                  autoComplete="off"
                  required
                  className={input}
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dein Name"
                  aria-label="Dein Name"
                  autoComplete="given-name"
                  required
                  className={input}
                />
              </>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail"
              aria-label="E-Mail"
              autoComplete="email"
              autoFocus={mode === 'login'}
              required
              className={input}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPw(e.target.value)}
              placeholder={mode === 'setup' ? 'Neues Passwort (mind. 8 Zeichen)' : 'Passwort'}
              aria-label={mode === 'setup' ? 'Neues Passwort' : 'Passwort'}
              autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
              minLength={mode === 'setup' ? 8 : undefined}
              required
              className={input}
            />
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 text-white text-sm font-medium rounded-lg py-2"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {mode === 'setup' ? 'Zugang anlegen' : 'Anmelden'}
            </button>
            {mode === 'login' && (
              <p className="text-[11px] text-gray-500 text-center">Passwort vergessen? Ein Admin eurer Familie kann es zurücksetzen.</p>
            )}
          </>
        )}
      </form>
    </div>
  );
}
