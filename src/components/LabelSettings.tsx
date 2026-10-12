import { useEffect, useState } from 'react';
import { ListChecks, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { DEFAULT_LABELS, LABEL_COLORS, ShoppingLabel } from '../types';
import { createLabel, deleteLabel, getLabels, updateLabel } from '../lib/api';
import ConfirmDialog from './ConfirmDialog';
import CollapsibleCard from './CollapsibleCard';

/** Eigene Listen gehören nicht zu einem Shop und sind keine Standard-Liste */
const isCustom = (l: ShoppingLabel) => !l.provider && !DEFAULT_LABELS.some((d) => d.id === l.id);

/** Einstellungen → Einkaufslisten: eigene Listen (z. B. Aldi, DM) anlegen, umbenennen, löschen */
export default function LabelSettings() {
  const [labels, setLabels] = useState<ShoppingLabel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShoppingLabel | 'new' | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[2]);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ShoppingLabel | null>(null);

  useEffect(() => {
    getLabels()
      .then(setLabels)
      .catch((e) => setError((e as Error).message));
  }, []);

  const open = (label: ShoppingLabel | 'new') => {
    setEditing(label);
    setName(label === 'new' ? '' : label.name);
    setColor(label === 'new' ? LABEL_COLORS[2] : label.color);
    setError(null);
  };

  const save = async () => {
    if (!name.trim() || saving || !editing) return;
    setSaving(true);
    const next = editing === 'new' ? await createLabel(name.trim(), color) : await updateLabel(editing.id, name.trim(), color);
    setSaving(false);
    if (!next) {
      setError('Die Liste konnte nicht gespeichert werden.');
      return;
    }
    setLabels(next);
    setEditing(null);
  };

  return (
    <CollapsibleCard
      storageKey="einkaufslisten"
      title="Einkaufslisten"
      icon={<ListChecks size={16} />}
      summary={labels ? labels.map((l) => l.name).join(', ') : undefined}
    >
      <p className="px-4 pb-3 text-xs text-gray-500">
        Jede Liste ist ein eigener Abschnitt in der Einkaufsliste, z. B. für Aldi oder die Drogerie.
      </p>

      {!labels ? (
        <div className="px-4 pb-4 flex justify-center">
          {error ? <p className="text-xs text-red-600">{error}</p> : <Loader2 size={18} className="animate-spin text-gray-300" />}
        </div>
      ) : (
        <ul className="border-t border-gray-100 divide-y divide-gray-100">
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} aria-hidden="true" />
              <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{l.name}</span>
              {isCustom(l) ? (
                <>
                  <button
                    onClick={() => open(l)}
                    aria-label={`Liste ${l.name} bearbeiten`}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setToDelete(l)}
                    aria-label={`Liste ${l.name} löschen`}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-gray-500">{l.provider ? 'Shop' : 'Standard'}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="px-4 py-3 border-t border-gray-100 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">{editing === 'new' ? 'Neue Liste' : 'Liste bearbeiten'}</span>
            <button
              onClick={() => setEditing(null)}
              aria-label="Abbrechen"
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200"
            >
              <X size={14} />
            </button>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="z. B. Aldi, Rewe, DM …"
            aria-label="Name der Liste"
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
            {LABEL_COLORS.map((c, i) => (
              <button
                key={c}
                role="radio"
                aria-checked={color === c}
                aria-label={`Farbe ${i + 1}`}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="w-full h-10 rounded-lg text-sm font-semibold bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-500 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editing === 'new' ? 'Liste anlegen' : 'Speichern'}
          </button>
        </div>
      ) : (
        labels && (
          <div className="px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => open('new')}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-600 hover:border-gray-300"
            >
              <Plus size={15} />
              Liste hinzufügen
            </button>
          </div>
        )
      )}

      {toDelete && (
        <ConfirmDialog
          title="Liste löschen?"
          message={
            <>
              Die Liste <strong>{toDelete.name}</strong> wird gelöscht. Artikel darauf wandern zurück auf die Standard-Liste.
            </>
          }
          confirmLabel="Löschen"
          danger
          onConfirm={async () => {
            const next = await deleteLabel(toDelete.id);
            if (!next) throw new Error('Die Liste konnte nicht gelöscht werden.');
            setLabels(next);
            if (editing !== 'new' && editing?.id === toDelete.id) setEditing(null);
          }}
          onClose={() => setToDelete(null)}
        />
      )}
    </CollapsibleCard>
  );
}
