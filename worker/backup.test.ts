import { describe, expect, test } from "bun:test";
import { backupKey, backupsToDelete, daysAgoIso } from "./backup";
import { exportFamily } from "./adminTools";

describe("Sicherung: Hilfen", () => {
  test("Schlüssel je Familie und Tag", () => {
    expect(backupKey("abc", "2026-10-25")).toBe("abc/2026-10-25.json");
  });
  test("Datum vor n Tagen, auch über Monats- und Jahresgrenzen", () => {
    expect(daysAgoIso("2026-10-25", 7)).toBe("2026-10-18");
    expect(daysAgoIso("2026-03-03", 7)).toBe("2026-02-24");
    expect(daysAgoIso("2026-01-03", 7)).toBe("2025-12-27");
  });
  test("nur die neuesten Sicherungen bleiben", () => {
    const keys = Array.from({ length: 10 }, (_, i) => `f/2026-10-${String(10 + i).padStart(2, "0")}.json`);
    const del = backupsToDelete(keys, 8);
    expect(del).toEqual(["f/2026-10-11.json", "f/2026-10-10.json"]);
    expect(backupsToDelete(keys.slice(0, 3), 8)).toEqual([]);
  });
});

/** Minimale Datenbank: merkt sich die Abfragen und antwortet je nach Text */
function fakeSql() {
  const seen: string[] = [];
  const answer = (text: string) => {
    seen.push(text);
    if (text.includes("FROM profiles p WHERE id")) return [{ r: { id: "fam", name: "Test" } }];
    if (text.includes("information_schema.columns")) return [{ table_name: "favorites" }, { table_name: "meal_images" }, { table_name: "users" }];
    return [{ r: { x: 1 } }];
  };
  const sql = Object.assign((strings: TemplateStringsArray) => Promise.resolve(answer(strings.join("?"))), {
    query: (text: string) => Promise.resolve(answer(text)),
  });
  return { sql: sql as unknown as Parameters<typeof exportFamily>[0], seen };
}

describe("exportFamily", () => {
  test("ohne Bilddaten: image_data wird weggelassen, die übrigen Tabellen bleiben", async () => {
    const { sql, seen } = fakeSql();
    const b = await exportFamily(sql, "fam", { withImages: false });
    expect(b?.tables.meal_images).toBeDefined();
    expect(b?.tables.favorites).toEqual([{ x: 1 }]);
    expect(seen.some((t) => t.includes("to_jsonb(x) - 'image_data'") && t.includes("meal_images"))).toBe(true);
  });
  test("standardmäßig mit Bilddaten (wie bisher)", async () => {
    const { sql, seen } = fakeSql();
    await exportFamily(sql, "fam");
    expect(seen.some((t) => t.includes("image_data"))).toBe(false);
  });
});
