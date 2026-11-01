import { describe, expect, test } from "bun:test";
import { RECENT_DAYS } from "./meals";
import { MAX_PAUSE_DAYS, pausedNames, repeatPauseDays } from "./repeatPause";

describe("repeatPauseDays", () => {
  test("unbewertet: 5 Wochen wie bisher", () => expect(repeatPauseDays(undefined)).toBe(RECENT_DAYS));
  test("gestaffelt: 5 ★ = 8 Wochen, 4 ★ = 9, 3 ★ = 10", () => {
    expect(repeatPauseDays(5)).toBe(56);
    expect(repeatPauseDays(4)).toBe(63);
    expect(repeatPauseDays(3)).toBe(70);
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

  test("5 ★ vor 50 Tagen: noch Pause; vor 56 Tagen: wieder möglich", () => {
    expect(pausedNames([{ date: daysAgo(50), name: "Lieblingsgericht" }], { Lieblingsgericht: 5 }, today)).toEqual(["Lieblingsgericht"]);
    expect(pausedNames([{ date: daysAgo(56), name: "Lieblingsgericht" }], { Lieblingsgericht: 5 }, today)).toEqual([]);
  });
  test("unbewertet: 34 Tage Pause, ab 35 wieder möglich", () => {
    expect(pausedNames([{ date: daysAgo(34), name: "Neu" }], {}, today)).toEqual(["Neu"]);
    expect(pausedNames([{ date: daysAgo(35), name: "Neu" }], {}, today)).toEqual([]);
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
