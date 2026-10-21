// Administration (nur Betreiber): Familien anlegen, einladen, umbenennen, sperren, löschen
import type { Ctx } from "../http";
import { json } from "../http";
import { INVITE_DAYS, createInvite, type SessionUser } from "../auth";
import { DEFAULT_LABELS } from "../shoppingList";
import { DAILY_FREE_NEURONS } from "../aiUsage";

/** Beginn des heutigen KI-Tages: das Gratis-Kontingent läuft um 00:00 UTC neu an */
const UTC_TODAY = `date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`;

/** Statistik pro Familie und KI-Verbrauch (geschätzte Neurons, siehe aiUsage.ts) */
async function familyStats(sql: Ctx["sql"], ownProfileId: string) {
  const usage = `SELECT profile_id,
      COALESCE(sum(neurons) FILTER (WHERE created_at >= ${UTC_TODAY}), 0)::float AS today,
      COALESCE(sum(neurons) FILTER (WHERE created_at >= now() - interval '7 days'), 0)::float AS week,
      COALESCE(sum(neurons), 0)::float AS month,
      COALESCE(sum(neurons) FILTER (WHERE kind = 'recipe'), 0)::float AS recipes,
      COALESCE(sum(neurons) FILTER (WHERE kind <> 'recipe'), 0)::float AS images,
      count(*) FILTER (WHERE kind = 'recipe')::int AS "recipeCalls",
      count(*) FILTER (WHERE kind = 'image')::int AS "imageCalls"
    FROM ai_usage WHERE created_at >= now() - interval '30 days' GROUP BY profile_id`;
  const families = await sql.query(
    `SELECT p.id, p.name, p.disabled,
      (SELECT count(*)::int FROM users u WHERE u.profile_id = p.id) AS "userCount",
      GREATEST(
        (SELECT max(s.last_seen_at) FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.profile_id = p.id),
        (SELECT max(u.last_login_at) FROM users u WHERE u.profile_id = p.id))::text AS "lastActiveAt",
      (SELECT count(*)::int FROM meal_plans mp WHERE mp.profile_id = p.id) AS "planCount",
      (SELECT count(*)::int FROM plan_meals pm JOIN meal_plans mp ON mp.id = pm.plan_id
        WHERE mp.profile_id = p.id AND NOT pm.rejected AND pm.meal_date >= current_date - 30 AND pm.meal_date <= current_date) AS "meals30",
      (SELECT count(*)::int FROM meal_ratings r WHERE r.profile_id = p.id) AS "ratingCount",
      (SELECT count(*)::int FROM favorites f WHERE f.profile_id = p.id) AS "favoriteCount",
      (SELECT count(*)::int FROM recipes r WHERE r.profile_id = p.id AND r.source = 'ai' AND r.replaces IS NULL) AS "aiRecipeCount",
      (SELECT count(*)::int FROM recipes r WHERE r.profile_id = p.id AND r.source = 'import') AS "importCount",
      to_jsonb(u) - 'profile_id' AS ai
    FROM profiles p LEFT JOIN (${usage}) u ON u.profile_id = p.id
    ORDER BY COALESCE(u.month, 0) DESC, p.created_at`
  );
  const auto = await sql.query(`SELECT to_jsonb(u) - 'profile_id' AS ai FROM (${usage}) u WHERE u.profile_id IS NULL`);
  const daily = await sql.query(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(sum(a.neurons), 0)::float AS neurons
    FROM generate_series((${UTC_TODAY}) - interval '29 days', ${UTC_TODAY}, interval '1 day') d
    LEFT JOIN ai_usage a ON a.created_at >= d AND a.created_at < d + interval '1 day'
    GROUP BY d ORDER BY d`
  );
  const since = await sql`SELECT min(created_at)::text AS since FROM ai_usage`;
  const empty = { today: 0, week: 0, month: 0, recipes: 0, images: 0, recipeCalls: 0, imageCalls: 0 };
  return {
    dailyLimit: DAILY_FREE_NEURONS,
    since: (since[0]?.since as string | null) ?? null,
    daily,
    automatic: auto[0]?.ai ?? empty,
    families: families.map((f) => ({ ...f, ai: f.ai ?? empty, own: f.id === ownProfileId })),
  };
}

async function listFamilies(sql: Ctx["sql"], ownProfileId: string) {
  const rows = await sql`SELECT p.id, p.name, p.disabled, p.created_at::text AS "createdAt",
      (SELECT count(*)::int FROM users u WHERE u.profile_id = p.id) AS "userCount",
      (SELECT max(u.last_login_at)::text FROM users u WHERE u.profile_id = p.id) AS "lastLoginAt",
      (SELECT count(*)::int FROM meal_plans mp WHERE mp.profile_id = p.id) AS "planCount",
      (SELECT count(*)::int FROM invites i WHERE i.profile_id = p.id AND i.used_at IS NULL AND i.expires_at > now()) AS "openInvites"
    FROM profiles p ORDER BY p.created_at`;
  return rows.map((r) => ({ ...r, own: r.id === ownProfileId }));
}

const inviteUrl = (request: Request, token: string) => `${new URL(request.url).origin}/?einladung=${token}`;

export async function adminRoutes({ request, sql, body, parts, route }: Ctx, user: SessionUser): Promise<Response | null> {
  if (parts[0] !== "admin") return null;
  if (!user.isOwner) return json({ error: "Nur für den Betreiber." }, 403);
  const id = parts[2];

  if (route === "GET /admin/families") return json(await listFamilies(sql, user.profileId));
  if (route === "GET /admin/stats") return json(await familyStats(sql, user.profileId));

  // Neue Familie: Start-Listen „Einkauf“ (Standard) und „Metzger“, dazu ein Einladungslink
  if (route === "POST /admin/families") {
    const name = String(body.name ?? "").trim().slice(0, 80);
    if (!name) return json({ error: "Bitte einen Namen für die Familie angeben." }, 400);
    const rows = await sql`INSERT INTO profiles (name, standard_label) VALUES (${name}, 'einkauf') RETURNING id`;
    const profileId = rows[0].id as string;
    for (const [i, l] of DEFAULT_LABELS.entries()) {
      await sql`INSERT INTO shopping_labels (profile_id, id, name, color, sort, provider)
        VALUES (${profileId}, ${l.id}, ${l.name}, ${l.color}, ${i}, ${l.provider}) ON CONFLICT DO NOTHING`;
    }
    const token = await createInvite(sql, profileId);
    return json({ families: await listFamilies(sql, user.profileId), inviteUrl: inviteUrl(request, token), days: INVITE_DAYS });
  }

  if (parts[1] === "families" && id) {
    const exists = await sql`SELECT id FROM profiles WHERE id = ${id}`;
    if (!exists[0]) return json({ error: "Familie nicht gefunden" }, 404);

    // Neuer Einladungslink (z. B. abgelaufen oder für eine weitere Person)
    if (parts[3] === "invite" && request.method === "POST") {
      const token = await createInvite(sql, id);
      return json({ families: await listFamilies(sql, user.profileId), inviteUrl: inviteUrl(request, token), days: INVITE_DAYS });
    }
    if (!parts[3] && request.method === "PUT") {
      if (body.name !== undefined) {
        const name = String(body.name ?? "").trim().slice(0, 80);
        if (!name) return json({ error: "Bitte einen Namen angeben." }, 400);
        await sql`UPDATE profiles SET name = ${name} WHERE id = ${id}`;
      }
      if (body.disabled !== undefined) {
        if (id === user.profileId) return json({ error: "Die eigene Familie lässt sich nicht sperren." }, 400);
        await sql`UPDATE profiles SET disabled = ${!!body.disabled} WHERE id = ${id}`;
        if (body.disabled) await sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE profile_id = ${id})`;
      }
      return json(await listFamilies(sql, user.profileId));
    }
    // Löschen: alles der Familie (Pläne, Rezepte, Zugänge …) – die gemeinsamen Bilder bleiben
    if (!parts[3] && request.method === "DELETE") {
      if (id === user.profileId) return json({ error: "Die eigene Familie lässt sich nicht löschen." }, 400);
      await sql`DELETE FROM profiles WHERE id = ${id}`;
      return json(await listFamilies(sql, user.profileId));
    }
  }
  return null;
}
