import { describe, expect, test } from "bun:test";
import { cleanWish, generateWishRecipe, type RecipeRequestContext } from "./aiRecipes";

const ctx = (over: Partial<RecipeRequestContext> = {}): RecipeRequestContext => ({
  healthFocus: [],
  healthConditions: [],
  familyMembers: [],
  ...over,
});

/** KI-Attrappe: liefert nacheinander die übergebenen Antworten und merkt sich die Prompts */
function fakeAi(...answers: unknown[]) {
  const prompts: string[] = [];
  const env = {
    AI: {
      run: async (_model: string, input: { messages: { content: string }[] }) => {
        prompts.push(input.messages[1].content);
        const a = answers.shift();
        if (a instanceof Error) throw a;
        return { response: a };
      },
    },
  };
  return { env: env as never, prompts };
}

const recipe = (name: string, ingredients: string[], duration_min = 30) => ({
  name,
  duration_min,
  ingredients,
  steps: ["Schneiden.", "Kochen."],
});

describe("cleanWish", () => {
  test("kürzt und entfernt Zeilenumbrüche", () => {
    expect(cleanWish("  etwas mit\nKürbis  ")).toBe("etwas mit Kürbis");
    expect(cleanWish("x".repeat(300))).toHaveLength(200);
  });
});

describe("generateWishRecipe", () => {
  test("Wunsch steht im Prompt, Art wird ohne Vorgabe geschätzt", async () => {
    const { env, prompts } = fakeAi(recipe("Kürbis-Hähnchen-Pfanne", ["500 g Hokkaido", "400 g Hähnchenbrust", "1 Zwiebel"]));
    const r = await generateWishRecipe(env, "etwas mit Kürbis", null, ctx(), []);
    expect(prompts[0]).toContain("Wunsch der Familie");
    expect(prompts[0]).toContain("etwas mit Kürbis");
    expect("recipe" in r && r.recipe.type).toBe("fleisch");
  });

  test("lange Gerichte werden Wochenende, vorgegebene Art bleibt", async () => {
    const long = fakeAi(recipe("Kürbis-Lasagne", ["1 Kürbis", "Lasagneplatten", "Ricotta"], 120));
    const r1 = await generateWishRecipe(long.env, "Kürbis-Lasagne", null, ctx(), []);
    expect("recipe" in r1 && r1.recipe.type).toBe("wochenende");
    const fixed = fakeAi(recipe("Kürbissuppe", ["1 Kürbis", "1 Zwiebel", "500 ml Brühe"]));
    const r2 = await generateWishRecipe(fixed.env, "Suppe", "vegetarisch", ctx(), []);
    expect("recipe" in r2 && r2.recipe.type).toBe("vegetarisch");
  });

  test("Name gibt es schon → zweiter Versuch", async () => {
    const { env } = fakeAi(
      recipe("Kürbissuppe", ["1 Kürbis", "1 Zwiebel", "1 l Brühe"]),
      recipe("Kürbis-Kokos-Suppe", ["1 Kürbis", "400 ml Kokosmilch", "1 Zwiebel"])
    );
    const r = await generateWishRecipe(env, "Kürbissuppe", null, ctx(), ["Kürbissuppe"]);
    expect("recipe" in r && r.recipe.name).toBe("Kürbis-Kokos-Suppe");
  });

  test("passt nicht zu den Einstellungen → Fehlermeldung statt Rezept", async () => {
    const pasta = recipe("Kürbis-Pasta", ["400 g Spaghetti", "1 Kürbis", "Parmesan"]);
    const { env } = fakeAi(pasta, pasta);
    const r = await generateWishRecipe(env, "Pasta mit Kürbis", null, ctx({ healthConditions: ["gluten_free"] }), []);
    expect("error" in r && r.error).toMatch(/Einstellungen/);
  });

  test("Kontingent aufgebraucht → klare Meldung", async () => {
    const { env } = fakeAi(new Error("AiError: 4006: you have used up your daily free allocation of 10,000 neurons"));
    const r = await generateWishRecipe(env, "etwas Schnelles", null, ctx(), []);
    expect(r).toEqual({ error: expect.stringMatching(/Kontingent/), quota: true });
  });
});
