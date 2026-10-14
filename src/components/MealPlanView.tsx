import { useState } from 'react';
import { Trash2, CalendarPlus, RefreshCw, Loader2, Download } from 'lucide-react';
import { DayRules, Dessert, ImageCredit, Meal, MealPlan, MealType, PlanDessert, PlanMeal } from '../types';
import { generateMealImage } from '../lib/api';
import { planDessertToMeal } from '../lib/desserts';
import DessertPickerModal from './DessertPickerModal';
import { formatShortDate, toIso } from '../lib/dateUtils';
import { ruleForDate } from '../lib/dayRules';
import TodayCard from './TodayCard';
import MoveMealSheet from './MoveMealSheet';
import DayCard from './DayCard';
import MealModal from './MealModal';
import { exportPlan } from '../lib/planExport';
import ReplacePlanDialog from './ReplacePlanDialog';
import ConfirmDialog from './ConfirmDialog';

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
  /** Nachtisch an ein Gericht hängen (null = entfernen) */
  onSetDessert?: (pm: PlanMeal, dessert: Dessert | null) => Promise<void>;
  /** Alle Gerichte des Plans (unabhängig von der KW-Auswahl) – für die Heute-Karte */
  allPlanMeals?: PlanMeal[];
  /** Uhrzeit der Erinnerung zum Bewerten („HH:MM“) */
  reminderTime?: string;
  /** Regeln pro Wochentag – freie Tage erscheinen als schmale Zeile */
  dayRules?: DayRules;
  /** Sichtbarer Zeitraum (gewählte KW), für die Zeilen der freien Tage */
  visibleRange?: { from: string; to: string };
  /** Gericht auf einen anderen Tag verschieben */
  onMove?: (pm: PlanMeal, date: string) => Promise<void>;
  /** Gericht aus dem Plan nehmen (Tag leeren) */
  onRemove?: (pm: PlanMeal) => Promise<void>;
}

/** Spätestens ab dann fragt die Heute-Karte nach dem heutigen Essen (vorher: nach dem von gestern) */
const ASK_TODAY_LATEST = '18:00';

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const dayShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** „2026-10-14“ → „Mittwoch, 14.10.“ */
function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${dayNames[new Date(iso + 'T12:00:00').getDay()]}, ${d}.${m}.`;
}

function planMealToMeal(pm: PlanMeal): Meal {
  const dow = new Date(pm.meal_date + 'T12:00:00').getDay();
  return {
    day: dayLabel(pm.meal_date),
    dayShort: dayShort[dow],
    meal: pm.meal_name,
    description: '',
    type: pm.meal_type as MealType,
    ingredients: pm.ingredients,
    instructions: pm.instructions,
    imageUrl: pm.image_url,
    imageCredit:
      pm.image_source && pm.image_source !== 'ai' && pm.image_credit_name && pm.image_credit_url
        ? { name: pm.image_credit_name, url: pm.image_credit_url }
        : null,
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
  onSetDessert,
  allPlanMeals,
  reminderTime,
  dayRules,
  visibleRange,
  onMove,
  onRemove,
}: MealPlanViewProps) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  const [cookOnOpen, setCookOnOpen] = useState(false);
  const [moving, setMoving] = useState<PlanMeal | null>(null);
  const [pickDessertFor, setPickDessertFor] = useState<PlanMeal | null>(null);
  const [openDessert, setOpenDessert] = useState<{ pm: PlanMeal; dessert: PlanDessert } | null>(null);
  const [removeDessertFor, setRemoveDessertFor] = useState<PlanMeal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  // Neu erzeugte Bilder sofort anzeigen (Gerichtname → Bild)
  const [imageOverrides, setImageOverrides] = useState<Record<string, { url: string; credit: ImageCredit | null }>>({});

  const displayItems = (planMeals ?? []).filter((pm) => !pm.rejected);

  if (!plan) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-center gap-3">
        <CalendarPlus size={32} className="text-gray-300" aria-hidden="true" />
        <p className="text-base font-semibold text-gray-800">Noch kein Speiseplan</p>
        <p className="text-sm text-gray-500 max-w-xs">
          Erstelle einen Plan – er berücksichtigt eure Familie, Vorlieben und Bewertungen.
        </p>
        <button
          onClick={onCreatePlan}
          className="mt-2 px-6 h-11 rounded-xl text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800"
        >
          Plan erstellen
        </button>
      </div>
    );
  }

  // Heute-Karte: heute, morgen und das letzte Essen, das noch nicht bewertet ist
  const active = (allPlanMeals ?? planMeals ?? []).filter((pm) => !pm.rejected);
  const now = new Date();
  const todayIso = toIso(now);
  const tomorrowIso = toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const yesterdayIso = toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const todayMeal = active.find((pm) => pm.meal_date === todayIso) ?? null;
  const tomorrowMeal = active.find((pm) => pm.meal_date === tomorrowIso) ?? null;
  // Ab der Erinnerungszeit (früher eingestellt → früher), spätestens ab 18 Uhr
  const askTodayFrom = reminderTime && reminderTime < ASK_TODAY_LATEST ? reminderTime : ASK_TODAY_LATEST;
  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const rateCandidates = [
    ...(nowHm >= askTodayFrom && todayMeal ? [todayMeal] : []),
    ...active.filter((pm) => pm.meal_date === yesterdayIso),
  ];
  const toRate = rateCandidates.find((pm) => !ratings[pm.meal_name]) ?? null;

  // Freie Tage im sichtbaren Zeitraum ohne Gericht → eigene, schmale Zeile
  const offDays: string[] = [];
  if (plan && dayRules) {
    const from = visibleRange && visibleRange.from > plan.start_date ? visibleRange.from : plan.start_date;
    const to = visibleRange && visibleRange.to < plan.end_date ? visibleRange.to : plan.end_date;
    const planned = new Set(displayItems.map((pm) => pm.meal_date));
    for (let d = new Date(`${from}T12:00:00`); toIso(d) <= to; d.setDate(d.getDate() + 1)) {
      const iso = toIso(d);
      if (!planned.has(iso) && ruleForDate(iso, dayRules).off) offDays.push(iso);
    }
  }
  const rows = [
    ...displayItems.map((pm) => ({ date: pm.meal_date, pm })),
    ...offDays.map((date) => ({ date, pm: null as PlanMeal | null })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const openPlanMeal = (pm: PlanMeal, cook = false) => {
    const meal = planMealToMeal(pm);
    const override = imageOverrides[pm.meal_name];
    if (override) {
      meal.imageUrl = override.url;
      meal.imageCredit = override.credit;
    }
    setCookOnOpen(cook);
    setSelectedMeal(meal);
  };

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
              {formatShortDate(plan.start_date)} – {formatShortDate(plan.end_date)}
            </span>
            <span className="flex items-center gap-3">
              <button
                onClick={() => exportPlan(plan, allPlanMeals ?? planMeals ?? [], defaultPortions ?? 4)}
                title="Plan mit allen Rezepten herunterladen oder drucken"
                className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                <Download size={13} aria-hidden="true" />
                Herunterladen
              </button>
              <button onClick={onCreatePlan} className="text-xs font-medium text-brand-700 hover:text-brand-800">
                Neuer Zeitraum
              </button>
            </span>
          </div>
        )}
        <TodayCard
          todayIso={todayIso}
          today={todayMeal}
          tomorrow={tomorrowMeal}
          toRate={toRate}
          onOpen={(pm) => openPlanMeal(pm)}
          onCook={(pm) => openPlanMeal(pm, true)}
          onRate={onRate ? (name, stars) => onRate(name, stars, '') : undefined}
          todayOff={!todayMeal && ruleForDate(todayIso, dayRules).off === true}
        />
        {rows.map(({ date, pm }) => {
          if (!pm) {
            return (
              <div
                key={`frei-${date}`}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed text-xs ${
                  date === todayIso ? 'border-brand-300 text-brand-800' : 'border-gray-200 text-gray-500'
                }`}
              >
                <span className="font-medium uppercase tracking-wide">{dayLabel(date)}</span>
                <span>· frei, nichts geplant</span>
              </div>
            );
          }
          const meal = planMealToMeal(pm);
          const override = imageOverrides[pm.meal_name];
          if (override) {
            meal.imageUrl = override.url;
            meal.imageCredit = override.credit;
          }
          return (
            <DayCard
              key={pm.id}
              meal={meal}
              rating={ratings[pm.meal_name]}
              busy={busyId === pm.id}
              onClick={() => openPlanMeal(pm)}
              isToday={pm.meal_date === todayIso}
              onMove={onMove && onRemove ? () => setMoving(pm) : undefined}
              onReject={onReject ? withBusy(pm.id, () => onReject(pm.id, pm.meal_name)) : undefined}
              onRegenerate={onRegenerate ? withBusy(pm.id, () => onRegenerate(pm.id)) : undefined}
              onToggleFavorite={onToggleFavorite ? withBusy(pm.id, () => onToggleFavorite(pm)) : undefined}
              isFavorite={favoriteNames?.has(pm.meal_name)}
              dessert={pm.dessert}
              onPickDessert={onSetDessert ? () => setPickDessertFor(pm) : undefined}
              onOpenDessert={() => pm.dessert && setOpenDessert({ pm, dessert: pm.dessert })}
              onRemoveDessert={onSetDessert && pm.dessert ? () => setRemoveDessertFor(pm) : undefined}
            />
          );
        })}

        {displayItems.length === 0 && offDays.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Alle Gerichte dieser Woche wurden abgelehnt. Erstelle einen neuen Plan.
          </div>
        )}

        {/* Plan-Aktionen */}
        <div className="pt-2 space-y-2">
          {onRegeneratePlan && (
            <button
              onClick={() => setConfirmRegenerate(true)}
              disabled={regeneratingPlan}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-xl bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 disabled:bg-brand-300 transition-colors"
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
                  className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                  Plan löschen
                </button>
              ))}
          </div>
        </div>
      </div>

      {moving && plan && onMove && onRemove && (
        <MoveMealSheet
          pm={moving}
          plan={plan}
          planMeals={allPlanMeals ?? planMeals ?? []}
          dayRules={dayRules}
          onMove={(date) => onMove(moving, date)}
          onRemove={() => onRemove(moving)}
          onClose={() => setMoving(null)}
        />
      )}

      {pickDessertFor && onSetDessert && (
        <DessertPickerModal
          dayLabel={planMealToMeal(pickDessertFor).day}
          mealName={pickDessertFor.meal_name}
          current={pickDessertFor.dessert}
          onSave={(dessert) => onSetDessert(pickDessertFor, dessert)}
          onClose={() => setPickDessertFor(null)}
        />
      )}

      {openDessert && (
        <MealModal
          meal={planDessertToMeal(openDessert.dessert)}
          yieldLabel={openDessert.dessert.yield}
          allowRating={false}
          extra={
            onSetDessert ? (
              <button
                onClick={() => setRemoveDessertFor(openDessert.pm)}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 size={13} />
                Nachtisch von diesem Tag entfernen
              </button>
            ) : undefined
          }
          onClose={() => setOpenDessert(null)}
        />
      )}

      {removeDessertFor && onSetDessert && (
        <ConfirmDialog
          title="Nachtisch entfernen?"
          message={
            <>
              <strong>{removeDessertFor.dessert?.name}</strong> kommt vom {planMealToMeal(removeDessertFor).day} weg, die Zutaten
              verschwinden von der Einkaufsliste.
            </>
          }
          confirmLabel="Entfernen"
          danger
          onConfirm={async () => {
            await onSetDessert(removeDessertFor, null);
            setOpenDessert(null);
          }}
          onClose={() => setRemoveDessertFor(null)}
        />
      )}

      {selectedMeal && (
        <MealModal
          key={`${selectedMeal.meal}-${cookOnOpen}`}
          meal={selectedMeal}
          startCooking={cookOnOpen}
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
            const image = await generateMealImage(mealName, !!selectedMeal.imageUrl);
            setImageOverrides((prev) => ({ ...prev, [mealName]: image }));
            setSelectedMeal((prev) => (prev ? { ...prev, imageUrl: image.url, imageCredit: image.credit } : prev));
            return image;
          }}
          onClose={() => setSelectedMeal(null)}
        />
      )}
      {confirmRegenerate && plan && onRegeneratePlan && (
        <ReplacePlanDialog
          plan={plan}
          meals={allPlanMeals ?? planMeals ?? []}
          portions={defaultPortions ?? 4}
          confirmLabel="Neu generieren"
          onConfirm={async () => {
            setRegeneratingPlan(true);
            try {
              await onRegeneratePlan();
            } finally {
              setRegeneratingPlan(false);
            }
          }}
          onClose={() => setConfirmRegenerate(false)}
        />
      )}
    </>
  );
}
