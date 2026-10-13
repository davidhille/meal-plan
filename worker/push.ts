// Erinnerung zum Bewerten per Web Push: Schlüssel, Geräte, Versand, Cron.
import type { Sql } from "./db";
import type { Env } from "./http";
import { decrypt, encrypt } from "./shops";
import { generateVapidKeys, sendWebPush, type PushSubscriptionKeys, type VapidKeys } from "./webpush";

/** Push-Dienste der Browser (Chrome/Android, Firefox, Safari/iOS, Edge) – an andere Adressen schickt der Worker nichts */
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** VAPID-Schlüssel laden; beim ersten Mal erzeugen und (privater Teil verschlüsselt) speichern */
export async function getVapidKeys(env: Env, sql: Sql): Promise<VapidKeys> {
  const load = async () => {
    const rows = await sql`SELECT value, iv FROM app_settings WHERE key = 'vapid'`;
    return rows[0] ? (JSON.parse(await decrypt(env, rows[0].value, rows[0].iv)) as VapidKeys) : null;
  };
  try {
    const keys = await load();
    if (keys) return keys;
  } catch {
    // Schlüssel zum Entschlüsseln geändert → alte Schlüssel und Geräte sind unbrauchbar, neu anfangen
    console.warn("VAPID-Schlüssel nicht lesbar – neu erzeugt, Geräte müssen die Erinnerung neu einschalten");
    await sql`DELETE FROM app_settings WHERE key = 'vapid'`;
    await sql`DELETE FROM push_subscriptions`;
  }
  const fresh = await generateVapidKeys();
  const e = await encrypt(env, JSON.stringify(fresh));
  // Zwei Anfragen gleichzeitig: nur die erste gewinnt, danach gilt das Gespeicherte
  await sql`INSERT INTO app_settings (key, value, iv) VALUES ('vapid', ${e.ciphertext}, ${e.iv}) ON CONFLICT (key) DO NOTHING`;
  return (await load()) ?? fresh;
}

/** Absender-Angabe für den Push-Dienst: Adresse der App (beim Einschalten gemerkt) */
async function subject(sql: Sql): Promise<string> {
  const rows = await sql`SELECT value FROM app_settings WHERE key = 'app_origin'`;
  return (rows[0]?.value as string | undefined) ?? "https://meal-plan.davidshille.workers.dev";
}

export async function rememberOrigin(sql: Sql, origin: string) {
  await sql`INSERT INTO app_settings (key, value) VALUES ('app_origin', ${origin})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Wohin ein Tipp auf die Benachrichtigung führt */
  url: string;
  /** Gleicher Tag ersetzt eine ältere Benachrichtigung */
  tag?: string;
}

/** An alle Geräte eines Profils (oder nur eines) schicken; ungültige Geräte werden entfernt */
export async function sendToProfile(env: Env, sql: Sql, profileId: string, msg: PushMessage, onlyEndpoint?: string) {
  const subs = onlyEndpoint
    ? await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE profile_id = ${profileId} AND endpoint = ${onlyEndpoint}`
    : await sql`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE profile_id = ${profileId}`;
  if (!subs.length) return { sent: 0, failed: 0, removed: 0 };
  const keys = await getVapidKeys(env, sql);
  const from = await subject(sql);
  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (const s of subs) {
    const result = await sendWebPush(s as PushSubscriptionKeys, JSON.stringify(msg), keys, from).catch((e) => {
      console.warn("Push fehlgeschlagen:", e);
      return "failed" as const;
    });
    if (result === "ok") sent++;
    else if (result === "gone") {
      removed++;
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
    } else failed++;
  }
  return { sent, failed, removed };
}

/**
 * Cron: Ist die Erinnerungszeit erreicht und das heutige Gericht noch nicht bewertet, eine Benachrichtigung
 * an alle Geräte. Höchstens einmal pro Tag (reminder_last_sent wird vorher gesetzt).
 */
export async function sendRatingReminders(env: Env, sql: Sql, now: { date: string; time: string }) {
  const profiles = await sql`SELECT p.id, p.reminder_time FROM profiles p
    WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.profile_id = p.id)
      AND (p.reminder_last_sent IS NULL OR p.reminder_last_sent < ${now.date}::date)`;
  for (const p of profiles) {
    if (now.time < (p.reminder_time as string)) continue;
    const claimed = await sql`UPDATE profiles SET reminder_last_sent = ${now.date}::date
      WHERE id = ${p.id} AND (reminder_last_sent IS NULL OR reminder_last_sent < ${now.date}::date) RETURNING id`;
    if (!claimed.length) continue;
    const meals = await sql`SELECT pm.meal_name FROM plan_meals pm JOIN meal_plans mp ON mp.id = pm.plan_id
      WHERE mp.profile_id = ${p.id} AND mp.status = 'active' AND pm.meal_date = ${now.date}::date AND NOT pm.rejected
      ORDER BY mp.created_at DESC LIMIT 1`;
    const name = meals[0]?.meal_name as string | undefined;
    if (!name) continue;
    const rated = await sql`SELECT 1 FROM meal_ratings WHERE profile_id = ${p.id} AND meal_name = ${name}`;
    if (rated.length) continue;
    const r = await sendToProfile(env, sql, p.id, {
      title: "Wie war das Essen?",
      body: `„${name}“ – kurz bewerten, dann plant die App besser.`,
      // Öffnet in der App direkt das Bewerten-Fenster für dieses Gericht
      url: `/?bewerten=${encodeURIComponent(name)}#speiseplan`,
      tag: "bewerten",
    });
    console.log(`Bewertungs-Erinnerung „${name}“: ${r.sent} gesendet, ${r.failed} fehlgeschlagen, ${r.removed} entfernt`);
  }
}
