// 0001 – Grundschema: Stand vor Einführung der Migrationsdateien (alter Schema-Stand „schema:2026101207“).
// Die Live-Datenbank hat das schon und überspringt diese Migration (siehe migrate.ts).
// Eine leere Datenbank bekommt damit alle Tabellen. Alles idempotent (IF NOT EXISTS).
export default [
  `CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    health_goal text DEFAULT 'balanced',
    health_conditions text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS family_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('adult', 'child')),
    age integer CHECK (age IS NULL OR (age > 0 AND age <= 120)),
    disliked_foods text[] DEFAULT '{}',
    favorite_foods text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS meal_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    meal_name text NOT NULL,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    notes text,
    created_at timestamptz DEFAULT now(),
    UNIQUE (profile_id, meal_name)
  )`,
  `CREATE TABLE IF NOT EXISTS meal_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at timestamptz DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS plan_meals (
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
  )`,
  `CREATE TABLE IF NOT EXISTS routines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
    day_of_week integer CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
    time time,
    duration_days integer NOT NULL DEFAULT 7,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS rejected_meals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    meal_name text NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS meal_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_name text NOT NULL UNIQUE,
    image_url text NOT NULL,
    created_at timestamptz DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS plan_meals_plan_id_idx ON plan_meals (plan_id)`,
  `CREATE INDEX IF NOT EXISTS family_members_profile_id_idx ON family_members (profile_id)`,
  `ALTER TABLE routines ADD COLUMN IF NOT EXISTS last_run_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS shopping_labels (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    id text NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    sort integer NOT NULL DEFAULT 0,
    PRIMARY KEY (profile_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS ingredient_prefs (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name_key text NOT NULL,
    label text,
    asin text,
    product_name text,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, name_key)
  )`,
  `CREATE TABLE IF NOT EXISTS shopping_item_state (
    plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    item_key text NOT NULL,
    checked boolean NOT NULL DEFAULT false,
    label text,
    PRIMARY KEY (plan_id, item_key)
  )`,
  `CREATE TABLE IF NOT EXISTS shopping_extras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    name text NOT NULL,
    label text NOT NULL,
    checked boolean NOT NULL DEFAULT false,
    is_basic boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now()
  )`,
  `ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS duration_min integer`,
  `CREATE TABLE IF NOT EXISTS favorites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    meal_name text NOT NULL,
    meal_type text NOT NULL,
    ingredients text[] NOT NULL DEFAULT '{}',
    instructions text,
    duration_min integer,
    turnus_weeks integer,
    last_planned date,
    created_at timestamptz DEFAULT now(),
    UNIQUE (profile_id, meal_name)
  )`,
  `CREATE TABLE IF NOT EXISTS recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    type text NOT NULL CHECK (type IN ('vegetarisch', 'fleisch', 'wochenende')),
    ingredients text[] NOT NULL,
    instructions text NOT NULL,
    duration_min integer,
    source text NOT NULL DEFAULT 'ai',
    created_at timestamptz DEFAULT now()
  )`,
  `ALTER TABLE shopping_labels ADD COLUMN IF NOT EXISTS provider text`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS standard_label text`,
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS metzger_auto boolean NOT NULL DEFAULT true`,
  `CREATE TABLE IF NOT EXISTS shop_connections (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider text NOT NULL,
    email text NOT NULL,
    secret_enc text NOT NULL,
    secret_iv text NOT NULL,
    device_id text,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, provider)
  )`,
  `CREATE TABLE IF NOT EXISTS product_links (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name_key text NOT NULL,
    provider text NOT NULL,
    product_id text NOT NULL,
    product_name text,
    image_url text,
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, name_key, provider)
  )`,
  `CREATE TABLE IF NOT EXISTS pantry_items (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name_key text NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (profile_id, name_key)
  )`,
  `ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS dessert jsonb`,
  `CREATE TABLE IF NOT EXISTS recipe_filters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    scope text NOT NULL DEFAULT 'beide' CHECK (scope IN ('gerichte', 'nachtische', 'beide')),
    keywords text[] NOT NULL DEFAULT '{}',
    max_minutes integer,
    created_at timestamptz DEFAULT now()
  )`,
  `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_url text`,
  `ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS image_data bytea`,
  `ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS content_type text`,
  `ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`,
  `ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS source text`,
  `ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS credit_name text`,
  `ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS credit_url text`,
  `ALTER TABLE product_links ADD COLUMN IF NOT EXISTS price numeric`,
  `ALTER TABLE product_links ADD COLUMN IF NOT EXISTS amount text`,
  `CREATE TABLE IF NOT EXISTS shop_rules (
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider text NOT NULL,
    min_order numeric NOT NULL,
    delivery_fee numeric NOT NULL DEFAULT 0,
    PRIMARY KEY (profile_id, provider)
  )`,
];
