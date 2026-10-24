// KI-Verbrauch mitschreiben: Cloudflare zeigt Neurons nur fürs ganze Konto. Darum zählt die App jeden
// erfolgreichen Workers-AI-Aufruf selbst und schätzt die Neurons nach der Preisliste (Stand Oktober 2026,
// developers.cloudflare.com/workers-ai/platform/pricing). Das ist eine Schätzung, nicht die Abrechnung.
import type { Sql } from "./db";
import type { AiEnv } from "./images";
import { UserError, type Env } from "./http";
import { checkAiWarning, logError, neuronsToday } from "./adminTools";

/** Gratis-Kontingent pro Tag (Free und Paid), Rückstellung um 00:00 UTC */
export const DAILY_FREE_NEURONS = 10_000;

/** Neurons pro Million Tokens (Eingabe, Ausgabe) */
const TEXT_RATES: Record<string, [number, number]> = {
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": [26_668, 204_805],
  // „-fast“ steht nicht in der Preisliste; nächster Eintrag ist llama-3.1-8b-instruct-fp8-fast
  "@cf/meta/llama-3.1-8b-instruct-fast": [4_119, 34_868],
  "@cf/meta/llama-3.1-8b-instruct-fp8-fast": [4_119, 34_868],
};
/** FLUX.1 schnell: je 512×512-Kachel und je Schritt */
const FLUX_TILE = 4.8;
const FLUX_STEP = 9.6;

export type AiKind = "recipe" | "image" | "describe";

/** Grobe Token-Schätzung, falls die Antwort keine Zählung mitliefert (~3,5 Zeichen je Token) */
const tokens = (text: string) => Math.ceil(text.length / 3.5);

/** Neurons eines Aufrufs nach Preisliste */
export function estimateNeurons(model: string, input: Record<string, unknown>, output: unknown): number {
  if (model.includes("flux")) {
    const w = Number(input.width) || 1024;
    const h = Number(input.height) || 1024;
    const tiles = Math.ceil(w / 512) * Math.ceil(h / 512);
    const steps = Number(input.steps) || 4;
    return tiles * FLUX_TILE + steps * FLUX_STEP;
  }
  const [inRate, outRate] = TEXT_RATES[model] ?? TEXT_RATES["@cf/meta/llama-3.3-70b-instruct-fp8-fast"];
  const o = (output && typeof output === "object" ? output : {}) as {
    response?: unknown;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const inTokens = Number(o.usage?.prompt_tokens) || tokens(JSON.stringify(input.messages ?? input.prompt ?? ""));
  const outText = typeof o.response === "string" ? o.response : JSON.stringify(o.response ?? output ?? "");
  const outTokens = Number(o.usage?.completion_tokens) || tokens(outText);
  return (inTokens * inRate + outTokens * outRate) / 1_000_000;
}

const kindOf = (model: string): AiKind =>
  model.includes("flux") ? "image" : model.includes("70b") ? "recipe" : "describe";

/**
 * Umgebung, deren KI-Aufrufe mitgezählt werden – für eine Familie oder (null) für die App selbst (Cron).
 * Alles andere der Umgebung bleibt unverändert; das Zählen darf nie einen Aufruf scheitern lassen.
 */
export function meteredEnv<E extends AiEnv>(env: E, sql: Sql, profileId: string | null): E {
  const ai = env.AI;
  if (!ai) return env;
  // KI-Budget der Familie (Administration), einmal pro Anfrage gelesen
  let limit: Promise<number | null> | undefined;
  const metered: E = Object.create(env);
  Object.defineProperty(metered, "AI", {
    value: {
      async run(model: string, input: Record<string, unknown>) {
        if (profileId) {
          limit ??= sql`SELECT ai_daily_limit FROM profiles WHERE id = ${profileId}`
            .then((r) => (r[0]?.ai_daily_limit == null ? null : Number(r[0].ai_daily_limit)))
            .catch(() => null);
          const max = await limit;
          if (max != null && (await neuronsToday(sql, profileId)) >= max) {
            throw new FamilyBudgetError();
          }
        }
        let result: unknown;
        try {
          result = await ai.run(model, input);
        } catch (err) {
          await logError(sql, `KI ${kindOf(model)}`, err, profileId);
          throw err;
        }
        try {
          const neurons = estimateNeurons(model, input, result);
          await sql`INSERT INTO ai_usage (profile_id, kind, model, neurons) VALUES (${profileId}, ${kindOf(model)}, ${model}, ${neurons})`;
          await checkAiWarning(env as unknown as Env, sql);
        } catch (err) {
          console.error("KI-Verbrauch nicht gespeichert:", err);
        }
        return result;
      },
    },
  });
  return metered;
}

/** Tages-Budget der Familie erreicht (gilt wie ein leeres Kontingent, sperrt die KI aber nicht für alle) */
export class FamilyBudgetError extends UserError {
  readonly familyBudget = true;
  constructor() {
    super("Euer KI-Budget für heute ist aufgebraucht.", 429);
  }
}
