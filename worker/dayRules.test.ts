import { describe, expect, test } from "bun:test";
import { fitsTime, isOffDay, parseDayRules, ruleFor, withinTime } from "./dayRules";
import { pickDays } from "./planning";
import type { Recipe, ScoringContext } from "./meals";

const r = (name: string, durationMin: number | null, type: Recipe["type"] = "vegetarisch"): Recipe => ({
  name,
  type,
  ingredients: ["1 Zwiebel"],
  instructions: "",
  durationMin,
});

describe("parseDayRules", () => {
  test("nur gültige Tage und Werte", () => {
    expect(
      parseDayRules({ "0": { off: true }, "3": { maxMinutes: 20 }, "7": { off: true }, "2": { maxMinutes: 17 }, x: 1 })
    ).toEqual({ "0": { off: true }, "3": { maxMinutes: 20 } });
    expect(parseDayRules(null)).toEqual({});
  });
});

describe("ruleFor / isOffDay", () => {
  const rules = parseDayRules({ "0": { off: true }, "3": { maxMinutes: 20 } });
  test("nach Wochentag des Datums", () => {
    expect(isOffDay("2026-10-18", rules)).toBe(true); // Sonntag
    expect(ruleFor("2026-10-14", rules)).toEqual({ maxMinutes: 20 }); // Mittwoch
    expect(ruleFor("2026-10-13", rules)).toEqual({}); // Dienstag
  });
});

describe("fitsTime", () => {
  test("Zeitangabe zählt; ohne Angabe nur, wenn kein Wochenend-Gericht", () => {
    expect(fitsTime(r("A", 20), 20)).toBe(true);
    expect(fitsTime(r("B", 25), 20)).toBe(false);
    expect(fitsTime(r("C", null), 20)).toBe(true);
    expect(fitsTime(r("D", null, "wochenende"), 20)).toBe(false);
    expect(fitsTime(r("E", 90), undefined)).toBe(true);
  });
  test("withinTime filtert nur an Tagen mit Limit", () => {
    const pool = [r("Schnell", 15), r("Lang", 60), r("Unbekannt", null)];
    const rules = parseDayRules({ "3": { maxMinutes: 20 } });
    expect(withinTime(pool, "2026-10-14", rules).map((x) => x.name)).toEqual(["Schnell"]);
    expect(withinTime(pool, "2026-10-13", rules)).toHaveLength(3);
    // ohne bekannte passende Zeit: dann auch Gerichte ohne Zeitangabe
    expect(withinTime([r("Lang", 60), r("Unbekannt", null)], "2026-10-14", rules).map((x) => x.name)).toEqual(["Unbekannt"]);
  });
});

describe("pickDays mit Zeitlimit", () => {
  const ctx = (rules: Record<string, unknown>): ScoringContext => ({
    familyMembers: [],
    rejectedMeals: [],
    mealRatings: {},
    healthConditions: [],
    healthFocus: [],
    dayRules: parseDayRules(rules),
  });
  test("am Mittwoch (max. 20 Min) nur Schnelles", () => {
    const pool = [r("Eintopf", 90), r("Auflauf", 60), r("Rührei", 15), r("Curry", 45)];
    for (let i = 0; i < 20; i++) {
      const meals = pickDays(["2026-10-14"], ctx({ "3": { maxMinutes: 20 } }), new Set(), pool);
      expect(meals[0].recipe.name).toBe("Rührei");
    }
  });
  test("passt nichts, wird trotzdem etwas geplant", () => {
    const meals = pickDays(["2026-10-14"], ctx({ "3": { maxMinutes: 15 } }), new Set(), [r("Eintopf", 90)]);
    expect(meals[0].recipe.name).toBe("Eintopf");
  });
});

describe("parseDayRules aus Text", () => {
  test("jsonb als Text wird gelesen", () => expect(parseDayRules('{"0":{"off":true}}')).toEqual({ "0": { off: true } }));
});
