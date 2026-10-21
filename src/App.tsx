import { useState, useEffect } from 'react';
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
  getLatestPlan,
  deletePlan,
  regenerateMeal,
  regeneratePlan,
  getFavorites,
  addFavorite,
  removeFavorite,
  setFavoriteTurnus,
  rejectMeal,
  UnauthorizedError,
  getAuthStatus,
  setMealDessert,
  replacePlanMeal,
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
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [mealRatings, setMealRatings] = useState<Record<string, number>>({});
  const [ratingNotes, setRatingNotes] = useState<Record<string, RatingNote>>({});
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null);
  const [planMeals, setPlanMeals] = useState<PlanMeal[]>([]);
  const [loading, setLoading] = useState(true);
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
  };

  const handleUpdateProfile = async (focus: string[], conditions: string[], meatMaxPerWeek: number | null) => {
    if (!profile) return;
    const updated = await updateProfile(profile.id, focus, conditions, meatMaxPerWeek);
    if (!updated) throw new Error('Die Einstellungen konnten nicht gespeichert werden.');
    setProfile(updated);
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

  const handleRejectMeal = async (planMealId: string, mealName: string) => {
    if (!profile) return;
    const replacement = await rejectMeal(profile.id, planMealId, mealName);
    if (replacement) swapMeal(planMealId, replacement);
    else setPlanMeals((prev) => prev.map((m) => (m.id === planMealId ? { ...m, rejected: true } : m)));
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
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 flex flex-col">
        <Header />
        <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
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
      <main className="flex-1 pb-8 w-full max-w-2xl mx-auto">
        {activeTab === 'speiseplan' ? (
          <MealPlanView
            key={`meals-${currentPlan?.id || 'none'}`}
            onCreatePlan={() => setShowPlanModal(true)}
            planMeals={currentPlan ? visiblePlanMeals : undefined}
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
            onCreatePlan={requestCreatePlan}
            onReminderTimeChange={(time) => setProfile((p) => (p ? { ...p, reminder_time: time } : p))}
            onProfileChange={setProfile}
          />
        )}
      </main>

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
