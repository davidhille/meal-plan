import { describe, expect, test } from "bun:test";
import { RECENT_DAYS } from "./meals";
import { MAX_PAUSE_DAYS, pausedNames, repeatPauseDays } from "./repeatPause";

describe("repeatPauseDays", () => {
  test("unbewertet: 10 Wochen", () => expect(repeatPauseDays(undefined)).toBe(RECENT_DAYS));
  test("gestaffelt: 5 ★ = 11 Wochen, 4 ★ = 12, 3 ★ = 13", () => {
    expect(repeatPauseDays(5)).toBe(77);
    expect(repeatPauseDays(4)).toBe(84);
    expect(repeatPauseDays(3)).toBe(91);
  });
  test("1–2 ★ praktisch nie wieder", () => {
    expect(repeatPauseDays(2)).toBe(MAX_PAUSE_DAYS);
    expect(repeatPauseDays(1)).toBe(MAX_PAUSE_DAYS);
  });
  test("bewertete Gerichte pausieren nie kürzer als unbewertete", () => {
    for (const r of [1, 2, 3, 4, 5]) expect(repeatPauseDays(r)).toBeGreaterThan(RECENT_DAYS);
  });
});

describe("pausedNames", () => {
  const today = "2026-11-02";
  const daysAgo = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

  test("5 ★ vor 70 Tagen: noch Pause; vor 77 Tagen: wieder möglich", () => {
    expect(pausedNames([{ date: daysAgo(70), name: "Lieblingsgericht" }], { Lieblingsgericht: 5 }, today)).toEqual(["Lieblingsgericht"]);
    expect(pausedNames([{ date: daysAgo(77), name: "Lieblingsgericht" }], { Lieblingsgericht: 5 }, today)).toEqual([]);
  });
  test("unbewertet: 69 Tage Pause, ab 70 wieder möglich", () => {
    expect(pausedNames([{ date: daysAgo(69), name: "Neu" }], {}, today)).toEqual(["Neu"]);
    expect(pausedNames([{ date: daysAgo(70), name: "Neu" }], {}, today)).toEqual([]);
  });
  test("2 ★ nach einem halben Jahr: noch immer Pause", () => {
    expect(pausedNames([{ date: daysAgo(180), name: "Mochte keiner" }], { "Mochte keiner": 2 }, today)).toEqual(["Mochte keiner"]);
  });
  test("zählt das späteste Datum, nicht das erste", () => {
    const history = [
      { date: daysAgo(100), name: "Eintopf" },
      { date: daysAgo(10), name: "Eintopf" },
    ];
    expect(pausedNames(history, { Eintopf: 5 }, today)).toEqual(["Eintopf"]);
  });
  test("leerer Verlauf: nichts pausiert", () => expect(pausedNames([], { A: 5 }, today)).toEqual([]));
});
