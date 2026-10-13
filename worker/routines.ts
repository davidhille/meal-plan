// Routinen automatisch ausführen (Cloudflare Cron, alle 15 Min)
import { neon } from "@neondatabase/serverless";
import type { Env } from "./http";
import { ensureSchema } from "./migrate";
import { fillMissingImages } from "./images";
import { addDaysIso, createPlan } from "./planning";

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
            to_char(last_run_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS last_run_date
     FROM routines WHERE active = true`
  );

  for (const r of routines) {
    const dueToday = r.frequency === "weekly" ? r.day_of_week === now.weekday : now.day === 1;
    const timeReached = now.time >= (r.time || "00:00");
    if (!dueToday || !timeReached || r.last_run_date === now.date) continue;

    // Erst als ausgeführt markieren, damit parallele Läufe keinen doppelten Plan erzeugen
    const claimed = await sql`UPDATE routines SET last_run_at = now()
      WHERE id = ${r.id} AND (last_run_at IS NULL OR (last_run_at AT TIME ZONE 'Europe/Berlin')::date < ${now.date}::date)
      RETURNING id`;
    if (!claimed.length) continue;

    const start = addDaysIso(now.date, 1);
    const end = addDaysIso(start, Math.max(1, r.duration_days) - 1);
    await createPlan(env, sql, r.profile_id, start, end);
    console.log(`Routine "${r.name}" ausgeführt: Plan ${start} bis ${end}`);
  }

  // Fehlende Rezeptbilder nachziehen
  await fillMissingImages(env, sql, 5);
}
