import { useState } from 'react';
import { X, Clock, ShoppingBasket, BookOpen, Star, ImageIcon, Loader2, Minus, Plus, Users } from 'lucide-react';
import { Meal } from '../types';
import MealRatingModal from './MealRatingModal';
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

type ModalTab = 'zutaten' | 'zubereitung';

export default function MealModal({
  meal,
  currentRating = 0,
  onRate,
  onGenerateImage,
  defaultPortions = RECIPE_BASE_PORTIONS,
  onClose,
}: MealModalProps) {
  const [portions, setPortions] = useState(defaultPortions);
  const factor = portions / RECIPE_BASE_PORTIONS;
  const [activeTab, setActiveTab] = useState<ModalTab>('zutaten');
  const [showRating, setShowRating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState(meal.imageUrl);
  const isWeekend = meal.type === 'wochenende';

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

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        {/* Modal Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 bg-white">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{meal.day}</p>
            <h2 className="text-base font-semibold text-gray-900 leading-tight truncate">{meal.meal}</h2>
          </div>
          {currentRating > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < currentRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hero Image */}
        <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={meal.meal}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-50 to-gray-100">
              <ImageIcon size={32} className="text-gray-300" />
              <p className="text-xs text-gray-400">Kein Bild vorhanden</p>
              {onGenerateImage && (
                <button
                  onClick={handleGenerateImage}
                  disabled={generating}
                  className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300 transition-all active:scale-95"
                >
                  {generating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Bild wird erstellt...
                    </>
                  ) : (
                    <>
                      <ImageIcon size={14} />
                      Bild generieren
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          {imageUrl && onGenerateImage && (
            <button
              onClick={handleGenerateImage}
              disabled={generating}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-black/60 text-white hover:bg-black/70 backdrop-blur-sm transition-all active:scale-95"
            >
              {generating ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Neu...
                </>
              ) : (
                <>
                  <ImageIcon size={12} />
                  Neues Bild
                </>
              )}
            </button>
          )}
        </div>

        {/* Weekend Badge */}
        {isWeekend && (
          <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Clock size={18} className="text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-700">Wochenende: Mehr Zeit einplanen</p>
              <p className="text-xs text-blue-500 mt-0.5">Dieses Gericht braucht etwas mehr Vorbereitung</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex px-4 mt-4 border-b border-gray-100 bg-white">
          <button
            onClick={() => setActiveTab('zutaten')}
            className={`flex items-center gap-1.5 py-3 mr-6 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'zutaten'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-400'
            }`}
          >
            <ShoppingBasket size={14} />
            Zutaten
          </button>
          <button
            onClick={() => setActiveTab('zubereitung')}
            className={`flex items-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'zubereitung'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-400'
            }`}
          >
            <BookOpen size={14} />
            Zubereitung
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === 'zutaten' ? (
            <>
            <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-gray-50">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <Users size={14} className="text-gray-400" />
                Portionen
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPortions((p) => Math.max(0.5, p - 0.5))}
                  aria-label="Weniger Portionen"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 active:scale-95"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-semibold text-gray-900">{formatPortions(portions)}</span>
                <button
                  onClick={() => setPortions((p) => Math.min(20, p + 0.5))}
                  aria-label="Mehr Portionen"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 active:scale-95"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {meal.ingredients.map((ingredient, idx) => (
                <li key={idx} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-gray-700">{scaleIngredient(ingredient, factor)}</span>
                </li>
              ))}
            </ul>
            {factor !== 1 && (
              <p className="mt-3 text-xs text-gray-400">
                Mengen umgerechnet vom Originalrezept für {RECIPE_BASE_PORTIONS} Portionen.
              </p>
            )}
            </>
          ) : (
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{meal.instructions}</p>
            </div>
          )}
        </div>

        {/* Rating Button */}
        {onRate && (
          <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setShowRating(true)}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Star size={14} />
              Gericht bewerten
            </button>
          </div>
        )}
      </div>

      {showRating && onRate && (
        <MealRatingModal
          mealName={meal.meal}
          currentRating={currentRating}
          onSave={async (rating, notes) => {
            await onRate(rating, notes);
            setShowRating(false);
          }}
          onClose={() => setShowRating(false)}
        />
      )}
    </>
  );
}
