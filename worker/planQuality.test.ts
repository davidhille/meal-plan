import { describe, expect, test } from "bun:test";
import { computePlanQuality, type QualityMeal } from "./planQuality";

const meal = (name: string, extra: Partial<QualityMeal> = {}): QualityMeal => ({
  name,
  ingredients: [],
  planId: "p1",
  interventions: 0,
  past: true,
  rated: false,
  ...extra,
});

const base = { familyDislikes: [] as string[], members: [], hidden7: 0, hidden30: 0 };

describe("computePlanQuality", () => {
  test("ohne Gerichte: keine Zahlen statt 0 %", () => {
    const q = computePlanQuality({ ...base, meals: [] });
    expect(q).toMatchObject({ meals: 0, dislikeHits: 0, interventionsPerPlan: null, unchangedShare: null, ratedShare: null });
  });

  test("zählt Gerichte mit Familien-Nein, Meeresfrüchte bleiben erlaubt", () => {
    const q = computePlanQuality({
      ...base,
      familyDislikes: ["fisch", "lamm"],
      meals: [meal("Honig-Teriyaki-Lachs"), meal("Lammcurry"), meal("Garnelen mit Zuckerschoten"), meal("Gemüse-Quesadillas")],
    });
    expect(q.dislikeHits).toBe(2);
  });

  test("Abneigung einzelner zählt nur bei Mehrheit", () => {
    const members = [{ disliked_foods: ["Fisch"] }, { disliked_foods: ["Fisch"] }, { disliked_foods: [] }, { disliked_foods: [] }];
    expect(computePlanQuality({ ...base, members, meals: [meal("Lachs mit Reis")] }).dislikeHits).toBe(0);
    const mehrheit = [{ disliked_foods: ["Fisch"] }, { disliked_foods: ["Fisch"] }, { disliked_foods: ["Fisch"] }, { disliked_foods: [] }];
    expect(computePlanQuality({ ...base, members: mehrheit, meals: [meal("Lachs mit Reis")] }).dislikeHits).toBe(1);
  });

  test("Eingriffe je Plan und Anteil unveränderter Gerichte", () => {
    const q = computePlanQuality({
      ...base,
      meals: [
        meal("A", { planId: "p1", interventions: 2 }),
        meal("B", { planId: "p1" }),
        meal("C", { planId: "p2" }),
        meal("D", { planId: "p2" }),
      ],
    });
    expect(q.interventionsPerPlan).toBe(1);
    expect(q.unchangedShare).toBe(75);
  });

  test("Bewertungsquote zählt nur Tage, die schon vorbei sind", () => {
    const q = computePlanQuality({
      ...base,
      meals: [meal("A", { rated: true }), meal("B"), meal("C", { past: false }), meal("D", { past: false })],
    });
    expect(q.cooked).toBe(2);
    expect(q.ratedShare).toBe(50);
  });

  test("reicht die Ausblendungen durch", () => {
    const q = computePlanQuality({ ...base, hidden7: 3, hidden30: 9, meals: [meal("A")] });
    expect([q.hidden7, q.hidden30]).toEqual([3, 9]);
  });
});
