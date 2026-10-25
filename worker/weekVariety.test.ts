import { describe, expect, test } from "bun:test";
import { addToWeekCounts, exceedsWeekCap, varietyGroupsOf, weekCountsOf } from "./weekVariety";

describe("varietyGroupsOf", () => {
  test("erkennt Garnelen unter allen Namen", () => {
    for (const n of ["Bang-Bang-Garnelensalat mit Reisnudeln", "Gambas al ajillo", "Shrimps-Curry", "Brasilianischer Garnelen-Kokos-Eintopf (Moqueca)"]) {
      expect(varietyGroupsOf(n).map((g) => g.id)).toContain("meeresfruechte");
    }
  });
  test("erkennt Nudelgerichte ohne das Wort Nudel", () => {
    for (const n of ["Gemüsebraten-Penne", "Ricotta-Spinat-Tortelloni in Salbeibutter", "Vegane Linsen-Lasagne mit Spinat", "One Pot Pasta al forno", "Hähnchen-Spinat-Nudelauflauf"]) {
      expect(varietyGroupsOf(n).map((g) => g.id)).toContain("nudeln");
    }
  });
  test("Gemüse-Quesadillas und Gulasch gehören zu keiner Gruppe", () => {
    expect(varietyGroupsOf("Gemüse-Quesadillas")).toEqual([]);
    expect(varietyGroupsOf("Rindergulasch mit Spätzle")).toEqual([]);
  });
});

describe("exceedsWeekCap", () => {
  const week = [
    { date: "2026-10-26", name: "Ricotta-Spinat-Tortelloni in Salbeibutter" },
    { date: "2026-10-27", name: "Bang-Bang-Garnelensalat mit Reisnudeln" },
    { date: "2026-10-29", name: "Gemüsebraten-Penne" },
  ];
  const counts = weekCountsOf(week);

  test("dritte Nudel- und zweite Garnelenspeise in derselben Woche sind zu viel", () => {
    expect(exceedsWeekCap("Vegane Linsen-Lasagne", "2026-10-31", counts)).toBe(true);
    expect(exceedsWeekCap("Gambas-Pfanne", "2026-10-30", counts)).toBe(true);
  });
  test("andere Gerichte und andere Wochen sind frei", () => {
    expect(exceedsWeekCap("Kichererbsen-Fajitas", "2026-10-28", counts)).toBe(false);
    expect(exceedsWeekCap("Vegane Linsen-Lasagne", "2026-11-03", counts)).toBe(false);
  });
  test("Zählen und Prüfen greifen ineinander (zweites Nudelgericht noch erlaubt)", () => {
    const c = weekCountsOf([{ date: "2026-10-26", name: "Spaghetti Bolognese" }]);
    expect(exceedsWeekCap("Penne Arrabbiata", "2026-10-28", c)).toBe(false);
    addToWeekCounts(c, "2026-10-28", "Penne Arrabbiata");
    expect(exceedsWeekCap("Lasagne", "2026-10-30", c)).toBe(true);
  });
});
