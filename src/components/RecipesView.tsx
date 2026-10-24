import { useEffect, useState } from 'react';
import { CatalogRecipe, Dessert, PlanMeal, RecipeFilter } from '../types';
import { getRecipeFilters, type DislikeHint } from '../lib/api';
import { filtersFor } from '../lib/recipeFilters';
import MainDishesView from './MainDishesView';
import DessertsView from './DessertsView';

interface RecipesViewProps {
  planMeals: PlanMeal[];
  onReplace?: (pm: PlanMeal, recipe: CatalogRecipe) => Promise<void>;
  onAssignDessert?: (pm: PlanMeal, dessert: Dessert) => Promise<void>;
  defaultPortions?: number;
  /** Gericht bearbeitet – Plan und Favoriten neu laden */
  onRecipesChanged?: () => void;
  /** Namen der Favoriten (für die Sortierung „Empfohlen“) */
  favoriteNames?: string[];
  familyDislikes?: string[];
  onFamilyDislike?: (groupId: string) => Promise<void>;
  onDislikeHint?: (hint: DislikeHint) => void;
}

type Section = 'gerichte' | 'nachtische';

/** Rezept-Übersicht: Hauptgerichte und Nachtische */
export default function RecipesView({ planMeals, onReplace, onAssignDessert, defaultPortions, onRecipesChanged, favoriteNames, familyDislikes, onFamilyDislike, onDislikeHint }: RecipesViewProps) {
  const [section, setSection] = useState<Section>(() => {
    try {
      return localStorage.getItem('rezepte-bereich') === 'nachtische' ? 'nachtische' : 'gerichte';
    } catch {
      return 'gerichte';
    }
  });

  // Eigene Filter aus den Einstellungen (ohne sie geht es auch)
  const [customFilters, setCustomFilters] = useState<RecipeFilter[]>([]);
  useEffect(() => {
    getRecipeFilters()
      .then(setCustomFilters)
      .catch(() => setCustomFilters([]));
  }, []);

  const choose = (s: Section) => {
    setSection(s);
    try {
      localStorage.setItem('rezepte-bereich', s);
    } catch {
      // egal – dann startet die Ansicht beim nächsten Mal wieder bei den Gerichten
    }
  };

  return (
    <>
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 p-1 rounded-xl bg-gray-200/70" role="group" aria-label="Rezepte">
          {(
            [
              { id: 'gerichte', label: 'Hauptgerichte' },
              { id: 'nachtische', label: 'Nachtische' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              aria-pressed={section === s.id}
              onClick={() => choose(s.id)}
              className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                section === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {section === 'gerichte' ? (
        <MainDishesView
          planMeals={planMeals}
          onReplace={onReplace}
          defaultPortions={defaultPortions}
          customFilters={filtersFor(customFilters, 'gerichte')}
          onFiltersChange={setCustomFilters}
          onRecipesChanged={onRecipesChanged}
          favoriteNames={favoriteNames}
          familyDislikes={familyDislikes}
          onFamilyDislike={onFamilyDislike}
          onDislikeHint={onDislikeHint}
        />
      ) : (
        <DessertsView
          planMeals={planMeals}
          onAssign={onAssignDessert}
          customFilters={filtersFor(customFilters, 'nachtische')}
          onFiltersChange={setCustomFilters}
        />
      )}
    </>
  );
}
