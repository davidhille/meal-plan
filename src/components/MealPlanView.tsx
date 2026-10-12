import { useState } from 'react';
import { Trash2, CalendarPlus } from 'lucide-react';
import { Meal, MealPlan, MealType, PlanMeal } from '../types';
import { generateMealImage } from '../lib/api';
import DayCard from './DayCard';
import MealModal from './MealModal';

interface MealPlanViewProps {
  onCreatePlan: () => void;
  planMeals?: PlanMeal[];
  ratings: Record<string, number>;
  onRate?: (mealName: string, rating: number, notes: string) => Promise<void>;
  onReject?: (planMealId: string, mealName: string) => Promise<void>;
  plan?: MealPlan | null;
  onDeletePlan?: () => Promise<void>;
  defaultPortions?: number;
}

const dayNames: Record<string, string> = {
  '0': 'Sonntag',
  '1': 'Montag',
  '2': 'Dienstag',
  '3': 'Mittwoch',
  '4': 'Donnerstag',
  '5': 'Freitag',
  '6': 'Samstag',
};

const dayShort: Record<string, string> = {
  '0': 'So',
  '1': 'Mo',
  '2': 'Di',
  '3': 'Mi',
  '4': 'Do',
  '5': 'Fr',
  '6': 'Sa',
};

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y.slice(2)}`;
}

function planMealToMeal(pm: PlanMeal): Meal {
  const date = new Date(pm.meal_date);
  const dow = date.getDay().toString();
  return {
    day: dayNames[dow] || pm.meal_date,
    dayShort: dayShort[dow] || pm.meal_date.slice(8, 10),
    meal: pm.meal_name,
    description: pm.meal_type === 'vegetarisch' ? 'Vegetarisches Gericht' : pm.meal_type === 'fleisch' ? 'Fleischgericht' : 'Wochenendgericht',
    type: pm.meal_type as MealType,
    ingredients: pm.ingredients,
    instructions: pm.instructions,
    imageUrl: pm.image_url,
  };
}

export default function MealPlanView({
  onCreatePlan,
  planMeals,
  ratings,
  onRate,
  onReject,
  plan,
  onDeletePlan,
  defaultPortions,
}: MealPlanViewProps) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Neu erzeugte Bilder sofort anzeigen (Gerichtname → URL)
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});

  const hasPlan = !!plan;
  const showReject = !!onReject && hasPlan;
  const displayItems = (planMeals ?? []).filter((pm) => !pm.rejected);

  if (!hasPlan) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-center gap-3">
        <CalendarPlus size={32} className="text-gray-300" />
        <p className="text-sm text-gray-500">Noch kein Speiseplan vorhanden.</p>
        <p className="text-xs text-gray-400">
          Erstelle einen Plan – er berücksichtigt eure Familie, Vorlieben und Bewertungen.
        </p>
        <button
          onClick={onCreatePlan}
          className="mt-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600"
        >
          Plan erstellen
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-4 space-y-3">
        {plan && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white border border-gray-100 text-sm">
            <span className="text-gray-600">
              Plan {formatDate(plan.start_date)} – {formatDate(plan.end_date)}
            </span>
            {onDeletePlan &&
              (confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-gray-100"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        await onDeletePlan();
                      } finally {
                        setDeleting(false);
                        setConfirmDelete(false);
                      }
                    }}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500 disabled:bg-red-300"
                  >
                    {deleting ? 'Löscht …' : 'Wirklich löschen'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100"
                >
                  <Trash2 size={12} />
                  Plan löschen
                </button>
              ))}
          </div>
        )}
        {displayItems.map((pm) => {
          const meal: Meal = planMealToMeal(pm);
          if (imageOverrides[pm.meal_name]) meal.imageUrl = imageOverrides[pm.meal_name];
          const ratingVal = ratings[pm.meal_name];

          return (
            <DayCard
              key={pm.id}
              meal={meal}
              rating={ratingVal}
              showReject={showReject}
              onReject={onReject ? () => onReject(pm.id, pm.meal_name) : undefined}
              onClick={() => setSelectedMeal(meal)}
            />
          );
        })}

        {displayItems.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Alle Gerichte wurden abgelehnt. Erstelle einen neuen Plan.
          </div>
        )}
      </div>

      {selectedMeal && (
        <MealModal
          meal={selectedMeal}
          currentRating={ratings[selectedMeal.meal]}
          defaultPortions={defaultPortions}
          onRate={
            onRate
              ? async (rating, notes) => {
                  await onRate(selectedMeal.meal, rating, notes);
                }
              : undefined
          }
          onGenerateImage={async (mealName) => {
            const url = await generateMealImage(mealName, !!selectedMeal.imageUrl);
            if (url) {
              setImageOverrides((prev) => ({ ...prev, [mealName]: url }));
              setSelectedMeal((prev) => (prev ? { ...prev, imageUrl: url } : prev));
            }
            return url;
          }}
          onClose={() => setSelectedMeal(null)}
        />
      )}
    </>
  );
}
