import { describe, expect, test } from "bun:test";
import { datesToFill } from "./planning";

describe("datesToFill – welche Tage ein Plan bekommt", () => {
  test("neuer Plan: alle Tage außer freien Wochentagen", () => {
    // 2026-10-19 = Montag; Sonntag (0) frei
    expect(datesToFill("2026-10-19", "2026-10-25", { 0: { off: true } })).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24",
    ]);
  });

  test("Verlängern: belegte und bewusst leere Tage bleiben, wie sie sind", () => {
    const taken = new Set(["2026-10-19", "2026-10-22"]); // u. a. das verschobene Gericht
    const cleared = new Set(["2026-10-20"]); // „Tag leeren“
    expect(datesToFill("2026-10-19", "2026-10-23", {}, taken, cleared)).toEqual(["2026-10-21", "2026-10-23"]);
  });

  test("alles schon belegt: nichts zu tun", () => {
    expect(datesToFill("2026-10-19", "2026-10-19", {}, new Set(["2026-10-19"]))).toEqual([]);
  });
});
