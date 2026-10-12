export type MealType = 'vegetarisch' | 'fleisch' | 'wochenende';

export type ViewTab = 'speiseplan' | 'einkaufsliste' | 'einstellungen';

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
}

export interface ShoppingItem {
  id: string;
  name: string;
  /** Zutat ohne Menge (für Amazon-Suche und gemerkte Zuordnungen) */
  baseName: string;
  checked: boolean;
  label: string;
  isBasic?: boolean;
  asin?: string;
  productName?: string;
}

export interface ShoppingLabel {
  id: string;
  name: string;
  color: string;
}

export const DEFAULT_LABELS: ShoppingLabel[] = [
  { id: 'knuspr', name: 'Knuspr', color: '#22c55e' },
  { id: 'metzger', name: 'Metzger', color: '#f97316' },
];

export const LABEL_COLORS = [
  '#22c55e', '#f97316', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#eab308', '#6366f1',
  '#ef4444', '#06b6d4',
];

export const BASICS_ITEMS: string[] = [
  'Salz', 'Pfeffer', 'Zucker', 'Olivenöl', 'Sonnenblumenöl',
  'Mehl', 'Butter', 'Milch', 'Eier', 'Zwiebeln',
  'Knoblauch', 'Gemüsebrühe', 'Tomatenmark', 'Essig',
  'Sojasoße', 'Senf', 'Ketchup', 'Mayonnaise',
  'Paprikapulver', 'Oregano', 'Basilikum', 'Thymian', 'Rosmarin',
  'Cayennepfeffer', 'Kreuzkümmel', 'Kurkuma', 'Muskatnuss',
  'Petersilie', 'Dill', 'Chiliflocken', 'Worcestershiresoße',
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
  health_goal: HealthGoal;
  health_conditions: string[];
  created_at: string;
  updated_at: string;
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
  rejected: boolean;
  created_at: string;
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
