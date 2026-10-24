import { describe, expect, test } from "bun:test";
import { MAX_ROUTINE_ATTEMPTS, cronTick, pickAutoFamily, routineDue, shouldRetryRoutine } from "./routineRules";

const now = { date: "2026-10-26", time: "09:30", weekday: 1, day: 26 }; // Montag
const weekly = { frequency: "weekly", day_of_week: 1, time: "09:00", last_run_date: "2026-10-19" };

describe("routineDue", () => {
  test("wöchentlich: am Wochentag, ab der Uhrzeit", () => {
    expect(routineDue(weekly, now)).toBe(true);
    expect(routineDue({ ...weekly, day_of_week: 2 }, now)).toBe(false);
    expect(routineDue(weekly, { ...now, time: "08:59" })).toBe(false);
  });
  test("höchstens einmal am Tag", () => {
    expect(routineDue({ ...weekly, last_run_date: "2026-10-26" }, now)).toBe(false);
  });
  test("monatlich: nur am 1.", () => {
    const monthly = { frequency: "monthly", day_of_week: null, time: null, last_run_date: null };
    expect(routineDue(monthly, { ...now, day: 1 })).toBe(true);
    expect(routineDue(monthly, now)).toBe(false);
  });
  test("ohne Uhrzeit gilt 00:00", () => {
    expect(routineDue({ ...weekly, time: null }, { ...now, time: "00:00" })).toBe(true);
  });
});

describe("Wiederholung nach Fehlschlag", () => {
  test("bis zu 3 Versuche am Tag, danach Alarm statt weiterer Versuche", () => {
    expect(MAX_ROUTINE_ATTEMPTS).toBe(3);
    expect(shouldRetryRoutine(1)).toBe(true);
    expect(shouldRetryRoutine(2)).toBe(true);
    expect(shouldRetryRoutine(3)).toBe(false);
  });
});

describe("Chefkoch-Automatik: eine Familie je Lauf", () => {
  const f = (id: string, due = true, open = true) => ({ id, due, open });
  test("wechselt reihum, sortiert nach Kennung", () => {
    const fams = [f("b"), f("c"), f("a")];
    expect([0, 1, 2, 3].map((t) => pickAutoFamily(fams, t)?.id)).toEqual(["a", "b", "c", "a"]);
  });
  test("überspringt Familien, die nicht fällig sind oder das Tageslimit erreicht haben", () => {
    const fams = [f("a", false), f("b", true, false), f("c"), f("d")];
    expect([0, 1, 2].map((t) => pickAutoFamily(fams, t)?.id)).toEqual(["c", "d", "c"]);
  });
  test("niemand dran → undefined", () => {
    expect(pickAutoFamily([f("a", false)], 5)).toBeUndefined();
    expect(pickAutoFamily([], 0)).toBeUndefined();
  });
  test("Takt-Nummer zählt alle 15 Minuten weiter", () => {
    const t = Date.UTC(2026, 9, 24, 6, 15, 0);
    expect(cronTick(t + 14 * 60_000)).toBe(cronTick(t));
    expect(cronTick(t + 15 * 60_000)).toBe(cronTick(t) + 1);
  });
});
