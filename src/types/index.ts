export type MealType = 'vegetarisch' | 'fleisch' | 'wochenende';

export type ViewTab = 'speiseplan' | 'einkaufsliste' | 'rezepte' | 'favoriten' | 'einstellungen';

/** Gericht aus der Rezept-Übersicht (alles, was geplant werden kann) */
export interface CatalogRecipe {
  name: string;
  type: MealType;
  ingredients: string[];
  instructions: string;
  durationMin: number | null;
  imageUrl: string | null;
  imageCredit: ImageCredit | null;
  /** basis = feste Sammlung, ki = KI-Rezept, import = aus dem Web, favorit = eigener Favorit */
  origin: 'basis' | 'ki' | 'import' | 'favorit';
  /** Gericht der Grundsammlung, das bearbeitet wurde (lässt sich auf das Original zurücksetzen) */
  edited?: boolean;
  /** Passt nicht zu den Gesundheitseinstellungen – wird nie automatisch geplant */
  unsuitable?: boolean;
  /** Von der Chefkoch-Automatik übernommen, noch nicht geprüft („Neu“) */
  review?: boolean;
}

/** Änderbare Angaben eines Gerichts (Mengen für 4 Portionen) */
export interface RecipeDraft {
  name: string;
  type: MealType;
  durationMin: number | null;
  ingredients: string[];
  instructions: string;
}

/** Eigener Filter für die Rezept-Übersicht (in den Einstellungen angelegt) */
export interface RecipeFilter {
  id: string;
  name: string;
  scope: 'gerichte' | 'nachtische' | 'beide';
  /** Treffer, wenn einer der Begriffe im Namen oder in den Zutaten vorkommt */
  keywords: string[];
  /** Höchstens so viele Minuten Zubereitung */
  maxMinutes: number | null;
  /** Von Hand zugeordnet: immer dabei */
  includeNames: string[];
  /** Von Hand ausgenommen: nie dabei, auch wenn ein Begriff passt */
  excludeNames: string[];
}

/** Angaben eines Filters, die in den Einstellungen bearbeitet werden */
export type RecipeFilterInput = Pick<RecipeFilter, 'name' | 'scope' | 'keywords' | 'maxMinutes'> & { id?: string };

export interface RecipeCatalog {
  recipes: CatalogRecipe[];
  /** Ausgeblendete bzw. abgelehnte Gerichte */
  hidden: string[];
  /** Gesundheitseinstellungen des Profils (z. B. gluten_free) – erklären, warum Gerichte unpassend sind */
  healthConditions?: string[];
}

export type DessertCategory = 'kuchen' | 'gebaeck' | 'creme' | 'pfanne' | 'obst' | 'eis';

/** Nachtisch aus der festen Sammlung (src/data/desserts.ts) */
export interface Dessert {
  name: string;
  category: DessertCategory;
  /** Ergibt z. B. „1 Kuchen (12 Stücke)“ – Mengen werden nicht umgerechnet */
  yield: string;
  durationMin: number;
  ingredients: string[];
  instructions: string;
  /** Foto aus TheMealDB; fehlt es, gibt es ein generiertes Bild unter /api/images/<Name> (siehe lib/desserts.ts) */
  imageUrl?: string;
  /** Eigener Nachtisch (Datenbank, z. B. von Chefkoch oder aus einem Hauptgericht) */
  custom?: boolean;
  sourceUrl?: string | null;
}

export type FamilyMemberType = 'adult' | 'child';

export type HealthGoal = 'weight_loss' | 'muscle_gain' | 'balanced' | 'healthy_lifestyle';

export type PlanFrequency = 'weekly' | 'monthly';

export type PlanDurationType = 'next_day' | 'next_week' | 'next_month' | 'custom';

export interface Meal {
  day: string;
  dayShort: string;
  meal: string;
  description: string;
  type: MealType;
  ingredients: string[];
  instructions: string;
  imageUrl?: string;
  /** Zubereitungszeit in Minuten (falls bekannt) */
  durationMin?: number | null;
  /** Quellenangabe, wenn das Bild ein Foto aus einer Bilddatenbank ist (Pexels, Pixabay, Openverse) */
  imageCredit?: ImageCredit | null;
}

export interface ImageCredit {
  name: string;
  url: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  /** Zutat ohne Menge (für die Shop-Suche und gemerkte Zuordnungen) */
  baseName: string;
  checked: boolean;
  label: string;
  isBasic?: boolean;
  /** Verknüpftes Produkt im Shop der Liste (Knuspr/Picnic) */
  productId?: string;
  productName?: string;
  productImage?: string;
  /** Preis pro Packung beim Verknüpfen (Momentaufnahme) */
  productPrice?: number;
  productAmount?: string;
  /** Verknüpfte Produkte in allen Shops (für den Preisvergleich) */
  links?: Partial<Record<ShopProvider, ProductLink>>;
}

export interface ProductLink {
  productId: string;
  productName: string;
  productImage?: string;
  productPrice?: number;
  productAmount?: string;
}

/** Mindestbestellwert und Liefergebühr eines Shops */
export interface ShopRule {
  minOrder: number;
  deliveryFee: number;
}

export interface ShoppingLabel {
  id: string;
  name: string;
  color: string;
  /** Online-Shop hinter der Liste (knuspr, picnic) */
  provider?: ShopProvider | null;
}

/** Start-Listen (fest, nicht löschbar); Knuspr/Picnic kommen erst beim Verbinden des Shops dazu */
export const DEFAULT_LABELS: ShoppingLabel[] = [
  { id: 'einkauf', name: 'Einkauf', color: '#3b82f6' },
  { id: 'metzger', name: 'Metzger', color: '#f97316' },
];

export const LABEL_COLORS = [
  '#22c55e', '#f97316', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#eab308', '#6366f1',
  '#ef4444', '#06b6d4',
];

export interface FamilyMember {
  id: string;
  profile_id: string;
  name: string;
  type: FamilyMemberType;
  age: number | null;
  disliked_foods: string[];
  favorite_foods: string[];
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  /** Alt (vor den Schwerpunkten), wird nicht mehr benutzt */
  health_goal?: HealthGoal;
  /** Ernährungs-Schwerpunkte (mehrere möglich): calorie_light, high_protein, low_carb … */
  health_focus: string[];
  health_conditions: string[];
  /** Fleisch höchstens so oft pro Kalenderwoche (null = keine Grenze) */
  meat_max_per_week: number | null;
  created_at: string;
  updated_at: string;
  /** Uhrzeit der Erinnerung zum Bewerten, z. B. „20:00“ */
  reminder_time?: string;
  /** In der Nachtisch-Sammlung ausgeblendet */
  hidden_desserts?: string[];
  /** Endgültig gelöschte Nachtische (nicht mehr unter „Ausgeblendet“) */
  deleted_desserts?: string[];
  /** Regeln pro Wochentag (Schlüssel 0–6, 0 = Sonntag): frei oder höchstens X Minuten */
  day_rules?: DayRules;
  /** „Kommt nie in den Plan“: Hauptzutaten, die die ganze Familie nicht will (z. B. „fisch“, „lamm“) */
  family_dislikes?: string[];
  /** Chefkoch-Automatik: täglich bis zu 10 neue Hauptspeisen ab 4,5 Sternen */
  chefkoch_auto?: boolean;
  /** Tag (JJJJ-MM-TT) und Anzahl der heute übernommenen Rezepte */
  chefkoch_auto_day?: string | null;
  /** Uhrzeit (HH:MM, Berliner Zeit), ab der die Automatik täglich holt */
  chefkoch_auto_time?: string;
  chefkoch_auto_count?: number;
  /** So oft pro Woche Brotzeit (feste Brotzeit-Tage zählen mit) */
  brotzeit_per_week?: number;
}

export interface DayRule {
  off?: boolean;
  /** An diesem Wochentag Brotzeit statt Kochen */
  brotzeit?: boolean;
  maxMinutes?: number;
}
export type DayRules = Partial<Record<string, DayRule>>;

/** Kommentar zu einer Bewertung */
export interface RatingNote {
  notes: string;
  updatedAt?: string;
}

export interface MealRating {
  id: string;
  profile_id: string;
  meal_name: string;
  rating: number;
  notes?: string;
  created_at: string;
}

export interface MealPlan {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'archived';
  created_at: string;
  /** Per Nur-Lese-Link geteilt */
  shared?: boolean;
}

export interface PlanMeal {
  id: string;
  plan_id: string;
  meal_date: string;
  meal_name: string;
  meal_type: MealType;
  ingredients: string[];
  instructions: string;
  image_url?: string;
  image_source?: 'ai' | 'mealdb' | 'chefkoch' | 'pexels' | 'pixabay' | 'openverse' | null;
  image_credit_name?: string | null;
  image_credit_url?: string | null;
  rejected: boolean;
  created_at: string;
  duration_min?: number | null;
  /** Nachtisch zu diesem Gericht (aus der Nachtisch-Sammlung) */
  dessert?: PlanDessert | null;
  /** Brotzeit statt Kochen (Platzhalter ohne Zutaten) */
  brotzeit?: boolean;
  /** Gäste an diesem Tag (zusätzliche Portionen) */
  guests?: number;
}

/** Am Gericht gespeicherter Nachtisch – die Zutaten landen mit fester Menge auf der Einkaufsliste */
export interface PlanDessert {
  name: string;
  ingredients: string[];
  instructions: string;
  durationMin: number | null;
  imageUrl: string | null;
  yield: string;
}

export interface Routine {
  id: string;
  profile_id: string;
  name: string;
  frequency: PlanFrequency;
  day_of_week: number | null;
  time: string | null;
  duration_days: number;
  active: boolean;
  created_at: string;
  last_run_at?: string | null;
}

export interface RejectedMeal {
  id: string;
  profile_id: string;
  meal_name: string;
  reason?: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  meal_name: string;
  meal_type: MealType;
  ingredients: string[];
  instructions: string | null;
  duration_min: number | null;
  /** null = kein Turnus, sonst alle n Wochen automatisch einplanen */
  turnus_weeks: number | null;
  last_planned: string | null;
  created_at: string;
  /** Bild des Gerichts (falls vorhanden) */
  image_url?: string | null;
}

export type ShopProvider = 'knuspr' | 'picnic';

export interface ShopState {
  labels: ShoppingLabel[];
  standardLabel: string;
  metzgerAuto: boolean;
  activeShops: ShopProvider[];
  connections: Partial<Record<ShopProvider, { email: string; since: string }>>;
  rules: Record<ShopProvider, ShopRule>;
}

/** Artikel im Knuspr-Warenkorb */
export interface CartItem {
  productId: string;
  orderFieldId?: string;
  name: string;
  /** Preis der Zeile (Menge × Stückpreis) */
  lineTotal?: number;
  quantity: number;
  price?: string;
  imageUrl?: string;
}

export interface ProductResult {
  productId: string;
  name: string;
  price?: string;
  amount?: string;
  imageUrl?: string;
}
