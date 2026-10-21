// Gemeinsames für alle API-Routen: Umgebung, Anfrage-Kontext, JSON-Antwort.
import type { Row, Sql } from "./db";
import type { AiEnv } from "./images";
import type { ShopEnv } from "./shops";
import type { SessionUser } from "./auth";

export interface Env extends AiEnv, ShopEnv {
  DATABASE_URL: string;
  APP_PASSWORD?: string;
  CREDENTIALS_KEY?: string;
}

/** Alles, was eine Route über die Anfrage wissen muss */
export interface Ctx {
  request: Request;
  env: Env;
  sql: Sql;
  /** JSON-Body (bei POST/PUT/PATCH), wird in jeder Route selbst geprüft (String(...), Number(...) usw.) */
  body: Row;
  /** Pfad ohne /api, z. B. ["plans", "<id>", "shopping"] */
  parts: string[];
  /** z. B. "GET /plans/latest" */
  route: string;
  /** zweiter Pfad-Teil, meist eine ID */
  id: string | undefined;
  waitUntil: (p: Promise<unknown>) => void;
  /** Angemeldete Person (null nur in der Übergangszeit mit Familien-Passwort, solange es keine Zugänge gibt) */
  user: SessionUser | null;
}

/** Route-Handler: Antwort, oder null, wenn die Route nicht zuständig ist */
export type RouteHandler = (ctx: Ctx) => Promise<Response | null>;

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
