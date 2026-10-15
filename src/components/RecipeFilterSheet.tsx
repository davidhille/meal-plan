import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { CatalogRecipe, RecipeFilter } from '../types';
import { DISH_KINDS, MAIN_INGREDIENTS, inCategory } from '../lib/recipeCategories';
import { matchesRecipeFilter } from '../lib/recipeFilters';
import {
  EMPTY_SELECTION,
  FacetContext,
  FacetGroup,
  FacetSelection,
  TYPE_OPTIONS,
  optionCount,
  selectionSize,
  toggleOption,
} from '../lib/recipeFacets';

interface RecipeFilterSheetProps {
  /** Gerichte nach Suche und Gesundheits-Einstellung – darauf beziehen sich die Zahlen */
  recipes: CatalogRecipe[];
  selection: FacetSelection;
  onChange: (sel: FacetSelection) => void;
  /** Gerichte mit der aktuellen Auswahl */
  resultCount: number;
  customFilters: RecipeFilter[];
  overrides: FacetContext['overrides'];
  onClose: () => void;
}

/** Alle Filter der Rezept-Übersicht in einem Fenster: Art, Speiseart, Hauptzutat, eigene Filter */
export default function RecipeFilterSheet({
  recipes,
  selection,
  onChange,
  resultCount,
  customFilters,
  overrides,
  onClose,
}: RecipeFilterSheetProps) {
  const dialogRef = useDialog(onClose);
  const ctx: FacetContext = { customFilters, overrides };

  // Möglichkeiten ohne ein einziges passendes Gericht gar nicht erst zeigen
  const present = useMemo(() => {
    const has = (test: (r: CatalogRecipe) => boolean) => recipes.some(test);
    return {
      kinds: new Set(DISH_KINDS.filter((c) => has((r) => inCategory(c, r, overrides))).map((c) => c.id)),
      ingredients: new Set(MAIN_INGREDIENTS.filter((c) => has((r) => inCategory(c, r, overrides))).map((c) => c.id)),
      custom: new Set(customFilters.filter((f) => has((r) => matchesRecipeFilter(f, r))).map((f) => f.id)),
    };
  }, [recipes, overrides, customFilters]);

  const group = (key: FacetGroup, title: string, options: { id: string; label: string }[], hint?: string) => {
    const shown = options.filter(
      (o) => key === 'types' || present[key as Exclude<FacetGroup, 'types'>].has(o.id) || selection[key].includes(o.id)
    );
    if (shown.length === 0 && !hint) return null;
    return (
      <section>
        <h3 className="text-sm font-bold text-gray-800 mb-2">{title}</h3>
        {hint && shown.length === 0 && <p className="text-xs text-gray-500">{hint}</p>}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={title}>
          {shown.map((o) => {
            const on = selection[key].includes(o.id);
            const n = optionCount(recipes, key, o.id, selection, ctx);
            return (
              <button
                key={o.id}
                aria-pressed={on}
                disabled={!on && n === 0}
                onClick={() => onChange(toggleOption(selection, key, o.id))}
                className={`h-9 px-3 flex items-center gap-1 rounded-full border text-sm font-medium transition-colors disabled:opacity-40 ${
                  on
                    ? 'bg-brand-700 border-brand-700 text-white'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-brand-50 hover:border-brand-200'
                }`}
              >
                {on && <Check size={13} aria-hidden="true" />}
                {o.label}
                <span className={`text-xs ${on ? 'text-brand-100' : 'text-gray-500'}`}>{n}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const count = selectionSize(selection);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-filter-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="outline-none bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <h2 id="recipe-filter-title" className="flex-1 text-base font-semibold text-gray-900">
            Filter
          </h2>
          {count > 0 && (
            <button onClick={() => onChange(EMPTY_SELECTION)} className="px-2 h-8 text-sm font-semibold text-brand-700 hover:underline">
              Alle löschen
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {group('types', 'Art', TYPE_OPTIONS)}
          {group('kinds', 'Speiseart', DISH_KINDS)}
          {group('ingredients', 'Hauptzutat', MAIN_INGREDIENTS)}
          {group(
            'custom',
            'Meine Filter',
            customFilters.map((f) => ({ id: f.id, label: f.name })),
            'Eigene Filter (z. B. „Schnell“ oder „Lieblingsessen der Kinder“) legst du in den Einstellungen an.'
          )}
          <p className="text-xs text-gray-500">
            In einer Gruppe darfst du mehreres wählen (z. B. Rind oder Schwein). Speiseart und Hauptzutat erkennt die App am Namen und an
            den Zutaten – liegt sie daneben, korrigierst du das im Rezept unter „Kategorien“.
          </p>
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <button onClick={onClose} className="w-full h-12 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800">
            {resultCount === 1 ? '1 Gericht anzeigen' : `${resultCount} Gerichte anzeigen`}
          </button>
        </div>
      </div>
    </div>
  );
}
