// Erinnerung zum Bewerten: Geräte an-/abmelden, Uhrzeit, Test
import type { Ctx } from "../http";
import { json } from "../http";
import type { Sql } from "../db";
import { getProfile } from "../repo";
import { getVapidKeys, isPushEndpoint, rememberOrigin, sendToProfile } from "../push";

async function pushState(ctx: Ctx, profileId: string) {
  const [keys, rows, devices] = await Promise.all([
    getVapidKeys(ctx.env, ctx.sql),
    ctx.sql`SELECT reminder_time FROM profiles WHERE id = ${profileId}`,
    ctx.sql`SELECT endpoint FROM push_subscriptions WHERE profile_id = ${profileId}`,
  ]);
  return {
    publicKey: keys.publicKey,
    reminderTime: (rows[0]?.reminder_time as string | undefined) ?? "20:00",
    endpoints: devices.map((d) => d.endpoint as string),
  };
}

const deleteDevice = (sql: Sql, profileId: string, endpoint: string) =>
  sql`DELETE FROM push_subscriptions WHERE profile_id = ${profileId} AND endpoint = ${endpoint}`;

export async function pushRoutes(ctx: Ctx): Promise<Response | null> {
  const { request, sql, body, route } = ctx;
  if (!route.startsWith("GET /push") && !route.startsWith("POST /push") && !route.startsWith("PUT /push")) return null;
  const p = await getProfile(sql, ctx.user);

  if (route === "GET /push") return json(await pushState(ctx, p.id));

  // Gerät anmelden: { subscription: { endpoint, keys: { p256dh, auth } }, label }
  if (route === "POST /push/subscribe") {
    const s = (body.subscription ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    const endpoint = String(s.endpoint ?? "");
    const p256dh = String(s.keys?.p256dh ?? "");
    const auth = String(s.keys?.auth ?? "");
    if (!isPushEndpoint(endpoint) || !/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) {
      return json({ error: "Ungültige Geräte-Anmeldung" }, 400);
    }
    const label = String(body.label ?? "").slice(0, 80) || null;
    await sql`INSERT INTO push_subscriptions (endpoint, profile_id, p256dh, auth, label)
      VALUES (${endpoint}, ${p.id}, ${p256dh}, ${auth}, ${label})
      ON CONFLICT (endpoint) DO UPDATE SET profile_id = EXCLUDED.profile_id, p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth, label = EXCLUDED.label`;
    await rememberOrigin(sql, new URL(request.url).origin);
    return json(await pushState(ctx, p.id));
  }

  if (route === "POST /push/unsubscribe") {
    await deleteDevice(sql, p.id, String(body.endpoint ?? ""));
    return json(await pushState(ctx, p.id));
  }

  if (route === "PUT /push/settings") {
    const time = String(body.reminderTime ?? "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return json({ error: "Bitte eine Uhrzeit wie 20:00 angeben" }, 400);
    await sql`UPDATE profiles SET reminder_time = ${time} WHERE id = ${p.id}`;
    return json(await pushState(ctx, p.id));
  }

  // Probe-Benachrichtigung an dieses Gerät
  if (route === "POST /push/test") {
    const endpoint = String(body.endpoint ?? "");
    const r = await sendToProfile(ctx.env, sql, p.id, {
      title: "miyummy",
      body: "So sieht die Erinnerung zum Bewerten aus.",
      url: "/#speiseplan",
      tag: "test",
    }, endpoint);
    if (r.sent) return json({ ok: true });
    if (r.removed) return json({ error: "Das Gerät ist nicht mehr angemeldet – bitte Erinnerung neu einschalten." }, 410);
    return json({ error: "Die Benachrichtigung konnte nicht verschickt werden." }, 502);
  }

  return null;
}
