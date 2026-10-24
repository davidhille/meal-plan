import { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';
import { FAMILY_DISLIKES } from '../lib/familyDislikes';

interface Props {
  onCreatePlan: () => void;
  /** Bisheriges Familien-Nein (Kennungen wie in `family_dislikes`) */
  familyDislikes: string[];
  /** Eine Hauptzutat ein- bzw. ausschließen; wirft bei Fehlern */
  onToggleDislike: (id: string, on: boolean) => Promise<void>;
  /** Frische Familie: noch keine Angaben – dann mit Willkommen */
  fresh: boolean;
}

/**
 * Leerer Speiseplan. Der erste Plan entsteht, bevor die App etwas über die Familie weiß –
 * darum die überspringbare Frage „Was esst ihr nicht?“. Sie blockiert nichts: „Plan erstellen“ geht immer.
 */
export default function EmptyPlanStart({ onCreatePlan, familyDislikes, onToggleDislike, fresh }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (id: string, label: string) => {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await onToggleDislike(id, !familyDislikes.includes(id));
    } catch {
      setError(`„${label}“ konnte nicht gespeichert werden. Bitte Netz prüfen und noch einmal tippen.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-4 py-10 flex flex-col items-center text-center gap-3">
      <CalendarPlus size={32} className="text-gray-300" aria-hidden="true" />
      <h2 className="text-base font-semibold text-gray-800">{fresh ? 'Willkommen bei miyummy' : 'Noch kein Speiseplan'}</h2>
      <p className="text-sm text-gray-600 max-w-xs">
        {fresh
          ? 'Der erste Plan passt besser, wenn er weiß, was ihr nicht esst. Du kannst die Angabe überspringen und später ändern.'
          : 'Erstelle einen Plan. Was ihr nicht esst, bleibt draußen.'}
      </p>

      <section aria-labelledby="no-eat-title" className="w-full max-w-sm mt-2">
        <h3 id="no-eat-title" className="text-sm font-medium text-gray-800 mb-2">
          Was esst ihr nicht?
        </h3>
        <div className="flex flex-wrap justify-center gap-2">
          {FAMILY_DISLIKES.map((d) => {
            const on = familyDislikes.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(d.id, d.label)}
                disabled={busy === d.id}
                className={`inline-flex items-center gap-1.5 px-4 h-11 rounded-full text-sm font-medium border transition-colors ${
                  on
                    ? 'bg-brand-700 border-brand-700 text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {on && <Check size={14} aria-hidden="true" />}
                {d.label}
              </button>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        )}
      </section>

      <button
        onClick={onCreatePlan}
        className="mt-3 px-6 h-11 rounded-xl text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800"
      >
        Plan erstellen
      </button>
    </div>
  );
}
