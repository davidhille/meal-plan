// Einstiegspunkt des Cloudflare Workers:
// /api/* → API (Neon), alles andere → statische App aus dist/ (www.* → Umleitung ohne www)
// Zeitgesteuert (alle 15 Min) → Routinen ausführen, fehlende Rezeptbilder erzeugen
import { handleApi, runRoutines, type Env } from "./api";

interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    // www.miyummy.com → miyummy.com (eine Adresse, damit Passwort, App-Installation und Push zusammenpassen)
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return handleApi(request, env, (p) => ctx.waitUntil(p));
    }
    const res = await env.ASSETS.fetch(request);
    // Fehlende Build-Datei (z. B. alte Seite nach einem Deploy): 404 statt der App-Seite,
    // damit niemand HTML unter einem .js-Namen speichert
    if (pathname.startsWith("/assets/") && (res.headers.get("content-type") || "").includes("text/html")) {
      return new Response("Nicht gefunden", { status: 404, headers: { "cache-control": "no-store" } });
    }
    return res;
  },

  // Cron (siehe wrangler.jsonc): fällige Routinen erzeugen automatisch neue Pläne
  async scheduled(_event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runRoutines(env));
  },
} satisfies ExportedHandler<WorkerEnv>;
