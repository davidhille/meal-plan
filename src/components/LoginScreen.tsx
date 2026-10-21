import { useEffect, useState } from 'react';
import { Loader2, UtensilsCrossed } from 'lucide-react';
import { acceptInvite, getAuthStatus, getInvite, login, setPassword, setupFirstAccount } from '../lib/api';

interface Props {
  /** Nach erfolgreicher Anmeldung: App neu laden */
  onDone: () => void;
}

const input =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

/** Einladungslink: ?einladung=<token> */
export const inviteToken = () => {
  try {
    return new URLSearchParams(window.location.search).get('einladung');
  } catch {
    return null;
  }
};

const dropInviteFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('einladung');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
};

/**
 * Anmeldung mit E-Mail und Passwort. Gibt es noch keine Zugänge, legt man hier den ersten an
 * (bestätigt mit dem bisherigen Familien-Passwort) – danach gilt nur noch die Anmeldung.
 * Mit Einladungslink legt man den ersten Zugang einer neuen Familie an.
 */
export default function LoginScreen({ onDone }: Props) {
  const [mode, setMode] = useState<'loading' | 'login' | 'setup' | 'invite' | 'invalid-invite'>('loading');
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPw] = useState('');
  const [name, setName] = useState('');
  const [familyPassword, setFamilyPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = inviteToken();
    if (token) {
      getInvite(token)
        .then((r) => {
          setFamilyName(r.familyName ?? null);
          setMode(r.valid ? 'invite' : 'invalid-invite');
        })
        .catch(() => setMode('invalid-invite'));
      return;
    }
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
      else if (mode === 'invite') await acceptInvite(inviteToken() ?? '', { name, email, password });
      else await login(email, password);
      dropInviteFromUrl();
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
            {mode === 'invalid-invite' && (
              <>
                <p role="alert" className="text-sm text-gray-700">
                  Dieser Einladungslink ist abgelaufen oder wurde schon benutzt. Bitte frag nach einem neuen Link – oder melde
                  dich an, wenn du schon einen Zugang hast.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    dropInviteFromUrl();
                    setMode('login');
                  }}
                  className="bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium rounded-lg py-2"
                >
                  Zur Anmeldung
                </button>
              </>
            )}
            {mode === 'invite' && (
              <>
                <p className="text-sm text-gray-700">
                  Willkommen{familyName ? <> bei <strong>{familyName}</strong></> : ''}! Lege deinen Zugang an. Weitere Personen
                  deiner Familie lädst du danach in den Einstellungen unter „Zugänge“ ein.
                </p>
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
            {mode !== 'invalid-invite' && (
            <>
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
              placeholder={mode === 'login' ? 'Passwort' : 'Neues Passwort (mind. 8 Zeichen)'}
              aria-label={mode === 'login' ? 'Passwort' : 'Neues Passwort'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? undefined : 8}
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
              {mode === 'login' ? 'Anmelden' : 'Zugang anlegen'}
            </button>
            {mode === 'login' && (
              <p className="text-[11px] text-gray-500 text-center">Passwort vergessen? Ein Admin eurer Familie kann es zurücksetzen.</p>
            )}
            </>
            )}
          </>
        )}
      </form>
    </div>
  );
}
