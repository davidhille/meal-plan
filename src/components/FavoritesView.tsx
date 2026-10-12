import { useState } from 'react';
import { Heart, Clock, Trash2, Repeat } from 'lucide-react';
import { Favorite, Meal } from '../types';
import MealModal from './MealModal';

interface FavoritesViewProps {
  favorites: Favorite[];
  ratings: Record<string, number>;
  defaultPortions?: number;
  onSetTurnus: (id: string, weeks: number | null) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const TURNUS_OPTIONS: { weeks: number | null; label: string }[] = [
  { weeks: null, label: 'Kein Turnus' },
  { weeks: 1, label: 'Jede Woche' },
  { weeks: 2, label: 'Alle 2 Wochen' },
  { weeks: 3, label: 'Alle 3 Wochen' },
  { weeks: 4, label: 'Alle 4 Wochen' },
];

function formatDate(d: string) {
  const [, m, day] = d.split('-');
  return `${day}.${m}.`;
}

function toMeal(f: Favorite): Meal {
  return {
    day: 'Favorit',
    dayShort: '♥',
    meal: f.meal_name,
    description: '',
    type: f.meal_type,
    ingredients: f.ingredients,
    instructions: f.instructions ?? '',
    durationMin: f.duration_min,
  };
}

export default function FavoritesView({ favorites, ratings, defaultPortions, onSetTurnus, onRemove }: FavoritesViewProps) {
  const [selected, setSelected] = useState<Favorite | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (favorites.length === 0) {
    return (
      <div className="px-5 py-12 flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
          <Heart size={28} className="text-rose-400" />
        </div>
        <p className="font-display text-lg font-semibold text-gray-800 mt-2">Noch keine Favoriten</p>
        <p className="text-sm text-gray-500 max-w-xs">
          Tippe im Speiseplan bei einem Gericht auf „Merken“. Hier kannst du dann festlegen, wie oft es wiederkommen soll.
        </p>
      </div>
    );
  }

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="px-4 space-y-3">
        {favorites.map((f) => (
          <article
            key={f.id}
            className={`bg-white rounded-2xl border border-gray-200/70 shadow-card p-4 transition-opacity ${
              busyId === f.id ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <button onClick={() => setSelected(f)} className="flex-1 min-w-0 text-left">
                <h3 className="text-[17px] leading-snug font-semibold text-gray-800">{f.meal_name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                  {f.duration_min ? (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {f.duration_min} Min
                    </span>
                  ) : null}
                  {f.last_planned && <span>Zuletzt geplant: {formatDate(f.last_planned)}</span>}
                </div>
              </button>
              {confirmId === f.id ? (
                <button
                  onClick={() => run(f.id, () => onRemove(f.id))}
                  onBlur={() => setConfirmId(null)}
                  className="px-3 h-8 rounded-full text-xs font-semibold text-white bg-red-500"
                >
                  Entfernen?
                </button>
              ) : (
                <button
                  onClick={() => setConfirmId(f.id)}
                  aria-label="Favorit entfernen"
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2">
                <Repeat size={11} /> Turnus
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TURNUS_OPTIONS.map((o) => {
                  const active = (f.turnus_weeks ?? null) === o.weeks;
                  return (
                    <button
                      key={o.label}
                      onClick={() => !active && run(f.id, () => onSetTurnus(f.id, o.weeks))}
                      disabled={busyId === f.id}
                      className={`px-3 h-8 rounded-full text-xs font-semibold transition-colors ${
                        active ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {!f.turnus_weeks && (
                <p className="text-xs text-gray-400 mt-2">Ohne Turnus wird das Gericht bei der Planung bevorzugt.</p>
              )}
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <MealModal
          meal={toMeal(selected)}
          currentRating={ratings[selected.meal_name]}
          defaultPortions={defaultPortions}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
