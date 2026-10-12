import {
  Profile, FamilyMember, MealRating, MealPlan, PlanMeal, Routine, ShoppingItem, ShoppingLabel, Favorite, MealType, ImageCredit,
  ShopState, ShopProvider, ProductResult,
} from '../types';

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
    // Lesende Anfragen nicht ewig hängen lassen (Planen/KI darf länger dauern)
    signal: method === 'GET' ? AbortSignal.timeout(25000) : undefined,
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

export async function updateFamilyMember(
  id: string,
  member: Omit<FamilyMember, 'id' | 'profile_id' | 'created_at'>
): Promise<FamilyMember | null> {
  try {
    return await request<FamilyMember>('PUT', `/family/${id}`, member);
  } catch (error) {
    console.error('Error updating family member:', error);
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

/** Gericht nur austauschen (ohne es auszuschließen) */
export async function regenerateMeal(planMealId: string): Promise<PlanMeal | null> {
  try {
    const result = await request<{ replacement: PlanMeal }>('POST', `/plan-meals/${planMealId}/regenerate`);
    return result.replacement;
  } catch (error) {
    console.error('Error regenerating meal:', error);
    return null;
  }
}

/** Kompletten Plan für denselben Zeitraum neu erstellen (ersetzt den alten) */
export async function regeneratePlan(planId: string): Promise<MealPlan | null> {
  try {
    return await request<MealPlan>('POST', `/plans/${planId}/regenerate`);
  } catch (error) {
    console.error('Error regenerating plan:', error);
    return null;
  }
}

// ---------- Favoriten ----------

export async function getFavorites(): Promise<Favorite[]> {
  try {
    return await request<Favorite[]>('GET', '/favorites');
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }
}

export async function addFavorite(planMealId: string): Promise<Favorite[] | null> {
  try {
    return await request<Favorite[]>('POST', '/favorites', { planMealId });
  } catch (error) {
    console.error('Error adding favorite:', error);
    return null;
  }
}

export async function removeFavorite(id: string): Promise<Favorite[] | null> {
  try {
    return await request<Favorite[]>('DELETE', `/favorites/${id}`);
  } catch (error) {
    console.error('Error removing favorite:', error);
    return null;
  }
}

export async function setFavoriteTurnus(id: string, weeks: number | null): Promise<Favorite[] | null> {
  try {
    return await request<Favorite[]>('PATCH', `/favorites/${id}`, { turnus_weeks: weeks });
  } catch (error) {
    console.error('Error updating favorite:', error);
    return null;
  }
}

/** Bild über den Server erzeugen (Cloudflare Workers AI). force = neues Bild statt vorhandenem.
 *  Wirft mit verständlicher Meldung, z. B. wenn das Tageskontingent aufgebraucht ist. */
export async function generateMealImage(
  mealName: string,
  force = false
): Promise<{ url: string; credit: ImageCredit | null }> {
  const r = await request<{ imageUrl: string; source?: string; creditName?: string; creditUrl?: string }>(
    'POST',
    '/meal-images/generate',
    { mealName, force }
  );
  const credit = r.source && r.source !== 'ai' && r.creditName && r.creditUrl ? { name: r.creditName, url: r.creditUrl } : null;
  return { url: r.imageUrl, credit };
}

// ---------- Einkaufsliste ----------

export interface ShoppingData {
  labels: ShoppingLabel[];
  items: ShoppingItem[];
  pantryNeeded: string[];
  /** Eigene Vorrats-Zutaten („In Basics legen“) */
  customPantry: string[];
  portions: number;
  standardLabel: string;
}

const enc = encodeURIComponent;

export interface WeekRange {
  from: string;
  to: string;
}

const weekQuery = (week?: WeekRange) => (week ? `?from=${week.from}&to=${week.to}` : '');

export async function getShopping(planId: string, week?: WeekRange): Promise<ShoppingData | null> {
  try {
    return await request<ShoppingData>('GET', `/plans/${planId}/shopping${weekQuery(week)}`);
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    return null;
  }
}

export async function updateShoppingItem(
  planId: string,
  item: ShoppingItem,
  change: { checked?: boolean; label?: string }
): Promise<boolean> {
  try {
    await request('PATCH', `/plans/${planId}/shopping/${enc(item.id)}`, {
      ...change,
      baseName: item.baseName,
      isBasic: item.isBasic,
    });
    return true;
  } catch (error) {
    console.error('Error updating shopping item:', error);
    return false;
  }
}

export async function addShoppingItem(
  planId: string,
  name: string,
  label: string,
  isBasic = false,
  week?: WeekRange
): Promise<ShoppingData | null> {
  try {
    return await request<ShoppingData>('POST', `/plans/${planId}/shopping${weekQuery(week)}`, { name, label, isBasic });
  } catch (error) {
    console.error('Error adding shopping item:', error);
    return null;
  }
}

export async function removeShoppingItem(planId: string, itemId: string): Promise<boolean> {
  try {
    await request('DELETE', `/plans/${planId}/shopping/${enc(itemId)}`);
    return true;
  } catch (error) {
    console.error('Error removing shopping item:', error);
    return false;
  }
}

export async function createLabel(name: string, color: string): Promise<ShoppingLabel[] | null> {
  try {
    return await request<ShoppingLabel[]>('POST', '/labels', { name, color });
  } catch (error) {
    console.error('Error creating label:', error);
    return null;
  }
}

export async function updateLabel(labelId: string, name: string, color: string): Promise<ShoppingLabel[] | null> {
  try {
    return await request<ShoppingLabel[]>('PUT', `/labels/${enc(labelId)}`, { name, color });
  } catch (error) {
    console.error('Error updating label:', error);
    return null;
  }
}

/** Zutat dauerhaft in den Vorrat legen – taucht dann nicht mehr auf der Liste auf */
export async function addToPantry(name: string): Promise<boolean> {
  try {
    await request('POST', '/pantry', { name });
    return true;
  } catch (error) {
    console.error('Error adding to pantry:', error);
    return false;
  }
}

export async function removeFromPantry(name: string): Promise<boolean> {
  try {
    await request('DELETE', `/pantry/${enc(name)}`);
    return true;
  } catch (error) {
    console.error('Error removing from pantry:', error);
    return false;
  }
}

export async function deleteLabel(labelId: string): Promise<ShoppingLabel[] | null> {
  try {
    return await request<ShoppingLabel[]>('DELETE', `/labels/${enc(labelId)}`);
  } catch (error) {
    console.error('Error deleting label:', error);
    return null;
  }
}

// ---------- Shops ----------

/** Fehler mit Klartext-Meldung vom Server (z. B. „Knuspr-Login fehlgeschlagen“) */
async function shopRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  return request<T>(method, path, body);
}

export async function getShopState(): Promise<ShopState | null> {
  try {
    return await shopRequest<ShopState>('GET', '/shops');
  } catch (error) {
    console.error('Error loading shops:', error);
    return null;
  }
}

export function saveShopSettings(standardLabel: string, metzgerAuto: boolean): Promise<ShopState> {
  return shopRequest<ShopState>('PUT', '/shops/settings', { standardLabel, metzgerAuto });
}

export function enableAmazon(): Promise<ShopState> {
  return shopRequest<ShopState>('POST', '/shops/amazon/enable');
}

export function disconnectShop(provider: ShopProvider): Promise<ShopState> {
  return shopRequest<ShopState>('DELETE', `/shops/${provider}`);
}

/** Knuspr: direkt verbunden. Picnic: evtl. erst SMS-Code nötig (needs2fa). */
export function connectShop(
  provider: 'knuspr' | 'picnic',
  email: string,
  password: string
): Promise<ShopState | { needs2fa: true; tempAuthKey: string; deviceId: string }> {
  return shopRequest('POST', `/shops/${provider}/connect`, { email, password });
}

export function verifyPicnic(email: string, tempAuthKey: string, deviceId: string, code: string): Promise<ShopState> {
  return shopRequest<ShopState>('POST', '/shops/picnic/verify', { email, tempAuthKey, deviceId, code });
}

export async function searchShop(provider: 'knuspr' | 'picnic', query: string): Promise<ProductResult[]> {
  const result = await shopRequest<{ results: ProductResult[] }>('POST', `/shops/${provider}/search`, { query });
  return result.results;
}

export async function saveProductLink(name: string, provider: ShopProvider, product: ProductResult): Promise<boolean> {
  try {
    await request('PUT', '/product-links', {
      name,
      provider,
      productId: product.productId,
      productName: product.name,
      imageUrl: product.imageUrl,
    });
    return true;
  } catch (error) {
    console.error('Error saving product link:', error);
    return false;
  }
}

export function addToKnusprCart(productIds: string[]): Promise<{ added: number; failed: string[] }> {
  return shopRequest('POST', '/shops/knuspr/cart', { productIds });
}

// ---------- Eigene Rezepte (Import per Link) ----------

export interface ImportedRecipe {
  name: string;
  type: MealType;
  ingredients: string[];
  instructions: string;
  durationMin?: number | null;
  sourceUrl: string;
  sourcePortions: number | null;
}

/** Rezeptseite abrufen und auslesen (noch nicht gespeichert). Wirft mit Klartext-Meldung. */
export async function previewRecipeImport(url: string): Promise<ImportedRecipe> {
  const result = await request<{ recipe: ImportedRecipe }>('POST', '/recipes/import', { url });
  return result.recipe;
}

/** Rezept in den Rezept-Pool speichern, optional zusätzlich als Favorit */
export async function saveImportedRecipe(
  recipe: Omit<ImportedRecipe, 'sourcePortions'>,
  favorite: boolean
): Promise<Favorite[]> {
  const result = await request<{ favorites: Favorite[] }>('POST', '/recipes', { ...recipe, favorite });
  return result.favorites;
}

/** Nachtische von TheMealDB als JSON-Datei herunterladen (zum Übersetzen außerhalb der App) */
export async function downloadMealDbExport(): Promise<number> {
  const res = await fetch('/api/mealdb-export', { headers: { 'X-App-Password': getPassword() } });
  if (res.status === 401) throw new Error('Passwort wurde nicht akzeptiert – bitte neu anmelden.');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Fehler ${res.status}`);
  }
  const blob = await res.blob();
  const count = JSON.parse(await blob.text()).count as number;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mealdb-nachtische.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return count;
}
