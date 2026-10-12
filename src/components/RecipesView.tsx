import { useState } from 'react';
import { CatalogRecipe, Dessert, PlanMeal } from '../types';
import MainDishesView from './MainDishesView';
import DessertsView from './DessertsView';

interface RecipesViewProps {
  planMeals: PlanMeal[];
  onReplace?: (pm: PlanMeal, recipe: CatalogRecipe) => Promise<void>;
  onAssignDessert?: (pm: PlanMeal, dessert: Dessert) => Promise<void>;
  defaultPortions?: number;
}

type Section = 'gerichte' | 'nachtische';

/** Rezept-Übersicht: Hauptgerichte und Nachtische */
export default function RecipesView({ planMeals, onReplace, onAssignDessert, defaultPortions }: RecipesViewProps) {
  const [section, setSection] = useState<Section>(() => {
    try {
      return localStorage.getItem('rezepte-bereich') === 'nachtische' ? 'nachtische' : 'gerichte';
    } catch {
      return 'gerichte';
    }
  });

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
        <MainDishesView planMeals={planMeals} onReplace={onReplace} defaultPortions={defaultPortions} />
      ) : (
        <DessertsView planMeals={planMeals} onAssign={onAssignDessert} />
      )}
    </>
  );
}
