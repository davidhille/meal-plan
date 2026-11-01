import { describe, expect, test } from "bun:test";
import {
  DEFAULT_VARIETY_RULES,
  addToCounts,
  categoriesOf,
  countsOf,
  exceedsCap,
  matchesCategory,
  minimumSlots,
  parseVarietyRules,
  type VarietyRule,
} from "./weekVariety";

describe("categoriesOf", () => {
  test("erkennt Garnelen unter allen Namen", () => {
    for (const n of ["Bang-Bang-Garnelensalat mit Reisnudeln", "Gambas al ajillo", "Shrimps-Curry", "Brasilianischer Garnelen-Kokos-Eintopf (Moqueca)"]) {
      expect(categoriesOf(n).map((g) => g.id)).toContain("meeresfruechte");
    }
  });
  test("erkennt Nudelgerichte ohne das Wort Nudel", () => {
    for (const n of ["Gemüsebraten-Penne", "Ricotta-Spinat-Tortelloni in Salbeibutter", "Vegane Linsen-Lasagne mit Spinat", "One Pot Pasta al forno", "Hähnchen-Spinat-Nudelauflauf"]) {
      expect(categoriesOf(n).map((g) => g.id)).toContain("nudeln");
    }
  });
  test("Gemüse-Quesadillas und Gulasch gehören zu keiner Nudel- oder Meeresfrüchte-Gruppe", () => {
    for (const n of ["Gemüse-Quesadillas", "Rindergulasch mit Spätzle"]) {
      const ids = categoriesOf(n).map((g) => g.id);
      expect(ids).not.toContain("nudeln");
      expect(ids).not.toContain("meeresfruechte");
    }
  });
  test("weitere Kategorien: Fisch, Reis, Geflügel", () => {
    expect(matchesCategory("fisch", "Lachs mit Gemüse")).toBe(true);
    expect(matchesCategory("fisch", "Garnelen-Curry")).toBe(false);
    expect(matchesCategory("reis", "Gebratener Reis mit Ei")).toBe(true);
    expect(matchesCategory("gefluegel", "Hähnchen-Curry")).toBe(true);
  });
});

describe("exceedsCap – Standard-Regeln (1× Meeresfrüchte, 2× Nudeln pro Woche)", () => {
  const week = [
    { date: "2026-10-26", name: "Ricotta-Spinat-Tortelloni in Salbeibutter" },
    { date: "2026-10-27", name: "Bang-Bang-Garnelensalat mit Reisnudeln" },
    { date: "2026-10-29", name: "Gemüsebraten-Penne" },
  ];
  const counts = countsOf(week);

  test("dritte Nudel- und zweite Garnelenspeise in derselben Woche sind zu viel", () => {
    expect(exceedsCap("Vegane Linsen-Lasagne", "2026-10-31", counts, DEFAULT_VARIETY_RULES)).toBe(true);
    expect(exceedsCap("Gambas-Pfanne", "2026-10-30", counts, DEFAULT_VARIETY_RULES)).toBe(true);
  });
  test("andere Gerichte und andere Wochen sind frei", () => {
    expect(exceedsCap("Kichererbsen-Fajitas", "2026-10-28", counts, DEFAULT_VARIETY_RULES)).toBe(false);
    expect(exceedsCap("Vegane Linsen-Lasagne", "2026-11-03", counts, DEFAULT_VARIETY_RULES)).toBe(false);
  });
  test("Zählen und Prüfen greifen ineinander (zweites Nudelgericht noch erlaubt)", () => {
    const c = countsOf([{ date: "2026-10-26", name: "Spaghetti Bolognese" }]);
    expect(exceedsCap("Penne Arrabbiata", "2026-10-28", c, DEFAULT_VARIETY_RULES)).toBe(false);
    addToCounts(c, "2026-10-28", "Penne Arrabbiata");
    expect(exceedsCap("Lasagne", "2026-10-30", c, DEFAULT_VARIETY_RULES)).toBe(true);
  });
});

describe("exceedsCap – Monats-Regeln", () => {
  const rules: VarietyRule[] = [{ id: "meeresfruechte", period: "month", max: 2 }];

  test("2× Garnelen im Monat: das dritte ist zu viel, auch in einer anderen Woche", () => {
    const counts = countsOf([
      { date: "2026-11-02", name: "Gambas-Pfanne" },
      { date: "2026-11-17", name: "Garnelen-Curry" },
    ]);
    expect(exceedsCap("Shrimps-Risotto", "2026-11-26", counts, rules)).toBe(true);
    expect(exceedsCap("Shrimps-Risotto", "2026-12-01", counts, rules)).toBe(false); // neuer Monat
  });
  test("zwei Garnelen-Gerichte in einer Woche sind erlaubt, wenn der Monat noch Platz hat", () => {
    const counts = countsOf([{ date: "2026-11-02", name: "Gambas-Pfanne" }]);
    expect(exceedsCap("Garnelen-Curry", "2026-11-04", counts, rules)).toBe(false);
  });
  test("höchstens 0 = nie", () => {
    expect(exceedsCap("Gambas-Pfanne", "2026-11-04", new Map(), [{ id: "meeresfruechte", period: "month", max: 0 }])).toBe(true);
  });
  test("Regeln ohne Höchstwert sperren nichts", () => {
    expect(exceedsCap("Lachs", "2026-11-04", new Map(), [{ id: "fisch", period: "week", min: 1 }])).toBe(false);
  });
});

describe("minimumSlots – Mindest-Regeln", () => {
  const week = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]; // Mo–So
  const fishMin1: VarietyRule[] = [{ id: "fisch", period: "week", min: 1 }];

  test("1× Fisch pro Woche: genau ein Tag, in der Wochenmitte", () => {
    const slots = minimumSlots(week, new Map(), fishMin1, "2026-11-08");
    expect([...slots]).toEqual([["2026-11-05", "fisch"]]);
  });
  test("2× pro Woche werden auseinandergezogen", () => {
    const slots = minimumSlots(week, new Map(), [{ id: "fisch", period: "week", min: 2 }], "2026-11-08");
    expect([...slots.keys()]).toEqual(["2026-11-03", "2026-11-07"]);
  });
  test("schon erfüllt: nichts zu tun", () => {
    const counts = countsOf([{ date: "2026-11-02", name: "Lachs mit Gemüse" }]);
    expect(minimumSlots(week.slice(1), counts, fishMin1, "2026-11-08").size).toBe(0);
  });
  test("Fisch aus der Vorwoche zählt nicht für diese Woche", () => {
    const counts = countsOf([{ date: "2026-10-30", name: "Lachs mit Gemüse" }]);
    expect(minimumSlots(week, counts, fishMin1, "2026-11-08").size).toBe(1);
  });
  test("Monats-Minimum: ein Plan über eine Woche übernimmt nur seinen Anteil", () => {
    // 4× Fisch im November, der Plan deckt die erste volle Woche ab (7 von 29 Tagen ab dem 2.) → 1
    const slots = minimumSlots(week, new Map(), [{ id: "fisch", period: "month", min: 4 }], "2026-11-08");
    expect(slots.size).toBe(1);
  });
  test("Monats-Minimum: reicht der Plan bis Monatsende, holt er alles Fehlende", () => {
    const rest: string[] = [];
    for (let d = 2; d <= 30; d++) rest.push(`2026-11-${String(d).padStart(2, "0")}`);
    const counts = countsOf([{ date: "2026-11-01", name: "Lachs mit Gemüse" }]);
    expect(minimumSlots(rest, counts, [{ id: "fisch", period: "month", min: 4 }], "2026-11-30").size).toBe(3);
  });
  test("mehr verlangt als Tage da sind: so viele wie möglich", () => {
    const slots = minimumSlots(week.slice(0, 2), new Map(), [{ id: "fisch", period: "week", min: 5 }], "2026-11-03");
    expect(slots.size).toBe(2);
  });
});

describe("parseVarietyRules", () => {
  test("gültige Regeln bleiben, unbekannte Kategorien und Zeiträume fallen weg", () => {
    const out = parseVarietyRules([
      { id: "nudeln", period: "week", max: 2 },
      { id: "fisch", period: "week", min: 1 },
      { id: "gibtsnicht", period: "week", max: 1 },
      { id: "reis", period: "jahr", max: 1 },
    ]);
    expect(out).toEqual([
      { id: "nudeln", period: "week", max: 2 },
      { id: "fisch", period: "week", min: 1 },
    ]);
  });
  test("ohne min und max, mit min > max und doppelt fällt weg", () => {
    expect(
      parseVarietyRules([
        { id: "nudeln", period: "week" },
        { id: "reis", period: "week", min: 3, max: 1 },
        { id: "pizza", period: "month", max: 2 },
        { id: "pizza", period: "month", max: 3 },
      ])
    ).toEqual([{ id: "pizza", period: "month", max: 2 }]);
  });
  test("Zahlen werden begrenzt, 0 als Minimum heißt kein Minimum, 0 als Maximum bleibt (nie)", () => {
    expect(parseVarietyRules([{ id: "pizza", period: "week", min: 0, max: 99 }])).toEqual([{ id: "pizza", period: "week", max: 7 }]);
    expect(parseVarietyRules([{ id: "lamm", period: "week", max: 0 }])).toEqual([]); // „lamm“ gehört nicht zu den Kategorien
    expect(parseVarietyRules([{ id: "fisch", period: "month", max: 0 }])).toEqual([{ id: "fisch", period: "month", max: 0 }]);
  });
  test("Text-jsonb wird gelesen; Unbrauchbares ergibt null (= Standard), eine leere Liste bleibt leer", () => {
    expect(parseVarietyRules('[{"id":"nudeln","period":"week","max":2}]')).toEqual([{ id: "nudeln", period: "week", max: 2 }]);
    expect(parseVarietyRules(null)).toBeNull();
    expect(parseVarietyRules("kaputt")).toBeNull();
    expect(parseVarietyRules([])).toEqual([]);
  });
});
