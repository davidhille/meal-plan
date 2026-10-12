import { Meal, MealType } from '../types';
import { Heart, X, RefreshCw, Clock, Star, Leaf, Beef, Sunset, Loader2 } from 'lucide-react';

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

const typeConfig: Record<MealType, { label: string; Icon: typeof Leaf; tone: string }> = {
  vegetarisch: { label: 'Vegetarisch', Icon: Leaf, tone: 'text-green-600 bg-green-50' },
  fleisch: { label: 'Fleisch & Fisch', Icon: Beef, tone: 'text-orange-700 bg-orange-50' },
  wochenende: { label: 'Wochenende', Icon: Sunset, tone: 'text-amber-800 bg-sand' },
};

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
  const isWeekend = meal.type === 'wochenende';

  return (
    <article
      className={`bg-white rounded-2xl border border-gray-200/70 shadow-card overflow-hidden transition-opacity ${
        busy ? 'opacity-60' : ''
      }`}
    >
      <button onClick={onClick} className="w-full text-left flex gap-3 p-4 active:bg-gray-50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{meal.day}</span>
            {isWeekend && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sand text-amber-800">
                Mehr Zeit ⏱
              </span>
            )}
          </div>
          <h3 className="text-[17px] leading-snug font-semibold text-gray-800">{meal.meal}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
            {meal.durationMin ? (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {meal.durationMin} Min
              </span>
            ) : null}
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${config.tone}`}>
              <config.Icon size={11} />
              {config.label}
            </span>
            {rating ? (
              <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                <Star size={12} className="fill-amber-400 text-amber-400" />
                {rating}
              </span>
            ) : null}
          </div>
        </div>
        {meal.imageUrl ? (
          <img
            src={meal.imageUrl}
            alt=""
            loading="lazy"
            className="flex-shrink-0 w-20 h-20 rounded-xl object-cover bg-gray-100"
          />
        ) : (
          <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
            <span className="font-display text-lg font-semibold text-gray-300">{meal.dayShort}</span>
          </div>
        )}
      </button>

      {(onToggleFavorite || onReject || onRegenerate) && (
        <div className="flex items-center gap-2 px-4 pb-4">
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              disabled={busy}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-semibold transition-colors ${
                isFavorite ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Heart size={14} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
              {isFavorite ? 'Gemerkt' : 'Merken'}
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              disabled={busy}
              title="Ablehnen – kommt nicht wieder"
              aria-label="Ablehnen"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={busy}
              title="Neu generieren – nur austauschen"
              aria-label="Neu generieren"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600 transition-colors"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
