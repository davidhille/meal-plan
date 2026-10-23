import { useState } from 'react';
import { Trash2, CalendarPlus, RefreshCw, Loader2, Download, Share2 } from 'lucide-react';
import { DayRules, Dessert, ImageCredit, Meal, MealPlan, MealType, PlanDessert, PlanMeal } from '../types';
import { generateMealImage, removeMealImage } from '../lib/api';
import { planDessertToMeal } from '../lib/desserts';
import DessertPickerModal from './DessertPickerModal';
import { formatShortDate, toIso } from '../lib/dateUtils';
import { ruleForDate } from '../lib/dayRules';
import { seasonHighlights } from '../lib/season';
import TodayCard from './TodayCard';
import GuestStepper from './GuestStepper';
import SharePlanDialog from './SharePlanDialog';
import WeekReviewCard from './WeekReviewCard';
import { weekReview } from '../lib/weekReview';
import MoveMealSheet from './MoveMealSheet';
import DayCard from './DayCard';
import BrotzeitCard from './BrotzeitCard';
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
  /** Nur die leeren Tage des Plans befüllen (geplante und bewusst leere Tage bleiben) */
  onFillEmptyDays?: () => Promise<void>;
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
  /** Brotzeit statt Kochen (zurück über onRegenerate = doch kochen) */
  onBrotzeit?: (pm: PlanMeal) => Promise<void>;
  /** Gerichte des Plans werden noch geladen: Platzhalter statt leerer Tage */
  mealsLoading?: boolean;
  /** Leeren Tag wieder mit einem Gericht füllen */
  onFillDay?: (date: string) => Promise<void>;
  /** Plan wurde geteilt bzw. der Link zurückgezogen */
  onSharedChange?: (shared: boolean) => void;
  /** Gäste an einem Tag setzen (wirft bei Fehlern) */
  onSetGuests?: (pm: PlanMeal, guests: number) => Promise<void>;
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
  onFillEmptyDays,
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
  onBrotzeit,
  onSetGuests,
  onSharedChange,
  onFillDay,
  mealsLoading,
}: MealPlanViewProps) {
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null);
  /** Plan-Eintrag des geöffneten Gerichts (für die Gäste) */
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const [cookOnOpen, setCookOnOpen] = useState(false);
  const [moving, setMoving] = useState<PlanMeal | null>(null);
  const [pickDessertFor, setPickDessertFor] = useState<PlanMeal | null>(null);
  const [openDessert, setOpenDessert] = useState<{ pm: PlanMeal; dessert: PlanDessert } | null>(null);
  const [removeDessertFor, setRemoveDessertFor] = useState<PlanMeal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [fillingDay, setFillingDay] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  // Neu erzeugte Bilder sofort anzeigen (Gerichtname → Bild)
  const [imageOverrides, setImageOverrides] = useState<Record<string, { url: string; credit: ImageCredit | null }>>({});

  const displayItems = (planMeals ?? []).filter((pm) => !pm.rejected);
  const selectedPm = selectedPmId ? (allPlanMeals ?? planMeals ?? []).find((pm) => pm.id === selectedPmId) ?? null : null;

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
  ].filter((pm) => !pm.brotzeit);
  const toRate = rateCandidates.find((pm) => !ratings[pm.meal_name]) ?? null;
  // Sonntag bis Dienstag: Rückblick auf die (vergangene) Woche
  const review = weekReview(active, ratings, now);

  // Tage im sichtbaren Zeitraum ohne Gericht (freier Wochentag oder geleert) → eigene, schmale Zeile
  const offDays: string[] = [];
  if (plan) {
    const from = visibleRange && visibleRange.from > plan.start_date ? visibleRange.from : plan.start_date;
    const to = visibleRange && visibleRange.to < plan.end_date ? visibleRange.to : plan.end_date;
    const planned = new Set(displayItems.map((pm) => pm.meal_date));
    for (let d = new Date(`${from}T12:00:00`); toIso(d) <= to; d.setDate(d.getDate() + 1)) {
      const iso = toIso(d);
      if (!planned.has(iso)) offDays.push(iso);
    }
  }
  const rows = [
    ...displayItems.map((pm) => ({ date: pm.meal_date, pm })),
    ...offDays.map((date) => ({ date, pm: null as PlanMeal | null })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const openPlanMeal = (pm: PlanMeal, cook = false) => {
    if (pm.brotzeit) return;
    const meal = planMealToMeal(pm);
    const override = imageOverrides[pm.meal_name];
    if (override) {
      meal.imageUrl = override.url;
      meal.imageCredit = override.credit;
    }
    setCookOnOpen(cook);
    setSelectedMeal(meal);
    setSelectedPmId(pm.id);
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
            <span className="min-w-0 truncate whitespace-nowrap text-xs font-medium text-gray-600">
              {formatShortDate(plan.start_date)} – {formatShortDate(plan.end_date)}
            </span>
            <span className="flex flex-shrink-0 items-center gap-3">
              <button
                onClick={() => setSharing(true)}
                title="Nur-Lese-Link für Familie und Freunde"
                className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                <Share2 size={13} aria-hidden="true" />
                Teilen
              </button>
              <button
                onClick={() => exportPlan(plan, allPlanMeals ?? planMeals ?? [], defaultPortions ?? 4)}
                title="Plan mit allen Rezepten herunterladen oder drucken"
                className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                <Download size={13} aria-hidden="true" />
                Herunterladen
              </button>
            </span>
          </div>
        )}
        {mealsLoading ? (
          <div className="space-y-3" role="status" aria-label="Gerichte werden geladen">
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-[156px] rounded-xl bg-white border border-gray-100 shadow-sm flex items-center gap-3.5 px-4 animate-pulse">
                <div className="w-20 h-20 rounded-xl bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-24 rounded bg-gray-100" />
                  <div className="h-3.5 w-3/4 rounded bg-gray-100" />
                  <div className="h-2.5 w-1/3 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
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
        {review && <WeekReviewCard key={review.weekStart} review={review} onOpen={(pm) => openPlanMeal(pm)} />}
        {rows.map(({ date, pm }) => {
          if (!pm) {
            return (
              <div
                key={`frei-${date}`}
                className={`flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl border border-dashed ${
                  date === todayIso ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{dayLabel(date)}</p>
                  <p className="text-sm text-gray-500">{ruleForDate(date, dayRules).off ? 'Frei (Wochentag)' : 'Nichts geplant'}</p>
                </div>
                {onFillDay && !ruleForDate(date, dayRules).off && (
                  <button
                    onClick={async () => {
                      setFillingDay(date);
                      try {
                        await onFillDay(date);
                      } finally {
                        setFillingDay(null);
                      }
                    }}
                    disabled={!!fillingDay}
                    className="flex-shrink-0 h-9 px-3 flex items-center gap-1.5 rounded-lg bg-brand-50 text-xs font-semibold text-brand-800 hover:bg-brand-100 transition-colors duration-150 disabled:opacity-50"
                  >
                    {fillingDay === date ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} aria-hidden="true" />}
                    Gericht planen
                  </button>
                )}
              </div>
            );
          }
          if (pm.brotzeit) {
            return (
              <BrotzeitCard
                key={pm.id}
                day={dayLabel(pm.meal_date)}
                isToday={pm.meal_date === todayIso}
                busy={busyId === pm.id}
                onMove={onMove && onRemove ? () => setMoving(pm) : undefined}
                onCook={onRegenerate ? withBusy(pm.id, () => onRegenerate(pm.id)) : undefined}
              />
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
              guests={pm.guests ?? 0}
              season={seasonHighlights(pm.meal_name, pm.ingredients ?? [], Number(pm.meal_date.slice(5, 7)))}
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

          </>
        )}

        {/* Plan-Aktionen */}
        <div className="pt-2 space-y-2">
          {/* Häufigste Aktion: nächsten Zeitraum planen (Hauptknopf); Neu generieren und Löschen zurückhaltend */}
          <button
            onClick={onCreatePlan}
            className="w-full py-3 flex items-center justify-center gap-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 transition-colors"
          >
            <CalendarPlus size={16} aria-hidden="true" />
            Neuen Zeitraum planen
          </button>
          <div className="flex gap-2">
            {onRegeneratePlan && (
              <button
                onClick={() => setConfirmRegenerate(true)}
                disabled={regeneratingPlan}
                className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {regeneratingPlan ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {regeneratingPlan ? 'Wird neu geplant …' : 'Neu generieren'}
              </button>
            )}
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
                  className="flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                  Plan löschen
                </button>
              ))}
          </div>
        </div>
      </div>

      {sharing && plan && (
        <SharePlanDialog plan={plan} onSharedChange={(s) => onSharedChange?.(s)} onClose={() => setSharing(false)} />
      )}

      {moving && plan && onMove && onRemove && (
        <MoveMealSheet
          pm={moving}
          plan={plan}
          planMeals={allPlanMeals ?? planMeals ?? []}
          dayRules={dayRules}
          onMove={(date) => onMove(moving, date)}
          onRemove={() => onRemove(moving)}
          onBrotzeit={onBrotzeit && !moving.brotzeit ? () => onBrotzeit(moving) : undefined}
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
          defaultPortions={(defaultPortions ?? 4) + (selectedPm?.guests ?? 0)}
          extra={
            selectedPm && onSetGuests ? (
              <GuestStepper guests={selectedPm.guests ?? 0} onChange={(n) => onSetGuests(selectedPm, n)} />
            ) : undefined
          }
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
          onRemoveImage={async (mealName) => {
            await removeMealImage(mealName);
            setImageOverrides((prev) => ({ ...prev, [mealName]: { url: '', credit: null } }));
            setSelectedMeal((prev) => (prev ? { ...prev, imageUrl: undefined, imageCredit: null } : prev));
          }}
          onClose={() => {
            setSelectedMeal(null);
            setSelectedPmId(null);
          }}
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
          onExtend={onFillEmptyDays}
          extendLabel="Nur leere Tage füllen"
          extendHint={
            <>
              <strong>Nur leere Tage füllen</strong> behält alle geplanten Gerichte (auch verschobene) und plant nur Tage ohne Gericht.
              Tage, die du mit „Tag leeren“ freigemacht hast, bleiben frei.
            </>
          }
          onClose={() => setConfirmRegenerate(false)}
        />
      )}
    </>
  );
}
