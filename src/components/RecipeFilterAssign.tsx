import { useState } from 'react';
import { Check, Filter, Loader2, Plus } from 'lucide-react';
import { RecipeFilter } from '../types';
import { assignRecipeFilter } from '../lib/api';
import { matchesRecipeFilter, toggleAssignment } from '../lib/recipeFilters';

interface RecipeFilterAssignProps {
  /** Filter, die für diesen Bereich gelten (Hauptgerichte bzw. Nachtische) */
  filters: RecipeFilter[];
  recipe: { name: string; ingredients: string[]; durationMin: number | null };
  /** Neue Filterliste nach dem Speichern */
  onChange: (filters: RecipeFilter[]) => void;
}

/** In der Rezept-Ansicht: eigene Filter per Antippen an- und abwählen */
export default function RecipeFilterAssign({ filters, recipe, onChange }: RecipeFilterAssignProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (filters.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <Filter size={12} aria-hidden="true" />
        Eigene Filter (z. B. „Fisch“, „Nudeln“) legst du in den Einstellungen an und kannst sie hier zuordnen.
      </p>
    );
  }

  const toggle = async (f: RecipeFilter) => {
    if (busy) return;
    setBusy(f.id);
    setError(null);
    try {
      onChange(await assignRecipeFilter(f.id, recipe.name, toggleAssignment(f, recipe)));
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <p className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-500">
        <Filter size={12} aria-hidden="true" />
        Filter
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter zuordnen">
        {filters.map((f) => {
          const on = matchesRecipeFilter(f, recipe);
          return (
            <button
              key={f.id}
              aria-pressed={on}
              disabled={!!busy}
              onClick={() => toggle(f)}
              className={`flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
                on ? 'bg-amber-700 text-white' : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
            >
              {busy === f.id ? <Loader2 size={11} className="animate-spin" /> : on ? <Check size={11} /> : <Plus size={11} />}
              {f.name}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
