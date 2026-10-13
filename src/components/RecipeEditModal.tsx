import { useState } from 'react';
import { Loader2, RotateCcw, X } from 'lucide-react';
import { MealType, RecipeDraft } from '../types';
import { useDialog } from '../lib/useDialog';
import ConfirmDialog from './ConfirmDialog';

interface RecipeEditModalProps {
  recipe: RecipeDraft;
  /** Gericht der Grundsammlung, das schon bearbeitet wurde → „Original wiederherstellen“ */
  canReset?: boolean;
  onSave: (draft: RecipeDraft) => Promise<void>;
  onReset?: () => Promise<void>;
  onClose: () => void;
}

const TYPES: { id: MealType; label: string }[] = [
  { id: 'vegetarisch', label: 'Vegetarisch' },
  { id: 'fleisch', label: 'Fleisch & Fisch' },
  { id: 'wochenende', label: 'Wochenende' },
];

const inputClass =
  'mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-300';

/** Gericht bearbeiten: Name, Art, Zeit, Zutaten (eine pro Zeile), Zubereitung (ein Schritt pro Zeile) */
export default function RecipeEditModal({ recipe, canReset, onSave, onReset, onClose }: RecipeEditModalProps) {
  const dialogRef = useDialog(onClose);
  const [name, setName] = useState(recipe.name);
  const [type, setType] = useState<MealType>(recipe.type);
  const [duration, setDuration] = useState(recipe.durationMin ? String(recipe.durationMin) : '');
  const [ingredients, setIngredients] = useState(recipe.ingredients.join('\n'));
  const [instructions, setInstructions] = useState(
    recipe.instructions
      .split(/\n+/)
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean)
      .join('\n')
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const lines = (s: string) =>
    s
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  const valid = name.trim() && lines(ingredients).length > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        type,
        durationMin: Number(duration) > 0 ? Math.round(Number(duration)) : null,
        ingredients: lines(ingredients),
        instructions: lines(instructions).join('\n'),
      });
    } catch (e) {
      setError((e as Error).message || 'Das Gericht konnte nicht gespeichert werden.');
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex justify-center bg-black/40 sm:p-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="recipe-edit-title"
          tabIndex={-1}
          className="outline-none flex flex-col w-full max-w-2xl h-full bg-white sm:rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
            <button
              onClick={onClose}
              aria-label="Abbrechen"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0"
            >
              <X size={16} />
            </button>
            <h2 id="recipe-edit-title" className="flex-1 min-w-0 text-base font-semibold text-gray-900 truncate">
              Gericht bearbeiten
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </label>

            <div>
              <span className="text-xs font-semibold text-gray-500">Art (bestimmt den Tag im Wochenrhythmus)</span>
              <div className="mt-1 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Art">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={type === t.id}
                    onClick={() => setType(t.id)}
                    className={`h-9 rounded-lg text-xs font-semibold border ${
                      type === t.id ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Zubereitungszeit in Minuten</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Zutaten für 4 Portionen – eine pro Zeile</span>
              <textarea
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                rows={Math.min(14, Math.max(6, lines(ingredients).length + 1))}
                placeholder={'400 g Spaghetti\n2 Zwiebeln\nSalz'}
                className={`${inputClass} leading-relaxed`}
              />
              <span className="block mt-1 text-xs text-gray-500">Format „Menge Einheit Zutat“, dann klappt Umrechnen und Einkaufsliste.</span>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Zubereitung – ein Schritt pro Zeile</span>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={Math.min(14, Math.max(6, lines(instructions).length + 1))}
                className={`${inputClass} leading-relaxed`}
              />
            </label>

            <p className="text-xs text-gray-500">
              Änderungen gelten auch für dieses Gericht in den kommenden Tagen des Speiseplans und für den Favoriten.
            </p>

            {canReset && onReset && (
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800"
              >
                <RotateCcw size={13} />
                Original wiederherstellen
              </button>
            )}
          </div>

          <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
            {error && (
              <p role="alert" className="mb-2 text-xs text-center text-red-600">
                {error}
              </p>
            )}
            <button
              onClick={save}
              disabled={!valid || saving}
              className="w-full h-10 rounded-lg text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:bg-gray-200 disabled:text-gray-500 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </div>

      {confirmReset && onReset && (
        <ConfirmDialog
          title="Original wiederherstellen?"
          message="Deine Änderungen an diesem Gericht gehen verloren, es gilt wieder das Rezept aus der Sammlung."
          confirmLabel="Wiederherstellen"
          danger
          onConfirm={onReset}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </>
  );
}
