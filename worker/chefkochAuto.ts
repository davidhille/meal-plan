// Chefkoch-Automatik: jeden Tag bis zu 10 neue Hauptspeisen ab 4,5 Sternen (mind. 2 Bewertungen) in die Sammlung
// der Familie. Läuft im Cron (alle 15 Min.) in kleinen Portionen, damit ein Lauf kurz bleibt und Chefkoch nicht
// mit Anfragen überhäuft wird. Übernommen wird wie „In meine Rezepte übernehmen“: Rezept + Chefkoch-Foto + Link;
// zusätzlich `auto_review`: In der Übersicht „Neu“, bis man es behält (oder ausblendet).
import type { Sql } from "./db";
import { listRecipeUrls, loadChefkochRecipe, newestTopMainUrl } from "./chefkoch";
import { excludedByDislikes } from "./dislikes";
import { storeSourcePhoto } from "./images";
import { dislikeMatches, MEAL_DATABASE, violatesHealthConditions } from "./meals";
import { loadContext, sourceKey } from "./repo";

export const AUTO_PER_DAY = 10;
const MIN_RATING = 4.5;
const MIN_RATING_COUNT = 2;
/** Pro Cron-Lauf höchstens so viele Rezeptseiten laden und so viele Ergebnisseiten durchsuchen */
const DETAILS_PER_RUN = 6;
const PAGES_PER_RUN = 3;

/** Nächste Portion für eine Familie; liefert die Namen der übernommenen Rezepte */
export async function importChefkochBatch(sql: Sql, profileId: string, today: string): Promise<string[]> {
  const rows = await sql`SELECT chefkoch_auto_day, chefkoch_auto_count FROM profiles WHERE id = ${profileId}`;
  const done = rows[0]?.chefkoch_auto_day === today ? Number(rows[0]?.chefkoch_auto_count) || 0 : 0;
  if (done >= AUTO_PER_DAY) return [];

  const ctx = await loadContext(sql, profileId);
  // Schon bekannt: eigene Rezepte (Name oder Link), Grundsammlung, ausgeblendete
  const known = await sql`SELECT lower(name) AS name, source_url FROM recipes WHERE profile_id = ${profileId}`;
  const knownNames = new Set([...known.map((r) => r.name as string), ...MEAL_DATABASE.map((m) => m.name.toLowerCase()), ...ctx.rejectedMeals.map((n) => n.toLowerCase())]);
  const knownUrls = new Set(known.map((r) => r.source_url as string).filter(Boolean).map(sourceKey));
  const skipped = await sql`SELECT url FROM chefkoch_auto_skipped WHERE profile_id = ${profileId}`;
  const skippedUrls = new Set(skipped.map((r) => r.url as string));

  const added: string[] = [];
  let loaded = 0;
  for (let page = 0; page < PAGES_PER_RUN && loaded < DETAILS_PER_RUN && done + added.length < AUTO_PER_DAY; page++) {
    const urls = (await listRecipeUrls(newestTopMainUrl(page))).filter((u) => !knownUrls.has(sourceKey(u)) && !skippedUrls.has(u));
    for (const url of urls) {
      if (loaded >= DETAILS_PER_RUN || done + added.length >= AUTO_PER_DAY) break;
      loaded++;
      const skip = async () => {
        await sql`INSERT INTO chefkoch_auto_skipped (profile_id, url) VALUES (${profileId}, ${url}) ON CONFLICT DO NOTHING`;
      };
      let d;
      try {
        d = await loadChefkochRecipe(url);
      } catch {
        await skip();
        continue;
      }
      const r = d.recipe;
      const fits =
        (d.rating ?? 0) >= MIN_RATING &&
        (d.ratingCount ?? 0) >= MIN_RATING_COUNT &&
        !knownNames.has(r.name.toLowerCase()) &&
        !violatesHealthConditions(r, ctx.healthConditions) &&
        !excludedByDislikes(r, ctx.familyDislikes, ctx.familyMembers, (t) => dislikeMatches(r, t));
      if (!fits) {
        await skip();
        continue;
      }
      const inserted = await sql`INSERT INTO recipes (profile_id, name, type, ingredients, instructions, duration_min, source, source_url, auto_review)
        VALUES (${profileId}, ${r.name}, ${r.type}, ${r.ingredients}, ${r.instructions}, ${r.durationMin ?? null}, 'import', ${url}, true)
        ON CONFLICT (profile_id, name) DO NOTHING RETURNING name`;
      if (!inserted.length) continue;
      knownNames.add(r.name.toLowerCase());
      if (d.imageUrl) await storeSourcePhoto(sql, r.name, d.imageUrl, "Chefkoch", url, profileId);
      added.push(r.name);
    }
  }
  await sql`UPDATE profiles SET chefkoch_auto_day = ${today}, chefkoch_auto_count = ${done + added.length} WHERE id = ${profileId}`;
  return added;
}
