import { useState } from 'react';
import { Trash2, CalendarPlus, RefreshCw, Loader2 } from 'lucide-react';
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
  onRegenerate?: (planMealId: string) => Promise<void>;
  onRegeneratePlan?: () => Promise<void>;
  favoriteNames?: Set<string>;
  onToggleFavorite?: (pm: PlanMeal) => Promise<void>;
  plan?: MealPlan | null;
  onDeletePlan?: () => Promise<void>;
  defaultPortions?: number;
}

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const dayShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y.slice(2)}`;
}

function planMealToMeal(pm: PlanMeal): Meal {
  const dow = new Date(pm.meal_date + 'T12:00:00').getDay();
  const [, m, d] = pm.meal_date.split('-');
  return {
    day: `${dayNames[dow]}, ${d}.${m}.`,
    dayShort: dayShort[dow],
    meal: pm.meal_name,
    description: '',
    type: pm.meal_type as MealType,
    ingredients: pm.ingredients,
    instructions: pm.instructions,
    imageUrl: pm.image_url,
    durationMin: pm.duration_min ?? null,
  };
}

export default function MealPlanView({
  onCreatePlan,
  planMeals,
  ratings,
  onRate,
  onReject,
  onRegenerate,
  onRegeneratePlan,
  favoriteNames,
  onToggleFavorite,
  plan,
  onDeletePlan,
  defaultPortions,
}: MealPlanViewProps) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  // Neu erzeugte Bilder sofort anzeigen (Gerichtname → URL)
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});

  const displayItems = (planMeals ?? []).filter((pm) => !pm.rejected);

  if (!plan) {
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

  const withBusy = (id: string, fn: () => Promise<void>) => async () => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="px-4 py-4 space-y-3">
        {plan && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white border border-gray-100 text-sm">
            <span className="text-gray-600">
              Plan {formatDate(plan.start_date)} – {formatDate(plan.end_date)}
            </span>
            <button onClick={onCreatePlan} className="text-xs font-medium text-green-600 hover:text-green-700">
              Neuer Zeitraum
            </button>
          </div>
        )}
        {displayItems.map((pm) => {
          const meal = planMealToMeal(pm);
          if (imageOverrides[pm.meal_name]) meal.imageUrl = imageOverrides[pm.meal_name];
          return (
            <DayCard
              key={pm.id}
              meal={meal}
              rating={ratings[pm.meal_name]}
              busy={busyId === pm.id}
              onClick={() => setSelectedMeal(meal)}
              onReject={onReject ? withBusy(pm.id, () => onReject(pm.id, pm.meal_name)) : undefined}
              onRegenerate={onRegenerate ? withBusy(pm.id, () => onRegenerate(pm.id)) : undefined}
              onToggleFavorite={onToggleFavorite ? withBusy(pm.id, () => onToggleFavorite(pm)) : undefined}
              isFavorite={favoriteNames?.has(pm.meal_name)}
            />
          );
        })}

        {displayItems.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Alle Gerichte wurden abgelehnt. Erstelle einen neuen Plan.
          </div>
        )}

        {/* Plan-Aktionen */}
        <div className="pt-2 space-y-2">
          {onRegeneratePlan && (
            <button
              onClick={async () => {
                setRegeneratingPlan(true);
                try {
                  await onRegeneratePlan();
                } finally {
                  setRegeneratingPlan(false);
                }
              }}
              disabled={regeneratingPlan}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:bg-green-300 transition-colors"
            >
              {regeneratingPlan ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {regeneratingPlan ? 'Wird neu geplant …' : 'Komplett neuen Plan generieren'}
            </button>
          )}
          <div className="flex gap-2">
            {onDeletePlan &&
              (confirmDelete ? (
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
                  onBlur={() => !deleting && setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 disabled:bg-red-300"
                >
                  {deleting ? 'Löscht …' : 'Wirklich löschen?'}
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white text-sm font-medium text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                  Plan löschen
                </button>
              ))}
          </div>
        </div>
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
