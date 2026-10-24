import { useState, useEffect, useRef } from 'react';
import AppIcon from './components/AppIcon';
import Logo from './components/Logo';
import { ViewTab, Profile, FamilyMember, Routine, MealPlan, PlanMeal, Favorite, Dessert, CatalogRecipe } from './types';
import {
  getOrCreateProfile,
  updateProfile,
  getFamilyMembers,
  addFamilyMember,
  deleteFamilyMember,
  updateFamilyMember,
  getMealRatings,
  getRatingNotes,
  addMealRating,
  getRoutines,
  createRoutine,
  deleteRoutine,
  createMealPlan,
  getPlanMeals,
  extendMealPlan,
  movePlanMeal,
  removePlanMeal,
  setPlanMealBrotzeit,
  setPlanMealGuests,
  fillPlanDay,
  getLatestPlan,
  deletePlan,
  regenerateMeal,
  regeneratePlan,
  getFavorites,
  addFavorite,
  removeFavorite,
  setFavoriteTurnus,
  rejectMeal,
  unrejectMeal,
  setFamilyDislikes,
  UnauthorizedError,
  getAuthStatus,
  setMealDessert,
  replacePlanMeal,
  type DislikeHint,
  fillChefkochPhotos,
} from './lib/api';
import LoginScreen, { inviteToken } from './components/LoginScreen';
import { familyPortions } from './lib/portions';
import { toPlanDessert } from './lib/desserts';
import PlanCreationModal from './components/PlanCreationModal';
import Header from './components/Header';
import TabSwitcher from './components/TabSwitcher';
import RecipesView from './components/RecipesView';
import WeekSelector from './components/WeekSelector';
import { getWeeksInRange, isDateInWeek, currentWeekIndex, upcomingWeeks } from './lib/dateUtils';
import FavoritesView from './components/FavoritesView';
import MealPlanView from './components/MealPlanView';
import ShoppingListView from './components/ShoppingListView';
import SettingsView from './components/SettingsView';
import MealRatingModal from './components/MealRatingModal';
import { RatingsContext } from './lib/ratings';
import { RatingNote } from './types';
import ReplacePlanDialog from './components/ReplacePlanDialog';

const VIEW_TABS: ViewTab[] = ['speiseplan', 'einkaufsliste', 'rezepte', 'favoriten', 'einstellungen'];

/** Aus der Erinnerung geöffnet (?bewerten=Gerichtname)? Parameter danach aus der Adresse entfernen */
function takeRateRequest(): string | null {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('bewerten');
  if (!name) return null;
  params.delete('bewerten');
  const rest = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
  return name.trim() || null;
}

export default function App() {
  const [showPlanModal, setShowPlanModal] = useState(false);
  /** Neuer Zeitraum, der erst nach Rückfrage den laufenden Plan ersetzt */
  const [pendingPlan, setPendingPlan] = useState<{ start: string; end: string } | null>(null);
  const [imagePolls, setImagePolls] = useState(0);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  // Vergangene Wochen des Plans sind ausgeblendet, bis man sie aufklappt
  const [showPastWeeks, setShowPastWeeks] = useState(false);
  // Gericht, das bewertet werden soll (Tipp auf die Erinnerung)
  const [rateRequest, setRateRequest] = useState<string | null>(() => takeRateRequest());
  // App war schon offen: der Service Worker schickt den Wunsch als Nachricht
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; name?: string } | null;
      if (data?.type === 'bewerten' && data.name) {
        setActiveTab('speiseplan');
        setRateRequest(data.name);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker.startMessages?.();
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);
  // Aktiver Bereich steht im URL-Hash (#einkaufsliste) – so bleibt man beim Neuladen, wo man war
  const [activeTab, setActiveTab] = useState<ViewTab>(() => {
    const hash = window.location.hash.slice(1);
    return (VIEW_TABS as string[]).includes(hash) ? (hash as ViewTab) : 'speiseplan';
  });
  useEffect(() => {
    const url = activeTab === 'speiseplan' ? window.location.pathname + window.location.search : `#${activeTab}`;
    window.history.replaceState(null, '', url);
  }, [activeTab]);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Fehlende Chefkoch-Fotos nachholen: aus dem Browser, weil das Chefkoch-CDN den Server abweist (lib/api.ts); einmal je Start
  const profileId = profile?.id;
  useEffect(() => {
    if (profileId) void fillChefkochPhotos();
  }, [profileId]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [mealRatings, setMealRatings] = useState<Record<string, number>>({});
  const [ratingNotes, setRatingNotes] = useState<Record<string, RatingNote>>({});
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null);
  const [planMeals, setPlanMeals] = useState<PlanMeal[]>([]);
  const [loading, setLoading] = useState(true);
  /** Für welchen Plan die Gerichte geladen sind (vorher: Platzhalter statt „leerer“ Tage) */
  const [mealsLoadedFor, setMealsLoadedFor] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    setSelectedWeekKey(null);
    if (currentPlan) {
      loadPlanMeals();
    }
  }, [currentPlan?.id]);

  const loadProfile = async () => {
    setLoading(true);
    setLoadFailed(false);
    let prof: Profile | null = null;
    try {
      // Nicht angemeldet (oder noch kein Zugang angelegt) → Anmeldung zeigen
      const status = await getAuthStatus().catch(() => null);
      // Einladungslink geöffnet → Zugang für die neue Familie anlegen
      if ((status && !status.user) || inviteToken()) throw new UnauthorizedError();
      prof = await getOrCreateProfile();
      setLocked(false);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setLocked(true);
        setLoading(false);
        return;
      }
    }
    if (!prof) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    if (prof) {
      setProfile(prof);
      const members = await getFamilyMembers(prof.id);
      setFamilyMembers(members);
      const [ratings, notes] = await Promise.all([getMealRatings(prof.id), getRatingNotes()]);
      setMealRatings(ratings);
      setRatingNotes(notes);
      const routinesList = await getRoutines(prof.id);
      setRoutines(routinesList);
      const latest = await getLatestPlan();
      if (latest) setCurrentPlan(latest);
      setFavorites(await getFavorites());
    }
    setLoading(false);
  };

  // Bilder entstehen nach dem Erstellen im Hintergrund → einige Male nachladen, bis alle da sind
  useEffect(() => {
    if (!currentPlan) return;
    const missing = planMeals.some((m) => !m.rejected && !m.image_url);
    if (!missing || imagePolls >= 8) return;
    const t = setTimeout(async () => {
      const meals = await getPlanMeals(currentPlan.id);
      if (meals.length) setPlanMeals(meals);
      setImagePolls((n) => n + 1);
    }, 15000);
    return () => clearTimeout(t);
  }, [planMeals, currentPlan?.id, imagePolls]);

  const loadPlanMeals = async () => {
    if (!currentPlan) return;
    setImagePolls(0);
    const meals = await getPlanMeals(currentPlan.id);
    setPlanMeals(meals);
    setMealsLoadedFor(currentPlan.id);
  };

  // „Kommt nie in den Plan“: Hauptzutat für die ganze Familie ausschließen (aus dem Ausblenden-Dialog)
  const handleFamilyDislike = async (groupId: string) => {
    setProfile(await setFamilyDislikes({ id: groupId, on: true }));
  };

  // Leerer Speiseplan: Familien-Nein einzeln ein-/ausschalten
  const handleToggleDislike = async (id: string, on: boolean) => {
    setProfile(await setFamilyDislikes({ id, on }));
  };

  const handleUpdateProfile = async (focus: string[], conditions: string[], meatMaxPerWeek: number | null, never?: string[]) => {
    if (!profile) return;
    const updated = await updateProfile(profile.id, focus, conditions, meatMaxPerWeek);
    if (!updated) throw new Error('Die Einstellungen konnten nicht gespeichert werden.');
    setProfile(never ? await setFamilyDislikes({ ids: never }) : updated);
  };

  const handleAddFamilyMember = async (
    member: Omit<FamilyMember, 'id' | 'profile_id' | 'created_at'>
  ) => {
    if (!profile) return;
    const newMember = await addFamilyMember(profile.id, member);
    if (newMember) {
      setFamilyMembers([...familyMembers, newMember]);
    }
  };

  const handleUpdateFamilyMember = async (
    id: string,
    member: Omit<FamilyMember, 'id' | 'profile_id' | 'created_at'>
  ) => {
    const updated = await updateFamilyMember(id, member);
    if (updated) setFamilyMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
  };

  const handleDeleteFamilyMember = async (id: string) => {
    const success = await deleteFamilyMember(id);
    if (success) {
      setFamilyMembers(familyMembers.filter((m) => m.id !== id));
    }
  };

  const handleRateMeal = async (mealName: string, rating: number, notes: string) => {
    if (!profile) return;
    const result = await addMealRating(profile.id, mealName, rating, notes);
    if (!result) throw new Error('Die Bewertung konnte nicht gespeichert werden.');
    setMealRatings((prev) => ({ ...prev, [mealName]: rating }));
    setRatingNotes((prev) => {
      const next = { ...prev };
      if (notes.trim()) next[mealName] = { notes: notes.trim(), updatedAt: new Date().toISOString() };
      else delete next[mealName];
      return next;
    });
  };

  const handleCreateRoutine = async (
    name: string,
    frequency: 'weekly' | 'monthly',
    dayOfWeek: number | null,
    time: string | null,
    durationDays: number
  ) => {
    if (!profile) return;
    const routine = await createRoutine(
      profile.id,
      name,
      frequency,
      dayOfWeek,
      time,
      durationDays
    );
    if (routine) {
      setRoutines([...routines, routine]);
    }
  };

  const handleDeleteRoutine = async (id: string) => {
    const success = await deleteRoutine(id);
    if (success) {
      setRoutines(routines.filter((r) => r.id !== id));
    }
  };

  const handleCreatePlan = async (startDate: string, endDate: string) => {
    if (!profile) return;
    const plan = await createMealPlan(profile.id, startDate, endDate);
    if (plan) {
      setCurrentPlan(plan);
      setActiveTab('speiseplan');
    }
  };

  /** Laufenden Plan verlängern statt ersetzen (gleiche Plan-ID → Gerichte neu laden) */
  const handleExtendPlan = async (startDate: string, endDate: string) => {
    if (!currentPlan) return;
    const plan = await extendMealPlan(currentPlan.id, startDate, endDate);
    setCurrentPlan(plan);
    setPlanMeals(await getPlanMeals(plan.id));
    setFavorites(await getFavorites());
    setActiveTab('speiseplan');
  };

  /** Läuft noch ein Plan mit Gerichten? Dann vor dem Ersetzen nachfragen */
  const planStillRunning = () => {
    const today = new Date().toISOString().slice(0, 10);
    return !!currentPlan && currentPlan.end_date >= today && planMeals.some((m) => !m.rejected);
  };

  const requestCreatePlan = async (startDate: string, endDate: string) => {
    if (planStillRunning()) {
      setShowPlanModal(false);
      setPendingPlan({ start: startDate, end: endDate });
      return;
    }
    await handleCreatePlan(startDate, endDate);
    setShowPlanModal(false);
  };

  const handleDeletePlan = async () => {
    if (!currentPlan) return;
    const result = await deletePlan(currentPlan.id);
    if (result.ok) {
      setPlanMeals([]);
      setCurrentPlan(result.latest);
    }
  };

  /** Ersatzgericht an die Stelle des alten setzen (nach Datum sortiert) */
  const swapMeal = (oldId: string, replacement: PlanMeal) =>
    setPlanMeals((prev) =>
      [...prev.filter((m) => m.id !== oldId), replacement].sort((a, b) => a.meal_date.localeCompare(b.meal_date))
    );

  // Zuletzt ausgeblendetes Gericht – kurz rückgängig machbar
  const [undoReject, setUndoReject] = useState<{ id: string; name: string; replacementId: string | null } | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  const handleRejectMeal = async (planMealId: string, mealName: string) => {
    if (!profile) return;
    const result = await rejectMeal(profile.id, planMealId, mealName);
    const replacement = result?.replacement ?? null;
    if (replacement) swapMeal(planMealId, replacement);
    else setPlanMeals((prev) => prev.map((m) => (m.id === planMealId ? { ...m, rejected: true } : m)));
    setUndoReject({ id: planMealId, name: mealName, replacementId: replacement?.id ?? null });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoReject(null), 8000);
    // Muster erkannt (z. B. das 3. Lammgericht): anbieten, die Hauptzutat ganz wegzulassen
    setDislikeHint(result?.hint ? { ...result.hint, phase: 'ask' } : null);
  };

  // „Lamm ganz weglassen?“ nach mehrfachem Ausblenden derselben Hauptzutat; bleibt, bis man antwortet (kein Zeitlimit)
  const [dislikeHint, setDislikeHint] = useState<(DislikeHint & { phase: 'ask' | 'saving' | 'done' | 'error' }) | null>(null);
  const acceptDislikeHint = async () => {
    if (!dislikeHint) return;
    setDislikeHint({ ...dislikeHint, phase: 'saving' });
    try {
      setProfile(await setFamilyDislikes({ id: dislikeHint.id, on: true }));
      setDislikeHint({ ...dislikeHint, phase: 'done' });
      window.setTimeout(() => setDislikeHint(null), 6000);
    } catch {
      setDislikeHint({ ...dislikeHint, phase: 'error' });
    }
  };

  const handleUndoReject = async () => {
    if (!undoReject) return;
    const { id, replacementId } = undoReject;
    window.clearTimeout(undoTimer.current);
    setUndoReject(null);
    setDislikeHint(null); // Rückgängig gemacht: das Ausblenden zählt nicht mehr
    try {
      const restored = await unrejectMeal(id, replacementId);
      setPlanMeals((prev) =>
        [...prev.filter((m) => m.id !== id && m.id !== replacementId), restored].sort((a, b) => a.meal_date.localeCompare(b.meal_date))
      );
    } catch {
      // Hat sich inzwischen etwas geändert: Plan neu laden
      loadPlanMeals();
    }
  };

  const handleRegenerateMeal = async (planMealId: string) => {
    const replacement = await regenerateMeal(planMealId);
    if (replacement) swapMeal(planMealId, replacement);
  };

  const handleRegeneratePlan = async () => {
    if (!currentPlan) return;
    const plan = await regeneratePlan(currentPlan.id);
    if (plan) {
      setPlanMeals([]);
      setCurrentPlan(plan);
      setFavorites(await getFavorites());
    }
  };

  const handleMoveMeal = async (pm: PlanMeal, date: string) => {
    const result = await movePlanMeal(pm.id, date);
    // Plan verlängert (z. B. auf nächste Woche verschoben) → neue Grenzen übernehmen
    if (result.plan) setCurrentPlan(result.plan);
    if (currentPlan) setPlanMeals(await getPlanMeals(currentPlan.id));
  };

  const handleBrotzeit = async (pm: PlanMeal) => {
    swapMeal(pm.id, await setPlanMealBrotzeit(pm.id));
  };

  const handleSetGuests = async (pm: PlanMeal, guests: number) => {
    const saved = await setPlanMealGuests(pm.id, guests);
    setPlanMeals((prev) => prev.map((m) => (m.id === pm.id ? { ...m, guests: saved } : m)));
  };

  const handleRemoveMeal = async (pm: PlanMeal) => {
    await removePlanMeal(pm.id);
    setPlanMeals((prev) => prev.filter((m) => m.id !== pm.id));
  };

  const handleSetDessert = async (pm: PlanMeal, dessert: Dessert | null) => {
    const saved = await setMealDessert(pm.id, dessert ? toPlanDessert(dessert) : null);
    setPlanMeals((prev) => prev.map((m) => (m.id === pm.id ? { ...m, dessert: saved } : m)));
  };

  const handleReplaceWithRecipe = async (pm: PlanMeal, recipe: CatalogRecipe) => {
    const replacement = await replacePlanMeal(pm.id, recipe.name);
    swapMeal(pm.id, replacement);
    setFavorites(await getFavorites());
  };

  const favoriteNames = new Set(favorites.map((f) => f.meal_name));

  const handleToggleFavorite = async (pm: PlanMeal) => {
    const existing = favorites.find((f) => f.meal_name === pm.meal_name);
    const next = existing ? await removeFavorite(existing.id) : await addFavorite(pm.id);
    if (next) setFavorites(next);
  };



  if (locked) {
    return <LoginScreen onDone={loadProfile} />;
  }

  if (loadFailed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div role="alert" className="max-w-xs text-center space-y-3">
          <p className="text-base font-semibold text-gray-800">Der Server antwortet gerade nicht</p>
          <p className="text-sm text-gray-500">Meist hilft es, kurz zu warten und neu zu laden.</p>
          <button
            onClick={loadProfile}
            className="px-6 h-11 rounded-xl text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800"
          >
            Neu laden
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3" role="status">
        <AppIcon size={56} />
        <Logo size={34} />
        <p className="text-sm text-gray-500 mt-2">Wird geladen …</p>
      </div>
    );
  }

  // KW-Auswahl (aus der Juli-Version): nur Wochen, die der Plan wirklich abdeckt
  const planWeeks = currentPlan ? getWeeksInRange(currentPlan.start_date, currentPlan.end_date) : [];
  // Vergangene Wochen ausblenden (lassen sich mit „Frühere“ wieder einblenden)
  const upcoming = upcomingWeeks(planWeeks);
  const shownWeeks = showPastWeeks ? planWeeks : upcoming;
  const pastCount = planWeeks.length - upcoming.length;
  // Ohne eigene Auswahl die Woche zeigen, in der heute liegt
  const selectedWeek = shownWeeks.find((w) => w.key === selectedWeekKey) ?? shownWeeks[currentWeekIndex(shownWeeks)];
  const visiblePlanMeals = selectedWeek
    ? planMeals.filter((m) => isDateInWeek(m.meal_date, selectedWeek))
    : planMeals;
  // Die Einkaufsliste hat eine eigene Wochenauswahl (mehrere Wochen kombinierbar)
  const showWeeks = planWeeks.length > 1 && activeTab === 'speiseplan';

  return (
    <RatingsContext.Provider value={{ ratings: mealRatings, notes: ratingNotes, rate: handleRateMeal }}>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Kopf scrollt mit; fest bleibt oben nur die Wochenauswahl. Bereiche: am Handy unten, ab Tablet oben */}
      <Header />
      <div className="hidden sm:block">
        <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <div className="sticky top-0 z-10 flex flex-col">
        {showWeeks && (
          <WeekSelector
            weeks={shownWeeks}
            selectedWeekKey={selectedWeek?.key ?? null}
            onSelectWeek={setSelectedWeekKey}
            pastCount={pastCount}
            showPast={showPastWeeks}
            onTogglePast={() => {
              setShowPastWeeks((v) => !v);
              setSelectedWeekKey(null);
            }}
          />
        )}
      </div>

      {/* Scrollable content area */}
      <main className="flex-1 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-8 w-full max-w-2xl mx-auto">
        {activeTab === 'speiseplan' ? (
          <MealPlanView
            key={`meals-${currentPlan?.id || 'none'}`}
            onCreatePlan={() => setShowPlanModal(true)}
            planMeals={currentPlan ? visiblePlanMeals : undefined}
            mealsLoading={!!currentPlan && mealsLoadedFor !== currentPlan.id}
            ratings={mealRatings}
            onRate={handleRateMeal}
            onReject={currentPlan ? handleRejectMeal : undefined}
            onRegenerate={currentPlan ? handleRegenerateMeal : undefined}
            onRegeneratePlan={currentPlan ? handleRegeneratePlan : undefined}
            onFillEmptyDays={currentPlan ? () => handleExtendPlan(currentPlan.start_date, currentPlan.end_date) : undefined}
            favoriteNames={favoriteNames}
            onToggleFavorite={handleToggleFavorite}
            plan={currentPlan}
            onDeletePlan={currentPlan ? handleDeletePlan : undefined}
            defaultPortions={familyPortions(familyMembers)}
            onSetDessert={currentPlan ? handleSetDessert : undefined}
            allPlanMeals={currentPlan ? planMeals : undefined}
            reminderTime={profile?.reminder_time}
            dayRules={profile?.day_rules}
            onMove={currentPlan ? handleMoveMeal : undefined}
            onRemove={currentPlan ? handleRemoveMeal : undefined}
            onBrotzeit={currentPlan ? handleBrotzeit : undefined}
            onSetGuests={currentPlan ? handleSetGuests : undefined}
            onSharedChange={(shared) => setCurrentPlan((p) => (p ? { ...p, shared } : p))}
            familyDislikes={profile?.family_dislikes}
            onFamilyDislike={handleFamilyDislike}
            onToggleDislike={handleToggleDislike}
            isFreshFamily={!currentPlan && familyMembers.length === 0 && !(profile?.family_dislikes?.length)}
            onFillDay={
              currentPlan
                ? async (date) => {
                    setCurrentPlan(await fillPlanDay(currentPlan.id, date));
                    setPlanMeals(await getPlanMeals(currentPlan.id));
                  }
                : undefined
            }
            visibleRange={selectedWeek ? { from: selectedWeek.weekStart, to: selectedWeek.weekEnd } : undefined}
          />
        ) : activeTab === 'einkaufsliste' ? (
          <ShoppingListView
            key={`shopping-${currentPlan?.id || 'none'}`}
            plan={currentPlan}
            weeks={planWeeks}
            planMeals={planMeals}
            onCreatePlan={() => setShowPlanModal(true)}
          />
        ) : activeTab === 'rezepte' ? (
          <RecipesView
            planMeals={currentPlan ? planMeals : []}
            onReplace={currentPlan ? handleReplaceWithRecipe : undefined}
            onAssignDessert={currentPlan ? handleSetDessert : undefined}
            defaultPortions={familyPortions(familyMembers)}
            favoriteNames={favorites.map((f) => f.meal_name)}
            familyDislikes={profile?.family_dislikes}
            onFamilyDislike={handleFamilyDislike}
            onDislikeHint={(hint) => setDislikeHint({ ...hint, phase: 'ask' })}
            onRecipesChanged={() => {
              loadPlanMeals();
              getFavorites().then(setFavorites).catch(() => {});
            }}
          />
        ) : activeTab === 'favoriten' ? (
          <FavoritesView
            favorites={favorites}
            ratings={mealRatings}
            defaultPortions={familyPortions(familyMembers)}
            onSetTurnus={async (id, weeks) => {
              const next = await setFavoriteTurnus(id, weeks);
              if (next) setFavorites(next);
            }}
            onRemove={async (id) => {
              const next = await removeFavorite(id);
              if (next) setFavorites(next);
            }}
            onFavoritesChange={setFavorites}
          />
        ) : (
          <SettingsView
            profile={profile}
            familyMembers={familyMembers}
            routines={routines}
            onUpdateProfile={handleUpdateProfile}
            onAddFamilyMember={handleAddFamilyMember}
            onUpdateFamilyMember={handleUpdateFamilyMember}
            onDeleteFamilyMember={handleDeleteFamilyMember}
            onCreateRoutine={handleCreateRoutine}
            onDeleteRoutine={handleDeleteRoutine}
            onReminderTimeChange={(time) => setProfile((p) => (p ? { ...p, reminder_time: time } : p))}
            onProfileChange={setProfile}
          />
        )}
      </main>

      <div className="sm:hidden">
        <TabSwitcher variant="bottom" activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Nach „Ausblenden“: kurz rückgängig machbar; role=status, damit Screenreader es ansagen */}
      <div role="status" className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6 z-40 flex flex-col items-center gap-2 pointer-events-none">
        {dislikeHint && (
          <div className="pointer-events-auto w-full max-w-md p-4 rounded-2xl bg-white text-gray-800 shadow-lg border border-brand-200">
            {dislikeHint.phase === 'done' ? (
              <p className="text-sm">
                {dislikeHint.label} kommt nicht mehr in den Plan. Zurücknehmen unter Einstellungen → Gesundheit &amp; Ernährung.
              </p>
            ) : (
              <>
                <p className="text-sm font-semibold">{dislikeHint.label} ganz weglassen?</p>
                <p className="mt-1 text-sm text-gray-600">
                  Ihr habt schon {dislikeHint.count} Gerichte mit {dislikeHint.label} ausgeblendet.
                </p>
                {dislikeHint.phase === 'error' && (
                  <p className="mt-1 text-sm text-red-700">Die Einstellung konnte nicht gespeichert werden. Bitte noch einmal versuchen.</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={acceptDislikeHint}
                    disabled={dislikeHint.phase === 'saving'}
                    className="h-10 px-4 rounded-xl text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-60"
                  >
                    {dislikeHint.label} weglassen
                  </button>
                  <button
                    onClick={() => setDislikeHint(null)}
                    className="h-10 px-4 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Nein, danke
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {undoReject && (
          <div className="pointer-events-auto w-full max-w-md flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl bg-gray-800 text-white shadow-lg">
            <p className="flex-1 min-w-0 text-sm">
              <span className="line-clamp-2">„{undoReject.name}“ ausgeblendet – kommt nicht mehr in den Plan.</span>
            </p>
            <button
              onClick={handleUndoReject}
              className="flex-shrink-0 h-10 px-3 rounded-xl text-sm font-semibold text-coral-300 hover:bg-white/10"
            >
              Rückgängig
            </button>
          </div>
        )}
      </div>

      {rateRequest && profile && (
        <MealRatingModal
          mealName={rateRequest}
          currentRating={mealRatings[rateRequest]}
          currentNotes={ratingNotes[rateRequest]?.notes ?? ''}
          onSave={async (rating, notes) => {
            await handleRateMeal(rateRequest, rating, notes);
            setRateRequest(null);
          }}
          onClose={() => setRateRequest(null)}
        />
      )}

      {showPlanModal && (
        <PlanCreationModal onCreate={requestCreatePlan} onClose={() => setShowPlanModal(false)} />
      )}

      {pendingPlan && currentPlan && (
        <ReplacePlanDialog
          plan={currentPlan}
          meals={planMeals}
          portions={familyPortions(familyMembers)}
          confirmLabel="Neuen Plan erstellen"
          onConfirm={() => handleCreatePlan(pendingPlan.start, pendingPlan.end)}
          onExtend={() => handleExtendPlan(pendingPlan.start, pendingPlan.end)}
          onClose={() => setPendingPlan(null)}
        />
      )}
    </div>
    </RatingsContext.Provider>
  );
}
