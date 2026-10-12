// Einstiegspunkt des Cloudflare Workers:
// /api/* → API (Neon), alles andere → statische App aus dist/
// Zeitgesteuert (alle 15 Min) → Routinen ausführen
import { handleApi, runRoutines, type Env } from "./api";

interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }
    return env.ASSETS.fetch(request);
  },

  // Cron (siehe wrangler.jsonc): fällige Routinen erzeugen automatisch neue Pläne
  async scheduled(_event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runRoutines(env));
  },
} satisfies ExportedHandler<WorkerEnv>;
