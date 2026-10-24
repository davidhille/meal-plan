// Routinen automatisch ausführen (Cloudflare Cron, alle 15 Min)
import { meteredEnv } from "./aiUsage";
import { alertOwnerOncePerDay, cleanupOldRows, logError } from "./adminTools";
import { runBackupStep } from "./backup";
import { checkStorageWarning } from "./storage";
import { MAX_ROUTINE_ATTEMPTS, cronTick, pickAutoFamily, routineDue, shouldRetryRoutine } from "./routineRules";
import { neon } from "@neondatabase/serverless";
import type { Env } from "./http";
import { ensureSchema } from "./migrate";
import { fillMissingImages } from "./images";
import { addDaysIso, createPlan } from "./planning";
import { sendRatingReminders } from "./push";
import { AUTO_PER_DAY, importChefkochBatch } from "./chefkochAuto";

/** Aktuelles Datum/Uhrzeit in Deutschland */
function berlinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`, weekday, day: Number(parts.day) };
}

/** Fällige Routinen ausführen: Plan ab morgen über duration_days Tage */
export async function runRoutines(env: Env) {
  if (!env.DATABASE_URL) return;
  const sql = neon(env.DATABASE_URL);
  await ensureSchema(sql);
  const now = berlinNow();

  const routines = await sql.query(
    `SELECT id, profile_id, name, frequency, day_of_week, to_char(time, 'HH24:MI') AS time, duration_days,
            to_char(last_run_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS last_run_date, last_run_at::text AS prev_run
     FROM routines WHERE active = true AND profile_id IN (SELECT id FROM profiles WHERE NOT disabled)`
  );

  for (const r of routines) {
    if (!routineDue(r as Parameters<typeof routineDue>[0], now)) continue;

    // Erst als ausgeführt markieren, damit parallele Läufe keinen doppelten Plan erzeugen; dabei die Versuche des Tages zählen
    const claimed = await sql`UPDATE routines SET last_run_at = now(),
        run_attempts = CASE WHEN run_attempt_date = ${now.date}::date THEN run_attempts + 1 ELSE 1 END,
        run_attempt_date = ${now.date}::date
      WHERE id = ${r.id} AND (last_run_at IS NULL OR (last_run_at AT TIME ZONE 'Europe/Berlin')::date < ${now.date}::date)
      RETURNING run_attempts`;
    if (!claimed.length) continue;
    const attempts = Number(claimed[0].run_attempts);

    const start = addDaysIso(now.date, 1);
    const end = addDaysIso(start, Math.max(1, r.duration_days) - 1);
    try {
      await createPlan(meteredEnv(env, sql, r.profile_id), sql, r.profile_id, start, end);
      console.log(`Routine "${r.name}" ausgeführt: Plan ${start} bis ${end}`);
    } catch (e) {
      // Eine fehlgeschlagene Routine soll Erinnerungen und Bilder nicht aufhalten
      console.error(`Routine "${r.name}" fehlgeschlagen:`, e);
      await logError(sql, `Routine „${r.name}“`, e, r.profile_id);
      if (shouldRetryRoutine(attempts)) {
        // Markierung zurücknehmen: der nächste Cron-Lauf (in 15 Min) versucht es noch einmal
        await sql`UPDATE routines SET last_run_at = ${r.prev_run ?? null}::timestamptz WHERE id = ${r.id}`.catch(() => {});
      } else {
        await alertOwnerOncePerDay(env, sql, "routine", {
          title: "Routine fehlgeschlagen",
          body: `„${r.name}“ ist heute ${MAX_ROUTINE_ATTEMPTS}× gescheitert. Wochenplan fehlt noch.`,
        });
      }
    }
  }

  // Chefkoch-Automatik: ab der eingestellten Uhrzeit (Standard 6:00) in kleinen Portionen, bis 10 neue Rezepte pro Familie und Tag
  const families = await sql`SELECT id, chefkoch_auto_time <= ${now.time} AS due,
      (chefkoch_auto_day IS DISTINCT FROM ${now.date} OR chefkoch_auto_count < ${AUTO_PER_DAY}) AS open
    FROM profiles WHERE chefkoch_auto AND NOT disabled`;
  // Nur eine Familie je Lauf (Free-Limit: 50 Unteranfragen; eine Familie braucht ca. 20), reihum
  const auto = pickAutoFamily(families.map((f) => ({ id: f.id as string, due: !!f.due, open: !!f.open })), cronTick(Date.now()));
  // Fotos holt die App aus dem Browser (`chefkochPhotos.ts`)
  if (auto) await importChefkochBatch(sql, auto.id, now.date).catch((e) => logError(sql, "Chefkoch-Automatik", e, auto.id));

  // Erinnerung zum Bewerten (Fehler hier sollen die Bilder nicht aufhalten)
  await sendRatingReminders(env, sql, now).catch((e) => logError(sql, "Bewertungs-Erinnerung", e));

  // Fehlende Rezeptbilder nachziehen
  await fillMissingImages(meteredEnv(env, sql, null), sql, 5).catch((e) => logError(sql, "Bilder nachziehen", e));

  // Betrieb: stündlich Speicher prüfen, um 4 Uhr aufräumen, wöchentlich je Familie sichern (nur mit R2-Bucket)
  const firstOfHour = now.time.slice(3) < "15";
  if (firstOfHour) await checkStorageWarning(env, sql);
  if (firstOfHour && now.time.startsWith("04:")) await cleanupOldRows(sql).catch((e) => logError(sql, "Aufräumen", e, null, { oncePerDay: true }));
  await runBackupStep(env, sql, now.date).catch(async (e) => {
    await logError(sql, "Sicherung", e, null, { oncePerDay: true });
    await alertOwnerOncePerDay(env, sql, "sicherung", { title: "Sicherung fehlgeschlagen", body: String((e as Error)?.message ?? e) });
  });
}
