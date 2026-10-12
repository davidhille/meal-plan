import { Profile, FamilyMember, MealRating, MealPlan, PlanMeal, Routine } from '../types';

// Alle Daten laufen über die Cloudflare-Functions unter /api (→ Neon).
// Das Familien-Passwort wird im Browser gemerkt und bei jeder Anfrage mitgeschickt.

const PW_KEY = 'mealplan-password';

export function getPassword(): string {
  try {
    return localStorage.getItem(PW_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setPassword(pw: string) {
  try {
    localStorage.setItem(PW_KEY, pw);
  } catch {
    /* ignore */
  }
}

export class UnauthorizedError extends Error {}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Password': getPassword(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) throw new UnauthorizedError();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

/** Wirft UnauthorizedError, damit die App den Passwort-Dialog zeigen kann */
export async function getOrCreateProfile(): Promise<Profile | null> {
  try {
    return await request<Profile>('GET', '/profile');
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    console.error('Error with profile:', error);
    return null;
  }
}

export async function updateProfile(
  _profileId: string,
  goal: string,
  conditions: string[]
): Promise<Profile | null> {
  try {
    return await request<Profile>('PUT', '/profile', { health_goal: goal, health_conditions: conditions });
  } catch (error) {
    console.error('Error updating profile:', error);
    return null;
  }
}

export async function getFamilyMembers(_profileId: string): Promise<FamilyMember[]> {
  try {
    return await request<FamilyMember[]>('GET', '/family');
  } catch (error) {
    console.error('Error fetching family members:', error);
    return [];
  }
}

export async function addFamilyMember(
  _profileId: string,
  member: Omit<FamilyMember, 'id' | 'profile_id' | 'created_at'>
): Promise<FamilyMember | null> {
  try {
    return await request<FamilyMember>('POST', '/family', member);
  } catch (error) {
    console.error('Error adding family member:', error);
    return null;
  }
}

export async function deleteFamilyMember(id: string): Promise<boolean> {
  try {
    await request('DELETE', `/family/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting family member:', error);
    return false;
  }
}

export async function getMealRatings(_profileId: string): Promise<Record<string, number>> {
  try {
    return await request<Record<string, number>>('GET', '/ratings');
  } catch (error) {
    console.error('Error fetching meal ratings:', error);
    return {};
  }
}

export async function addMealRating(
  _profileId: string,
  mealName: string,
  rating: number,
  notes: string
): Promise<MealRating | null> {
  try {
    return await request<MealRating>('PUT', '/ratings', { meal_name: mealName, rating, notes });
  } catch (error) {
    console.error('Error adding meal rating:', error);
    return null;
  }
}

export async function getRoutines(_profileId: string): Promise<Routine[]> {
  try {
    return await request<Routine[]>('GET', '/routines');
  } catch (error) {
    console.error('Error fetching routines:', error);
    return [];
  }
}

export async function createRoutine(
  _profileId: string,
  name: string,
  frequency: 'weekly' | 'monthly',
  dayOfWeek: number | null,
  time: string | null,
  durationDays: number
): Promise<Routine | null> {
  try {
    return await request<Routine>('POST', '/routines', {
      name,
      frequency,
      day_of_week: dayOfWeek,
      time,
      duration_days: durationDays,
    });
  } catch (error) {
    console.error('Error creating routine:', error);
    return null;
  }
}

export async function deleteRoutine(routineId: string): Promise<boolean> {
  try {
    await request('DELETE', `/routines/${routineId}`);
    return true;
  } catch (error) {
    console.error('Error deleting routine:', error);
    return false;
  }
}

export async function createMealPlan(
  _profileId: string,
  startDate: string,
  endDate: string
): Promise<MealPlan | null> {
  try {
    return await request<MealPlan>('POST', '/plans', { startDate, endDate });
  } catch (error) {
    console.error('Error creating meal plan:', error);
    return null;
  }
}

export async function getLatestPlan(): Promise<MealPlan | null> {
  try {
    return await request<MealPlan | null>('GET', '/plans/latest');
  } catch (error) {
    console.error('Error fetching latest plan:', error);
    return null;
  }
}

export async function deletePlan(planId: string): Promise<{ ok: boolean; latest: MealPlan | null }> {
  try {
    return await request<{ ok: boolean; latest: MealPlan | null }>('DELETE', `/plans/${planId}`);
  } catch (error) {
    console.error('Error deleting plan:', error);
    return { ok: false, latest: null };
  }
}

export async function getPlanMeals(planId: string): Promise<PlanMeal[]> {
  try {
    return await request<PlanMeal[]>('GET', `/plans/${planId}/meals`);
  } catch (error) {
    console.error('Error fetching plan meals:', error);
    return [];
  }
}

export async function rejectMeal(
  _profileId: string,
  planMealId: string,
  _mealName: string
): Promise<PlanMeal | null> {
  try {
    const result = await request<{ replacement: PlanMeal }>('POST', `/plan-meals/${planMealId}/reject`);
    return result.replacement;
  } catch (error) {
    console.error('Error rejecting meal:', error);
    return null;
  }
}

export async function generateMealImage(
  mealName: string,
  planMealId?: string
): Promise<string | null> {
  try {
    // Cache zuerst prüfen
    const cached = await request<{ imageUrl: string | null }>(
      'GET',
      `/meal-images?name=${encodeURIComponent(mealName)}`
    );
    if (cached.imageUrl) return cached.imageUrl;

    // Bild im Browser über Puter.js erzeugen (kostenlos, kein API-Key)
    const prompt = `Professional food photography of ${mealName}, German home-cooked dish, warm lighting, plated on white ceramic, top-down angle, appetizing, high quality`;
    const imgElement = await puter.ai.txt2img(prompt, {
      model: 'black-forest-labs/flux-schnell',
    });
    const imageUrl = imgElement.src;
    if (!imageUrl) return null;

    await request('PUT', '/meal-images', {
      meal_name: mealName,
      image_url: imageUrl,
      plan_meal_id: planMealId,
    });
    return imageUrl;
  } catch (error) {
    console.error('Error generating meal image:', error);
    return null;
  }
}
