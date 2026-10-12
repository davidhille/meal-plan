import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Meal, MealPlan, MealType, PlanMeal } from '../types';
import { generateMealImage } from '../lib/api';
import DayCard from './DayCard';
import MealModal from './MealModal';

interface MealPlanViewProps {
  meals: Meal[];
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
  meals,
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

  // When we have a plan, use plan meals; otherwise fall back to static data
  const hasPlan = planMeals && planMeals.length > 0;
  const showReject = !!onReject && hasPlan;

  const displayItems = hasPlan
    ? planMeals!.filter((pm) => !pm.rejected)
    : meals;

  return (
    <>
      <div className="px-4 py-4 space-y-3">
        {hasPlan && plan && (
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
        {displayItems.map((item) => {
          const pm = item as PlanMeal;
          const isPlan = hasPlan;
          const meal: Meal = isPlan ? planMealToMeal(pm) : (item as Meal);
          const mealKey = isPlan ? pm.id : meal.meal;
          const mealName = isPlan ? pm.meal_name : meal.meal;
          const ratingVal = ratings[mealName];

          return (
            <DayCard
              key={mealKey}
              meal={meal}
              rating={ratingVal}
              showReject={showReject}
              onReject={
                isPlan && onReject
                  ? () => onReject(pm.id, pm.meal_name)
                  : undefined
              }
              onClick={() => setSelectedMeal(meal)}
            />
          );
        })}

        {hasPlan && displayItems.length === 0 && (
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
            const url = await generateMealImage(mealName);
            if (url && selectedMeal) {
              setSelectedMeal({ ...selectedMeal, imageUrl: url });
            }
            return url;
          }}
          onClose={() => setSelectedMeal(null)}
        />
      )}
    </>
  );
}
