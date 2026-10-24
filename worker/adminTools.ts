// Werkzeuge für den Betreiber: Fehler-Protokoll, Warnung beim KI-Kontingent, Datensicherung einer Familie
import type { Row, Sql } from "./db";
import type { Env } from "./http";
import { sendToProfile } from "./push";
import { DAILY_FREE_NEURONS } from "./aiUsage";

/** Beginn des heutigen KI-Tages (das Gratis-Kontingent läuft um 00:00 UTC neu an) */
export const UTC_TODAY = `date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`;

/**
 * Fehler für die Übersicht in der Administration merken – darf selbst nie scheitern.
 * `oncePerDay`: gleiche Quelle derselben Familie innerhalb von 24 Stunden nur einmal (für Fehler, die sich dauernd wiederholen,
 * damit sie die seltenen, echten Fehler nicht verdecken).
 */
export async function logError(
  sql: Sql,
  source: string,
  message: unknown,
  profileId: string | null = null,
  opts: { oncePerDay?: boolean } = {}
): Promise<void> {
  try {
    const text = String((message as Error)?.message ?? message).slice(0, 500);
    if (opts.oncePerDay) {
      const seen = await sql`SELECT 1 FROM app_errors WHERE source = ${source.slice(0, 120)}
        AND profile_id IS NOT DISTINCT FROM ${profileId} AND created_at > now() - interval '1 day' LIMIT 1`;
      if (seen.length) return;
    }
    await sql`INSERT INTO app_errors (profile_id, source, message) VALUES (${profileId}, ${source.slice(0, 120)}, ${text})`;
    // Alte Einträge gelegentlich aufräumen
    if (Math.random() < 0.05) await sql`DELETE FROM app_errors WHERE created_at < now() - interval '60 days'`;
  } catch (err) {
    console.error("Fehler nicht protokolliert:", err);
  }
}

/** Einmal am Tag: abgelaufene Sitzungen und Einladungen sowie sehr alte KI-Zähler löschen (die Tabellen wüchsen sonst endlos) */
export async function cleanupOldRows(sql: Sql): Promise<void> {
  await sql`DELETE FROM sessions WHERE expires_at < now() - interval '7 days'`;
  await sql`DELETE FROM invites WHERE expires_at < now() - interval '30 days'`;
  await sql`DELETE FROM ai_usage WHERE created_at < now() - interval '400 days'`;
}

/** Verbrauch heute (alle Familien zusammen) */
export async function neuronsToday(sql: Sql, profileId?: string): Promise<number> {
  const rows = profileId
    ? await sql.query(`SELECT COALESCE(sum(neurons), 0)::float AS n FROM ai_usage WHERE profile_id = $1 AND created_at >= ${UTC_TODAY}`, [profileId])
    : await sql.query(`SELECT COALESCE(sum(neurons), 0)::float AS n FROM ai_usage WHERE created_at >= ${UTC_TODAY}`);
  return Number(rows[0]?.n) || 0;
}

/** Ab 80 % des Gratis-Kontingents einmal am Tag eine Push-Nachricht an den Betreiber */
export async function checkAiWarning(env: Env, sql: Sql): Promise<void> {
  try {
    const used = await neuronsToday(sql);
    if (used < DAILY_FREE_NEURONS * 0.8) return;
    const day = new Date().toISOString().slice(0, 10);
    const claimed = await sql`INSERT INTO app_settings (key, value) VALUES ('ai_warn_day', ${day})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() WHERE app_settings.value <> EXCLUDED.value
      RETURNING key`;
    if (!claimed.length) return;
    const owners = await sql`SELECT DISTINCT profile_id FROM users WHERE is_owner`;
    for (const o of owners) {
      await sendToProfile(env, sql, o.profile_id as string, {
        title: "KI-Kontingent fast aufgebraucht",
        body: `Heute schon ${Math.round(used).toLocaleString("de-DE")} von ${DAILY_FREE_NEURONS.toLocaleString("de-DE")} Neurons (${Math.round((used / DAILY_FREE_NEURONS) * 100)} %).`,
        url: "/#einstellungen",
        tag: "ki-kontingent",
      });
    }
  } catch (err) {
    console.error("KI-Warnung fehlgeschlagen:", err);
  }
}

/**
 * Push an den Betreiber, höchstens einmal pro Tag und Anlass (`key`). So fällt ein Ausfall auf, ohne dass
 * ein dauernder Fehler das Handy zuspammt. Darf nie scheitern.
 */
export async function alertOwnerOncePerDay(
  env: Env,
  sql: Sql,
  key: string,
  msg: { title: string; body: string; url?: string }
): Promise<void> {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const claimed = await sql`INSERT INTO app_settings (key, value) VALUES (${`alert_${key}_day`}, ${day})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now() WHERE app_settings.value <> EXCLUDED.value
      RETURNING key`;
    if (!claimed.length) return;
    const owners = await sql`SELECT DISTINCT profile_id FROM users WHERE is_owner`;
    for (const o of owners) {
      await sendToProfile(env, sql, o.profile_id as string, {
        title: msg.title.slice(0, 80),
        body: msg.body.slice(0, 200),
        url: msg.url ?? "/#einstellungen",
        tag: `alert-${key}`,
      });
    }
  } catch (err) {
    console.error("Alarm an den Betreiber fehlgeschlagen:", err);
  }
}

// ---------- Datensicherung ----------

/** Nicht gesichert: Zugänge, Sitzungen, Einladungen, Geräte für Push, Protokolle */
const SKIP = new Set(["users", "sessions", "invites", "push_subscriptions", "ai_usage", "app_errors", "feedback", "profiles"]);
/** Tabellen, die über den Plan an der Familie hängen */
const PLAN_CHILDREN = ["plan_meals", "shopping_item_state", "shopping_extras"];

async function familyTables(sql: Sql): Promise<string[]> {
  const rows = await sql`SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'profile_id' ORDER BY table_name`;
  return rows.map((r) => r.table_name as string).filter((t) => !SKIP.has(t));
}

export interface FamilyBackup {
  version: 1;
  exportedAt: string;
  family: string | null;
  profile: Row;
  tables: Record<string, Row[]>;
}

/**
 * Alle Daten einer Familie als JSON (ohne Zugänge und Push-Geräte).
 * Alle Abfragen laufen als ein Batch (eine Unteranfrage, ein gemeinsamer Stand). `withImages: false` lässt die Bilddaten
 * (`meal_images.image_data`) weg – für die automatische Sicherung, damit die Antwort klein bleibt.
 */
export async function exportFamily(sql: Sql, profileId: string, opts: { withImages?: boolean } = {}): Promise<FamilyBackup | null> {
  const withImages = opts.withImages ?? true;
  const profiles = await sql`SELECT row_to_json(p) AS r FROM profiles p WHERE id = ${profileId}`;
  if (!profiles[0]) return null;
  const names: string[] = [];
  const queries: Query[] = [];
  for (const t of await familyTables(sql)) {
    const col = !withImages && t === "meal_images" ? `to_jsonb(x) - 'image_data'` : `row_to_json(x)`;
    names.push(t);
    queries.push({ text: `SELECT ${col} AS r FROM ${t} x WHERE profile_id = $1`, params: [profileId] });
  }
  for (const t of PLAN_CHILDREN) {
    names.push(t);
    queries.push({
      text: `SELECT row_to_json(x) AS r FROM ${t} x WHERE plan_id IN (SELECT id FROM meal_plans WHERE profile_id = $1)`,
      params: [profileId],
    });
  }
  const results = await runBatch(sql, queries);
  const tables: Record<string, Row[]> = {};
  names.forEach((t, i) => {
    tables[t] = results[i].map((r) => r.r as Row);
  });
  const profile = profiles[0].r as Row;
  return { version: 1, exportedAt: new Date().toISOString(), family: (profile.name as string) ?? null, profile, tables };
}

/** Eine Abfrage als Teil einer Transaktion (Neon) bzw. nacheinander (lokale Tests) */
type Query = { text: string; params: unknown[] };
/** Alle Abfragen in einer Anfrage an die Datenbank; liefert die Ergebnisse in der Reihenfolge der Abfragen */
async function runBatch(sql: Sql, queries: Query[]): Promise<Row[][]> {
  const s = sql as unknown as { transaction?: (q: unknown[]) => Promise<unknown> };
  if (typeof s.transaction === "function") return (await s.transaction(queries.map((q) => sql.query(q.text, q.params)))) as Row[][];
  const out: Row[][] = [];
  for (const q of queries) out.push((await sql.query(q.text, q.params)) as Row[]);
  return out;
}
async function runAll(sql: Sql, queries: Query[]) {
  const s = sql as unknown as { transaction?: (q: unknown[]) => Promise<unknown> };
  if (typeof s.transaction === "function") await s.transaction(queries.map((q) => sql.query(q.text, q.params)));
  else for (const q of queries) await sql.query(q.text, q.params);
}

/**
 * Sicherung in eine Familie zurückspielen: deren Daten werden ersetzt (Zugänge bleiben). Name und Sperre der Familie
 * bleiben, die übrigen Einstellungen kommen aus der Sicherung. Alles in einer Transaktion.
 */
export async function importFamily(sql: Sql, profileId: string, backup: unknown): Promise<{ rows: number }> {
  const b = backup as Partial<FamilyBackup> | null;
  if (!b || b.version !== 1 || typeof b.tables !== "object" || !b.tables || typeof b.profile !== "object") {
    throw new Error("Das ist keine gültige Sicherung.");
  }
  if (b.profile && (b.profile as Row).id !== profileId) {
    throw new Error("Diese Sicherung gehört zu einer anderen Familie.");
  }
  const allowed = new Set([...(await familyTables(sql)), ...PLAN_CHILDREN]);
  const unknownTables = Object.keys(b.tables).filter((t) => !allowed.has(t));
  if (unknownTables.length) throw new Error(`Unbekannte Tabellen in der Sicherung: ${unknownTables.join(", ")}`);

  const queries: Query[] = [];
  // Erst alles der Familie löschen (Plan-Tabellen hängen per CASCADE an meal_plans)
  for (const t of await familyTables(sql)) queries.push({ text: `DELETE FROM ${t} WHERE profile_id = $1`, params: [profileId] });

  // Einstellungen der Familie (ohne id, Name, Sperre)
  const cols = (await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles'`)
    .map((r) => r.column_name as string)
    .filter((c) => !["id", "name", "disabled", "created_at"].includes(c));
  if (cols.length) {
    queries.push({
      text: `UPDATE profiles p SET (${cols.map((c) => `"${c}"`).join(", ")}) =
        (SELECT ${cols.map((c) => `x."${c}"`).join(", ")} FROM json_populate_record(NULL::profiles, $2::text::json) x) WHERE p.id = $1`,
      params: [profileId, JSON.stringify(b.profile)],
    });
  }

  // Zeilen einfügen: profile_id auf die Zielfamilie setzen; Pläne vor ihren Kind-Tabellen
  const order = [...Object.keys(b.tables).filter((t) => !PLAN_CHILDREN.includes(t)), ...PLAN_CHILDREN.filter((t) => b.tables![t])];
  let count = 0;
  for (const t of order) {
    const rows = (b.tables[t] ?? []).map((r) => ("profile_id" in r ? { ...r, profile_id: profileId } : r));
    if (!rows.length) continue;
    count += rows.length;
    queries.push({ text: `INSERT INTO ${t} SELECT * FROM json_populate_recordset(NULL::${t}, $1::text::json)`, params: [JSON.stringify(rows)] });
  }
  await runAll(sql, queries);
  return { rows: count };
}
