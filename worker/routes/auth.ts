// Anmeldung und Zugänge der Familie
import type { Ctx } from "../http";
import { json } from "../http";
import { getProfile } from "../repo";
import {
  MIN_PASSWORD, clearSessionCookie, createSession, deleteSession, hashPassword, login, markUsersExist, normEmail, usersExist,
  validEmail, verifyPassword, type SessionUser,
} from "../auth";

const withCookie = (res: Response, cookie: string) => {
  const h = new Headers(res.headers);
  h.append("Set-Cookie", cookie);
  return new Response(res.body, { status: res.status, headers: h });
};

const publicUser = (u: SessionUser) => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });

/** Ohne Anmeldung erreichbar: Status, Anmelden, ersten Zugang anlegen, Abmelden */
export async function publicAuthRoutes({ request, env, sql, body, route }: Ctx, user: SessionUser | null): Promise<Response | null> {
  if (route === "GET /auth/status") {
    return json({ user: user ? publicUser(user) : null, needsSetup: !(await usersExist(sql)) });
  }
  if (route === "POST /auth/login") {
    const email = normEmail(body.email);
    const result = await login(sql, email, String(body.password ?? ""));
    if (!result.ok) return json({ error: result.error }, 401);
    return withCookie(json({ ok: true }), await createSession(sql, result.userId));
  }
  if (route === "POST /auth/logout") {
    await deleteSession(sql, request);
    return withCookie(json({ ok: true }), clearSessionCookie());
  }
  // Erster Zugang (nur solange es noch keinen gibt): bisheriges Familien-Passwort bestätigt, dass es die Familie ist
  if (route === "POST /auth/setup") {
    if (await usersExist(sql)) return json({ error: "Es gibt schon Zugänge – bitte anmelden." }, 409);
    if (env.APP_PASSWORD && String(body.familyPassword ?? "") !== env.APP_PASSWORD) {
      return json({ error: "Das Familien-Passwort stimmt nicht." }, 401);
    }
    const input = checkInput(body);
    if ("error" in input) return json({ error: input.error }, 400);
    const p = await getProfile(sql);
    const rows = await sql`INSERT INTO users (profile_id, email, name, password_hash, is_admin)
      VALUES (${p.id}, ${input.email}, ${input.name}, ${await hashPassword(input.password)}, true) RETURNING id`;
    markUsersExist();
    return withCookie(json({ ok: true }), await createSession(sql, rows[0].id));
  }
  return null;
}

function checkInput(body: Record<string, unknown>): { name: string; email: string; password: string } | { error: string } {
  const name = String(body.name ?? "").trim().slice(0, 80);
  const email = normEmail(body.email);
  const password = String(body.password ?? "");
  if (!name) return { error: "Bitte einen Namen angeben." };
  if (!validEmail(email)) return { error: "Bitte eine gültige E-Mail-Adresse angeben." };
  if (password.length < MIN_PASSWORD) return { error: `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.` };
  return { name, email, password };
}

/** Nur angemeldet: eigenes Passwort, Zugänge der Familie verwalten (Admin) */
export async function accountRoutes({ sql, body, parts, route, id }: Ctx, user: SessionUser): Promise<Response | null> {
  if (route === "GET /auth/me") return json(publicUser(user));

  if (route === "PUT /auth/password") {
    const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
    if (!(await verifyPassword(String(body.current ?? ""), rows[0].password_hash))) {
      return json({ error: "Das bisherige Passwort stimmt nicht." }, 400);
    }
    const next = String(body.next ?? "");
    if (next.length < MIN_PASSWORD) return json({ error: `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.` }, 400);
    await sql`UPDATE users SET password_hash = ${await hashPassword(next)} WHERE id = ${user.id}`;
    return json({ ok: true });
  }

  if (parts[0] !== "users") return null;
  if (!user.isAdmin) return json({ error: "Nur für Admins." }, 403);
  const list = async () =>
    json(
      await sql`SELECT id, name, email, is_admin AS "isAdmin", last_login_at::text AS "lastLoginAt" FROM users
        WHERE profile_id = ${user.profileId} ORDER BY created_at`
    );

  if (route === "GET /users") return list();
  if (route === "POST /users") {
    const input = checkInput(body);
    if ("error" in input) return json({ error: input.error }, 400);
    const exists = await sql`SELECT 1 FROM users WHERE lower(email) = ${input.email}`;
    if (exists[0]) return json({ error: "Diese E-Mail-Adresse hat schon einen Zugang." }, 409);
    await sql`INSERT INTO users (profile_id, email, name, password_hash, is_admin)
      VALUES (${user.profileId}, ${input.email}, ${input.name}, ${await hashPassword(input.password)}, ${!!body.isAdmin})`;
    return list();
  }
  if (id && parts[2] === "password" && route.startsWith("PUT ")) {
    const password = String(body.password ?? "");
    if (password.length < MIN_PASSWORD) return json({ error: `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.` }, 400);
    // Neues Passwort meldet alle Geräte dieser Person ab
    const done = await sql`UPDATE users SET password_hash = ${await hashPassword(password)}, failed_logins = 0, locked_until = NULL
      WHERE id = ${id} AND profile_id = ${user.profileId} RETURNING id`;
    if (!done[0]) return json({ error: "Zugang nicht gefunden" }, 404);
    if (id !== user.id) await sql`DELETE FROM sessions WHERE user_id = ${id}`;
    return list();
  }
  if (id && !parts[2] && route.startsWith("DELETE ")) {
    if (id === user.id) return json({ error: "Den eigenen Zugang kannst du nicht löschen." }, 400);
    await sql`DELETE FROM users WHERE id = ${id} AND profile_id = ${user.profileId}`;
    return list();
  }
  return null;
}
