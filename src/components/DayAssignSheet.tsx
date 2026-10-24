import { useState } from 'react';
import { X, Loader2, ChevronRight, ArrowLeft } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { PlanMeal } from '../types';

interface DayAssignSheetProps {
  /** replace = Gericht des Tages austauschen, dessert = Nachtisch an den Tag hängen */
  mode: 'replace' | 'dessert';
  /** Name des gewählten Rezepts bzw. Nachtischs */
  itemName: string;
  planMeals: PlanMeal[];
  onConfirm: (pm: PlanMeal) => Promise<void>;
  onClose: () => void;
}

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function dayLabel(date: string) {
  const dow = new Date(date + 'T12:00:00').getDay();
  const [, m, d] = date.split('-');
  return `${dayNames[dow]}, ${d}.${m}.`;
}

/** Erst Tag wählen, dann noch einmal bestätigen – erst dann wird gespeichert */
export default function DayAssignSheet({ mode, itemName, planMeals, onConfirm, onClose }: DayAssignSheetProps) {
  const dialogRef = useDialog(onClose);
  const [chosen, setChosen] = useState<PlanMeal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = planMeals.filter((pm) => !pm.rejected).sort((a, b) => a.meal_date.localeCompare(b.meal_date));

  const confirm = async () => {
    if (!chosen || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(chosen);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-assign-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          {chosen && (
            <button
              onClick={() => setChosen(null)}
              aria-label="Zurück zur Tagesauswahl"
              className="tap w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 id="day-assign-title" className="flex-1 text-base font-semibold text-gray-900">
            {chosen ? (mode === 'replace' ? 'Gericht ersetzen?' : 'Nachtisch festlegen?') : mode === 'replace' ? 'Für welchen Tag?' : 'Nachtisch für welchen Tag?'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="tap w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {days.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-gray-500">
            Es gibt noch keinen Speiseplan. Erstelle zuerst einen Plan, dann kannst du hier Tage auswählen.
          </p>
        ) : !chosen ? (
          <ul className="overflow-y-auto divide-y divide-gray-100">
            {days.map((pm) => {
              const current = mode === 'replace' ? pm.meal_name : pm.dessert?.name;
              return (
                <li key={pm.id}>
                  <button
                    onClick={() => setChosen(pm)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">{dayLabel(pm.meal_date)}</span>
                      <span className="block text-sm text-gray-800 truncate">
                        {mode === 'replace' ? current : pm.meal_name}
                      </span>
                      {mode === 'dessert' && current && (
                        <span className="block text-xs text-amber-700 truncate">Nachtisch: {current}</span>
                      )}
                    </span>
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-5 space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              {mode === 'replace' ? (
                <>
                  Am <strong>{dayLabel(chosen.meal_date)}</strong> wird <strong>{chosen.meal_name}</strong> durch{' '}
                  <strong>{itemName}</strong> ersetzt.
                </>
              ) : chosen.dessert ? (
                <>
                  Am <strong>{dayLabel(chosen.meal_date)}</strong> wird der Nachtisch <strong>{chosen.dessert.name}</strong> durch{' '}
                  <strong>{itemName}</strong> ersetzt.
                </>
              ) : (
                <>
                  <strong>{itemName}</strong> kommt am <strong>{dayLabel(chosen.meal_date)}</strong> als Nachtisch zu{' '}
                  <strong>{chosen.meal_name}</strong>.
                </>
              )}
            </p>
            <p className="text-xs text-gray-500">Die Einkaufsliste passt sich automatisch an.</p>
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setChosen(null)}
                disabled={saving}
                className="flex-1 h-11 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Abbrechen
              </button>
              <button
                onClick={confirm}
                disabled={saving}
                className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Bestätigen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
