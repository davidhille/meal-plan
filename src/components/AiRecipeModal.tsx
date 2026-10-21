import { useState } from 'react';
import { BatteryLow, ChefHat, Clock, Heart, Loader2, Pencil, RefreshCw, Sparkles, X } from 'lucide-react';
import { MealType, RecipeCatalog, RecipeDraft } from '../types';
import { isQuotaError, previewAiRecipe, saveAiRecipe } from '../lib/api';
import { toSteps } from '../lib/cooking';
import { useDialog } from '../lib/useDialog';
import RecipeEditModal from './RecipeEditModal';

interface AiRecipeModalProps {
  /** Gespeichert: Name des neuen Rezepts und die neue Übersicht */
  onSaved: (result: { name: string; catalog: RecipeCatalog }, favorite: boolean) => void;
  onClose: () => void;
  /** KI-Kontingent aufgebraucht: stattdessen bei Chefkoch suchen (mit dem Wunsch als Suchbegriff) */
  onChefkoch?: (wish: string) => void;
}

const TYPES: { id: MealType | null; label: string }[] = [
  { id: null, label: 'Egal' },
  { id: 'vegetarisch', label: 'Vegetarisch' },
  { id: 'fleisch', label: 'Fleisch & Fisch' },
  { id: 'wochenende', label: 'Wochenende' },
];

const TYPE_LABEL: Record<MealType, string> = { vegetarisch: 'Vegetarisch', fleisch: 'Fleisch & Fisch', wochenende: 'Wochenende' };

const IDEAS = ['etwas mit Kürbis', 'schnell & kindgerecht', 'Ofengericht ohne viel Abwasch', 'Suppe zum Aufwärmen', 'Resteessen mit Reis'];

/** Rezept bei der KI bestellen: Wunsch eingeben → Vorschau → nochmal / anpassen / speichern */
export default function AiRecipeModal({ onSaved, onClose, onChefkoch }: AiRecipeModalProps) {
  const dialogRef = useDialog(onClose);
  const [wish, setWish] = useState('');
  const [type, setType] = useState<MealType | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [busy, setBusy] = useState<'create' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Hinweis, wenn das KI-Kontingent aufgebraucht ist */
  const [quota, setQuota] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [editing, setEditing] = useState(false);

  const create = async () => {
    if (wish.trim().length < 3 || busy) return;
    setBusy('create');
    setError(null);
    setQuota(null);
    try {
      setDraft(await previewAiRecipe(wish.trim(), type));
    } catch (e) {
      if (isQuotaError(e)) setQuota((e as Error).message);
      else setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!draft || busy) return;
    setBusy('save');
    setError(null);
    try {
      onSaved(await saveAiRecipe(draft, favorite), favorite);
    } catch (e) {
      setError((e as Error).message || 'Das Rezept konnte nicht gespeichert werden.');
      setBusy(null);
    }
  };

  const steps = draft ? toSteps(draft.instructions) : [];

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:p-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-recipe-title"
          tabIndex={-1}
          className="outline-none flex flex-col w-full max-w-2xl h-full bg-white sm:rounded-2xl overflow-hidden shadow-xl"
        >
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
            <button
              onClick={onClose}
              aria-label="Schließen"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0"
            >
              <X size={16} />
            </button>
            <h2 id="ai-recipe-title" className="flex-1 min-w-0 flex items-center gap-2 text-base font-semibold text-gray-900">
              <Sparkles size={16} className="text-brand-600" aria-hidden="true" />
              Rezept mit KI erstellen
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500">Was hättet ihr gern?</span>
              <textarea
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="z. B. etwas mit Kürbis, schnell, für Kinder"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </label>
            {!wish && (
              <div className="flex flex-wrap gap-1.5" aria-label="Ideen">
                {IDEAS.map((idea) => (
                  <button
                    key={idea}
                    onClick={() => setWish(idea)}
                    className="px-2.5 h-8 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            )}
            <div>
              <span className="text-xs font-semibold text-gray-500">Art</span>
              <div className="mt-1 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Art">
                {TYPES.map((t) => (
                  <button
                    key={t.label}
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
            <p className="text-xs text-gray-500">
              Die KI beachtet eure Gesundheitseinstellungen und Abneigungen; das Ergebnis wird zusätzlich geprüft. Mengen für 4 Portionen.
            </p>

            {busy === 'create' && (
              <div className="py-8 flex flex-col items-center gap-2 text-sm text-gray-500" role="status">
                <Loader2 size={22} className="animate-spin text-brand-600" />
                Die KI denkt sich etwas aus … (dauert etwa 10–20 Sekunden)
              </div>
            )}

            {draft && busy !== 'create' && (
              <article className="rounded-xl border border-brand-200 bg-brand-50/40 overflow-hidden">
                <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 leading-snug">{draft.name}</h3>
                    <p className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>{TYPE_LABEL[draft.type]}</span>
                      {draft.durationMin ? (
                        <span className="flex items-center gap-1">
                          <Clock size={12} aria-hidden="true" />
                          {draft.durationMin} Min
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    aria-label="Vorschau anpassen"
                    title="Anpassen"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 flex-shrink-0"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <div className="px-4 pb-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zutaten</h4>
                  <ul className="mt-1 text-sm text-gray-700 list-disc pl-5 space-y-0.5">
                    {draft.ingredients.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                  <h4 className="mt-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Zubereitung</h4>
                  <ol className="mt-1 text-sm text-gray-700 list-decimal pl-5 space-y-1">
                    {steps.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ol>
                </div>
              </article>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            {quota && (
              <div role="alert" className="rounded-xl border border-coral-300 bg-coral-50 p-3 space-y-2">
                <p className="flex items-start gap-2 text-sm text-coral-700">
                  <BatteryLow size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>KI-Kontingent aufgebraucht.</strong> {quota} Es läuft um 2 Uhr nachts (Winterzeit 1 Uhr) neu an.
                  </span>
                </p>
                {onChefkoch && (
                  <button
                    onClick={() => onChefkoch(wish.trim())}
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-white border border-coral-300 text-sm font-semibold text-coral-700 hover:bg-coral-100"
                  >
                    <ChefHat size={15} aria-hidden="true" />
                    Stattdessen bei Chefkoch suchen
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="px-4 py-4 border-t border-gray-100 bg-gray-50 space-y-2">
            {draft ? (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} className="accent-brand-700" />
                  <Heart size={14} className="text-rose-500" aria-hidden="true" />
                  Auch als Favorit merken (wird öfter geplant)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={create}
                    disabled={!!busy}
                    className="h-11 flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {busy === 'create' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Anderer Vorschlag
                  </button>
                  <button
                    onClick={save}
                    disabled={!!busy}
                    className="h-11 flex items-center justify-center gap-1.5 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 disabled:bg-brand-300"
                  >
                    {busy === 'save' && <Loader2 size={14} className="animate-spin" />}
                    In die Sammlung
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={create}
                disabled={wish.trim().length < 3 || !!busy}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 disabled:bg-gray-200 disabled:text-gray-500"
              >
                {busy === 'create' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Rezept erstellen
              </button>
            )}
          </div>
        </div>
      </div>

      {editing && draft && (
        <RecipeEditModal
          recipe={draft}
          note="Gespeichert wird erst mit „In die Sammlung“."
          onSave={async (d) => {
            setDraft(d);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
