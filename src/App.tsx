import { useState, useEffect } from 'react';
import { ViewTab, Profile, FamilyMember, Routine, MealPlan, PlanMeal } from './types';
import {
  getOrCreateProfile,
  updateProfile,
  getFamilyMembers,
  addFamilyMember,
  deleteFamilyMember,
  getMealRatings,
  addMealRating,
  getRoutines,
  createRoutine,
  deleteRoutine,
  createMealPlan,
  getPlanMeals,
  getLatestPlan,
  deletePlan,
  rejectMeal,
  getPassword,
  UnauthorizedError,
} from './lib/api';
import PasswordGate from './components/PasswordGate';
import { familyPortions } from './lib/portions';
import Header from './components/Header';
import PlanCreationModal from './components/PlanCreationModal';
import TabSwitcher from './components/TabSwitcher';
import MealPlanView from './components/MealPlanView';
import ShoppingListView from './components/ShoppingListView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [showPlanModal, setShowPlanModal] = useState(false);
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
    }
    setLoading(false);
  };

  const loadPlanMeals = async () => {
    if (!currentPlan) return;
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

  const handleRejectMeal = async (planMealId: string, mealName: string) => {
    if (!profile) return;
    // Optimistically mark as rejected
    setPlanMeals(planMeals.map((m) => (m.id === planMealId ? { ...m, rejected: true } : m)));
    // Call edge function to reject + auto-replace in background
    const replacement = await rejectMeal(profile.id, planMealId, mealName);
    if (replacement) {
      // Add the replacement meal to the list
      setPlanMeals((prev) => [...prev.filter((m) => m.id !== planMealId), replacement]);
    }
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 flex flex-col">
        <Header />
        <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Scrollable content area */}
      <main className="flex-1 pb-8">
        {activeTab === 'speiseplan' ? (
          <MealPlanView
            key={`meals-${currentPlan?.id || 'none'}`}
            onCreatePlan={() => setShowPlanModal(true)}
            planMeals={currentPlan ? planMeals : undefined}
            ratings={mealRatings}
            onRate={handleRateMeal}
            onReject={currentPlan ? handleRejectMeal : undefined}
            plan={currentPlan}
            onDeletePlan={currentPlan ? handleDeletePlan : undefined}
            defaultPortions={familyPortions(familyMembers)}
          />
        ) : activeTab === 'einkaufsliste' ? (
          <ShoppingListView
            key={`shopping-${currentPlan?.id || 'none'}`}
            plan={currentPlan}
            onCreatePlan={() => setShowPlanModal(true)}
          />
        ) : (
          <SettingsView
            profile={profile}
            familyMembers={familyMembers}
            routines={routines}
            onUpdateProfile={handleUpdateProfile}
            onAddFamilyMember={handleAddFamilyMember}
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
