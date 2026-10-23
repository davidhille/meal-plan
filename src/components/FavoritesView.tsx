import { useState } from 'react';
import { Heart, Clock, Trash2, Repeat, Link2, MessageSquare } from 'lucide-react';
import { useRatings } from '../lib/ratings';
import { Favorite, Meal } from '../types';
import MealModal from './MealModal';
import RecipeImportModal from './RecipeImportModal';

interface FavoritesViewProps {
  favorites: Favorite[];
  ratings: Record<string, number>;
  defaultPortions?: number;
  onSetTurnus: (id: string, weeks: number | null) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  /** Nach einem Rezept-Import (neue Favoritenliste) */
  onFavoritesChange: (favorites: Favorite[]) => void;
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

export default function FavoritesView({ favorites, ratings, defaultPortions, onSetTurnus, onRemove, onFavoritesChange }: FavoritesViewProps) {
  const [selected, setSelected] = useState<Favorite | null>(null);
  const { notes } = useRatings();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const importButton = (
    <button
      onClick={() => setShowImport(true)}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors"
    >
      <Link2 size={16} aria-hidden="true" />
      Rezept aus dem Web importieren
    </button>
  );

  const importOverlay = (
    <>
      {showImport && (
        <RecipeImportModal
          onSaved={(next, name) => {
            onFavoritesChange(next);
            setShowImport(false);
            setNotice(`„${name}“ ist jetzt im Rezept-Pool.`);
            setTimeout(() => setNotice(null), 5000);
          }}
          onClose={() => setShowImport(false)}
        />
      )}
      {notice && (
        <div role="status" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6 inset-x-4 z-40 max-w-md mx-auto px-4 py-3 rounded-2xl bg-gray-800 text-white text-sm shadow-lg">
          {notice}
        </div>
      )}
    </>
  );

  if (favorites.length === 0) {
    return (
      <>
      <div className="px-5 py-12 flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-coral-50 flex items-center justify-center">
          <Heart size={28} className="text-coral-500" />
        </div>
        <p className="text-lg font-semibold text-gray-800 mt-2">Noch keine Favoriten</p>
        <p className="text-sm text-gray-500 max-w-xs">
          Tippe im Speiseplan bei einem Gericht auf das Herz. Hier kannst du dann festlegen, wie oft es wiederkommen soll.
        </p>
        <div className="w-full max-w-sm mt-4">{importButton}</div>
      </div>
      {importOverlay}
      </>
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
      <div className="px-4 py-4 space-y-3">
        {importButton}
        <p className="text-xs text-gray-500 px-1">Eure Lieblingsgerichte – mit Turnus kommen sie automatisch wieder in den Plan.</p>
        {favorites.map((f) => (
          <article
            key={f.id}
            className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 transition-opacity ${
              busyId === f.id ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <button onClick={() => setSelected(f)} className="flex-1 min-w-0 text-left">
                <h2 className="text-sm leading-snug font-semibold text-gray-800">{f.meal_name}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                  {f.duration_min ? (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {f.duration_min} Min
                    </span>
                  ) : null}
                  {f.last_planned && <span>Zuletzt geplant: {formatDate(f.last_planned)}</span>}
                </div>
                {notes[f.meal_name] && (
                  <p className="flex gap-1.5 mt-1.5 text-xs text-gray-600">
                    <MessageSquare size={12} className="flex-shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
                    <span className="line-clamp-2">{notes[f.meal_name].notes}</span>
                  </p>
                )}
              </button>
              {confirmId === f.id ? (
                <button
                  autoFocus
                  onClick={() => run(f.id, () => onRemove(f.id))}
                  onBlur={() => setConfirmId(null)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold text-white bg-red-500"
                >
                  Entfernen?
                </button>
              ) : (
                <button
                  onClick={() => setConfirmId(f.id)}
                  aria-label={`${f.meal_name} aus Favoriten entfernen`}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                <Repeat size={11} /> Turnus
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Turnus für ${f.meal_name}`}>
                {TURNUS_OPTIONS.map((o) => {
                  const active = (f.turnus_weeks ?? null) === o.weeks;
                  return (
                    <button
                      key={o.label}
                      aria-pressed={active}
                      onClick={() => !active && run(f.id, () => onSetTurnus(f.id, o.weeks))}
                      disabled={busyId === f.id}
                      className={`px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
                        active ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {!f.turnus_weeks && (
                <p className="text-xs text-gray-500 mt-2">Ohne Turnus wird das Gericht bei der Planung bevorzugt.</p>
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
      {importOverlay}
    </>
  );
}
