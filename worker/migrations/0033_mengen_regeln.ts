// 0033 – Mengen-Regeln: wie oft eine Hauptkomponente (Nudeln, Fisch, Garnelen …) pro Woche oder Monat vorkommt
export default [
  // [{ "id": "nudeln", "period": "week" | "month", "min"?: n, "max"?: n }]; NULL = Standard-Regeln (worker/weekVariety.ts)
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS variety_rules jsonb`,
];
