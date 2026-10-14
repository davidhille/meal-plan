import { Meal, MealType, PlanDessert } from '../types';
import { ChevronRight, Leaf, Beef, Sunset, Star, X, Heart, RefreshCw, Clock, Loader2, CakeSlice, CalendarDays } from 'lucide-react';
import { dessertPreview } from '../lib/desserts';

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
}

const typeConfig: Record<MealType, { bar: string; label: string; icon: React.ReactNode }> = {
  vegetarisch: {
    bar: 'bg-brand-600',
    label: 'Vegetarisch',
    icon: <Leaf size={11} className="text-brand-700" aria-hidden="true" />,
  },
  fleisch: {
    bar: 'bg-orange-400',
    label: 'Fleisch',
    icon: <Beef size={11} className="text-orange-600" aria-hidden="true" />,
  },
  wochenende: {
    bar: 'bg-blue-500',
    label: 'Wochenende',
    icon: <Sunset size={11} className="text-blue-600" aria-hidden="true" />,
  },
};

/** Gerichtkarte im Stil der Juli-Version: Farbbalken, Bild, Typ; rechts die Aktionen */
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
}: DayCardProps) {
  const config = typeConfig[meal.type];
  const hasActions = !!(onReject || onRegenerate || onToggleFavorite || onPickDessert || onMove);

  return (
    <div className={`flex gap-2 items-stretch transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <div
        className={`flex-1 min-w-0 flex flex-col bg-white rounded-xl shadow-sm border overflow-hidden ${
          isToday ? 'border-brand-300 ring-1 ring-brand-300' : 'border-gray-100'
        }`}
      >
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left active:scale-[0.98] transition-transform duration-100 flex"
      >
        <div className={`w-1 flex-shrink-0 ${config.bar}`} />
        <div className="flex items-center gap-3 px-4 py-4 flex-1 min-w-0">
          {meal.imageUrl ? (
            <img
              src={meal.imageUrl}
              alt=""
              loading="lazy"
              className="flex-shrink-0 w-14 h-14 rounded-lg object-cover border border-gray-100"
            />
          ) : (
            <div className="flex-shrink-0 w-14 h-14 bg-gray-50 rounded-lg flex flex-col items-center justify-center border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 leading-tight">{meal.dayShort}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              {isToday && <span className="mr-1.5 px-1.5 py-px rounded bg-brand-700 text-white normal-case tracking-normal">Heute</span>}
              {meal.day}
            </p>
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{meal.meal}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-1">
                {config.icon}
                <span className="text-xs text-gray-500">{config.label}</span>
              </span>
              {meal.durationMin ? (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock size={11} />
                  {meal.durationMin} Min
                </span>
              ) : null}
              {isFavorite && <Heart size={11} className="fill-rose-500 text-rose-500" aria-label="Favorit" />}
              {rating ? (
                <span className="ml-auto text-xs text-amber-700 font-medium flex items-center gap-0.5" aria-label={`${rating} von 5 Sternen`}>
                  <Star size={11} className="fill-yellow-400 text-yellow-500" aria-hidden="true" />
                  {rating}
                </span>
              ) : null}
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
        </div>
      </button>
      {dessert && (
        <div className="flex items-stretch border-t border-gray-100">
        <button
          onClick={onOpenDessert}
          className="flex-1 min-w-0 flex items-center gap-3 pl-5 pr-2 py-2 text-left hover:bg-amber-50/50"
        >
          {dessert.imageUrl ? (
            <img
              src={dessertPreview(dessert.imageUrl)}
              alt=""
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src !== dessert.imageUrl) img.src = dessert.imageUrl!;
                else img.style.visibility = 'hidden';
              }}
              className="flex-shrink-0 w-8 h-8 rounded-md object-cover bg-amber-50"
            />
          ) : (
            <CakeSlice size={16} className="flex-shrink-0 text-amber-600" aria-hidden="true" />
          )}
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] font-medium text-amber-700 uppercase tracking-wide">Nachtisch</span>
            <span className="block text-xs font-medium text-gray-800 truncate">{dessert.name}</span>
          </span>
          <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
        </button>
        {onRemoveDessert && (
          <button
            onClick={onRemoveDessert}
            disabled={busy}
            aria-label={`Nachtisch ${dessert.name} entfernen`}
            title="Nachtisch entfernen"
            className="w-10 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50"
          >
            <X size={15} />
          </button>
        )}
        </div>
      )}
      </div>

      {hasActions && (
        <div className="w-10 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              disabled={busy}
              className={`flex-1 min-h-[32px] flex items-center justify-center transition-colors ${
                isFavorite ? 'text-rose-500 hover:bg-rose-50' : 'text-gray-500 hover:bg-gray-50 hover:text-rose-500'
              }`}
              title={isFavorite ? 'Aus Favoriten entfernen' : 'Merken'}
              aria-label={`${meal.meal}: ${isFavorite ? 'aus Favoriten entfernen' : 'merken'}`}
              aria-pressed={!!isFavorite}
            >
              <Heart size={15} className={isFavorite ? 'fill-rose-500' : ''} />
            </button>
          )}
          {onPickDessert && (
            <button
              onClick={onPickDessert}
              disabled={busy}
              className={`flex-1 min-h-[32px] flex items-center justify-center transition-colors ${
                dessert ? 'text-amber-600 hover:bg-amber-50' : 'text-gray-500 hover:bg-amber-50 hover:text-amber-600'
              }`}
              title={dessert ? 'Nachtisch ändern' : 'Nachtisch dazu'}
              aria-label={`${meal.meal}: ${dessert ? `Nachtisch ändern (${dessert.name})` : 'Nachtisch hinzufügen'}`}
            >
              <CakeSlice size={15} />
            </button>
          )}
          {onMove && (
            <button
              onClick={onMove}
              disabled={busy}
              className="flex-1 min-h-[32px] flex items-center justify-center text-gray-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              title="Verschieben oder Tag leeren"
              aria-label={`${meal.meal}: auf anderen Tag verschieben oder Tag leeren`}
            >
              <CalendarDays size={15} />
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={busy}
              className="flex-1 min-h-[32px] flex items-center justify-center text-gray-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              title="Neu generieren – nur austauschen"
              aria-label={`${meal.meal}: austauschen`}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              disabled={busy}
              className="flex-1 min-h-[32px] flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors"
              title="Ablehnen – kommt nicht wieder"
              aria-label={`${meal.meal}: ablehnen, kommt nicht wieder`}
            >
              <X size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
