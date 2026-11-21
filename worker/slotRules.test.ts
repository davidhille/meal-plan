import { describe, expect, test } from "bun:test";
import { DEFAULT_VEG_MIN, effortOf, preferredEffortFor, vegMissing } from "./slotRules";
import { isVegetarianDish, type Recipe } from "./meals";
import { pausedNames, skipPauseDays } from "./repeatPause";
import { pickDays } from "./planning";

const r = (name: string, type: Recipe["type"], durationMin: number | null, ingredients = ["1 Zutat"]): Recipe =>
  ({ name, type, ingredients, instructions: "", durationMin }) as Recipe;

describe("effortOf", () => {
  test("nach Zeit: bis 45 schnell, darüber aufwendig", () => {
    expect(effortOf(r("A", "fleisch", 45))).toBe("schnell");
    expect(effortOf(r("B", "vegetarisch", 46))).toBe("aufwendig");
  });
  test("Zeit schlägt die Art", () => expect(effortOf(r("C", "wochenende", 30))).toBe("schnell"));
  test("ohne Zeit entscheidet die Art Wochenende", () => {
    expect(effortOf(r("D", "wochenende", null))).toBe("aufwendig");
    expect(effortOf(r("E", "fleisch", null))).toBe("schnell");
  });
  test("Wochentage schnell, Sa/So aufwendig", () => {
    expect(preferredEffortFor("2026-10-12")).toBe("schnell");
    expect(preferredEffortFor("2026-10-17")).toBe("aufwendig");
    expect(preferredEffortFor("2026-10-18")).toBe("aufwendig");
  });
});

describe("vegMissing", () => {
  test("volle Woche: 3 von 7", () => expect(vegMissing(3, 7, 1)).toBe(2));
  test("Teilwoche anteilig", () => expect(vegMissing(3, 2, 0)).toBe(1));
  test("0 = keine Vorgabe", () => expect(vegMissing(0, 7, 0)).toBe(0));
  test("schon erfüllt", () => expect(vegMissing(3, 7, 4)).toBe(0));
  test("Standard ist 3", () => expect(DEFAULT_VEG_MIN).toBe(3));
});

describe("isVegetarianDish", () => {
  test("Art vegetarisch zählt, Wochenende nach den Zutaten", () => {
    expect(isVegetarianDish(r("Gemüse", "vegetarisch", 30))).toBe(true);
    expect(isVegetarianDish(r("Rinderbraten", "wochenende", 120, ["1 kg Rindfleisch"]))).toBe(false);
    expect(isVegetarianDish(r("Linsen-Lasagne", "wochenende", 90, ["Linsen", "Lasagneplatten"]))).toBe(true);
  });
});

describe("weggetauschte Gerichte pausieren", () => {
  const today = "2026-11-21";
  test("90 Tage beim ersten Mal, bei jedem weiteren 45 mehr", () => {
    expect(skipPauseDays(1)).toBe(90);
    expect(skipPauseDays(2)).toBe(135);
    expect(skipPauseDays(20)).toBe(365);
  });
  test("pausiert, auch ohne Verlauf", () => {
    expect(pausedNames([], {}, today, { Kohlrouladen: { times: 1, last: "2026-10-01" } })).toEqual(["Kohlrouladen"]);
    expect(pausedNames([], {}, today, { Kohlrouladen: { times: 1, last: "2026-08-01" } })).toEqual([]);
  });
});

describe("pickDays – vegetarisch pro Woche", () => {
  const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
  const ctx = (min: number) => ({
    familyMembers: [],
    rejectedMeals: [],
    mealRatings: {},
    healthConditions: [],
    healthFocus: [],
    varietyRules: min > 0 ? [{ id: "vegetarisch", period: "week" as const, min }] : [],
  });
  const pool = [
    ...Array.from({ length: 12 }, (_, i) => r(`Fleischgericht ${i}`, "fleisch", 30, ["500 g Rindfleisch"])),
    ...Array.from({ length: 12 }, (_, i) => r(`Gemüsegericht ${i}`, "vegetarisch", 30, ["Gemüse"])),
  ];
  test("mindestens X vegetarische (Mengen-Regel „vegetarisch“), auch wenn die Zufallszahl immer dagegen spricht", () => {
    for (const min of [2, 3, 4]) {
      const meals = pickDays(week, ctx(min) as never, new Set(), pool, new Map(), () => 0.999);
      expect(meals.filter((m) => isVegetarianDish(m.recipe)).length).toBeGreaterThanOrEqual(min);
    }
  });
  test("ohne Vorgabe: kein Zwang", () => {
    const meals = pickDays(week, ctx(0) as never, new Set(), pool, new Map(), () => 0.999);
    expect(meals).toHaveLength(7);
  });
});

describe("Regelart Vegetarisch: höchstens", () => {
  const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
  const pool = [
    ...Array.from({ length: 12 }, (_, i) => r(`Fleischgericht ${i}`, "fleisch", 30, ["500 g Rindfleisch"])),
    ...Array.from({ length: 12 }, (_, i) => r(`Gemüsegericht ${i}`, "vegetarisch", 30, ["Gemüse"])),
  ];
  test("„höchstens 1× vegetarisch pro Woche“ gilt", () => {
    const ctx = { familyMembers: [], rejectedMeals: [], mealRatings: {}, healthConditions: [], healthFocus: [], varietyRules: [{ id: "vegetarisch", period: "week" as const, max: 1 }] };
    for (let i = 0; i < 20; i++) {
      const meals = pickDays(week, ctx as never, new Set(), pool);
      expect(meals.filter((m) => isVegetarianDish(m.recipe)).length).toBeLessThanOrEqual(1);
    }
  });
  test("Verlauf zählt mit: Zutaten des Verlaufs entscheiden über die Art", () => {
    const ctx = {
      familyMembers: [],
      rejectedMeals: [],
      mealRatings: {},
      healthConditions: [],
      healthFocus: [],
      varietyRules: [{ id: "fleisch", period: "week" as const, max: 1 }],
      planHistory: [{ date: "2026-10-12", name: "Gulasch", type: "fleisch" as const, ingredients: ["500 g Rindfleisch"] }],
    };
    for (let i = 0; i < 20; i++) {
      const meals = pickDays(week.slice(1, 3), ctx as never, new Set(), pool);
      expect(meals.every((m) => isVegetarianDish(m.recipe))).toBe(true);
    }
  });
});
