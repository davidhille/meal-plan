// Datenbank-Migrationen: Dateien in worker/migrations/, ausgeführt beim ersten Aufruf nach einem Deploy.
//
// Ablauf:
// 1. Schnellweg: Der Name der neuesten Migration steht als Kommentar an der Tabelle `profiles`. Stimmt er,
//    passiert nichts weiter – ein Kaltstart führt so keine DDL aus. (ALTER TABLE sperrt die Tabelle auch,
//    wenn sich nichts ändert; das hat die App schon einmal hängen lassen, siehe PR #5.)
// 2. Sonst: Tabelle `schema_migrations` anlegen, fehlende Migrationen der Reihe nach je in einer Transaktion
//    ausführen und eintragen, danach den Kommentar setzen.
// Laufen zwei Worker gleichzeitig an, kann eine Migration doppelt laufen – deshalb immer idempotent schreiben.
import type { Sql } from "./db";
import { MIGRATIONS, type Migration } from "./migrations";

/** Minimale Datenbank-Schnittstelle (damit sich der Ablauf ohne Neon testen lässt) */
export interface MigrationDb {
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  transaction(statements: { text: string; params?: unknown[] }[]): Promise<unknown>;
}

/** Schema-Stand vor den Migrationsdateien; entspricht genau 0001_basis */
export const LEGACY_VERSION = "schema:2026101207";
const marker = (id: string) => `migration:${id}`;

/** Fehlende Migrationen ausführen; gibt die IDs der ausgeführten zurück */
export async function runMigrations(db: MigrationDb, migrations: Migration[] = MIGRATIONS): Promise<string[]> {
  const latest = migrations[migrations.length - 1].id;
  const current = await db.query(`SELECT obj_description(to_regclass('public.profiles'), 'pg_class') AS v`);
  const version = current[0]?.v;
  if (version === marker(latest)) return [];

  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now())`);
  // Datenbank aus der Zeit vor den Migrationsdateien: Grundschema ist schon da
  if (version === LEGACY_VERSION) {
    await db.query(`INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [migrations[0].id]);
  }
  const applied = new Set((await db.query(`SELECT id FROM schema_migrations`)).map((r) => r.id as string));

  const ran: string[] = [];
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    await db.transaction([
      ...m.statements.map((text) => ({ text })),
      { text: `INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING`, params: [m.id] },
    ]);
    console.log(`Migration ${m.id} ausgeführt`);
    ran.push(m.id);
  }
  // Nur eine Abkürzung für den nächsten Kaltstart – darf die Anfrage nicht scheitern lassen
  await db.query(`COMMENT ON TABLE profiles IS '${marker(latest)}'`).catch((e) => console.warn("Schema-Stand nicht gespeichert", e));
  return ran;
}

/** Neon-Verbindung als MigrationDb */
export function neonMigrationDb(sql: Sql): MigrationDb {
  return {
    query: (text, params) => sql.query(text, params),
    transaction: (statements) => sql.transaction(statements.map((s) => sql.query(s.text, s.params))),
  };
}

let schemaReady: Promise<unknown> | null = null;

/** Einmal pro Worker-Instanz: Schema auf den neuesten Stand bringen */
export function ensureSchema(sql: Sql) {
  schemaReady ??= runMigrations(neonMigrationDb(sql)).catch((e) => {
    schemaReady = null;
    throw e;
  });
  return schemaReady;
}
