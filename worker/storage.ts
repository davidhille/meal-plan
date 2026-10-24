// Datenbank-Größe im Blick behalten: Neon Free erlaubt 1 GB je Projekt (Bilder liegen als bytea in der Datenbank).
// Ist es voll, scheitern alle Schreibzugriffe gleichzeitig – darum Anzeige in der Statistik und Push ab 80 %.
import type { Sql } from "./db";
import type { Env } from "./http";
import { alertOwnerOncePerDay } from "./adminTools";

/** Grenze des Free-Tarifs (Neon: 1 GB je Projekt); bei anderem Tarif hier anpassen */
export const DB_LIMIT_BYTES = 1_073_741_824;
/** Ab diesem Anteil kommt die Warnung */
export const STORAGE_WARN_SHARE = 0.8;

/** Anteil der Grenze, die belegt ist (0 bis über 1) */
export const storageShare = (bytes: number, limit = DB_LIMIT_BYTES) => (limit > 0 ? bytes / limit : 0);

export const storageWarning = (bytes: number, limit = DB_LIMIT_BYTES) => storageShare(bytes, limit) >= STORAGE_WARN_SHARE;

/** „312 MB“ bzw. „1,2 GB“ */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb >= 1024
    ? `${(mb / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} GB`
    : `${Math.round(mb).toLocaleString("de-DE")} MB`;
}

export async function databaseSize(sql: Sql): Promise<number> {
  const rows = await sql`SELECT pg_database_size(current_database())::float AS bytes`;
  return Number(rows[0]?.bytes) || 0;
}

/** Push an den Betreiber (einmal am Tag), wenn die Datenbank zu 80 % voll ist. Darf nie scheitern. */
export async function checkStorageWarning(env: Env, sql: Sql): Promise<void> {
  try {
    const bytes = await databaseSize(sql);
    if (!storageWarning(bytes)) return;
    await alertOwnerOncePerDay(env, sql, "speicher", {
      title: "Datenbank fast voll",
      body: `${formatBytes(bytes)} von ${formatBytes(DB_LIMIT_BYTES)} belegt (${Math.round(storageShare(bytes) * 100)} %). Alte Bilder aufräumen oder Tarif wechseln.`,
    });
  } catch (err) {
    console.error("Speicher-Prüfung fehlgeschlagen:", err);
  }
}
