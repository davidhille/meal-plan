// API der Meal-Plan-App. Wird von worker/index.ts für /api/* aufgerufen.
// Die Routen liegen thematisch in worker/routes/*; hier nur Anmeldung (Sitzung), Datenbank, Schema und Verteilung.
// Secrets (Cloudflare → Worker → Settings → Variables and Secrets): siehe CLAUDE.md

import { meteredEnv } from "./aiUsage";
import { neon } from "@neondatabase/serverless";
import type { Row } from "./db";
import { json, type Env, type RouteHandler } from "./http";
import { ensureSchema } from "./migrate";
import { serveImage } from "./images";
import { ShopError } from "./shops";
import { profileRoutes } from "./routes/profile";
import { planRoutes } from "./routes/plans";
import { recipeRoutes } from "./routes/recipes";
import { shoppingRoutes } from "./routes/shopping";
import { shopRoutes } from "./routes/shops";
import { pushRoutes } from "./routes/push";
import { accountRoutes, publicAuthRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { publicShareRoutes, shareRoutes } from "./routes/share";
import { getSessionUser, usersExist } from "./auth";

export type { Env } from "./http";
export { runRoutines } from "./routines";

/** Reihenfolge ist egal, die Routen überschneiden sich nicht */
const ROUTES: RouteHandler[] = [profileRoutes, shareRoutes, planRoutes, recipeRoutes, shoppingRoutes, shopRoutes, pushRoutes];

export async function handleApi(
  request: Request,
  env: Env,
  waitUntil: (p: Promise<unknown>) => void = () => {}
): Promise<Response> {
  const path = new URL(request.url).pathname;

  // Bilder sind öffentlich (ein <img> kann kein Passwort mitschicken)
  if (request.method === "GET" && path.startsWith("/api/images/") && env.DATABASE_URL) {
    const sql = neon(env.DATABASE_URL);
    // Auch hier zuerst migrieren: direkt nach einem Deploy kommen oft zuerst Bild-Anfragen
    await ensureSchema(sql);
    const f = new URL(request.url).searchParams.get("f");
    const family = f && /^[0-9a-f-]{36}$/i.test(f) ? f : null;
    return serveImage(sql, decodeURIComponent(path.slice("/api/images/".length)), family);
  }

  if (!env.DATABASE_URL) return json({ error: "DATABASE_URL fehlt" }, 500);

  // Ändernde Anfragen nur von der eigenen Seite (Schutz zusätzlich zu SameSite-Cookies)
  const origin = request.headers.get("Origin");
  if (request.method !== "GET" && origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ error: "Nicht erlaubt" }, 403);
  }

  const sql = neon(env.DATABASE_URL);
  await ensureSchema(sql);
  const parts = path.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const route = `${request.method} /${parts.join("/")}`;
  const body: Row = ["POST", "PUT", "PATCH"].includes(request.method) ? await request.json<Row>().catch(() => ({})) : {};
  const user = await getSessionUser(sql, request);
  // KI-Aufrufe zählen pro Familie mit (Statistik in der Administration)
  const ctx = { request, env: meteredEnv(env, sql, user?.profileId ?? null), sql, body, parts, route, id: parts[1], waitUntil, user };

  try {
    const publicRes = (await publicAuthRoutes(ctx, user)) ?? (await publicShareRoutes(ctx));
    if (publicRes) return publicRes;

    // Angemeldet – oder Übergang: noch keine Zugänge angelegt, dann gilt das alte Familien-Passwort
    if (!user) {
      const legacy = !(await usersExist(sql)) && (!env.APP_PASSWORD || request.headers.get("X-App-Password") === env.APP_PASSWORD);
      if (!legacy) return json({ error: "unauthorized" }, 401);
    }

    if (user) {
      const res = (await accountRoutes(ctx, user)) ?? (await adminRoutes(ctx, user));
      if (res) return res;
    }
    for (const handle of ROUTES) {
      const res = await handle(ctx);
      if (res) return res;
    }
    return json({ error: `Unbekannte Route: ${route}` }, 404);
  } catch (err) {
    if (err instanceof ShopError) {
      return json({ error: err.message, code: err.code }, err.code === "not_connected" ? 409 : 502);
    }
    console.error(route, err);
    return json({ error: (err as Error).message }, 500);
  }
}
