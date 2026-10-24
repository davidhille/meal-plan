import { describe, expect, test } from "bun:test";
import { whyReasons, MAX_REASONS, type WhyInput } from "./whyMeal";

const base: WhyInput = {
  meal: { name: "Linsensuppe", type: "vegetarisch", ingredients: ["200g Linsen", "1 Möhre", "1 Zwiebel"], durationMin: 30 },
  date: "2026-10-28", // Mittwoch
  ctx: { familyMembers: [], mealRatings: {}, healthFocus: [], healthConditions: [], month: 10, dayRules: {}, familyDislikes: [] },
  isFavorite: false,
  daysSinceLast: 10,
};
const withCtx = (c: Partial<WhyInput["ctx"]>, rest: Partial<WhyInput> = {}): WhyInput => ({ ...base, ...rest, ctx: { ...base.ctx, ...c } });

describe("whyReasons", () => {
  test("ohne Signale: keine Gründe", () => {
    expect(whyReasons(base)).toEqual([]);
  });
  test("Familien-Nein wird genannt", () => {
    expect(whyReasons(withCtx({ familyDislikes: ["fisch", "lamm"] }))[0]).toBe("Ohne Fisch und Lamm – so, wie ihr es festgelegt habt");
  });
  test("Favorit und gute Bewertung", () => {
    const r = whyReasons(withCtx({ mealRatings: { Linsensuppe: 5 } }, { isFavorite: true }));
    expect(r).toContain("Ein Favorit von euch");
    expect(r).toContain("Ihr habt es mit 5 von 5 Sternen bewertet");
  });
  test("schlechte Bewertung ist kein Grund", () => {
    expect(whyReasons(withCtx({ mealRatings: { Linsensuppe: 2 } }))).toEqual([]);
  });
  test("Lieblingsessen eines Mitglieds", () => {
    const r = whyReasons(withCtx({ familyMembers: [{ type: "child", age: 6, favorite_foods: ["Linsen"], disliked_foods: null }] }));
    expect(r).toEqual(["Lieblingsessen in der Familie: Linsen"]);
  });
  test("Zeitlimit des Wochentags", () => {
    const r = whyReasons(withCtx({ dayRules: { "3": { maxMinutes: 45 } } }));
    expect(r).toEqual(["Dauert 30 Min. – innerhalb eures Limits von 45 Min. für diesen Tag"]);
  });
  test("Zeitlimit überschritten: kein Grund", () => {
    expect(whyReasons(withCtx({ dayRules: { "3": { maxMinutes: 15 } } }))).toEqual([]);
  });
  test("Abwechslung: nie geplant und lange her", () => {
    expect(whyReasons({ ...base, daysSinceLast: null })).toEqual(["Noch nicht in euren Plänen gewesen – bringt Abwechslung"]);
    expect(whyReasons({ ...base, daysSinceLast: 35 })).toEqual(["Zuletzt vor 5 Wochen im Plan – bringt Abwechslung"]);
  });
  test("höchstens fünf Gründe", () => {
    const r = whyReasons(
      withCtx(
        {
          familyDislikes: ["fisch"],
          healthConditions: ["diabetes"],
          mealRatings: { Linsensuppe: 5 },
          familyMembers: [{ type: "adult", age: 40, favorite_foods: ["Linsen"], disliked_foods: null }],
          healthFocus: ["whole_grain"],
        },
        { isFavorite: true, daysSinceLast: null }
      )
    );
    expect(r.length).toBe(MAX_REASONS);
  });
});
