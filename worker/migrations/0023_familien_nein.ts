// 0023 – „Kommt nie in den Plan“: Hauptzutaten, die die ganze Familie nicht will (Fisch, Lamm …)
export default [`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_dislikes text[] NOT NULL DEFAULT '{}'`];
