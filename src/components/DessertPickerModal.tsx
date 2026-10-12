import { useState } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { Dessert, PlanDessert } from '../types';
import DessertsView from './DessertsView';

interface DessertPickerModalProps {
  /** z. B. „Montag, 13.10.“ */
  dayLabel: string;
  mealName: string;
  current?: PlanDessert | null;
  /** null = Nachtisch entfernen */
  onSave: (dessert: Dessert | null) => Promise<void>;
  onClose: () => void;
}

/** Nachtisch für ein Gericht auswählen: Antippen hängt ihn direkt an */
export default function DessertPickerModal({ dayLabel, mealName, current, onSave, onClose }: DessertPickerModalProps) {
  const dialogRef = useDialog(onClose);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (dessert: Dessert | null) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(dessert);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dessert-picker-title"
        tabIndex={-1}
        className="outline-none relative flex flex-col w-full max-w-2xl h-full bg-gray-50 sm:rounded-2xl overflow-hidden shadow-xl"
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 bg-white">
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0"
          >
            <X size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider truncate">{dayLabel} · {mealName}</p>
            <h2 id="dessert-picker-title" className="text-base font-semibold text-gray-900 leading-tight">
              Nachtisch auswählen
            </h2>
          </div>
        </div>

        {current && (
          <div className="flex items-center gap-3 mx-4 mt-4 px-3 py-2.5 rounded-xl bg-white border border-gray-100">
            <p className="flex-1 min-w-0 text-sm text-gray-600 truncate">
              Aktuell: <span className="font-semibold text-gray-800">{current.name}</span>
            </p>
            <button
              onClick={() => save(null)}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100"
            >
              <Trash2 size={13} aria-hidden="true" />
              Entfernen
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mx-4 mt-3 text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto">
          <DessertsView onPick={save} />
        </div>

        {saving && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60" role="status" aria-label="Wird gespeichert">
            <Loader2 size={24} className="animate-spin text-gray-500" />
          </div>
        )}
      </div>
    </div>
  );
}
