import { useState } from 'react';
import { ArrowLeft, Loader2, Trash2, Wheat, X } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { DayRules, MealPlan, PlanMeal } from '../types';
import { getWeeksInRange, toIso } from '../lib/dateUtils';
import { ruleForDate } from '../lib/dayRules';

interface MoveMealSheetProps {
  pm: PlanMeal;
  plan: MealPlan;
  /** Alle Gerichte des Plans (für „tauschen mit …“) */
  planMeals: PlanMeal[];
  dayRules?: DayRules;
  onMove: (date: string) => Promise<void>;
  onRemove: () => Promise<void>;
  /** Gericht durch Brotzeit ersetzen (fehlt bei Brotzeit-Tagen) */
  onBrotzeit?: () => Promise<void>;
  onClose: () => void;
}

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const label = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${dayNames[new Date(`${iso}T12:00:00`).getDay()]}, ${d}.${m}.`;
};
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toIso(d);
};

/** Wie weit nach Planende man verschieben kann (Tage) */
const EXTRA_DAYS = 14;

type Step = { kind: 'pick' } | { kind: 'move'; date: string } | { kind: 'remove' } | { kind: 'brotzeit' };

/** Gericht auf einen anderen Tag (auch nächste Woche) verschieben oder den Tag leeren */
export default function MoveMealSheet({ pm, plan, planMeals, dayRules, onMove, onRemove, onBrotzeit, onClose }: MoveMealSheetProps) {
  const dialogRef = useDialog(onClose);
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = toIso(new Date());
  const from = plan.start_date > today ? plan.start_date : today;
  const to = addDays(plan.end_date, EXTRA_DAYS);
  const mealOn = new Map(planMeals.filter((m) => !m.rejected).map((m) => [m.meal_date, m]));
  const weeks = getWeeksInRange(from, to).map((w) => {
    const days: string[] = [];
    for (let d = w.weekStart < from ? from : w.weekStart; d <= w.weekEnd && d <= to; d = addDays(d, 1)) days.push(d);
    return { kw: w.kw, days };
  });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
      setBusy(false);
    }
  };

  const target = step.kind === 'move' ? mealOn.get(step.date) : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          {step.kind !== 'pick' && (
            <button
              onClick={() => setStep({ kind: 'pick' })}
              aria-label="Zurück zur Tagesauswahl"
              className="tap w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 id="move-title" className="text-base font-semibold text-gray-900">
              {step.kind === 'pick' ? (onBrotzeit ? 'Verschieben, Brotzeit oder leeren' : 'Verschieben oder Tag leeren') : 'Bitte bestätigen'}
            </h2>
            <p className="text-xs text-gray-500 truncate">
              {pm.meal_name} · {label(pm.meal_date)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="tap w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {step.kind === 'pick' ? (
          <>
            <div className="flex-1 overflow-y-auto">
              {weeks.map((w) => (
                <div key={w.kw}>
                  <p className="sticky top-0 px-4 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    KW {w.kw}
                  </p>
                  <ul className="divide-y divide-gray-100">
                    {w.days.map((d) => {
                      const current = d === pm.meal_date;
                      const other = mealOn.get(d);
                      const off = ruleForDate(d, dayRules).off;
                      return (
                        <li key={d}>
                          <button
                            disabled={current}
                            onClick={() => setStep({ kind: 'move', date: d })}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 disabled:bg-brand-50"
                          >
                            <span className="w-32 flex-shrink-0 text-sm font-medium text-gray-800">{label(d)}</span>
                            <span className={`flex-1 min-w-0 truncate text-xs ${other && !current ? 'text-gray-600' : 'text-gray-500'}`}>
                              {current ? 'aktueller Tag' : other ? `tauschen mit ${other.meal_name}` : off ? 'frei (Wochentag)' : 'frei'}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 space-y-2">
              {onBrotzeit && (
                <button
                  onClick={() => setStep({ kind: 'brotzeit' })}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-coral-300 bg-white text-sm font-semibold text-coral-700 hover:bg-coral-50"
                >
                  <Wheat size={15} />
                  Brotzeit statt Kochen
                </button>
              )}
              <button
                onClick={() => setStep({ kind: 'remove' })}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} />
                Tag leeren – nicht kochen
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 py-5 space-y-4">
            <p className="text-sm text-gray-700">
              {step.kind === 'move' ? (
                <>
                  <strong>{pm.meal_name}</strong> auf <strong>{label(step.date)}</strong> verschieben?
                  {target ? (
                    <> Dafür kommt <strong>{target.meal_name}</strong> auf {label(pm.meal_date)}.</>
                  ) : step.date > plan.end_date ? (
                    <> Der Plan wird bis dahin verlängert.</>
                  ) : null}
                </>
              ) : step.kind === 'brotzeit' ? (
                <>
                  Am {label(pm.meal_date)} <strong>Brotzeit</strong> statt <strong>{pm.meal_name}</strong>? Die Zutaten verschwinden
                  von der Einkaufsliste. Mit „Doch kochen“ planst du später wieder ein Gericht.
                </>
              ) : (
                <>
                  <strong>{pm.meal_name}</strong> am {label(pm.meal_date)} aus dem Plan nehmen? Der Tag bleibt leer, die Zutaten
                  verschwinden von der Einkaufsliste. Das Gericht wird nicht ausgeblendet und kann wieder vorgeschlagen werden.
                </>
              )}
            </p>
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
            <button
              onClick={() => run(step.kind === 'move' ? () => onMove(step.date) : step.kind === 'brotzeit' && onBrotzeit ? onBrotzeit : onRemove)}
              disabled={busy}
              className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 ${
                step.kind === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-700 hover:bg-brand-800'
              }`}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {step.kind === 'move' ? (target ? 'Tauschen' : 'Verschieben') : step.kind === 'brotzeit' ? 'Brotzeit machen' : 'Tag leeren'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
