import { useEffect, useState } from 'react';
import { KeyRound, LogOut, Trash2, UserPlus, Users } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';
import ConfirmDialog from './ConfirmDialog';
import {
  addUser, changePassword, deleteUser, getAuthStatus, listUsers, logout, resetUserPassword, type AuthUser,
} from '../lib/api';

const input = 'w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const button = 'h-9 px-3 rounded-xl text-xs font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300';

/** Einstellungen → Zugänge: eigenes Passwort, Abmelden; Admins verwalten die Zugänge der Familie */
export default function AccountSettings() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', isAdmin: false });
  const [resetFor, setResetFor] = useState<AuthUser | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [removeUser, setRemoveUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAuthStatus()
      .then(async (s) => {
        setMe(s.user);
        if (s.user?.isAdmin) setUsers(await listUsers());
      })
      .catch(() => {});
  }, []);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ text: ok });
    } catch (e) {
      setMsg({ text: (e as Error).message || 'Das hat nicht geklappt.', error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!me) return null;

  return (
    <CollapsibleCard storageKey="zugaenge" title="Zugänge" icon={<Users size={16} />} summary={`Angemeldet als ${me.name}`}>
      <div className="px-4 pb-4 space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{me.name}</p>
            <p className="text-xs text-gray-500 truncate">{me.email}{me.isAdmin ? ' · Admin' : ''}</p>
            <p className="text-xs text-gray-500 mt-0.5">Angemeldet auf diesem Gerät</p>
          </div>
          <button
            onClick={async () => {
              await logout().catch(() => {});
              window.location.reload();
            }}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <LogOut size={14} aria-hidden="true" /> Abmelden
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await changePassword(pw.current, pw.next);
              setPw({ current: '', next: '' });
            }, 'Passwort geändert.');
          }}
          className="space-y-2 pt-4 border-t border-gray-100"
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <KeyRound size={13} aria-hidden="true" /> Eigenes Passwort ändern
          </p>
          <input type="password" className={input} placeholder="Bisheriges Passwort" aria-label="Bisheriges Passwort"
            autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          <input type="password" className={input} placeholder="Neues Passwort (mind. 8 Zeichen)" aria-label="Neues Passwort"
            autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className={button}>Passwort ändern</button>
          </div>
        </form>

        {me.isAdmin && (
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-600">Zugänge eurer Familie</p>
            <ul className="space-y-2">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 pl-4 pr-2 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {u.name}
                      {u.id === me.id && <span className="font-normal text-gray-500"> (du)</span>}
                      {u.isAdmin && <span className="ml-1.5 align-middle text-xs font-semibold uppercase tracking-wide text-brand-700">Admin</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  {u.id !== me.id && (
                    <>
                      <button onClick={() => { setResetFor(u); setResetPw(''); }} aria-label={`Passwort von ${u.name} zurücksetzen`}
                        title="Passwort zurücksetzen" className="tap w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                        <KeyRound size={15} />
                      </button>
                      <button onClick={() => setRemoveUser(u)} aria-label={`Zugang von ${u.name} entfernen`}
                        title="Zugang entfernen" className="tap w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  setUsers(await addUser(newUser));
                  setNewUser({ name: '', email: '', password: '', isAdmin: false });
                }, 'Zugang angelegt. Gib die E-Mail und das Startpasswort weiter.');
              }}
              className="space-y-2 rounded-xl border border-dashed border-gray-200 p-3"
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <UserPlus size={13} aria-hidden="true" /> Zugang anlegen
              </p>
              <input className={input} placeholder="Name" aria-label="Name" value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
              <input type="email" className={input} placeholder="E-Mail" aria-label="E-Mail" autoComplete="off" value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
              <input className={input} placeholder="Startpasswort (mind. 8 Zeichen)" aria-label="Startpasswort" autoComplete="off" minLength={8}
                value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={newUser.isAdmin} onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })} />
                  Darf Zugänge verwalten (Admin)
                </label>
                <button type="submit" disabled={busy} className={button}>Anlegen</button>
              </div>
            </form>
          </div>
        )}

        {msg && (
          <p role={msg.error ? 'alert' : 'status'} className={`text-xs ${msg.error ? 'text-red-600' : 'text-brand-700'}`}>
            {msg.text}
          </p>
        )}
      </div>

      {resetFor && (
        <ConfirmDialog
          title={`Neues Passwort für ${resetFor.name}`}
          message={
            <div className="space-y-2">
              <span className="block">Die Person wird auf allen Geräten abgemeldet und meldet sich mit dem neuen Passwort an.</span>
              <input className={input} placeholder="Neues Passwort (mind. 8 Zeichen)" aria-label="Neues Passwort" autoComplete="off"
                value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
            </div>
          }
          confirmLabel="Speichern"
          onConfirm={async () => {
            setUsers(await resetUserPassword(resetFor.id, resetPw));
            setMsg({ text: `Passwort für ${resetFor.name} geändert.` });
          }}
          onClose={() => setResetFor(null)}
        />
      )}
      {removeUser && (
        <ConfirmDialog
          title="Zugang entfernen?"
          message={`${removeUser.name} (${removeUser.email}) kann sich danach nicht mehr anmelden. Eure Pläne und Rezepte bleiben.`}
          confirmLabel="Entfernen"
          danger
          onConfirm={async () => setUsers(await deleteUser(removeUser.id))}
          onClose={() => setRemoveUser(null)}
        />
      )}
    </CollapsibleCard>
  );
}
