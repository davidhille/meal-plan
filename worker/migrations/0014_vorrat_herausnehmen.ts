// 0014 – Vorrat: Einträge des Standard-Vorrats herausnehmen (kommen dann bei Bedarf wieder auf die Einkaufsliste)
export default [`ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS excluded boolean NOT NULL DEFAULT false`];
