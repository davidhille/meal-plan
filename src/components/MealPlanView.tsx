import { useState } from 'react';
import { Meal, MealType, PlanMeal } from '../types';
import { generateMealImage } from '../lib/api';
import DayCard from './DayCard';
import MealModal from './MealModal';

interface MealPlanViewProps {
  meals: Meal[];
  planMeals?: PlanMeal[];
  ratings: Record<string, number>;
  onRate?: (mealName: string, rating: number, notes: string) => Promise<void>;
  onReject?: (planMealId: string, mealName: string) => Promise<void>;
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
}: MealPlanViewProps) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);

  // When we have a plan, use plan meals; otherwise fall back to static data
  const hasPlan = planMeals && planMeals.length > 0;
  const showReject = !!onReject && hasPlan;

  const displayItems = hasPlan
    ? planMeals!.filter((pm) => !pm.rejected)
    : meals;

  return (
    <>
      <div className="px-4 py-4 space-y-3">
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
