import { useEffect, useState } from 'react';
import { Filter, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { RecipeFilter } from '../types';
import { deleteRecipeFilter, getRecipeFilters, saveRecipeFilter } from '../lib/api';
import ConfirmDialog from './ConfirmDialog';
import CollapsibleCard from './CollapsibleCard';

const SCOPES: { id: RecipeFilter['scope']; label: string }[] = [
  { id: 'gerichte', label: 'Hauptgerichte' },
  { id: 'nachtische', label: 'Nachtische' },
  { id: 'beide', label: 'Beide' },
];

/** Vorschläge zum schnellen Anlegen */
const SUGGESTIONS: Omit<RecipeFilter, 'id'>[] = [
  { name: 'Schnell', scope: 'beide', keywords: [], maxMinutes: 30 },
  { name: 'Nudeln', scope: 'gerichte', keywords: ['Nudel', 'Pasta', 'Spaghetti', 'Penne', 'Lasagne', 'Tortellini'], maxMinutes: null },
  { name: 'Mit Reis', scope: 'gerichte', keywords: ['Reis', 'Risotto'], maxMinutes: null },
  { name: 'Suppen & Eintöpfe', scope: 'gerichte', keywords: ['Suppe', 'Eintopf'], maxMinutes: null },
  { name: 'Schokolade', scope: 'nachtische', keywords: ['Schoko', 'Kakao'], maxMinutes: null },
];

type Draft = { id?: string; name: string; scope: RecipeFilter['scope']; keywords: string; maxMinutes: string };

const describe = (f: RecipeFilter) =>
  [
    SCOPES.find((s) => s.id === f.scope)?.label,
    f.keywords.length ? `enthält: ${f.keywords.join(', ')}` : null,
    f.maxMinutes ? `bis ${f.maxMinutes} Min` : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** Einstellungen → eigene Filter für die Rezept-Übersicht */
export default function FilterSettings() {
  const [filters, setFilters] = useState<RecipeFilter[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<RecipeFilter | null>(null);

  useEffect(() => {
    getRecipeFilters()
      .then(setFilters)
      .catch((e) => setError((e as Error).message));
  }, []);

  const keywordsOf = (d: Draft) =>
    d.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  const minutesOf = (d: Draft) => (Number(d.maxMinutes) > 0 ? Math.round(Number(d.maxMinutes)) : null);
  const valid = (d: Draft) => !!d.name.trim() && (keywordsOf(d).length > 0 || !!minutesOf(d));

  const save = async () => {
    if (!draft || !valid(draft) || saving) return;
    setSaving(true);
    setError(null);
    try {
      setFilters(
        await saveRecipeFilter({
          id: draft.id,
          name: draft.name.trim(),
          scope: draft.scope,
          keywords: keywordsOf(draft),
          maxMinutes: minutesOf(draft),
        })
      );
      setDraft(null);
    } catch (e) {
      setError((e as Error).message || 'Der Filter konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (f: RecipeFilter | Omit<RecipeFilter, 'id'>) =>
    setDraft({
      id: 'id' in f ? f.id : undefined,
      name: f.name,
      scope: f.scope,
      keywords: f.keywords.join(', '),
      maxMinutes: f.maxMinutes ? String(f.maxMinutes) : '',
    });

  const unusedSuggestions = SUGGESTIONS.filter((s) => !filters?.some((f) => f.name.toLowerCase() === s.name.toLowerCase()));

  return (
    <CollapsibleCard
      storageKey="rezeptfilter"
      title="Filter für die Rezepte"
      icon={<Filter size={16} />}
      summary={filters ? (filters.length ? filters.map((f) => f.name).join(', ') : 'Noch keine eigenen Filter') : undefined}
    >
      <p className="px-4 pb-3 text-xs text-gray-500">
        Eigene Filter erscheinen in der Rezept-Übersicht neben „Vegetarisch“ &amp; Co. Ein Rezept passt, wenn einer der Begriffe im
        Namen oder in den Zutaten vorkommt.
      </p>

      {!filters ? (
        <div className="px-4 pb-4 flex justify-center">
          {error ? <p className="text-xs text-red-600">{error}</p> : <Loader2 size={18} className="animate-spin text-gray-300" />}
        </div>
      ) : (
        filters.length > 0 && (
          <ul className="border-t border-gray-100 divide-y divide-gray-100">
            {filters.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-gray-800 truncate">{f.name}</span>
                  <span className="block text-xs text-gray-500 truncate">{describe(f)}</span>
                </span>
                <button
                  onClick={() => edit(f)}
                  aria-label={`Filter ${f.name} bearbeiten`}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setToDelete(f)}
                  aria-label={`Filter ${f.name} löschen`}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {draft ? (
        <div className="px-4 py-3 border-t border-gray-100 space-y-3 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">{draft.id ? 'Filter bearbeiten' : 'Neuer Filter'}</span>
            <button
              onClick={() => setDraft(null)}
              aria-label="Abbrechen"
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-200"
            >
              <X size={14} />
            </button>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Name</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="z. B. Kinderliebling"
              autoFocus
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </label>
          <div>
            <span className="text-xs font-semibold text-gray-500">Gilt für</span>
            <div className="mt-1 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Gilt für">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={draft.scope === s.id}
                  onClick={() => setDraft({ ...draft, scope: s.id })}
                  className={`h-9 rounded-lg text-xs font-semibold border ${
                    draft.scope === s.id ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Suchbegriffe (mit Komma getrennt)</span>
            <input
              type="text"
              value={draft.keywords}
              onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
              placeholder="z. B. Nudel, Pasta, Spaghetti"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Höchstens … Minuten (optional)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={draft.maxMinutes}
              onChange={(e) => setDraft({ ...draft, maxMinutes: e.target.value })}
              placeholder="z. B. 30"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
            />
          </label>
          {!valid(draft) && draft.name.trim() && (
            <p className="text-xs text-gray-500">Bitte Suchbegriffe oder eine Zeit angeben.</p>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
          <button
            onClick={save}
            disabled={!valid(draft) || saving}
            className="w-full h-10 rounded-lg text-sm font-semibold bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-200 disabled:text-gray-500 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {draft.id ? 'Speichern' : 'Filter anlegen'}
          </button>
        </div>
      ) : (
        filters && (
          <div className="px-4 py-3 border-t border-gray-100 space-y-2">
            {unusedSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Vorschläge">
                {unusedSuggestions.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => edit(s)}
                    className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <Plus size={12} />
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setDraft({ name: '', scope: 'gerichte', keywords: '', maxMinutes: '' })}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-600 hover:border-gray-300"
            >
              <Plus size={15} />
              Eigenen Filter anlegen
            </button>
          </div>
        )
      )}

      {toDelete && (
        <ConfirmDialog
          title="Filter löschen?"
          message={
            <>
              Der Filter <strong>{toDelete.name}</strong> verschwindet aus der Rezept-Übersicht. Die Rezepte selbst bleiben erhalten.
            </>
          }
          confirmLabel="Löschen"
          danger
          onConfirm={async () => setFilters(await deleteRecipeFilter(toDelete.id))}
          onClose={() => setToDelete(null)}
        />
      )}
    </CollapsibleCard>
  );
}
