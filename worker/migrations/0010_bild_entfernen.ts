// Bilder entfernen: Fotos, die nicht passen, kommen nicht wieder (Link bzw. „mealdb“ für das Originalfoto)
export default [`ALTER TABLE meal_images ADD COLUMN IF NOT EXISTS rejected_photos text[]`];
