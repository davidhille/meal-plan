import { useState } from 'react';
import { X, Star } from 'lucide-react';

interface MealRatingModalProps {
  mealName: string;
  currentRating?: number;
  onSave: (rating: number, notes: string) => void;
  onClose: () => void;
}

export default function MealRatingModal({
  mealName,
  currentRating = 0,
  onSave,
  onClose,
}: MealRatingModalProps) {
  const [rating, setRating] = useState(currentRating);
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (rating > 0) {
      onSave(rating, notes);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Gericht bewerten</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
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
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="transition-transform active:scale-110"
              >
                <Star
                  size={32}
                  className={`transition-all ${
                    star <= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Anmerkungen (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="z.B. Zu würzig, Zu salzarm, etc."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={rating === 0}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
