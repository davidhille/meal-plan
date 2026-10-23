import { useState } from 'react';
import { Star, Trophy, X } from 'lucide-react';
import { PlanMeal } from '../types';
import { WeekReview } from '../lib/weekReview';
import { formatShortDate } from '../lib/dateUtils';

interface WeekReviewCardProps {
  review: WeekReview;
  /** Gericht öffnen (dort bewerten) */
  onOpen: (pm: PlanMeal) => void;
}

const storageKey = (weekStart: string) => `rueckblick-${weekStart}`;

function isDismissed(weekStart: string) {
  try {
    return localStorage.getItem(storageKey(weekStart)) === '1';
  } catch {
    return false;
  }
}

/** Wochen-Rückblick (So bis Di): gekocht, Lieblingsgericht, noch nicht bewertet */
export default function WeekReviewCard({ review, onOpen }: WeekReviewCardProps) {
  const [hidden, setHidden] = useState(() => isDismissed(review.weekStart));
  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(storageKey(review.weekStart), '1');
    } catch {
      // nur für diese Sitzung ausgeblendet
    }
  };

  const n = review.cooked.length;
  return (
    <section aria-labelledby="rueckblick-titel" className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h2 id="rueckblick-titel" className="text-sm font-bold text-brand-800">
            Wochen-Rückblick
          </h2>
          <p className="text-xs text-gray-500">
            {formatShortDate(review.weekStart)} – {formatShortDate(review.weekEnd)} · {n} {n === 1 ? 'Gericht' : 'Gerichte'} gekocht
            {review.brotzeit ? ` · ${review.brotzeit}× Brotzeit` : ''}
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Rückblick ausblenden"
          className="tap w-8 h-8 -mr-2 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
        >
          <X size={15} />
        </button>
      </div>

      {review.best.length > 0 && (
        <p className="flex items-start gap-2 text-sm text-gray-800">
          <Trophy size={15} className="flex-shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
          <span>
            Am besten kam an: <strong>{review.best.map((b) => b.pm.meal_name).join(', ')}</strong>{' '}
            <span className="whitespace-nowrap text-amber-700">({review.best[0].rating} ★)</span>
          </span>
        </p>
      )}

      {review.unrated.length > 0 ? (
        <div>
          <p className="text-xs text-gray-600">Noch nicht bewertet – antippen und Sterne vergeben:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {review.unrated.slice(0, 6).map((pm) => (
              <button
                key={pm.id}
                onClick={() => onOpen(pm)}
                className="max-w-full flex items-center gap-1 px-2.5 h-8 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                <Star size={12} aria-hidden="true" />
                <span className="truncate">{pm.meal_name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-600">Alles bewertet – danke! Das hilft der Planung.</p>
      )}
    </section>
  );
}
