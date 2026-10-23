import { useState } from 'react';
import { X, Star, Loader2 } from 'lucide-react';
import { useDialog } from '../lib/useDialog';

interface MealRatingModalProps {
  mealName: string;
  currentRating?: number;
  /** Bisheriger Kommentar (zum Bearbeiten) */
  currentNotes?: string;
  /** Darf ein Promise liefern; Fehler werden im Fenster angezeigt */
  onSave: (rating: number, notes: string) => void | Promise<void>;
  onClose: () => void;
}

export default function MealRatingModal({
  mealName,
  currentRating = 0,
  currentNotes = '',
  onSave,
  onClose,
}: MealRatingModalProps) {
  const [rating, setRating] = useState(currentRating);
  const [notes, setNotes] = useState(currentNotes);
  const dialogRef = useDialog(onClose);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (rating === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(rating, notes);
    } catch (e) {
      setError((e as Error).message || 'Die Bewertung konnte nicht gespeichert werden.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mealratingmodal-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 id="mealratingmodal-title" className="text-base font-semibold text-gray-900">Gericht bewerten</h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="tap w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-6 space-y-4">
          <p className="text-sm text-gray-600">
            Wie hat dir <span className="font-semibold text-gray-900">{mealName}</span> gefallen?
          </p>

          {/* Star Rating */}
          <div className="flex justify-center gap-3" role="radiogroup" aria-label="Sterne">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                role="radio"
                aria-checked={star === rating}
                aria-label={`${star} von 5 Sternen`}
                onClick={() => setRating(star)}
                className="transition-transform active:scale-110"
              >
                <Star
                  size={32}
                  className={`transition-all ${
                    star <= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-500'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Rating Labels */}
          <div className="text-center">
            {rating > 0 && (
              <p className="text-sm font-medium text-gray-700">
                {
                  [
                    'Nicht empfehlenswert',
                    'Nicht so gut',
                    'Okay',
                    'Gut',
                    'Ausgezeichnet!',
                  ][rating - 1]
                }
              </p>
            )}
          </div>

          {/* Notes */}
          {rating > 0 && (
            <div>
              <label htmlFor="rating-notes" className="block text-sm font-medium text-gray-700 mb-1.5">
                Anmerkungen (optional)
              </label>
              <textarea
                id="rating-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="z. B. zu scharf, Kinder mochten die Soße nicht"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none resize-none"
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="px-4 pb-3 text-xs text-center text-red-600">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={rating === 0 || saving}
            className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
