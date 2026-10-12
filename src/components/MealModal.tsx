import { useEffect, useState } from 'react';
import { X, Clock, Star, ImageIcon, Loader2, Minus, Plus, Users, RefreshCw } from 'lucide-react';
import { Meal } from '../types';
import { RECIPE_BASE_PORTIONS, scaleIngredient, formatPortions } from '../lib/portions';

interface MealModalProps {
  meal: Meal;
  currentRating?: number;
  onRate?: (rating: number, notes: string) => Promise<void>;
  onGenerateImage?: (mealName: string) => Promise<string | null>;
  /** Portionen der Familie (Standard für die Mengenanzeige) */
  defaultPortions?: number;
  onClose: () => void;
}

/** Zubereitung in Schritte zerlegen: Zeilen (KI-Rezepte) oder Sätze (ältere Rezepte) */
function toSteps(instructions: string): string[] {
  const lines = instructions
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return instructions
    .split(/(?<=[.!])\s+(?=[A-ZÄÖÜ])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function MealModal({
  meal,
  currentRating = 0,
  onRate,
  onGenerateImage,
  defaultPortions = RECIPE_BASE_PORTIONS,
  onClose,
}: MealModalProps) {
  const [portions, setPortions] = useState(defaultPortions);
  const [rating, setRating] = useState(currentRating);
  const [savingRating, setSavingRating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState(meal.imageUrl);
  const factor = portions / RECIPE_BASE_PORTIONS;
  const steps = toSteps(meal.instructions || '');

  // Hintergrund nicht mitscrollen; Escape schließt
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleGenerateImage = async () => {
    if (!onGenerateImage || generating) return;
    setGenerating(true);
    try {
      const url = await onGenerateImage(meal.meal);
      if (url) setImageUrl(url);
    } finally {
      setGenerating(false);
    }
  };

  const handleRate = async (value: number) => {
    if (!onRate || savingRating) return;
    setRating(value);
    setSavingRating(true);
    try {
      await onRate(value, '');
    } finally {
      setSavingRating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={meal.meal}
        className="relative w-full sm:max-w-lg max-h-[92vh] bg-cream rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Kopf */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 bg-cream">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{meal.day}</p>
            <h2 className="text-xl leading-snug font-bold text-gray-800 mt-0.5">{meal.meal}</h2>
            {meal.durationMin ? (
              <p className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                <Clock size={12} /> {meal.durationMin} Min
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
          {/* Bild */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-100">
            {imageUrl ? (
              <img src={imageUrl} alt={meal.meal} className="w-full aspect-[16/10] object-cover" />
            ) : (
              <div className="h-32 flex flex-col items-center justify-center gap-2">
                <ImageIcon size={24} className="text-gray-300" />
                {onGenerateImage && (
                  <button
                    onClick={handleGenerateImage}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-4 h-8 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    {generating ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                    {generating ? 'Bild wird erstellt …' : 'Bild generieren'}
                  </button>
                )}
              </div>
            )}
            {imageUrl && onGenerateImage && (
              <button
                onClick={handleGenerateImage}
                disabled={generating}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold bg-gray-900/60 text-white backdrop-blur-sm"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {generating ? 'Neues Bild …' : 'Neues Bild'}
              </button>
            )}
          </div>

          {/* Bewertung */}
          {onRate && (
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 mb-2">Bewertung</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => handleRate(v)}
                    aria-label={`${v} von 5 Sternen`}
                    className="p-0.5 active:scale-90 transition-transform"
                  >
                    <Star
                      size={26}
                      strokeWidth={1.6}
                      className={v <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Zutaten */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Zutaten</h3>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-1.5 py-1">
                <Users size={13} className="text-gray-400 ml-1.5" />
                <button
                  onClick={() => setPortions((p) => Math.max(0.5, p - 0.5))}
                  aria-label="Weniger Portionen"
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95"
                >
                  <Minus size={13} />
                </button>
                <span className="min-w-[2.5rem] text-center text-xs font-semibold text-gray-800">
                  {formatPortions(portions)} Port.
                </span>
                <button
                  onClick={() => setPortions((p) => Math.min(20, p + 0.5))}
                  aria-label="Mehr Portionen"
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-95"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {meal.ingredients.map((ingredient, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200/70 text-sm text-gray-700"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  {scaleIngredient(ingredient, factor)}
                </li>
              ))}
            </ul>
            {factor !== 1 && (
              <p className="mt-2 text-xs text-gray-400">
                Mengen umgerechnet vom Originalrezept für {RECIPE_BASE_PORTIONS} Portionen.
              </p>
            )}
          </section>

          {/* Zubereitung */}
          {steps.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Zubereitung</h3>
              {meal.type === 'wochenende' && (
                <p className="mb-3 px-4 py-2.5 rounded-xl bg-sand text-xs font-semibold text-amber-800">
                  ⏱ Wochenende: Mehr Zeit einplanen
                </p>
              )}
              <ol className="space-y-4">
                {steps.map((step, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="w-7 h-7 flex-shrink-0 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <p className="text-sm text-gray-700 leading-relaxed pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
