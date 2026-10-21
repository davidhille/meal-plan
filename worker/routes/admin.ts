// Administration (nur Betreiber): Familien anlegen, einladen, umbenennen, sperren, löschen
import type { Ctx } from "../http";
import { json } from "../http";
import { INVITE_DAYS, createInvite, type SessionUser } from "../auth";
import { DEFAULT_LABELS } from "../shoppingList";

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
