import { useState } from 'react';
import { CakeSlice, ChefHat, ChevronRight, Clock, Loader2, Star } from 'lucide-react';
import { PlanMeal } from '../types';

interface TodayCardProps {
  /** Heutiges Datum als YYYY-MM-DD (lokal) */
  todayIso: string;
  today: PlanMeal | null;
  tomorrow: PlanMeal | null;
  /** Gericht, das noch auf eine Bewertung wartet (gestern oder heute Abend) */
  toRate: PlanMeal | null;
  onOpen: (pm: PlanMeal) => void;
  onCook: (pm: PlanMeal) => void;
  onRate?: (mealName: string, rating: number) => Promise<void>;
  /** Heute ist laut Wochentag-Regel frei */
  todayOff?: boolean;
}

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

/** Oben im Speiseplan: was gibt es heute, was morgen, und kurz das letzte Essen bewerten */
export default function TodayCard({ todayIso, today, tomorrow, toRate, onOpen, onCook, onRate, todayOff }: TodayCardProps) {
  const [saving, setSaving] = useState<number | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!today && !tomorrow && !toRate && !thanks) return null;

  const rate = async (pm: PlanMeal, stars: number) => {
    if (!onRate || saving) return;
    setSaving(stars);
    setError(null);
    try {
      await onRate(pm.meal_name, stars);
      setThanks(pm.meal_name);
    } catch (e) {
      setError((e as Error).message || 'Die Bewertung konnte nicht gespeichert werden.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <section aria-labelledby="heute-titel" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-baseline justify-between gap-2">
        <h2 id="heute-titel" className="text-sm font-bold text-brand-800">
          Heute
        </h2>
        <span className="text-xs text-gray-500">{longDate(todayIso)}</span>
      </div>

      {today?.brotzeit ? (
        <p className="px-4 pb-3 text-sm text-gray-700">
          Heute ist <strong>Brotzeit</strong> – nicht kochen.
        </p>
      ) : today ? (
        <div>
          <button onClick={() => onOpen(today)} className="block w-full text-left">
            {today.image_url && (
              <img src={today.image_url} alt="" className="w-full aspect-[16/9] max-h-56 object-cover bg-gray-100" />
            )}
            <div className="px-4 pt-3">
              <p className="text-lg font-semibold leading-snug text-gray-900">{today.meal_name}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                {today.duration_min ? (
                  <span className="flex items-center gap-1">
                    <Clock size={12} aria-hidden="true" />
                    {today.duration_min} Min
                  </span>
                ) : null}
                {today.dessert && (
                  <span className="flex items-center gap-1 text-amber-700">
                    <CakeSlice size={12} aria-hidden="true" />
                    {today.dessert.name}
                  </span>
                )}
              </p>
            </div>
          </button>
          <div className="grid grid-cols-2 gap-2 px-4 pt-3 pb-3">
            <button
              onClick={() => onOpen(today)}
              className="h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Rezept
            </button>
            <button
              onClick={() => onCook(today)}
              className="h-11 flex items-center justify-center gap-1.5 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800"
            >
              <ChefHat size={16} />
              Kochmodus
            </button>
          </div>
        </div>
      ) : (
        <p className="px-4 pb-3 text-sm text-gray-500">{todayOff ? 'Heute ist frei – nichts geplant.' : 'Für heute ist nichts geplant.'}</p>
      )}

      {tomorrow && (
        <button
          onClick={() => !tomorrow.brotzeit && onOpen(tomorrow)}
          className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 text-left hover:bg-gray-50"
        >
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Morgen</span>
          <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{tomorrow.meal_name}</span>
          <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
        </button>
      )}

      {thanks ? (
        <p role="status" className="px-4 py-3 border-t border-gray-100 bg-brand-50 text-sm text-brand-800">
          Danke! „{thanks}“ ist bewertet.
        </p>
      ) : (
        toRate &&
        onRate && (
          <div className="px-4 py-3 border-t border-gray-100 bg-amber-50/60">
            <p className="text-sm text-gray-800">
              Wie war {toRate.meal_date === todayIso ? 'heute' : 'gestern'} <strong>{toRate.meal_name}</strong>?
            </p>
            <div className="mt-2 flex gap-1" role="group" aria-label="Bewertung">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => rate(toRate, n)}
                  disabled={!!saving}
                  aria-label={`${n} von 5 Sternen`}
                  className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-amber-100"
                >
                  {saving === n ? (
                    <Loader2 size={20} className="animate-spin text-amber-600" />
                  ) : (
                    <Star size={26} className={saving && n <= saving ? 'fill-yellow-400 text-yellow-500' : 'text-amber-400'} />
                  )}
                </button>
              ))}
            </div>
            {error && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>
        )
      )}
    </section>
  );
}
