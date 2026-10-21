import {
  Profile, FamilyMember, MealRating, MealPlan, PlanMeal, Routine, ShoppingItem, ShoppingLabel, Favorite, MealType, ImageCredit,
  ShopState, ShopProvider, ProductResult, CartItem, ShopRule, PlanDessert, Dessert, DessertCategory, RecipeCatalog, RecipeFilter, RecipeFilterInput, RecipeDraft, DayRules, RatingNote,
} from '../types';
import type { CategoryOverride } from './recipeCategories';

// Alle Daten laufen über den Cloudflare Worker unter /api (→ Neon).
// Angemeldet wird per Sitzungs-Cookie (HttpOnly, schickt der Browser selbst mit).
// Übergang: Solange es noch keine Zugänge gibt, gilt das alte Familien-Passwort (im Browser gemerkt).

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
    if (pw) localStorage.setItem(PW_KEY, pw);
    else localStorage.removeItem(PW_KEY);
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
      ...(getPassword() ? { 'X-App-Password': getPassword() } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Lesende Anfragen nicht ewig hängen lassen (Planen/KI darf länger dauern)
    signal: method === 'GET' ? AbortSignal.timeout(25000) : undefined,
  });
  if (res.status === 401) throw new UnauthorizedError();
  const data = await res.json().catch(() => ({}));
  // quota: KI-Kontingent aufgebraucht (Gratis-Tageskontingent oder Budget der Familie)
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, quota: !!data.quota });
  return data as T;
}

// ---------- Anmeldung und Zugänge ----------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  /** Betreiber der App (sieht die Administration) */
  isOwner?: boolean;
  lastLoginAt?: string | null;
}

export interface Family {
  id: string;
  name: string | null;
  disabled: boolean;
  createdAt: string;
  userCount: number;
  lastLoginAt: string | null;
  planCount: number;
  openInvites: number;
  /** Die eigene Familie (lässt sich nicht sperren/löschen) */
  own: boolean;
}

/** Einladungslink prüfen (ohne Anmeldung) */
export async function getInvite(token: string): Promise<{ valid: boolean; familyName?: string | null }> {
  return requestPublic('GET', `/auth/invite/${encodeURIComponent(token)}`);
}

/** Über den Einladungslink den ersten Zugang einer Familie anlegen (meldet direkt an) */
export async function acceptInvite(token: string, input: { name: string; email: string; password: string }): Promise<void> {
  await requestPublic('POST', `/auth/invite/${encodeURIComponent(token)}`, input);
}

// ---------- Administration (nur Betreiber) ----------

export interface InviteResult {
  families: Family[];
  inviteUrl: string;
  days: number;
}

export async function listFamilies(): Promise<Family[]> {
  return request('GET', '/admin/families');
}

export async function createFamily(name: string): Promise<InviteResult> {
  return request('POST', '/admin/families', { name });
}

export async function newFamilyInvite(id: string): Promise<InviteResult> {
  return request('POST', `/admin/families/${id}/invite`);
}

export async function updateFamily(id: string, change: { name?: string; disabled?: boolean }): Promise<Family[]> {
  return request('PUT', `/admin/families/${id}`, change);
}

export async function deleteFamily(id: string): Promise<Family[]> {
  return request('DELETE', `/admin/families/${id}`);
}

/** KI-Verbrauch der letzten 30 Tage in geschätzten Neurons */
export interface AiUsage {
  today: number;
  week: number;
  month: number;
  recipes: number;
  images: number;
  recipeCalls: number;
  imageCalls: number;
}

export interface FamilyStats {
  id: string;
  name: string | null;
  disabled: boolean;
  userCount: number;
  lastActiveAt: string | null;
  planCount: number;
  meals30: number;
  ratingCount: number;
  favoriteCount: number;
  aiRecipeCount: number;
  importCount: number;
  ai: AiUsage;
  own: boolean;
}

export interface AdminStats {
  dailyLimit: number;
  /** Seit wann der KI-Verbrauch gezählt wird (null = noch nichts gezählt) */
  since: string | null;
  daily: { day: string; neurons: number }[];
  /** Was die App selbst erzeugt (Bilder per Cron) */
  automatic: AiUsage;
  families: FamilyStats[];
}

export async function getAdminStats(): Promise<AdminStats> {
  return request('GET', '/admin/stats');
}

/** Wer ist angemeldet, und gibt es überhaupt schon Zugänge? */
export async function getAuthStatus(): Promise<{ user: AuthUser | null; needsSetup: boolean }> {
  return request('GET', '/auth/status');
}

export async function login(email: string, password: string): Promise<void> {
  await requestPublic('POST', '/auth/login', { email, password });
  setPassword('');
}

/** Ersten Zugang anlegen – mit dem bisherigen Familien-Passwort als Bestätigung */
export async function setupFirstAccount(input: { familyPassword: string; name: string; email: string; password: string }): Promise<void> {
  await requestPublic('POST', '/auth/setup', input);
  setPassword('');
}

export async function logout(): Promise<void> {
  await request('POST', '/auth/logout');
}

export async function changePassword(current: string, next: string): Promise<void> {
  await request('PUT', '/auth/password', { current, next });
}

export async function listUsers(): Promise<AuthUser[]> {
  return request('GET', '/users');
}

export async function addUser(input: { name: string; email: string; password: string; isAdmin: boolean }): Promise<AuthUser[]> {
  return request('POST', '/users', input);
}

export async function resetUserPassword(id: string, password: string): Promise<AuthUser[]> {
  return request('PUT', `/users/${id}/password`, { password });
}

export async function deleteUser(id: string): Promise<AuthUser[]> {
  return request('DELETE', `/users/${id}`);
}

/** Wie request, aber ein 401 ist hier eine normale Fehlermeldung (falsches Passwort), kein „abgemeldet“ */
async function requestPublic<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

/** Wirft UnauthorizedError, damit die App die Anmeldung zeigen kann */
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
  focus: string[],
  conditions: string[],
  meatMaxPerWeek: number | null
): Promise<Profile | null> {
  try {
    return await request<Profile>('PUT', '/profile', {
      health_focus: focus,
      health_conditions: conditions,
      meat_max_per_week: meatMaxPerWeek,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return null;
  }
}

/** Nachtisch ausblenden, wieder einblenden oder endgültig löschen; liefert beide Listen. Wirft bei Fehlern. */
export function setDessertVisibility(
  name: string,
  action: 'hide' | 'show' | 'delete'
): Promise<{ hiddenDesserts: string[]; deletedDesserts: string[] }> {
  return request('PUT', '/profile/hidden-desserts', { name, hidden: action === 'hide', deleted: action === 'delete' });
}

/** Regeln pro Wochentag speichern; wirft bei Fehlern */
export function saveDayRules(dayRules: DayRules, brotzeitPerWeek?: number): Promise<Profile> {
  return request<Profile>('PUT', '/profile/day-rules', { day_rules: dayRules, brotzeit_per_week: brotzeitPerWeek });
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

/** Kommentare zu Bewertungen (nur Gerichte mit Kommentar) */
export async function getRatingNotes(): Promise<Record<string, RatingNote>> {
  try {
    return await request<Record<string, RatingNote>>('GET', '/ratings/notes');
  } catch (error) {
    console.error('Error fetching rating notes:', error);
    return {};
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

/** Laufenden Plan auf einen Zeitraum verlängern: geplante und bewusst leere Tage bleiben, nur freie Tage werden befüllt */
export async function extendMealPlan(planId: string, startDate: string, endDate: string): Promise<MealPlan> {
  return request<MealPlan>('POST', `/plans/${planId}/extend`, { startDate, endDate });
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

/** Gericht auf einen anderen Tag verschieben (tauscht, wenn dort schon eins steht); liefert ggf. den verlängerten Plan */
export function movePlanMeal(planMealId: string, date: string): Promise<{ swapped: boolean; plan?: MealPlan }> {
  return request('POST', `/plan-meals/${enc(planMealId)}/move`, { date });
}

/** Gericht aus dem Plan nehmen (Tag bleibt leer, Gericht wird nicht abgelehnt); wirft bei Fehlern */
/** Gericht im Plan durch Brotzeit ersetzen (zurück: regenerateMeal = doch kochen); wirft bei Fehlern */
export async function setPlanMealBrotzeit(planMealId: string): Promise<PlanMeal> {
  const result = await request<{ replacement: PlanMeal }>('POST', `/plan-meals/${enc(planMealId)}/brotzeit`);
  return result.replacement;
}

/** Gäste an einem Tag (zusätzliche Portionen) speichern; wirft bei Fehlern */
export async function setPlanMealGuests(planMealId: string, guests: number): Promise<number> {
  return (await request<{ guests: number }>('PUT', `/plan-meals/${enc(planMealId)}/guests`, { guests })).guests;
}

export async function removePlanMeal(planMealId: string): Promise<void> {
  await request('DELETE', `/plan-meals/${enc(planMealId)}`);
}

/** Nachtisch an ein Gericht hängen (null = entfernen); wirft bei Fehlern */
export async function setMealDessert(planMealId: string, dessert: PlanDessert | null): Promise<PlanDessert | null> {
  const result = await request<{ dessert: PlanDessert | null }>('PUT', `/plan-meals/${planMealId}/dessert`, { dessert });
  return result.dessert;
}

/** Alle planbaren Gerichte plus ausgeblendete; wirft bei Fehlern */
export async function getRecipeCatalog(): Promise<RecipeCatalog> {
  return request<RecipeCatalog>('GET', '/recipes/catalog');
}

/** Gericht ausblenden (wird nicht mehr vorgeschlagen) bzw. wieder einblenden; liefert die neue Übersicht */
export async function setRecipeHidden(name: string, hidden: boolean): Promise<RecipeCatalog> {
  return request<RecipeCatalog>('POST', hidden ? '/recipes/hide' : '/recipes/unhide', { name });
}

/** Gericht bearbeiten; liefert den (neuen) Namen und die aktualisierte Übersicht. Wirft bei Fehlern. */
export async function saveRecipeEdit(originalName: string, recipe: RecipeDraft): Promise<{ name: string; catalog: RecipeCatalog }> {
  return request('PUT', '/recipes/edit', { originalName, ...recipe });
}

/** KI-Rezept nach Wunsch (nur Vorschau, nicht gespeichert). Wirft mit Klartext-Meldung. */
export async function previewAiRecipe(wish: string, type: MealType | null): Promise<RecipeDraft> {
  const r = await request<{ recipe: RecipeDraft }>('POST', '/recipes/ai-preview', { wish, type });
  return r.recipe;
}

/** Vorschau in die Sammlung übernehmen (auf Wunsch als Favorit); liefert Namen und neue Übersicht */
export async function saveAiRecipe(recipe: RecipeDraft, favorite: boolean): Promise<{ name: string; catalog: RecipeCatalog }> {
  return request('POST', '/recipes/ai-save', { recipe, favorite });
}

/** Bearbeitetes Gericht der Grundsammlung auf das Original zurücksetzen. Wirft bei Fehlern. */
export async function resetRecipeEdit(name: string): Promise<{ name: string; catalog: RecipeCatalog }> {
  return request('POST', '/recipes/reset', { name });
}

/** Gericht endgültig löschen (eigene/KI-Rezepte aus der Datenbank, Grundsammlung dauerhaft ausgeschlossen) */
export async function deleteRecipe(name: string): Promise<RecipeCatalog> {
  return request<RecipeCatalog>('POST', '/recipes/delete', { name });
}

/** Gericht im Plan durch ein bestimmtes Rezept ersetzen; wirft bei Fehlern */
export async function replacePlanMeal(planMealId: string, recipeName: string): Promise<PlanMeal> {
  const result = await request<{ replacement: PlanMeal }>('POST', `/plan-meals/${planMealId}/replace`, { name: recipeName });
  return result.replacement;
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
  force = false,
  /** Gemeinsames Bild für alle Familien (Nachtische der Sammlung); sonst gilt „Neues Bild“ nur für die eigene Familie */
  shared = false
): Promise<{ url: string; credit: ImageCredit | null }> {
  const r = await request<{ imageUrl: string; source?: string; creditName?: string; creditUrl?: string }>(
    'POST',
    '/meal-images/generate',
    { mealName, force, shared }
  );
  const credit = r.source && r.source !== 'ai' && r.creditName && r.creditUrl ? { name: r.creditName, url: r.creditUrl } : null;
  return { url: r.imageUrl, credit };
}

/** Unpassendes Bild entfernen: das Gericht hat dann kein Bild, dieses Foto kommt nicht wieder */
export async function removeMealImage(mealName: string): Promise<void> {
  await request('POST', '/meal-images/remove', { mealName });
}

// ---------- Einkaufsliste ----------

export interface PantryEntry {
  name: string;
  needed: boolean;
  kind: 'default' | 'custom' | 'plan';
}

export interface ShoppingData {
  labels: ShoppingLabel[];
  items: ShoppingItem[];
  /** Vorrat: Standard-Einträge, eigene und vom Plan gebrauchte (needed = gelb markiert) */
  pantry: PantryEntry[];
  portions: number;
  standardLabel: string;
  /** Mindestbestellwert und Liefergebühr je Shop */
  shopRules?: Record<ShopProvider, ShopRule>;
}

/** Warenkorb mit Summe (total = null, wenn der Shop keine Preise liefert) */
export interface CartSummary {
  items: CartItem[];
  total: number | null;
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

/** Mehrere eigene Artikel auf einmal (z. B. alle Zutaten eines Nachtischs); wirft bei Fehlern */
export async function addShoppingItems(planId: string, names: string[], label = 'knuspr'): Promise<void> {
  await request<ShoppingData>('POST', `/plans/${planId}/shopping`, { names, label });
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

/** Alle Einkaufslisten (Labels); wirft bei Fehlern */
export async function getLabels(): Promise<ShoppingLabel[]> {
  return request<ShoppingLabel[]>('GET', '/labels');
}

// ---------- Eigene Rezept-Filter (werfen bei Fehlern) ----------

export async function getRecipeFilters(): Promise<RecipeFilter[]> {
  return request<RecipeFilter[]>('GET', '/recipe-filters');
}

export async function saveRecipeFilter(filter: RecipeFilterInput): Promise<RecipeFilter[]> {
  const { id, ...data } = filter;
  return id
    ? request<RecipeFilter[]>('PUT', `/recipe-filters/${enc(id)}`, data)
    : request<RecipeFilter[]>('POST', '/recipe-filters', data);
}

/** Gericht von Hand einem Filter zuordnen (include), ausnehmen (exclude) oder wieder den Regeln überlassen (auto) */
export async function assignRecipeFilter(filterId: string, name: string, state: 'include' | 'exclude' | 'auto'): Promise<RecipeFilter[]> {
  return request<RecipeFilter[]>('POST', `/recipe-filters/${enc(filterId)}/assign`, { name, state });
}

export async function deleteRecipeFilter(id: string): Promise<RecipeFilter[]> {
  return request<RecipeFilter[]>('DELETE', `/recipe-filters/${enc(id)}`);
}

// ---------- Speiseart/Hauptzutat korrigieren (werfen bei Fehlern) ----------

export async function getCategoryOverrides(): Promise<CategoryOverride[]> {
  return request<CategoryOverride[]>('GET', '/category-overrides');
}

/** Gericht einer Kategorie zuordnen (include), ausnehmen (exclude) oder wieder der Erkennung überlassen (auto) */
export async function setCategoryOverride(name: string, categoryId: string, state: 'include' | 'exclude' | 'auto'): Promise<CategoryOverride[]> {
  return request<CategoryOverride[]>('POST', '/category-overrides', { name, categoryId, state });
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
      price: product.price,
      amount: product.amount,
    });
    return true;
  } catch (error) {
    console.error('Error saving product link:', error);
    return false;
  }
}

export function addToShopCart(
  provider: ShopProvider,
  items: { productId: string; quantity: number }[]
): Promise<{ added: number; failed: string[] }> {
  return shopRequest('POST', `/shops/${provider}/cart`, { items });
}

/** Menge im Warenkorb ändern (0 = entfernen); liefert den neuen Warenkorb */
export function setShopCartQuantity(provider: ShopProvider, productId: string, quantity: number): Promise<CartSummary> {
  return shopRequest<CartSummary>('PATCH', `/shops/${provider}/cart`, { productId, quantity });
}

/** Warenkorb leeren; liefert, was übrig bleibt (normalerweise nichts) */
export function clearShopCart(provider: ShopProvider): Promise<CartSummary> {
  return shopRequest<CartSummary>('DELETE', `/shops/${provider}/cart`);
}

/** Inhalt des Warenkorbs; wirft bei Fehlern (z. B. not_connected) */
export function getShopCart(provider: ShopProvider): Promise<CartSummary> {
  return shopRequest<CartSummary>('GET', `/shops/${provider}/cart`);
}

/** Preise der verknüpften Produkte frisch beim Shop abfragen (höchstens 40 Zutaten) */
export function refreshShopPrices(provider: ShopProvider, names: string[]): Promise<{ updated: number; missing: string[] }> {
  return shopRequest('POST', `/shops/${provider}/prices`, { names });
}

/** Mindestbestellwert und Liefergebühr eines Shops speichern */
export function saveShopRule(provider: ShopProvider, minOrder: number, deliveryFee: number): Promise<ShopState> {
  return shopRequest<ShopState>('PUT', `/shops/${provider}/rules`, { minOrder, deliveryFee });
}

/** Verknüpftes Produkt einer Zutat wieder lösen */
export async function removeProductLink(name: string, provider: ShopProvider): Promise<void> {
  await request('DELETE', `/product-links?name=${enc(name)}&provider=${enc(provider)}`);
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

/** Rezept in den Rezept-Pool speichern, optional zusätzlich als Favorit (imageUrl: Foto der Quelle übernehmen) */
export async function saveImportedRecipe(
  recipe: Omit<ImportedRecipe, 'sourcePortions'> & { imageUrl?: string | null },
  favorite: boolean
): Promise<Favorite[]> {
  const result = await request<{ favorites: Favorite[] }>('POST', '/recipes', { ...recipe, favorite });
  return result.favorites;
}

// ---------- Chefkoch-Suche – werfen mit Klartext-Meldung ----------

export interface ChefkochFilters {
  main?: boolean;
  dessert?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  maxMinutes?: number | null;
  topRated?: boolean;
  sort?: 'relevance' | 'rating' | 'new';
}

export interface ChefkochHit {
  url: string;
  name: string;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  durationMin: number | null;
  type: MealType | null;
}

export interface ChefkochDetails {
  recipe: ImportedRecipe;
  imageUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  tags: string[];
  /** Zutaten in Originalmenge (für Nachtische) */
  originalIngredients: string[];
  /** Menge laut Quelle, z. B. „1 Kuchen“ */
  yieldText: string | null;
  /** Passt nicht zu den Gesundheitseinstellungen (Allergien, vegetarisch …) */
  unsuitable: boolean;
}

// ---------- Eigene Nachtische – werfen mit Klartext-Meldung ----------

export interface DessertInput {
  name: string;
  category: DessertCategory;
  yield: string;
  durationMin: number | null;
  ingredients: string[];
  instructions: string;
  sourceUrl?: string | null;
}

export function getCustomDesserts(): Promise<Dessert[]> {
  return request<Dessert[]>('GET', '/desserts/custom');
}

/** Eigenen Nachtisch speichern (imageUrl: Chefkoch-Foto übernehmen); liefert alle eigenen Nachtische */
export function saveCustomDessert(d: DessertInput & { imageUrl?: string | null }): Promise<Dessert[]> {
  return request<Dessert[]>('POST', '/desserts/custom', d);
}

/** Hauptgericht `from` zum Nachtisch machen (wird bei den Hauptgerichten gelöscht, Bild bleibt) */
export function moveRecipeToDessert(from: string, d: DessertInput): Promise<{ catalog: RecipeCatalog; desserts: Dessert[] }> {
  return request('POST', '/recipes/to-dessert', { ...d, from });
}

/** Position für „Mehr laden“ (null = keine weiteren Treffer) */
export interface ChefkochCursor {
  page: number;
  index: number;
}

export function searchChefkoch(
  query: string,
  filters: ChefkochFilters,
  cursor?: ChefkochCursor
): Promise<{ hits: ChefkochHit[]; next: ChefkochCursor | null }> {
  return request('POST', '/recipes/chefkoch/search', { query, filters, cursor });
}

export function previewChefkoch(url: string): Promise<ChefkochDetails> {
  return request<ChefkochDetails>('POST', '/recipes/chefkoch/preview', { url });
}

// ---------- Erinnerung zum Bewerten (Push) – werfen bei Fehlern ----------

export interface PushState {
  /** VAPID-Schlüssel für pushManager.subscribe */
  publicKey: string;
  /** Uhrzeit der Erinnerung, z. B. „20:00“ */
  reminderTime: string;
  /** Angemeldete Geräte (Push-Adressen) */
  endpoints: string[];
}

export function getPushState(): Promise<PushState> {
  return request<PushState>('GET', '/push');
}

export function subscribePush(subscription: PushSubscriptionJSON, label: string): Promise<PushState> {
  return request<PushState>('POST', '/push/subscribe', { subscription, label });
}

export function unsubscribePush(endpoint: string): Promise<PushState> {
  return request<PushState>('POST', '/push/unsubscribe', { endpoint });
}

export function saveReminderTime(reminderTime: string): Promise<PushState> {
  return request<PushState>('PUT', '/push/settings', { reminderTime });
}

export function sendTestPush(endpoint: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('POST', '/push/test', { endpoint });
}

/** Ist der Fehler „KI-Kontingent aufgebraucht“? */
export const isQuotaError = (e: unknown) => !!(e as { quota?: boolean } | null)?.quota;

/** Aus einem KI-Wunsch einen Suchbegriff für Chefkoch machen („etwas mit Kürbis, schnell“ → „Kürbis schnell“) */
export function wishToQuery(wish: string): string {
  return wish
    .replace(/\b(etwas|was|irgendwas|gerne|bitte|ein|eine|einen|mit|ohne viel|für|die|der|das|und)\b/gi, ' ')
    .replace(/[,.;!?&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

// ---------- Plan teilen ----------

/** Nur-Lese-Link für den Plan erzeugen (ein früherer Link wird ungültig) */
export async function sharePlan(planId: string): Promise<string> {
  return (await request<{ url: string }>('POST', `/plans/${enc(planId)}/share`)).url;
}

/** Geteilten Link zurückziehen */
export async function unsharePlan(planId: string): Promise<void> {
  await request('DELETE', `/plans/${enc(planId)}/share`);
}

export interface SharedPlan {
  family: string | null;
  startDate: string;
  endDate: string;
  meals: {
    date: string;
    name: string;
    type: MealType;
    durationMin: number | null;
    ingredients: string[];
    instructions: string;
    brotzeit: boolean;
    dessert: string | null;
    imageUrl: string | null;
  }[];
}

/** Geteilten Plan ohne Anmeldung lesen */
export async function getSharedPlan(token: string): Promise<SharedPlan> {
  return requestPublic('GET', `/share/${encodeURIComponent(token)}`);
}
