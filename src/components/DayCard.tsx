import { Meal, MealType } from '../types';
import { ChevronRight, Leaf, Beef, Sunset, Star, X, Heart, RefreshCw, Clock, Loader2 } from 'lucide-react';

interface DayCardProps {
  meal: Meal;
  rating?: number;
  onClick: () => void;
  onReject?: () => void;
  onRegenerate?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  busy?: boolean;
}

const typeConfig: Record<MealType, { bar: string; label: string; icon: React.ReactNode }> = {
  vegetarisch: {
    bar: 'bg-green-500',
    label: 'Vegetarisch',
    icon: <Leaf size={11} className="text-green-600" />,
  },
  fleisch: {
    bar: 'bg-orange-400',
    label: 'Fleisch',
    icon: <Beef size={11} className="text-orange-500" />,
  },
  wochenende: {
    bar: 'bg-blue-500',
    label: 'Wochenende',
    icon: <Sunset size={11} className="text-blue-500" />,
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
}: DayCardProps) {
  const config = typeConfig[meal.type];
  const hasActions = !!(onReject || onRegenerate || onToggleFavorite);

  return (
    <div className={`flex gap-2 items-stretch transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform duration-100 flex"
      >
        <div className={`w-1 flex-shrink-0 ${config.bar}`} />
        <div className="flex items-center gap-3 px-4 py-4 flex-1 min-w-0">
          {meal.imageUrl ? (
            <img
              src={meal.imageUrl}
              alt={meal.meal}
              loading="lazy"
              className="flex-shrink-0 w-14 h-14 rounded-lg object-cover border border-gray-100"
            />
          ) : (
            <div className="flex-shrink-0 w-14 h-14 bg-gray-50 rounded-lg flex flex-col items-center justify-center border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 leading-tight">{meal.dayShort}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{meal.day}</p>
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{meal.meal}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-1">
                {config.icon}
                <span className="text-xs text-gray-400">{config.label}</span>
              </span>
              {meal.durationMin ? (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={11} />
                  {meal.durationMin} Min
                </span>
              ) : null}
              {isFavorite && <Heart size={11} className="fill-rose-500 text-rose-500" />}
              {rating ? (
                <span className="ml-auto text-xs text-yellow-500 font-medium flex items-center gap-0.5">
                  <Star size={11} className="fill-yellow-400" />
                  {rating}
                </span>
              ) : null}
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
        </div>
      </button>

      {hasActions && (
        <div className="w-10 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              disabled={busy}
              className={`flex-1 flex items-center justify-center transition-colors ${
                isFavorite ? 'text-rose-500 hover:bg-rose-50' : 'text-gray-400 hover:bg-gray-50 hover:text-rose-500'
              }`}
              title={isFavorite ? 'Aus Favoriten entfernen' : 'Merken'}
              aria-label={isFavorite ? 'Aus Favoriten entfernen' : 'Merken'}
            >
              <Heart size={15} className={isFavorite ? 'fill-rose-500' : ''} />
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={busy}
              className="flex-1 flex items-center justify-center text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors"
              title="Neu generieren – nur austauschen"
              aria-label="Neu generieren"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              disabled={busy}
              className="flex-1 flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
              title="Ablehnen – kommt nicht wieder"
              aria-label="Ablehnen"
            >
              <X size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
