import { useState, useEffect } from 'react';
import { ViewTab, Profile, FamilyMember, Routine, MealPlan, PlanMeal, Favorite } from './types';
import {
  getOrCreateProfile,
  updateProfile,
  getFamilyMembers,
  addFamilyMember,
  deleteFamilyMember,
  updateFamilyMember,
  getMealRatings,
  addMealRating,
  getRoutines,
  createRoutine,
  deleteRoutine,
  createMealPlan,
  getPlanMeals,
  getLatestPlan,
  deletePlan,
  regenerateMeal,
  regeneratePlan,
  getFavorites,
  addFavorite,
  removeFavorite,
  setFavoriteTurnus,
  rejectMeal,
  getPassword,
  UnauthorizedError,
} from './lib/api';
import PasswordGate from './components/PasswordGate';
import { familyPortions } from './lib/portions';
import PlanCreationModal from './components/PlanCreationModal';
import Header from './components/Header';
import TabSwitcher from './components/TabSwitcher';
import WeekSelector from './components/WeekSelector';
import { getWeeksInRange, isDateInWeek } from './lib/dateUtils';
import FavoritesView from './components/FavoritesView';
import MealPlanView from './components/MealPlanView';
import ShoppingListView from './components/ShoppingListView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [imagePolls, setImagePolls] = useState(0);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('speiseplan');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [mealRatings, setMealRatings] = useState<Record<string, number>>({});
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null);
  const [planMeals, setPlanMeals] = useState<PlanMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

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
    let prof: Profile | null = null;
    try {
      prof = await getOrCreateProfile();
      setLocked(false);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setLocked(true);
        setLoading(false);
        return;
      }
    }
    if (prof) {
      setProfile(prof);
      const members = await getFamilyMembers(prof.id);
      setFamilyMembers(members);
      const ratings = await getMealRatings(prof.id);
      setMealRatings(ratings);
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

  const handleUpdateProfile = async (goal: string, conditions: string[]) => {
    if (!profile) return;
    const updated = await updateProfile(profile.id, goal, conditions);
    if (updated) {
      setProfile(updated);
    }
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
    if (result) {
      setMealRatings({ ...mealRatings, [mealName]: rating });
    }
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

  const favoriteNames = new Set(favorites.map((f) => f.meal_name));

  const handleToggleFavorite = async (pm: PlanMeal) => {
    const existing = favorites.find((f) => f.meal_name === pm.meal_name);
    const next = existing ? await removeFavorite(existing.id) : await addFavorite(pm.id);
    if (next) setFavorites(next);
  };



  if (locked) {
    return <PasswordGate failed={getPassword() !== ''} onSubmit={loadProfile} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Wird geladen...</p>
      </div>
    );
  }

  // KW-Auswahl (aus der Juli-Version): nur Wochen, die der Plan wirklich abdeckt
  const planWeeks = currentPlan ? getWeeksInRange(currentPlan.start_date, currentPlan.end_date) : [];
  const selectedWeek = planWeeks.find((w) => w.key === selectedWeekKey) ?? planWeeks[0];
  const visiblePlanMeals = selectedWeek
    ? planMeals.filter((m) => isDateInWeek(m.meal_date, selectedWeek))
    : planMeals;
  const showWeeks = planWeeks.length > 1 && (activeTab === 'speiseplan' || activeTab === 'einkaufsliste');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 flex flex-col">
        <Header />
        {showWeeks && (
          <WeekSelector weeks={planWeeks} selectedWeekKey={selectedWeek?.key ?? null} onSelectWeek={setSelectedWeekKey} />
        )}
        <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
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
            favoriteNames={favoriteNames}
            onToggleFavorite={handleToggleFavorite}
            plan={currentPlan}
            onDeletePlan={currentPlan ? handleDeletePlan : undefined}
            defaultPortions={familyPortions(familyMembers)}
          />
        ) : activeTab === 'einkaufsliste' ? (
          <ShoppingListView
            key={`shopping-${currentPlan?.id || 'none'}-${selectedWeek?.key ?? 'all'}`}
            plan={currentPlan}
            week={showWeeks && selectedWeek ? { from: selectedWeek.weekStart, to: selectedWeek.weekEnd } : undefined}
            onCreatePlan={() => setShowPlanModal(true)}
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
            onCreatePlan={handleCreatePlan}
          />
        )}
      </main>

      {showPlanModal && (
        <PlanCreationModal onCreate={handleCreatePlan} onClose={() => setShowPlanModal(false)} />
      )}
    </div>
  );
}
