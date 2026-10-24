import { describe, expect, test } from "bun:test";
import { MAX_ROUTINE_ATTEMPTS, routineDue, shouldRetryRoutine } from "./routineRules";

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
