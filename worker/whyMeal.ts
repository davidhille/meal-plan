// „Warum dieses Gericht?“: kurze Gründe, warum ein Gericht zu den Einstellungen der Familie passt.
// Rein und ohne Datenbank (die Route lädt die Eingaben). Die Gründe spiegeln die Signale aus scoreMeal wider,
// zeigen aber den Stand von heute – nicht, was beim Planen den Ausschlag gab.
import { dislikeMatches, type Recipe, type ScoringContext } from "./meals";
import { focusScore } from "./nutrition";
import { ruleFor } from "./dayRules";
import { FAMILY_DISLIKE_GROUPS } from "./dislikes";

export const MAX_REASONS = 5;

const FOCUS_LABEL: Record<string, string> = {
  calorie_light: "kalorienarm",
  high_protein: "eiweißreich",
  low_carb: "wenig Kohlenhydrate",
  veggie_rich: "viel Gemüse",
  whole_grain: "Vollkorn",
  kid_friendly: "kinderfreundlich",
  seasonal: "saisonal",
  budget: "preiswert",
};

export interface WhyInput {
  meal: { name: string; type: Recipe["type"]; ingredients: string[]; durationMin?: number | null };
  /** Tag im Plan (YYYY-MM-DD), für die Regel des Wochentags */
  date: string;
  ctx: Pick<
    ScoringContext,
    "familyMembers" | "mealRatings" | "healthFocus" | "healthConditions" | "month" | "dayRules" | "familyDislikes"
  >;
  isFavorite: boolean;
  /** Tage seit dem letzten Mal im Plan der Familie (null = noch nie) */
  daysSinceLast: number | null;
}

/** „Fisch“, „Fisch und Lamm“, „Fisch, Lamm und Rind“ */
const joinList = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;

export function whyReasons({ meal, date, ctx, isFavorite, daysSinceLast }: WhyInput): string[] {
  const reasons: string[] = [];

  const noGos = (ctx.familyDislikes ?? []).map((id) => FAMILY_DISLIKE_GROUPS[id]?.label).filter((l): l is string => !!l);
  if (noGos.length) reasons.push(`Ohne ${joinList(noGos)} – so, wie ihr es festgelegt habt`);

  if (ctx.healthConditions.length) reasons.push("Passt zu euren Gesundheitseinstellungen");

  if (isFavorite) reasons.push("Ein Favorit von euch");

  const rating = ctx.mealRatings[meal.name];
  if (rating >= 4) reasons.push(`Ihr habt es mit ${rating} von 5 Sternen bewertet`);

  const liked = new Set<string>();
  for (const m of ctx.familyMembers) {
    for (const f of m.favorite_foods ?? []) if (f.trim() && dislikeMatches(meal, f)) liked.add(f.trim());
  }
  if (liked.size) reasons.push(`Lieblingsessen in der Familie: ${joinList([...liked].slice(0, 3))}`);

  const recipe: Recipe = { ...meal, instructions: "" };
  const focus = ctx.healthFocus.filter((f) => FOCUS_LABEL[f] && focusScore(recipe, [f], ctx.month) > 0);
  if (focus.length) reasons.push(`Passt zu eurem Schwerpunkt: ${joinList(focus.map((f) => FOCUS_LABEL[f]))}`);

  const max = ruleFor(date, ctx.dayRules).maxMinutes;
  if (max && meal.durationMin && meal.durationMin <= max) {
    reasons.push(`Dauert ${meal.durationMin} Min. – innerhalb eures Limits von ${max} Min. für diesen Tag`);
  }

  if (daysSinceLast === null) reasons.push("Neu für euch: bisher nicht in euren Plänen");
  else if (daysSinceLast >= 21) reasons.push(`Zuletzt vor ${Math.round(daysSinceLast / 7)} Wochen im Plan – bringt Abwechslung`);

  return reasons.slice(0, MAX_REASONS);
}
