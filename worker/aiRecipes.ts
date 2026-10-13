// KI-Rezepte über Cloudflare Workers AI (Llama 3.3 70B, JSON-Modus).
// Prompt-Idee übernommen aus der Juli-Version (lib/aiRecipes.ts), aber serverseitig und
// mit Nachprüfung durch unsere eigenen Filter – die KI hält sich nicht immer an Vorgaben.
import type { Sql } from "./db";
import { isQuotaError, type AiEnv } from "./images";
import { guessType } from "./recipeImport";
import { FOCUS_PROMPT, type Focus } from "./nutrition";
import { type Recipe, violatesHealthConditions, dislikeMatches, isSimilarDish } from "./meals";


const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface RecipeRequestContext {
  healthFocus: string[];
  healthConditions: string[];
  familyMembers: { type: string; age: number | null; favorite_foods: string[] | null; disliked_foods: string[] | null }[];
}

const TYPE_LABEL: Record<Recipe["type"], string> = {
  vegetarisch: "vegetarisch (kein Fleisch, kein Fisch), schnell unter der Woche (max. 40 Minuten)",
  fleisch: "ein Fleisch- oder Fischgericht, schnell unter der Woche (max. 40 Minuten)",
  wochenende: "ein etwas aufwendigeres Wochenend-Gericht (darf 60–120 Minuten dauern)",
};


const CONDITION_LABEL: Record<string, string> = {
  diabetes: "Diabetes (wenig Zucker und schnell wirkende Kohlenhydrate)",
  gluten_free: "glutenfrei (kein Weizen, Roggen, Gerste, Dinkel – also keine normalen Nudeln, kein Brot, kein Mehl, keine Sojasoße)",
  lactose_intolerant: "laktosefrei (keine Milch, Sahne, Käse, Butter, Joghurt – nur ausdrücklich laktosefreie Varianten)",
  nut_allergy: "Nussallergie (keinerlei Nüsse, Mandeln, Erdnüsse, Pinienkerne)",
  vegetarian: "vegetarisch (kein Fleisch, kein Fisch)",
  vegan: "vegan (keine tierischen Produkte, auch keine Milchprodukte, Eier, Honig)",
  no_alcohol: "ohne Alkohol (kein Wein, Bier, Likör – auch nicht zum Ablöschen)",
};

/** Küchen-Richtungen für Abwechslung bei parallelen Anfragen */
const CUISINES = [
  "deutsche Hausmannskost",
  "italienisch",
  "asiatisch",
  "mediterran",
  "orientalisch",
  "mexikanisch",
  "französische Landküche",
  "skandinavisch",
  "indisch (mild, kinderfreundlich)",
  "griechisch",
];

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

function describeFamily(ctx: RecipeRequestContext): string {
  const kids = ctx.familyMembers.filter((m) => m.type === "child");
  const adults = ctx.familyMembers.filter((m) => m.type === "adult").length;
  if (!ctx.familyMembers.length) return "";
  const parts = [`${adults} Erwachsene`];
  if (kids.length) parts.push(`${kids.length} Kinder (${kids.map((k) => (k.age ? `${k.age} J.` : "Alter unbekannt")).join(", ")})`);
  return `Die Familie: ${parts.join(" und ")} – kinderfreundlich, nicht zu scharf.`;
}

/** Freitext-Wunsch der Familie bereinigen (kurz, ohne Steuerzeichen) */
export function cleanWish(raw: unknown): string {
  return String(raw ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

const WISH_TYPE_LABEL = "passend zum Wunsch – unter der Woche schnell (max. 40 Minuten), außer der Wunsch verlangt etwas Aufwendigeres";

function buildPrompt(type: Recipe["type"] | null, cuisine: string, ctx: RecipeRequestContext, avoid: string[], wish = ""): string {
  const dislikes = [...new Set(ctx.familyMembers.flatMap((m) => m.disliked_foods ?? []).map((d) => d.trim()).filter(Boolean))];
  const likes = [...new Set(ctx.familyMembers.flatMap((m) => m.favorite_foods ?? []).map((d) => d.trim()).filter(Boolean))];
  const conditions = ctx.healthConditions.map((c) => CONDITION_LABEL[c] ?? c);
  return [
    `Erstelle ein neues, alltagstaugliches Familien-Abendessen auf Deutsch.`,
    wish
      ? `Wunsch der Familie (umsetzen, solange er nicht gegen die Vorgaben unten verstößt): ${wish}. Art: ${type ? TYPE_LABEL[type] : WISH_TYPE_LABEL}.`
      : `Art: ${TYPE_LABEL[type ?? "vegetarisch"]}. Küchenrichtung: ${cuisine}.`,
    describeFamily(ctx),
    conditions.length ? `STRIKT einzuhalten: ${conditions.join("; ")}.` : "",
    dislikes.length ? `Diese Zutaten mag niemand – NICHT verwenden: ${dislikes.join(", ")}.` : "",
    likes.length ? `Beliebt in der Familie (gern einbauen, wenn passend): ${likes.join(", ")}.` : "",
    ctx.healthFocus?.length
      ? `Schwerpunkte: ${ctx.healthFocus.map((f) => FOCUS_PROMPT[f as Focus]).filter(Boolean).join("; ")}.`
      : "",
    avoid.length ? `Nicht wiederholen (gibt es schon): ${avoid.slice(0, 60).join(", ")}.` : "",
    `Mengen für GENAU 4 Portionen. Jede Zutat als eigener Eintrag im Format "Menge Einheit Zutat", z. B. "400 g Spaghetti", "2 EL Olivenöl", "1 Zwiebel". Gewürze ohne Menge sind ok ("Salz", "Pfeffer").`,
    `steps: 4–8 kurze Zubereitungsschritte. duration_min: realistische Gesamtzeit in Minuten. name: appetitlicher, kurzer Gerichtname ohne Anführungszeichen.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function parse(raw: unknown): { name: string; duration_min: number; ingredients: string[]; steps: string[] } | null {
  // Workers AI liefert je nach Modell { response: {...} }, { response: "…" } oder direkt das Objekt
  let data: unknown = raw && typeof raw === "object" && "response" in raw ? (raw as { response: unknown }).response : raw;
  if (typeof data === "string") {
    const m = data.match(/\{[\s\S]*\}/);
    try {
      data = JSON.parse(m ? m[0] : data);
    } catch {
      return null;
    }
  }
  const d = (data && typeof data === "object" ? data : {}) as {
    name?: unknown;
    duration_min?: unknown;
    ingredients?: unknown;
    steps?: unknown;
  };
  if (typeof d.name !== "string" || !Array.isArray(d.ingredients) || !Array.isArray(d.steps)) return null;
  const ingredients = d.ingredients.map((i: unknown) => String(i).trim()).filter(Boolean);
  const steps = d.steps.map((st: unknown) => String(st).replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
  const name = d.name.replace(/["„“]/g, "").trim();
  if (!name || ingredients.length < 3 || steps.length < 2) return null;
  return { name, duration_min: Math.max(5, Math.min(240, Math.round(Number(d.duration_min) || 30))), ingredients, steps };
}

type GenerateResult = { recipe: Recipe } | { error: "quota" | "failed" };

async function generateOne(
  env: AiEnv,
  type: Recipe["type"] | null,
  cuisine: string,
  ctx: RecipeRequestContext,
  avoid: string[],
  wish = ""
): Promise<GenerateResult> {
  if (!env.AI) return { error: "failed" };
  const prompt = buildPrompt(type, cuisine, ctx, avoid, wish);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "Du bist ein erfahrener Familienkoch. Antworte ausschließlich mit JSON nach Schema." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_schema", json_schema: SCHEMA },
        max_tokens: 1400,
        temperature: 0.8,
      });
      const r = parse(raw);
      if (!r) continue;
      const recipe: Recipe = {
        name: r.name,
        type: type ?? "vegetarisch",
        ingredients: r.ingredients,
        instructions: r.steps.join("\n"),
        durationMin: r.duration_min,
      };
      // Ohne vorgegebene Art: aus Zutaten und Zeit schätzen
      if (!type) recipe.type = guessType(recipe);
      return { recipe };
    } catch (err) {
      console.error("KI-Rezept fehlgeschlagen:", err);
      if (isQuotaError(err)) return { error: "quota" };
    }
  }
  return { error: "failed" };
}

/**
 * Neue Rezepte erzeugen (parallel, je eins pro gewünschtem Typ), mit eigenen Filtern prüfen
 * und im geteilten Rezept-Pool speichern. Gibt nur gültige, neue Rezepte zurück.
 */
export async function generateRecipes(
  env: AiEnv,
  sql: Sql,
  types: Recipe["type"][],
  ctx: RecipeRequestContext,
  avoidNames: string[]
): Promise<Recipe[]> {
  if (!env.AI || types.length === 0) return [];
  const offset = Math.floor(Math.random() * CUISINES.length);
  const results = await Promise.all(
    types.map((t, i) =>
      generateOne(env, t, CUISINES[(offset + i) % CUISINES.length], ctx, avoidNames).then((g) => ("recipe" in g ? g.recipe : null))
    )
  );

  const seen = new Set(avoidNames.map((n) => n.toLowerCase()));
  const valid: Recipe[] = [];
  for (const r of results) {
    if (!r || seen.has(r.name.toLowerCase())) continue;
    // Nur eine Variante von etwas, das es schon gibt („Indische Quinoa-Pfanne“ neben „Mediterrane Quinoa-Pfanne“)
    if ([...avoidNames, ...valid.map((v) => v.name)].some((n) => isSimilarDish(r.name, n))) continue;
    // Nachprüfen: Gesundheitsbedingungen und Abneigungen hart
    if (violatesHealthConditions(r, ctx.healthConditions)) continue;
    if (ctx.familyMembers.some((m) => (m.disliked_foods ?? []).some((d) => dislikeMatches(r, d)))) continue;
    seen.add(r.name.toLowerCase());
    valid.push(r);
  }

  for (const r of valid) {
    await sql`INSERT INTO recipes (name, type, ingredients, instructions, duration_min, source)
      VALUES (${r.name}, ${r.type}, ${r.ingredients}, ${r.instructions}, ${r.durationMin ?? null}, 'ai')
      ON CONFLICT (name) DO NOTHING`;
  }
  return valid;
}

/** Prüft eigene Regeln: Gesundheitsbedingungen und Abneigungen der Familie */
function fitsFamily(r: Recipe, ctx: RecipeRequestContext) {
  return (
    !violatesHealthConditions(r, ctx.healthConditions) &&
    !ctx.familyMembers.some((m) => (m.disliked_foods ?? []).some((d) => dislikeMatches(r, d)))
  );
}

/**
 * Ein Rezept nach Wunsch („etwas mit Kürbis, schnell“) – nur Vorschau, wird nicht gespeichert.
 * Zwei Versuche, falls das Ergebnis nicht zu den Einstellungen passt oder den Namen schon gibt.
 */
export async function generateWishRecipe(
  env: AiEnv,
  wish: string,
  type: Recipe["type"] | null,
  ctx: RecipeRequestContext,
  existingNames: string[]
): Promise<{ recipe: Recipe } | { error: string; quota?: boolean }> {
  if (!env.AI) return { error: "Die KI ist nicht eingerichtet." };
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  let lastProblem = "Die KI hat kein brauchbares Rezept geliefert. Bitte nochmal versuchen.";
  for (let attempt = 0; attempt < 2; attempt++) {
    // Beim zweiten Versuch eine andere Küchenrichtung als Anstoß
    const g = await generateOne(env, type, CUISINES[Math.floor(Math.random() * CUISINES.length)], ctx, [], wish);
    if ("error" in g) {
      if (g.error === "quota") {
        return { error: "Das tägliche Gratis-Kontingent der KI ist aufgebraucht. Morgen früh geht es wieder.", quota: true };
      }
      continue;
    }
    if (taken.has(g.recipe.name.toLowerCase())) {
      lastProblem = `„${g.recipe.name}“ gibt es schon in der Sammlung.`;
      continue;
    }
    if (!fitsFamily(g.recipe, ctx)) {
      lastProblem = "Das Ergebnis passte nicht zu euren Einstellungen (Gesundheit oder Abneigungen). Bitte den Wunsch anders formulieren.";
      continue;
    }
    return { recipe: g.recipe };
  }
  return { error: lastProblem };
}
