// KI-Beilage/-Salat auf Knopfdruck (nur Vorschau, gespeichert wird erst beim Übernehmen); zählt über `meteredEnv` zum KI-Budget
import type { RecipeRequestContext } from "./aiRecipes";
import { matchesDislikeGroup } from "./dislikes";
import { isFamilyBudget, isQuotaError, type AiEnv } from "./images";
import { dislikeMatches, violatesHealthConditions, type Recipe } from "./meals";
import type { SideKind } from "../src/types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    duration_min: { type: "integer" },
    ingredients: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["name", "duration_min", "ingredients", "steps"],
};

export interface AiSide {
  name: string;
  kind: SideKind;
  ingredients: string[];
  instructions: string;
  durationMin: number;
}

export function parseAiSide(raw: unknown, kind: SideKind): AiSide | null {
  let data: unknown = raw && typeof raw === "object" && "response" in raw ? (raw as { response: unknown }).response : raw;
  if (typeof data === "string") {
    const m = data.match(/\{[\s\S]*\}/);
    try {
      data = JSON.parse(m ? m[0] : data);
    } catch {
      return null;
    }
  }
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (typeof d.name !== "string" || !Array.isArray(d.ingredients) || !Array.isArray(d.steps)) return null;
  const ingredients = d.ingredients.map((i) => String(i).trim()).filter(Boolean).slice(0, 25);
  const steps = d.steps.map((s) => String(s).replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
  const name = d.name.replace(/["„“]/g, "").trim().slice(0, 120);
  if (!name || ingredients.length < 2 || steps.length < 1) return null;
  return { name, kind, ingredients, instructions: steps.join("\n"), durationMin: Math.max(5, Math.min(120, Math.round(Number(d.duration_min) || 20))) };
}

/** Eine Beilage oder einen Salat passend zu einem Gericht erzeugen; zwei Versuche, falls das Ergebnis nicht zur Familie passt */
export async function generateSide(
  env: AiEnv,
  kind: SideKind,
  mealName: string,
  wish: string,
  ctx: RecipeRequestContext
): Promise<{ side: AiSide } | { error: string; quota?: boolean }> {
  if (!env.AI) return { error: "Die KI ist nicht eingerichtet." };
  const art = kind === "salat" ? "einen Salat" : "eine Beilage (Gemüse, Kartoffeln, Reis, Getreide o. Ä.)";
  const prompt = [
    `Erfinde ${art} passend zu: „${mealName || "einem Familienessen"}“.`,
    wish ? `Wunsch der Familie: ${wish}` : "",
    "Für 4 Portionen, Zutaten mit Mengen (z. B. „400 g Möhren“), einfache Schritte, höchstens 30 Minuten, kinderfreundlich.",
    ctx.healthConditions.length ? `Gesundheit beachten: ${ctx.healthConditions.join(", ")}.` : "",
    "Antworte nur mit JSON: name, duration_min, ingredients (Liste), steps (Liste).",
  ]
    .filter(Boolean)
    .join("\n");
  let problem = "Die KI hat nichts Brauchbares geliefert. Bitte nochmal versuchen.";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "Du bist ein erfahrener Familienkoch. Antworte ausschließlich mit JSON nach Schema." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: SCHEMA },
        max_tokens: 900,
        temperature: 0.8,
      });
      const side = parseAiSide(raw, kind);
      if (!side) continue;
      const asRecipe: Recipe = { name: side.name, type: "vegetarisch", ingredients: side.ingredients, instructions: side.instructions };
      if (
        violatesHealthConditions(asRecipe, ctx.healthConditions) ||
        ctx.familyMembers.some((m) => (m.disliked_foods ?? []).some((d) => dislikeMatches(asRecipe, d))) ||
        (ctx.familyDislikes ?? []).some((id) => matchesDislikeGroup(asRecipe, id))
      ) {
        problem = "Das Ergebnis passte nicht zu euren Einstellungen. Bitte mit anderem Wunsch nochmal versuchen.";
        continue;
      }
      return { side };
    } catch (err) {
      console.error("KI-Beilage fehlgeschlagen:", err);
      if (isFamilyBudget(err)) return { error: "Euer KI-Budget für heute ist aufgebraucht.", quota: true };
      if (isQuotaError(err)) return { error: "Das tägliche Gratis-Kontingent der KI ist für heute verbraucht.", quota: true };
    }
  }
  return { error: problem };
}
