-- Meal Plan – Schema für Neon (Postgres)
-- Einmalig im Neon SQL Editor ausführen (Projekt "Meal Plan", Branch "production").
-- Ersetzt die drei Supabase-Migrationen. Kein Supabase-Auth/RLS mehr:
-- Zugriff läuft ausschließlich über die Server-Funktionen (functions/api).

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  health_goal text DEFAULT 'balanced',
  health_conditions text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('adult', 'child')),
  age integer CHECK (age IS NULL OR (age > 0 AND age <= 120)),
  disliked_foods text[] DEFAULT '{}',
  favorite_foods text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, meal_name)
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  meal_date date NOT NULL,
  meal_name text NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('vegetarisch', 'fleisch', 'wochenende')),
  ingredients text[] NOT NULL DEFAULT '{}',
  instructions text,
  rejected boolean DEFAULT false,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day_of_week integer CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  time time,
  duration_days integer NOT NULL DEFAULT 7,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rejected_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_name text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meal_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_name text NOT NULL UNIQUE,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_meals_plan_id_idx ON plan_meals (plan_id);
CREATE INDEX IF NOT EXISTS family_members_profile_id_idx ON family_members (profile_id);
