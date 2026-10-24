// Wöchentliche Sicherung jeder Familie als JSON in einen Cloudflare-R2-Bucket (Binding `BACKUPS`).
// Ohne Binding passiert nichts. Je Cron-Lauf höchstens eine Familie (Free-Tarif: 50 Unteranfragen je Aufruf).
// Bilddaten sind nicht dabei (Neons Antwortgrenze); Zugänge und Protokolle auch nicht – wie bei der Sicherung in der Administration.
// Zurückspielen: Datei aus R2 laden, Administration → Familie → Wiederherstellen.
import type { Sql } from "./db";
import type { Env } from "./http";
import { exportFamily } from "./adminTools";

export const BACKUP_EVERY_DAYS = 7;
/** So viele Sicherungen je Familie bleiben im Bucket */
export const BACKUP_KEEP = 8;

export const backupKey = (profileId: string, date: string) => `${profileId}/${date}.json`;

/** Datum (YYYY-MM-DD) vor `n` Tagen */
export function daysAgoIso(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Welche Dateien (Schlüssel `<Familie>/<Datum>.json`) sind älter als die neuesten `keep`? */
export function backupsToDelete(keys: string[], keep = BACKUP_KEEP): string[] {
  return [...keys].sort().reverse().slice(keep);
}

async function setting(sql: Sql, key: string, value: string) {
  await sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

/**
 * Eine fällige Familie sichern (letzte Sicherung älter als 7 Tage); gibt deren ID zurück, sonst null.
 * Ein Fehlversuch zählt für den Tag (`backup_try_…`), damit nicht alle 15 Minuten neu begonnen wird.
 */
export async function runBackupStep(env: Env, sql: Sql, today: string): Promise<string | null> {
  const bucket = env.BACKUPS;
  if (!bucket) return null;
  const due = await sql`SELECT p.id FROM profiles p WHERE NOT p.disabled
    AND COALESCE((SELECT value FROM app_settings WHERE key = 'backup_ok_' || p.id::text), '') <= ${daysAgoIso(today, BACKUP_EVERY_DAYS)}
    AND COALESCE((SELECT value FROM app_settings WHERE key = 'backup_try_' || p.id::text), '') < ${today}
    ORDER BY p.created_at LIMIT 1`;
  const id = due[0]?.id as string | undefined;
  if (!id) return null;

  await setting(sql, `backup_try_${id}`, today);
  const backup = await exportFamily(sql, id, { withImages: false });
  if (!backup) return null;
  await bucket.put(backupKey(id, today), JSON.stringify(backup), { httpMetadata: { contentType: "application/json" } });
  await setting(sql, `backup_ok_${id}`, today);

  // Alte Sicherungen aufräumen
  const listed = await bucket.list({ prefix: `${id}/` });
  const old = backupsToDelete(listed.objects.map((o) => o.key));
  if (old.length) await bucket.delete(old);
  return id;
}
