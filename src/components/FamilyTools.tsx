import { useRef, useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { exportFamilyBackup, importFamilyBackup, setFamilyAiLimit, type FamilyStats } from '../lib/api';
import { toIso } from '../lib/dateUtils';

const BUDGETS: (number | null)[] = [null, 500, 1000, 2000, 3000, 5000];

interface FamilyToolsProps {
  family: FamilyStats;
  label: string;
  /** Nach einer Änderung Statistik neu laden */
  onChanged: () => void;
}

/** Pro Familie in der Statistik: KI-Budget pro Tag, Datensicherung herunterladen und zurückspielen */
export default function FamilyTools({ family, label, onChanged }: FamilyToolsProps) {
  const [busy, setBusy] = useState<'budget' | 'export' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restore, setRestore] = useState<{ file: string; data: unknown } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (kind: 'budget' | 'export' | 'import', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(null);
    }
  };

  const download = () =>
    run('export', async () => {
      const data = await exportFamilyBackup(family.id);
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `miyummy-sicherung-${label.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-')}-${toIso(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setRestore({ file: file.name, data: JSON.parse(await file.text()) });
    } catch {
      setError('Die Datei ist keine gültige Sicherung.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          KI-Budget/Tag
          <select
            value={family.aiDailyLimit ?? ''}
            disabled={!!busy}
            onChange={(e) =>
              run('budget', async () => {
                await setFamilyAiLimit(family.id, e.target.value === '' ? null : Number(e.target.value));
                onChanged();
              })
            }
            className="h-8 px-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-800"
          >
            {BUDGETS.map((b) => (
              <option key={b ?? 'frei'} value={b ?? ''}>
                {b == null ? 'unbegrenzt' : `${b.toLocaleString('de-DE')} Neurons`}
              </option>
            ))}
          </select>
        </label>
        {busy === 'budget' && <Loader2 size={13} className="animate-spin text-gray-400" aria-hidden="true" />}
        <span className="flex-1" />
        <button
          onClick={download}
          disabled={!!busy}
          className="h-8 px-2.5 flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          {busy === 'export' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} aria-hidden="true" />}
          Sichern
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!!busy}
          className="h-8 px-2.5 flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          {busy === 'import' ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} aria-hidden="true" />}
          Wiederherstellen
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label={`Sicherung für ${label} auswählen`}
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>
      {notice && <p role="status" className="text-xs text-brand-700">{notice}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      {restore && (
        <ConfirmDialog
          title={`${label} wiederherstellen?`}
          message={
            <>
              Alle Pläne, Rezepte, Einkaufslisten und Einstellungen von <strong>{label}</strong> werden durch den Stand aus{' '}
              <strong>{restore.file}</strong> ersetzt. Zugänge bleiben. Das lässt sich nicht rückgängig machen – am besten vorher
              „Sichern“.
            </>
          }
          confirmLabel="Wiederherstellen"
          danger
          onConfirm={() =>
            run('import', async () => {
              const r = await importFamilyBackup(family.id, restore.data);
              setNotice(`Wiederhergestellt: ${r.rows} Einträge.`);
              onChanged();
            })
          }
          onClose={() => setRestore(null)}
        />
      )}
    </div>
  );
}
