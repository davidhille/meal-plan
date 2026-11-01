import { describe, expect, test } from "bun:test";
import { datesToFill, pickDays } from "./planning";
import { type Recipe, type ScoringContext } from "./meals";
import { matchesCategory } from "./weekVariety";

describe("datesToFill – welche Tage ein Plan bekommt", () => {
  test("neuer Plan: alle Tage außer freien Wochentagen", () => {
    // 2026-10-19 = Montag; Sonntag (0) frei
    expect(datesToFill("2026-10-19", "2026-10-25", { 0: { off: true } })).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24",
    ]);
  });

  test("Verlängern: belegte und bewusst leere Tage bleiben, wie sie sind", () => {
    const taken = new Set(["2026-10-19", "2026-10-22"]); // u. a. das verschobene Gericht
    const cleared = new Set(["2026-10-20"]); // „Tag leeren“
    expect(datesToFill("2026-10-19", "2026-10-23", {}, taken, cleared)).toEqual(["2026-10-21", "2026-10-23"]);
  });

  test("alles schon belegt: nichts zu tun", () => {
    expect(datesToFill("2026-10-19", "2026-10-19", {}, new Set(["2026-10-19"]))).toEqual([]);
  });
});

describe("pickDays – Mengen-Regeln", () => {
  const dish = (name: string, type: Recipe["type"] = "vegetarisch"): Recipe => ({ name, type, ingredients: ["1 Zutat"], instructions: "" });
  const others = ["Kartoffelsuppe", "Gemüsecurry", "Linseneintopf", "Pizza Margherita", "Rührei mit Brot", "Käsespätzle", "Gemüsepfanne", "Bratkartoffeln mit Spiegelei", "Ofengemüse"].map((n) => dish(n));
  const ctx = (over: Partial<ScoringContext> = {}): ScoringContext => ({
    familyMembers: [],
    rejectedMeals: [],
    mealRatings: {},
    healthConditions: [],
    healthFocus: [],
    ...over,
  });
  const week = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];

  test("Mindest-Regel: mindestens 1× Fisch pro Woche landet im Plan", () => {
    const pool = [...others, dish("Lachs mit Gemüse", "fleisch"), dish("Backfisch mit Kartoffelsalat", "fleisch")];
    for (let i = 0; i < 20; i++) {
      const meals = pickDays(week, ctx({ varietyRules: [{ id: "fisch", period: "week", min: 1 }] }), new Set(), pool);
      // Untergrenze: mehr Fisch ist erlaubt, weniger nicht
      expect(meals.filter((m) => matchesCategory("fisch", m.recipe.name)).length).toBeGreaterThanOrEqual(1);
    }
  });
  test("Mindest-Regel ohne frisches Gericht der Kategorie: normaler Plan, kein leerer Tag", () => {
    const pool = [...others, dish("Lachs mit Gemüse", "fleisch")];
    const meals = pickDays(week, ctx({ varietyRules: [{ id: "fisch", period: "week", min: 1 }], recentNames: ["Lachs mit Gemüse"] }), new Set(), pool);
    expect(meals.length).toBe(7);
    expect(meals.some((m) => m.recipe.name === "Lachs mit Gemüse")).toBe(false);
  });
  test("Höchst-Regel pro Monat: Garnelen aus dem Verlauf zählen mit", () => {
    const pool = [...others, dish("Garnelen-Curry"), dish("Gambas-Pfanne"), dish("Shrimps-Risotto")];
    const planHistory = [
      { date: "2026-11-02", name: "Gambas-Pfanne" },
      { date: "2026-11-05", name: "Garnelen-Curry" },
    ];
    const nextWeek = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
    for (let i = 0; i < 20; i++) {
      const meals = pickDays(nextWeek, ctx({ varietyRules: [{ id: "meeresfruechte", period: "month", max: 2 }], planHistory }), new Set(), pool);
      expect(meals.some((m) => matchesCategory("meeresfruechte", m.recipe.name))).toBe(false);
    }
  });
  test("Standard-Regeln: höchstens 2× Nudeln pro Woche", () => {
    const pool = [...others, dish("Spaghetti Bolognese"), dish("Penne Arrabbiata"), dish("Tortelloni in Salbeibutter"), dish("Lasagne")];
    for (let i = 0; i < 20; i++) {
      const meals = pickDays(week, ctx(), new Set(), pool);
      expect(meals.filter((m) => matchesCategory("nudeln", m.recipe.name)).length).toBeLessThanOrEqual(2);
    }
  });
});
