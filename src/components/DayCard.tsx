import { Meal, MealType, PlanDessert } from '../types';
import { ChevronRight, Leaf, Beef, Fish, Sunset, Star, X, Heart, RefreshCw, Clock, Loader2, CakeSlice, CalendarDays, Sprout, UserPlus } from 'lucide-react';
import { dessertPreview } from '../lib/desserts';
import CardActionBar, { CardAction } from './CardActionBar';
import { isFishDish } from '../lib/recipeCategories';

interface DayCardProps {
  meal: Meal;
  rating?: number;
  onClick: () => void;
  onReject?: () => void;
  onRegenerate?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  busy?: boolean;
  /** Nachtisch zum Gericht */
  dessert?: PlanDessert | null;
  onPickDessert?: () => void;
  onOpenDessert?: () => void;
  /** Heutiger Tag – hervorgehoben */
  isToday?: boolean;
  /** Verschieben oder Tag leeren */
  onMove?: () => void;
  /** Nachtisch vom Tag entfernen */
  onRemoveDessert?: () => void;
  /** Saison-Zutaten des Gerichts (z. B. „Kürbis“) */
  season?: string[];
  /** Gäste an diesem Tag */
  guests?: number;
}

const typeConfig: Record<MealType, { bar: string; label: string; icon: React.ReactNode }> = {
  vegetarisch: {
    bar: 'bg-brand-600',
    label: 'Vegetarisch',
    icon: <Leaf size={11} className="text-brand-700" aria-hidden="true" />,
  },
  fleisch: {
    bar: 'bg-coral-500',
    label: 'Fleisch',
    icon: <Beef size={11} className="text-coral-700" aria-hidden="true" />,
  },
  wochenende: {
    bar: 'bg-brand-900',
    label: 'Wochenende',
    icon: <Sunset size={11} className="text-brand-900" aria-hidden="true" />,
  },
};

const fishConfig = {
  bar: 'bg-coral-300',
  label: 'Fisch',
  icon: <Fish size={11} className="text-coral-700" aria-hidden="true" />,
};

/** Gerichtkarte: Farbbalken, Bild, Typ; unten die Aktionsleiste (Merken, Nachtisch, Verschieben, Tauschen, Ablehnen) */
export default function DayCard({
  meal,
  rating,
  onClick,
  onReject,
  onRegenerate,
  onToggleFavorite,
  isFavorite,
  busy,
  dessert,
  onPickDessert,
  onOpenDessert,
  isToday,
  onMove,
  onRemoveDessert,
  season,
  guests = 0,
}: DayCardProps) {
  // „Fleisch“-Tage mit Fisch oder Meeresfrüchten (ohne Fleisch) als „Fisch“ anzeigen
  const config =
    meal.type === 'fleisch' && isFishDish({ name: meal.meal, ingredients: meal.ingredients ?? [] }) ? fishConfig : typeConfig[meal.type];
  const actions: CardAction[] = [];
  if (onToggleFavorite)
    actions.push({
      key: 'fav',
      label: isFavorite ? 'Gemerkt' : 'Merken',
      icon: <Heart size={16} className={isFavorite ? 'fill-coral-500 text-coral-500' : ''} />,
      onClick: onToggleFavorite,
      tone: isFavorite ? 'active' : 'default',
      pressed: !!isFavorite,
      title: isFavorite ? 'Aus Favoriten entfernen' : 'Merken',
      ariaLabel: `${meal.meal}: ${isFavorite ? 'aus Favoriten entfernen' : 'merken'}`,
    });
  if (onPickDessert)
    actions.push({
      key: 'dessert',
      label: 'Nachtisch',
      icon: <CakeSlice size={16} />,
      onClick: onPickDessert,
      tone: dessert ? 'active' : 'default',
      title: dessert ? 'Nachtisch ändern' : 'Nachtisch dazu',
      ariaLabel: `${meal.meal}: ${dessert ? `Nachtisch ändern (${dessert.name})` : 'Nachtisch hinzufügen'}`,
    });
  if (onMove)
    actions.push({
      key: 'move',
      label: 'Verschieben',
      icon: <CalendarDays size={16} />,
      onClick: onMove,
      title: 'Verschieben oder Tag leeren',
      ariaLabel: `${meal.meal}: auf anderen Tag verschieben oder Tag leeren`,
    });
  if (onRegenerate)
    actions.push({
      key: 'swap',
      label: 'Tauschen',
      icon: busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />,
      onClick: onRegenerate,
      title: 'Neu generieren – nur austauschen',
      ariaLabel: `${meal.meal}: austauschen`,
    });
  if (onReject)
    actions.push({
      key: 'reject',
      label: 'Ablehnen',
      icon: <X size={16} />,
      onClick: onReject,
      tone: 'danger',
      title: 'Ablehnen – kommt nicht wieder',
      ariaLabel: `${meal.meal}: ablehnen, kommt nicht wieder`,
    });

  return (
    <article
      className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-opacity ${busy ? 'opacity-60' : ''} ${
        isToday ? 'border-brand-300 ring-1 ring-brand-300' : 'border-gray-100'
      }`}
    >
      <button
        onClick={onClick}
        className="w-full text-left flex hover:bg-gray-50/60 active:bg-gray-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
      >
        <div className={`w-1 flex-shrink-0 ${config.bar}`} />
        <div className="flex items-center gap-3.5 p-3.5 flex-1 min-w-0">
          {meal.imageUrl ? (
            <img src={meal.imageUrl} alt="" loading="lazy" className="flex-shrink-0 w-20 h-20 rounded-xl object-cover bg-gray-100" />
          ) : (
            <div className="flex-shrink-0 w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
              <span className="text-xs font-semibold text-gray-500">{meal.dayShort}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              {isToday && <span className="mr-1.5 px-1.5 py-px rounded bg-brand-700 text-white normal-case tracking-normal">Heute</span>}
              {meal.day}
            </p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-gray-900 leading-snug line-clamp-2">{meal.meal}</h3>
            {/* Infozeile: Teile brechen als Ganzes um, nie mitten im Wort („35 Min“) */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-xs text-gray-500 whitespace-nowrap tabular-nums">
              <span className="flex items-center gap-1">
                {config.icon}
                {config.label}
              </span>
              {meal.durationMin ? (
                <span className="flex items-center gap-1">
                  <Clock size={11} aria-hidden="true" />
                  {meal.durationMin} Min
                </span>
              ) : null}
              {guests > 0 && (
                <span className="flex items-center gap-1 font-medium text-brand-700">
                  <UserPlus size={11} aria-hidden="true" />+{guests}
                  <span className="sr-only">{guests === 1 ? 'Gast' : 'Gäste'}</span>
                </span>
              )}
              {rating ? (
                <span className="text-amber-700 font-medium flex items-center gap-0.5" aria-label={`${rating} von 5 Sternen`}>
                  <Star size={11} className="fill-yellow-400 text-yellow-500" aria-hidden="true" />
                  {rating}
                </span>
              ) : null}
            </div>
            {season && season.length > 0 && (
              <p className="flex items-center gap-1 mt-1 min-w-0 text-xs text-coral-700" title="Hat gerade Saison">
                <Sprout size={11} aria-hidden="true" className="flex-shrink-0" />
                <span className="truncate">Saison: {season.join(', ')}</span>
              </p>
            )}
          </div>
          <ChevronRight size={16} className="text-gray-300 flex-shrink-0" aria-hidden="true" />
        </div>
      </button>
      {dessert && (
        <div className="flex items-stretch border-t border-gray-100">
          <button
            onClick={onOpenDessert}
            className="flex-1 min-w-0 flex items-center gap-3 pl-5 pr-2 py-2 text-left hover:bg-coral-50/60 transition-colors duration-150"
          >
            {dessert.imageUrl ? (
              <img
                src={dessertPreview(dessert.imageUrl)}
                alt=""
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  // Vorschau → Original; schlägt auch das fehl (z. B. eigenes Bild noch nicht erzeugt), ausblenden
                  if (!img.src.endsWith(dessert.imageUrl!)) img.src = dessert.imageUrl!;
                  else img.style.visibility = 'hidden';
                }}
                className="flex-shrink-0 w-8 h-8 rounded-lg object-cover bg-coral-50"
              />
            ) : (
              <CakeSlice size={16} className="flex-shrink-0 text-coral-700" aria-hidden="true" />
            )}
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-semibold text-coral-700 uppercase tracking-wider">Nachtisch</span>
              <span className="block text-xs font-medium text-gray-800 truncate">{dessert.name}</span>
            </span>
            <ChevronRight size={14} className="text-gray-300 flex-shrink-0" aria-hidden="true" />
          </button>
          {onRemoveDessert && (
            <button
              onClick={onRemoveDessert}
              disabled={busy}
              aria-label={`Nachtisch ${dessert.name} entfernen`}
              title="Nachtisch entfernen"
              className="w-11 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}
      <CardActionBar actions={actions} disabled={busy} />
    </article>
  );
}
