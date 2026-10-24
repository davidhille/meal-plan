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
  /** Angemeldete Person (null nur bei den öffentlichen Routen: Anmeldung, Einladung, geteilter Plan) */
  user: SessionUser | null;
}

/** Route-Handler: Antwort, oder null, wenn die Route nicht zuständig ist */
export type RouteHandler = (ctx: Ctx) => Promise<Response | null>;

/** Meldung für Menschen (Deutsch, ohne Interna): Der Browser bekommt genau diesen Text. Jeder andere Fehler zeigt nur `GENERIC_ERROR`. */
export class UserError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const GENERIC_ERROR = "Der Server hat gerade ein Problem. Bitte gleich noch einmal versuchen.";

/** Was der Browser bei einem unbehandelten Fehler bekommt – nie Datenbank- oder Bibliothekstexte */
export function publicError(err: unknown): { status: number; message: string } {
  return err instanceof UserError ? { status: err.status, message: err.message } : { status: 500, message: GENERIC_ERROR };
}

/** Kommt die Anfrage von der eigenen Seite? Eine unlesbare Herkunft (z. B. „null“ aus einem Sandbox-Frame) gilt als fremd. */
export function sameHost(origin: string, requestUrl: string): boolean {
  try {
    return new URL(origin).host === new URL(requestUrl).host;
  } catch {
    return false;
  }
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
