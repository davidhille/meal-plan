// Abwechslung innerhalb einer Kalenderwoche: dieselbe Hauptkomponente (Garnelen, Nudeln) nicht zu oft.
// Ergänzt die Ähnlichkeit über Namen (`isSimilarDish`, `overlapWithRecent`), die nur ähnliche Namen erkennt –
// „Gambas“, „Shrimps“ und „Garnelen“ oder „Penne“, „Tortelloni“ und „Lasagne“ haben keine gemeinsamen Wörter.
import { isoWeekKey } from "./nutrition";

/** Eine Gruppe austauschbarer Hauptkomponenten und wie oft sie pro Kalenderwoche vorkommen darf */
export interface VarietyGroup {
  id: string;
  label: string;
  /** Trifft auf den Gerichtnamen (der Name nennt die Hauptkomponente, Zutatenlisten zu viele Nebendinge) */
  re: RegExp;
  maxPerWeek: number;
}

export const VARIETY_GROUPS: VarietyGroup[] = [
  {
    id: "meeresfruechte",
    label: "Garnelen & Meeresfrüchte",
    re: /garnel|gambas|shrimp|scampi|krabbe|krevett|prawn|muschel|tintenfisch|calamari|meeresfr/i,
    maxPerWeek: 1,
  },
  {
    id: "nudeln",
    label: "Nudeln & Pasta",
    re: /nudel|pasta|spaghetti|penne|tortellini|tortelloni|lasagne|fusilli|tagliatelle|rigatoni|maccheroni|makkaroni|farfalle|linguine|ravioli|cannelloni|orecchiette|carbonara|bolognese|mie\b|udon|ramen/i,
    maxPerWeek: 2,
  },
];

/** Zu welchen Gruppen gehört das Gericht? */
export function varietyGroupsOf(name: string): VarietyGroup[] {
  return VARIETY_GROUPS.filter((g) => g.re.test(name));
}

/** Zähler je Kalenderwoche und Gruppe */
export type WeekCounts = Map<string, Map<string, number>>;

export function addToWeekCounts(counts: WeekCounts, date: string, name: string): void {
  const week = isoWeekKey(date);
  for (const g of varietyGroupsOf(name)) {
    const byGroup = counts.get(week) ?? new Map<string, number>();
    byGroup.set(g.id, (byGroup.get(g.id) ?? 0) + 1);
    counts.set(week, byGroup);
  }
}

export function weekCountsOf(meals: { date: string; name: string }[]): WeekCounts {
  const counts: WeekCounts = new Map();
  for (const m of meals) addToWeekCounts(counts, m.date, m.name);
  return counts;
}

/** Würde das Gericht an diesem Tag eine Wochen-Grenze überschreiten? */
export function exceedsWeekCap(name: string, date: string, counts: WeekCounts): boolean {
  const byGroup = counts.get(isoWeekKey(date));
  if (!byGroup) return false;
  return varietyGroupsOf(name).some((g) => (byGroup.get(g.id) ?? 0) >= g.maxPerWeek);
}
