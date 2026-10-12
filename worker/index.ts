// Einstiegspunkt des Cloudflare Workers:
// /api/* → API (Neon), alles andere → statische App aus dist/
import { handleApi, type Env } from "./api";

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
} satisfies ExportedHandler<WorkerEnv>;
