import { useEffect, useState } from 'react';
import { Ban, Check, Copy, Link2, Pencil, Plus, Share2, ShieldCheck, Trash2 } from 'lucide-react';
import AdminStats from './AdminStats';
import AdminInbox from './AdminInbox';
import CollapsibleCard from './CollapsibleCard';
import SettingsGroup from './SettingsGroup';
import ConfirmDialog from './ConfirmDialog';
import {
  createFamily, deleteFamily, getAuthStatus, listFamilies, newFamilyInvite, updateFamily, type Family, type InviteResult,
} from '../lib/api';

const input = 'w-full h-9 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const iconBtn = 'w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100';

const formatDate = (v: string | null) =>
  v ? new Date(v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;

/** Einstellungen → Administration (nur Betreiber): Familien anlegen und per Link einladen, umbenennen, sperren, löschen */
export default function AdminSettings() {
  const [owner, setOwner] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [newName, setNewName] = useState('');
  const [invite, setInvite] = useState<(InviteResult & { family: string }) | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState<Family | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [remove, setRemove] = useState<Family | null>(null);

  useEffect(() => {
    getAuthStatus()
      .then(async (s) => {
        if (!s.user?.isOwner) return;
        setOwner(true);
        setFamilies(await listFamilies());
      })
      .catch(() => {});
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  const showInvite = (r: InviteResult, family: string) => {
    setFamilies(r.families);
    setInvite({ ...r, family });
    setCopied(false);
  };

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopied(true);
    } catch {
      setError('Kopieren ging nicht – bitte den Link markieren und kopieren.');
    }
  };

  const share = async () => {
    if (!invite) return;
    try {
      await navigator.share({ title: 'Einladung zu miyummy', text: `Einladung für ${invite.family}:`, url: invite.inviteUrl });
    } catch {
      /* abgebrochen */
    }
  };

  if (!owner) return null;
  const others = families.filter((f) => !f.own).length;

  return (
    <SettingsGroup title="Administration">
    <CollapsibleCard
      storageKey="administration"
      title="Administration"
      icon={<ShieldCheck size={16} />}
      summary={`${families.length} ${families.length === 1 ? 'Familie' : 'Familien'} · nur für dich sichtbar`}
    >
      <div className="px-4 pb-4 space-y-4">
        <p className="text-xs text-gray-500">
          Lege eine Familie an und schick den Einladungslink weiter. Wer ihn öffnet, legt den ersten Zugang an und verwaltet
          danach seine Familie selbst. Rezepte, Pläne und Einstellungen sind pro Familie getrennt; Grundsammlung und Bilder
          teilen sich alle.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (!name) return;
            run(async () => {
              showInvite(await createFamily(name), name);
              setNewName('');
            });
          }}
          className="flex gap-2"
        >
          <input className={input} placeholder="Name, z. B. Familie Müller" aria-label="Name der neuen Familie" value={newName}
            onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" disabled={busy || !newName.trim()}
            className="flex-shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300">
            <Plus size={14} aria-hidden="true" /> Anlegen
          </button>
        </form>

        {invite && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 space-y-2" role="status">
            <p className="text-xs font-semibold text-brand-800">Einladungslink für {invite.family}</p>
            <p className="text-xs text-gray-600">Gültig {invite.days} Tage, nur einmal nutzbar.</p>
            <input readOnly value={invite.inviteUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Einladungslink"
              className="w-full h-9 px-3 rounded-xl border border-brand-200 bg-white text-xs text-gray-700" />
            <div className="flex gap-2">
              <button onClick={copy} className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-white border border-brand-200 text-brand-800 hover:bg-brand-100">
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
              {typeof navigator.share === 'function' && (
                <button onClick={share} className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-brand-700 text-white hover:bg-brand-800">
                  <Share2 size={14} aria-hidden="true" /> Teilen
                </button>
              )}
            </div>
          </div>
        )}

        <ul className="space-y-2">
          {families.map((f) => {
            const label = f.name || (f.own ? 'Eure Familie' : 'Ohne Namen');
            const last = formatDate(f.lastLoginAt);
            return (
              <li key={f.id} className="flex items-center gap-1 rounded-xl bg-gray-50 border border-gray-100 pl-4 pr-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {label}
                    {f.own && <span className="font-normal text-gray-500"> (ihr)</span>}
                    {f.disabled && <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-red-700">Gesperrt</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {f.userCount} {f.userCount === 1 ? 'Zugang' : 'Zugänge'} · {f.planCount} {f.planCount === 1 ? 'Plan' : 'Pläne'}
                    {last ? ` · zuletzt ${last}` : f.openInvites ? ' · Einladung offen' : ''}
                  </p>
                </div>
                <button onClick={() => { setRename(f); setRenameValue(f.name ?? ''); }} aria-label={`${label} umbenennen`} title="Umbenennen" className={iconBtn}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => run(async () => showInvite(await newFamilyInvite(f.id), label))} aria-label={`Neuer Einladungslink für ${label}`}
                  title="Neuer Einladungslink" className={iconBtn}>
                  <Link2 size={15} />
                </button>
                {!f.own && (
                  <>
                    <button onClick={() => run(async () => setFamilies(await updateFamily(f.id, { disabled: !f.disabled })))}
                      aria-label={f.disabled ? `${label} entsperren` : `${label} sperren`} title={f.disabled ? 'Entsperren' : 'Sperren'}
                      className={`${iconBtn} ${f.disabled ? 'text-red-600' : ''}`}>
                      <Ban size={15} />
                    </button>
                    <button onClick={() => setRemove(f)} aria-label={`${label} löschen`} title="Löschen"
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {others === 0 && <p className="text-xs text-gray-500">Noch keine weitere Familie angelegt.</p>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>

      {rename && (
        <ConfirmDialog
          title="Familie umbenennen"
          message={<input className={input} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} aria-label="Name der Familie" autoFocus />}
          confirmLabel="Speichern"
          onConfirm={async () => setFamilies(await updateFamily(rename.id, { name: renameValue }))}
          onClose={() => setRename(null)}
        />
      )}
      {remove && (
        <ConfirmDialog
          title={`${remove.name || 'Familie'} löschen?`}
          message="Alle Pläne, Rezepte, Einkaufslisten, Einstellungen und Zugänge dieser Familie werden endgültig gelöscht. Das lässt sich nicht rückgängig machen."
          confirmLabel="Endgültig löschen"
          danger
          onConfirm={async () => setFamilies(await deleteFamily(remove.id))}
          onClose={() => setRemove(null)}
        />
      )}
    </CollapsibleCard>
    <AdminStats />
    <AdminInbox />
    </SettingsGroup>
  );
}
