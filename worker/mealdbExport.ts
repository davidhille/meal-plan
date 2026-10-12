// Einmaliger Export aus TheMealDB (kostenlose Rezept-API, Test-Schlüssel "1"), damit die Rezepte
// außerhalb übersetzt und als feste Sammlung übernommen werden können. Nur Hauptgerichte.

const BASE = "https://www.themealdb.com/api/json/v1/1";
const MAIN_CATEGORIES = new Set(["Beef", "Chicken", "Lamb", "Pork", "Seafood", "Pasta", "Vegetarian", "Vegan", "Goat"]);

interface RawMeal {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strTags: string | null;
  [key: string]: string | null;
}

export async function exportMealDb(): Promise<Response> {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  const meals: RawMeal[] = [];
  // In kleinen Gruppen abrufen, um die API nicht zu überlasten
  for (let i = 0; i < letters.length; i += 6) {
    const batch = await Promise.all(
      letters.slice(i, i + 6).map(async (l) => {
        const res = await fetch(`${BASE}/search.php?f=${l}`);
        if (!res.ok) throw new Error(`TheMealDB ${l}: HTTP ${res.status}`);
        return ((await res.json()) as { meals: RawMeal[] | null }).meals ?? [];
      })
    );
    meals.push(...batch.flat());
  }
  const out = meals
    .filter((m) => MAIN_CATEGORIES.has(m.strCategory ?? ""))
    .map((m) => ({
      id: m.idMeal,
      name: m.strMeal,
      category: m.strCategory,
      area: m.strArea,
      tags: m.strTags,
      thumb: m.strMealThumb,
      ingredients: Array.from({ length: 20 }, (_, i) => [m[`strMeasure${i + 1}`], m[`strIngredient${i + 1}`]])
        .filter(([, ing]) => ing && ing.trim())
        .map(([measure, ing]) => `${(measure ?? "").trim()} ${ing!.trim()}`.trim()),
      instructions: (m.strInstructions ?? "").replace(/\r\n/g, "\n").trim(),
    }));
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), count: out.length, meals: out }, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mealdb-export.json"',
    },
  });
}
