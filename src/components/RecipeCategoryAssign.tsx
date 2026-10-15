import { useState } from 'react';
import { Check, Loader2, Plus, Tags } from 'lucide-react';
import {
  CategoryOverride,
  CategoryOverrides,
  DISH_KINDS,
  MAIN_INGREDIENTS,
  RecipeCategory,
  inCategory,
  toggleCategory,
} from '../lib/recipeCategories';
import { setCategoryOverride } from '../lib/api';

interface RecipeCategoryAssignProps {
  recipe: { name: string; ingredients: string[] };
  overrides: CategoryOverrides;
  onChange: (list: CategoryOverride[]) => void;
}

/** In der Rezept-Ansicht: Speiseart und Hauptzutat ansehen und bei Bedarf korrigieren */
export default function RecipeCategoryAssign({ recipe, overrides, onChange }: RecipeCategoryAssignProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = [...DISH_KINDS, ...MAIN_INGREDIENTS].filter((c) => inCategory(c, recipe, overrides));

  const toggle = async (c: RecipeCategory) => {
    if (busy) return;
    setBusy(c.id);
    setError(null);
    try {
      onChange(await setCategoryOverride(recipe.name, c.id, toggleCategory(c, recipe, overrides)));
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(null);
    }
  };

  const chips = (title: string, list: RecipeCategory[]) => (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-gray-500">{title}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={title}>
        {list.map((c) => {
          const on = inCategory(c, recipe, overrides);
          return (
            <button
              key={c.id}
              aria-pressed={on}
              disabled={!!busy}
              onClick={() => toggle(c)}
              className={`flex items-center gap-1 px-3 h-8 rounded-full text-xs font-semibold transition-colors ${
                on ? 'bg-brand-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-brand-50'
              }`}
            >
              {busy === c.id ? <Loader2 size={11} className="animate-spin" /> : on ? <Check size={11} /> : <Plus size={11} />}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Tags size={12} className="text-gray-500" aria-hidden="true" />
        <p className="flex-1 text-xs font-semibold text-gray-500">Kategorien</p>
        <button
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          {editing ? 'Fertig' : 'Korrigieren'}
        </button>
      </div>
      {editing ? (
        <div className="space-y-2">
          {chips('Speiseart', DISH_KINDS)}
          {chips('Hauptzutat', MAIN_INGREDIENTS)}
        </div>
      ) : active.length > 0 ? (
        <p className="flex flex-wrap gap-1.5">
          {active.map((c) => (
            <span key={c.id} className="px-2.5 h-7 flex items-center rounded-full bg-brand-50 text-xs font-medium text-brand-800">
              {c.label}
            </span>
          ))}
        </p>
      ) : (
        <p className="text-xs text-gray-500">Keine erkannt – über „Korrigieren“ zuordnen.</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
