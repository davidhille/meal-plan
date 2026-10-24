// Login pro Person: Passwort-Hashing (PBKDF2, WebCrypto), Sitzungen per HttpOnly-Cookie.
// In der Datenbank steht nur der SHA-256-Hash des Sitzungs-Tokens, nie das Token selbst.
import type { Sql } from "./db";

export interface SessionUser {
  id: string;
  profileId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  /** Betreiber der App: sieht die Administration (Familien anlegen, einladen, sperren) */
  isOwner: boolean;
}

export const SESSION_COOKIE = "mp_session";
/** Anmeldung bleibt 180 Tage gültig (verlängert sich bei Nutzung) */
const SESSION_DAYS = 180;
/** Workers erlauben höchstens 100.000 PBKDF2-Iterationen */
const ITERATIONS = 100_000;
export const MIN_PASSWORD = 8;
const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

const enc = new TextEncoder();
const toB64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as Uint8Array<ArrayBuffer>, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** „pbkdf2$100000$<salt>$<hash>“ */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(await pbkdf2(password, salt, ITERATIONS))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, iter, salt, hash] = stored.split("$");
  if (kind !== "pbkdf2" || !iter || !salt || !hash) return false;
  const actual = await pbkdf2(password, fromB64(salt), Number(iter));
  const expected = fromB64(hash);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const normEmail = (email: unknown) => String(email ?? "").trim().toLowerCase().slice(0, 200);
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Neue Sitzung anlegen; liefert den Set-Cookie-Header */
export async function createSession(sql: Sql, userId: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${await sha256(token)}, ${userId}, now() + ${`${SESSION_DAYS} days`}::interval)`;
  await sql`UPDATE users SET last_login_at = now(), failed_logins = 0, locked_until = NULL WHERE id = ${userId}`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/** Angemeldete Person aus dem Cookie (oder null). Verlängert die Sitzung höchstens einmal am Tag. */
export async function getSessionUser(sql: Sql, request: Request): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const hash = await sha256(token);
  const rows = await sql`SELECT u.id, u.profile_id, u.email, u.name, u.is_admin, u.is_owner,
      s.last_seen_at < now() - interval '1 day' AS stale
    FROM sessions s JOIN users u ON u.id = s.user_id JOIN profiles p ON p.id = u.profile_id
    WHERE s.token_hash = ${hash} AND s.expires_at > now() AND (NOT p.disabled OR u.is_owner)`;
  const r = rows[0];
  if (!r) return null;
  if (r.stale) {
    await sql`UPDATE sessions SET last_seen_at = now(), expires_at = now() + ${`${SESSION_DAYS} days`}::interval
      WHERE token_hash = ${hash}`;
  }
  return { id: r.id, profileId: r.profile_id, email: r.email, name: r.name, isAdmin: !!r.is_admin, isOwner: !!r.is_owner };
}

export async function deleteSession(sql: Sql, request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await sql`DELETE FROM sessions WHERE token_hash = ${await sha256(token)}`;
}

/** Anmelden: E-Mail + Passwort; nach zu vielen Fehlversuchen kurz gesperrt */
export async function login(
  sql: Sql,
  email: string,
  password: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const rows = await sql`SELECT u.id, u.password_hash, u.failed_logins, u.locked_until > now() AS locked,
      p.disabled AND NOT u.is_owner AS disabled
    FROM users u JOIN profiles p ON p.id = u.profile_id WHERE lower(u.email) = ${email}`;
  const u = rows[0];
  const wrong = { ok: false as const, error: "E-Mail oder Passwort stimmt nicht." };
  if (!u) {
    await hashPassword(password); // gleiche Antwortzeit wie bei vorhandenem Zugang
    return wrong;
  }
  if (u.locked) return { ok: false, error: `Zu viele Versuche. Bitte in ${LOCK_MINUTES} Minuten noch einmal.` };
  if (!(await verifyPassword(password, u.password_hash))) {
    const failed = Number(u.failed_logins) + 1;
    await sql`UPDATE users SET failed_logins = ${failed % MAX_FAILED},
      locked_until = CASE WHEN ${failed >= MAX_FAILED} THEN now() + ${`${LOCK_MINUTES} minutes`}::interval ELSE locked_until END
      WHERE id = ${u.id}`;
    return wrong;
  }
  if (u.disabled) return { ok: false, error: "Dieser Zugang ist gesperrt. Bitte beim Betreiber der App melden." };
  return { ok: true, userId: u.id };
}

/** Zufälliges, URL-taugliches Token (24 Byte) */
export function randomToken(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(24))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Einladungslink: zufälliges Token, in der Datenbank nur sein Hash; 7 Tage gültig, einmal nutzbar */
export const INVITE_DAYS = 7;
export async function createInvite(sql: Sql, profileId: string): Promise<string> {
  const token = randomToken();
  await sql`INSERT INTO invites (token_hash, profile_id, expires_at)
    VALUES (${await sha256(token)}, ${profileId}, now() + ${`${INVITE_DAYS} days`}::interval)`;
  return token;
}

/** Gültige Einladung → Familie (oder null) */
export async function findInvite(sql: Sql, token: string): Promise<{ hash: string; profileId: string; familyName: string | null } | null> {
  if (!token || token.length > 100) return null;
  const hash = await sha256(token);
  const rows = await sql`SELECT i.profile_id, p.name FROM invites i JOIN profiles p ON p.id = i.profile_id
    WHERE i.token_hash = ${hash} AND i.used_at IS NULL AND i.expires_at > now() AND NOT p.disabled`;
  return rows[0] ? { hash, profileId: rows[0].profile_id, familyName: rows[0].name ?? null } : null;
}

/**
 * Warum gilt ein Einladungslink nicht mehr? Nur für die Meldung an die eingeladene Person: bekannter Link einer nicht
 * gesperrten Familie → „abgelaufen“ bzw. „benutzt“ plus Familienname; sonst `null` (unbekannt, kein Hinweis).
 */
export async function inviteProblem(sql: Sql, token: string): Promise<{ reason: "used" | "expired"; familyName: string | null } | null> {
  if (!token || token.length > 100) return null;
  const hash = await sha256(token);
  const rows = await sql`SELECT i.used_at IS NOT NULL AS used, p.name FROM invites i JOIN profiles p ON p.id = i.profile_id
    WHERE i.token_hash = ${hash} AND NOT p.disabled`;
  return rows[0] ? { reason: rows[0].used ? "used" : "expired", familyName: rows[0].name ?? null } : null;
}

/**
 * Darf der erste Zugang angelegt werden? Nur mit dem Familien-Passwort aus `APP_PASSWORD`. Ist es nicht gesetzt, ist die
 * Einrichtung gesperrt (nie offen): Sonst würde auf einer leeren Datenbank die erste Person, die die Adresse aufruft, Betreiber.
 */
export function checkSetupPassword(configured: string | undefined, given: string): "unavailable" | "wrong" | "ok" {
  if (!configured) return "unavailable";
  if (configured.length !== given.length) return "wrong";
  let diff = 0;
  for (let i = 0; i < configured.length; i++) diff |= configured.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0 ? "ok" : "wrong";
}

/** Gibt es schon Zugänge? (Solange nicht, gilt noch das alte Familien-Passwort.) Einmal true, bleibt true. */
let usersExistCache = false;
export async function usersExist(sql: Sql): Promise<boolean> {
  if (usersExistCache) return true;
  const rows = await sql`SELECT EXISTS (SELECT 1 FROM users) AS e`;
  usersExistCache = !!rows[0]?.e;
  return usersExistCache;
}
export const markUsersExist = () => {
  usersExistCache = true;
};
