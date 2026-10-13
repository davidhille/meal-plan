import { useState } from 'react';
import { X, Link2, Loader2, Check, ExternalLink } from 'lucide-react';
import { Favorite, MealType } from '../types';
import { ImportedRecipe, previewRecipeImport, saveImportedRecipe } from '../lib/api';
import { useDialog } from '../lib/useDialog';

interface RecipeImportModalProps {
  onSaved: (favorites: Favorite[], name: string) => void;
  onClose: () => void;
}

const TYPES: { id: MealType; label: string }[] = [
  { id: 'vegetarisch', label: 'Vegetarisch' },
  { id: 'fleisch', label: 'Fleisch/Fisch' },
  { id: 'wochenende', label: 'Wochenende' },
];

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none';

/** Rezept per Link (Chefkoch & Co.) holen, prüfen und in den Rezept-Pool übernehmen */
export default function RecipeImportModal({ onSaved, onClose }: RecipeImportModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<ImportedRecipe | null>(null);
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [favorite, setFavorite] = useState(true);
  const dialogRef = useDialog(() => !saving && onClose());

  const load = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await previewRecipeImport(url.trim());
      setRecipe(r);
      setIngredientsText(r.ingredients.join('\n'));
      setStepsText(r.instructions);
    } catch (e) {
      setRecipe(null);
      setError((e as Error).message || 'Das Rezept konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!recipe) return;
    const ingredients = ingredientsText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!recipe.name.trim() || ingredients.length === 0) {
      setError('Name und mindestens eine Zutat sind nötig.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const favorites = await saveImportedRecipe(
        {
          name: recipe.name.trim(),
          type: recipe.type,
          ingredients,
          instructions: stepsText.trim(),
          durationMin: recipe.durationMin ?? null,
          sourceUrl: recipe.sourceUrl,
        },
        favorite
      );
      onSaved(favorites, recipe.name.trim());
    } catch (e) {
      setError((e as Error).message || 'Speichern hat nicht geklappt.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 id="import-dialog-title" className="text-base font-semibold text-gray-900">
            Rezept importieren
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <label htmlFor="import-url" className="block text-sm font-medium text-gray-700 mb-1.5">
              Link zum Rezept
            </label>
            <div className="flex gap-2">
              <input
                id="import-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.chefkoch.de/rezepte/…"
                autoFocus
                className={inputClass}
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="flex-shrink-0 h-10 px-4 flex items-center gap-1.5 rounded-lg text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Laden
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Funktioniert mit Chefkoch und den meisten Rezeptseiten. Mengen werden auf 4 Portionen umgerechnet.
            </p>
          </form>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {recipe && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              <div>
                <label htmlFor="import-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name
                </label>
                <input
                  id="import-name"
                  value={recipe.name}
                  onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <p id="import-type" className="text-sm font-medium text-gray-700 mb-2">
                  Art
                </p>
                <div className="flex gap-2" role="group" aria-labelledby="import-type">
                  {TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={recipe.type === t.id}
                      onClick={() => setRecipe({ ...recipe, type: t.id })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        recipe.type === t.id ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="import-duration" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Dauer (Minuten)
                </label>
                <input
                  id="import-duration"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  value={recipe.durationMin ?? ''}
                  onChange={(e) => setRecipe({ ...recipe, durationMin: e.target.value ? Number(e.target.value) : null })}
                  className={`${inputClass} max-w-[8rem]`}
                />
              </div>

              <div>
                <label htmlFor="import-ingredients" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Zutaten für 4 Portionen
                </label>
                <textarea
                  id="import-ingredients"
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                  rows={Math.min(12, Math.max(4, ingredientsText.split('\n').length))}
                  aria-describedby="import-ingredients-hint"
                  className={`${inputClass} resize-y`}
                />
                <p id="import-ingredients-hint" className="mt-1 text-xs text-gray-500">
                  Eine Zutat pro Zeile, Menge vorne.
                  {recipe.sourcePortions && recipe.sourcePortions !== 4
                    ? ` Umgerechnet vom Original für ${recipe.sourcePortions} Portionen.`
                    : ''}
                </p>
              </div>

              <div>
                <label htmlFor="import-steps" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Zubereitung
                </label>
                <textarea
                  id="import-steps"
                  value={stepsText}
                  onChange={(e) => setStepsText(e.target.value)}
                  rows={6}
                  aria-describedby="import-steps-hint"
                  className={`${inputClass} resize-y`}
                />
                <p id="import-steps-hint" className="mt-1 text-xs text-gray-500">
                  Ein Schritt pro Zeile.
                </p>
              </div>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-brand-700"
                />
                <span className="text-sm text-gray-700">
                  Als Favorit merken
                  <span className="block text-xs text-gray-500">
                    Wird bei der Planung bevorzugt. Ohne Häkchen kommt es nur in den allgemeinen Rezept-Pool.
                  </span>
                </span>
              </label>

              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <ExternalLink size={12} aria-hidden="true" />
                Original ansehen
              </a>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={!recipe || saving}
            className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {saving ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
