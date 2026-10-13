import { describe, expect, test } from "bun:test";
import { focusScore, isMeatDish, isoWeekKey, seasonalWords } from "./nutrition";
import { MEAL_DATABASE, type Recipe, type ScoringContext } from "./meals";
import { pickDays } from "./planning";

const r = (name: string, ingredients: string[], type: Recipe["type"] = "vegetarisch", durationMin = 30): Recipe => ({
  name,
  type,
  ingredients,
  instructions: "",
  durationMin,
});

const pasta = r("Spaghetti mit Sahnesoße", ["400 g Spaghetti", "200 ml Sahne", "50 g Parmesan"]);
const bowl = r("Linsen-Gemüse-Bowl", ["200 g Linsen", "1 Brokkoli", "2 Karotten", "1 Paprika", "100 g Spinat"]);
const chili = r("Scharfes Chili", ["400 g Hackfleisch", "2 Chilischoten", "1 Dose Bohnen"], "fleisch");
const kuerbis = r("Kürbissuppe mit Pilzen", ["1 Hokkaido-Kürbis", "200 g Champignons", "1 Zwiebel"]);

describe("focusScore", () => {
  test("ohne Schwerpunkte neutral", () => expect(focusScore(pasta, [])).toBe(0));
  test("Low Carb: Nudeln runter, Bowl rauf", () => {
    expect(focusScore(pasta, ["low_carb"])).toBeLessThan(0);
    expect(focusScore(r("Gemüsepfanne", ["1 Brokkoli", "200 g Tofu"]), ["low_carb"])).toBeGreaterThan(0);
  });
  test("Viel Gemüse und Vollkorn mögen die Bowl", () => {
    expect(focusScore(bowl, ["veggie_rich"])).toBeGreaterThan(focusScore(pasta, ["veggie_rich"]));
    expect(focusScore(bowl, ["whole_grain"])).toBeGreaterThan(0);
  });
  test("Kalorienbewusst: Sahne kostet Punkte", () => expect(focusScore(pasta, ["calorie_light"])).toBeLessThan(focusScore(bowl, ["calorie_light"])));
  test("Proteinreich", () => expect(focusScore(bowl, ["high_protein"])).toBeGreaterThan(focusScore(pasta, ["high_protein"])));
  test("Kinderfreundlich: scharf runter", () => expect(focusScore(chili, ["kid_friendly"])).toBeLessThan(0));
  test("Saisonal: Kürbis im Oktober, nicht im Juli", () => {
    expect(focusScore(kuerbis, ["seasonal"], 10)).toBeGreaterThan(0);
    expect(focusScore(kuerbis, ["seasonal"], 7)).toBe(0);
    expect(seasonalWords(4)).toContain("spargel");
  });
  test("Günstig: Linsen ja, Lachs nein", () => {
    expect(focusScore(bowl, ["budget"])).toBeGreaterThan(0);
    expect(focusScore(r("Lachs mit Spargel", ["4 Lachsfilets", "500 g Spargel"], "fleisch"), ["budget"])).toBeLessThan(0);
  });
  test("mehrere Schwerpunkte zählen zusammen", () =>
    expect(focusScore(bowl, ["veggie_rich", "whole_grain"])).toBe(focusScore(bowl, ["veggie_rich"]) + focusScore(bowl, ["whole_grain"])));
});

describe("Fleisch-Grenze", () => {
  test("Fisch zählt nicht als Fleisch, Hack schon", () => {
    expect(isMeatDish(chili)).toBe(true);
    expect(isMeatDish(r("Ofenlachs", ["4 Lachsfilets"], "fleisch"))).toBe(false);
    expect(isMeatDish(bowl)).toBe(false);
  });
  test("ISO-Kalenderwoche", () => {
    expect(isoWeekKey("2026-10-12")).toBe("2026-W42");
    expect(isoWeekKey("2026-10-18")).toBe("2026-W42");
    expect(isoWeekKey("2026-10-19")).toBe("2026-W43");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
  });

  const ctx = (meatMaxPerWeek: number | null): ScoringContext => ({
    familyMembers: [],
    rejectedMeals: [],
    mealRatings: {},
    healthConditions: [],
    healthFocus: [],
    meatMaxPerWeek,
  });
  const twoWeeks = Array.from({ length: 14 }, (_, i) => `2026-10-${String(12 + i).padStart(2, "0")}`);
  const meatByWeek = (meals: { date: string; recipe: Recipe }[]) => {
    const m = new Map<string, number>();
    for (const x of meals) if (isMeatDish(x.recipe)) m.set(isoWeekKey(x.date), (m.get(isoWeekKey(x.date)) ?? 0) + 1);
    return m;
  };

  test("höchstens X Fleischgerichte pro Woche, alle Tage geplant", () => {
    for (let run = 0; run < 5; run++) {
      const meals = pickDays(twoWeeks, ctx(2), new Set(), [...MEAL_DATABASE]);
      expect(meals).toHaveLength(14);
      for (const n of meatByWeek(meals).values()) expect(n).toBeLessThanOrEqual(2);
    }
  });
  test("0 = gar kein Fleisch", () => {
    const meals = pickDays(twoWeeks.slice(0, 7), ctx(0), new Set(), [...MEAL_DATABASE]);
    expect(meals.some((m) => isMeatDish(m.recipe))).toBe(false);
  });
  test("ohne Grenze kommt Fleisch normal vor", () => {
    const meals = pickDays(twoWeeks, ctx(null), new Set(), [...MEAL_DATABASE]);
    expect([...meatByWeek(meals).values()].some((n) => n > 2)).toBe(true);
  });
});
