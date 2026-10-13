import { describe, expect, test } from "bun:test";
import { LEGACY_VERSION, runMigrations, type MigrationDb } from "./migrate";
import { MIGRATIONS, type Migration } from "./migrations";

/** Spielt eine Datenbank nach: merkt sich Kommentar, eingetragene Migrationen und ausgeführte Befehle */
function fakeDb(comment: string | null, applied: string[] = []) {
  const state = { comment, applied: new Set(applied), executed: [] as string[], queries: 0 };
  const db: MigrationDb = {
    async query(text, params) {
      state.queries++;
      if (text.startsWith("SELECT obj_description")) return [{ v: state.comment }];
      if (text.startsWith("INSERT INTO schema_migrations")) state.applied.add(params![0] as string);
      if (text.startsWith("SELECT id FROM schema_migrations")) return [...state.applied].map((id) => ({ id }));
      const m = text.match(/^COMMENT ON TABLE profiles IS '(.*)'$/);
      if (m) state.comment = m[1];
      return [];
    },
    async transaction(statements) {
      for (const s of statements) {
        if (s.text.startsWith("INSERT INTO schema_migrations")) state.applied.add(s.params![0] as string);
        else state.executed.push(s.text);
      }
    },
  };
  return { db, state };
}

const TEST_MIGRATIONS: Migration[] = [
  { id: "0001_basis", statements: ["CREATE TABLE IF NOT EXISTS a (x int)"] },
  { id: "0002_neu", statements: ["ALTER TABLE a ADD COLUMN IF NOT EXISTS y int"] },
];

describe("runMigrations", () => {
  test("leere Datenbank: alle Migrationen laufen", async () => {
    const { db, state } = fakeDb(null);
    expect(await runMigrations(db, TEST_MIGRATIONS)).toEqual(["0001_basis", "0002_neu"]);
    expect(state.executed).toHaveLength(2);
    expect(state.comment).toBe("migration:0002_neu");
  });

  test("aktueller Stand: nur eine Abfrage, keine DDL", async () => {
    const { db, state } = fakeDb("migration:0002_neu", ["0001_basis", "0002_neu"]);
    expect(await runMigrations(db, TEST_MIGRATIONS)).toEqual([]);
    expect(state.queries).toBe(1);
  });

  test("alte Datenbank (vor den Migrationsdateien): Grundschema wird übersprungen", async () => {
    const { db, state } = fakeDb(LEGACY_VERSION);
    expect(await runMigrations(db, TEST_MIGRATIONS)).toEqual(["0002_neu"]);
    expect(state.executed).toEqual(["ALTER TABLE a ADD COLUMN IF NOT EXISTS y int"]);
  });

  test("neue Migration nach einem Deploy: nur die neue läuft", async () => {
    const { db } = fakeDb("migration:0001_basis", ["0001_basis"]);
    expect(await runMigrations(db, TEST_MIGRATIONS)).toEqual(["0002_neu"]);
  });
});

describe("Migrationsdateien", () => {
  test("IDs eindeutig, aufsteigend nummeriert", () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id, i) => expect(id).toMatch(new RegExp(`^${String(i + 1).padStart(4, "0")}_[a-z0-9_]+$`)));
  });

  test("Befehle sind idempotent (IF NOT EXISTS)", () => {
    for (const m of MIGRATIONS) {
      for (const s of m.statements) {
        if (/^(CREATE (TABLE|INDEX)|ALTER TABLE \w+ ADD COLUMN)/i.test(s)) expect(s).toMatch(/IF NOT EXISTS/i);
      }
    }
  });

  test("keine CONCURRENTLY-Befehle (laufen nicht in einer Transaktion)", () => {
    for (const m of MIGRATIONS) for (const s of m.statements) expect(s).not.toMatch(/CONCURRENTLY/i);
  });
});
