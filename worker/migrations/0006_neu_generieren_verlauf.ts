// 0006 – „Neu generieren“: weggetauschte Gerichte pro Tag merken, damit sie nicht gleich wiederkommen
export default [`ALTER TABLE plan_meals ADD COLUMN IF NOT EXISTS skipped_names text[] NOT NULL DEFAULT '{}'`];
