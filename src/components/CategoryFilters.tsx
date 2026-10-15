import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { DISH_KINDS, MAIN_INGREDIENTS, RecipeCategory, matchesCategory } from '../lib/recipeCategories';

interface CategoryFiltersProps {
  /** Gerichte, die gerade in Frage kommen – nur Filter mit Treffern werden gezeigt */
  recipes: { name: string; ingredients: string[] }[];
  kindId: string | null;
  ingredientId: string | null;
  onKind: (id: string | null) => void;
  onIngredient: (id: string | null) => void;
}

const STORAGE_KEY = 'rezepte-kategorien-offen';

/** „Speiseart“ und „Hauptzutat“ als aufklappbare Chip-Gruppen */
export default function CategoryFilters({ recipes, kindId, ingredientId, onKind, onIngredient }: CategoryFiltersProps) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? '0' : '1');
      } catch {
        // dann nur bis zum Neuladen
      }
      return !v;
    });

  const active = [DISH_KINDS.find((c) => c.id === kindId), MAIN_INGREDIENTS.find((c) => c.id === ingredientId)].filter(
    (c): c is RecipeCategory => !!c
  );

  const group = (title: string, list: RecipeCategory[], selected: string | null, onSelect: (id: string | null) => void) => {
    const withCount = list
      .map((c) => ({ c, n: recipes.filter((r) => matchesCategory(c, r)).length }))
      .filter((x) => x.n > 0 || x.c.id === selected);
    if (withCount.length === 0) return null;
    return (
      <div>
        <h2 className="text-xs font-bold text-gray-700 mb-1.5">{title}</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={title}>
          {withCount.map(({ c, n }) => (
            <button
              key={c.id}
              aria-pressed={selected === c.id}
              onClick={() => onSelect(selected === c.id ? null : c.id)}
              className={`h-8 px-3 rounded-full border text-xs font-semibold transition-colors ${
                selected === c.id ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-brand-200 text-gray-700 hover:bg-brand-50'
              }`}
            >
              {c.label} <span className={selected === c.id ? 'text-brand-100' : 'text-gray-500'}>{n}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-white border border-gray-100">
      <div className="flex items-center gap-2 pr-3">
        <button onClick={toggle} aria-expanded={open} className="flex-1 min-w-0 flex items-center gap-2 pl-3 h-10 text-left">
          <SlidersHorizontal size={14} className="text-gray-500 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0 truncate text-sm font-semibold text-gray-800">
            Speiseart &amp; Hauptzutat
            {active.length > 0 && <span className="font-normal text-brand-800"> · {active.map((c) => c.label).join(' + ')}</span>}
          </span>
          <ChevronDown size={15} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {active.length > 0 && (
          <button
            onClick={() => {
              onKind(null);
              onIngredient(null);
            }}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            Zurücksetzen
          </button>
        )}
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {group('Speiseart', DISH_KINDS, kindId, onKind)}
          {group('Hauptzutat', MAIN_INGREDIENTS, ingredientId, onIngredient)}
        </div>
      )}
    </div>
  );
}
