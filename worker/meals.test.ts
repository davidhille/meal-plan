import { describe, expect, test } from "bun:test";
import {
  MEAL_DATABASE,
  type Recipe,
  type ScoringContext,
  containsGluten,
  dishKeywords,
  dislikeMatches,
  isSimilarDish,
  looksMeaty,
  pickMeal,
  pickReplacement,
  preferredTypeFor,
  scoreMeal,
  violatesHealthConditions,
} from "./meals";

const recipe = (name: string, ingredients: string[], type: Recipe["type"] = "vegetarisch"): Recipe => ({
  name,
  type,
  ingredients,
  instructions: "",
});

const ctx = (over: Partial<ScoringContext> = {}): ScoringContext => ({
  familyMembers: [],
  rejectedMeals: [],
  mealRatings: {},
  healthConditions: [],
  healthGoal: "balanced",
  ...over,
});

describe("Grundsammlung", () => {
  test("Namen sind eindeutig und jedes Rezept hat Zutaten", () => {
    const names = MEAL_DATABASE.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    for (const m of MEAL_DATABASE) expect(m.ingredients.length).toBeGreaterThan(0);
  });
  test("vegetarische Rezepte enthalten kein Fleisch", () => {
    const meaty = MEAL_DATABASE.filter((m) => m.type === "vegetarisch" && looksMeaty(m)).map((m) => m.name);
    expect(meaty).toEqual([]);
  });
});

describe("dislikeMatches", () => {
  const lachs = recipe("Ofenlachs mit Gemüse", ["4 Lachsfilets", "500 g Brokkoli"], "fleisch");
  test("Oberbegriff „Fisch“ trifft Lachs", () => expect(dislikeMatches(lachs, "Fisch")).toBe(true));
  test("„Pilze“ trifft Champignons", () =>
    expect(dislikeMatches(recipe("Rahmpfanne", ["250 g Champignons"]), "Pilze")).toBe(true));
  test("trifft nicht, was nicht drin ist", () => expect(dislikeMatches(lachs, "Käse")).toBe(false));
});

describe("violatesHealthConditions", () => {
  const curry = recipe("Gemüse-Curry", ["400 ml Kokosmilch", "300 g Reis", "2 Karotten"]);
  const brei = recipe("Grießbrei", ["500 ml Hafermilch", "80 g Hirse", "Zimt"]);

  test("laktosefrei: Kokos- und Hafermilch sind erlaubt", () => {
    expect(violatesHealthConditions(curry, ["lactose_intolerant"])).toBe(false);
    expect(violatesHealthConditions(brei, ["lactose_intolerant"])).toBe(false);
  });
  test("laktosefrei: Sahne und Käse sind ausgeschlossen, ausdrücklich laktosefreie erlaubt", () => {
    expect(violatesHealthConditions(recipe("Nudelauflauf", ["200 ml Sahne"]), ["lactose_intolerant"])).toBe(true);
    expect(violatesHealthConditions(recipe("Auflauf", ["200 ml laktosefreie Sahne"]), ["lactose_intolerant"])).toBe(false);
  });
  test("vegan: „Brei“ ist kein Ei, Eier aber schon", () => {
    expect(violatesHealthConditions(brei, ["vegan"])).toBe(false);
    expect(violatesHealthConditions(recipe("Pfannkuchen", ["3 Eier", "200 ml Hafermilch"]), ["vegan"])).toBe(true);
  });
  test("vegetarisch schließt Fleischgerichte aus", () => {
    expect(violatesHealthConditions(recipe("Gulasch", ["500 g Rindfleisch"], "fleisch"), ["vegetarian"])).toBe(true);
    expect(violatesHealthConditions(curry, ["vegetarian"])).toBe(false);
  });
  test("glutenfrei: normale Nudeln raus, glutenfreie erlaubt", () => {
    expect(containsGluten(recipe("Pasta", ["400 g Spaghetti"]))).toBe(true);
    expect(violatesHealthConditions(recipe("Spaghetti Bolognese", ["400 g glutenfreie Spaghetti", "300 g Rinderhack"]), ["gluten_free"])).toBe(false);
    expect(violatesHealthConditions(recipe("Gemüsepfanne", ["2 EL Sojasoße"]), ["gluten_free"])).toBe(true);
    // Name allein reicht, wenn keine glutenfreie Variante in den Zutaten steht
    expect(violatesHealthConditions(recipe("Spaghetti-Salat", ["200 g Rucola"]), ["gluten_free"])).toBe(true);
  });
  test("Nussallergie, koscher, halal", () => {
    expect(violatesHealthConditions(recipe("Pesto", ["50 g Pinienkerne"]), ["nut_allergy"])).toBe(true);
    expect(violatesHealthConditions(recipe("Carbonara", ["100 g Speck"], "fleisch"), ["kosher"])).toBe(true);
    expect(violatesHealthConditions(recipe("Risotto", ["100 ml Weißwein"]), ["halal"])).toBe(true);
    expect(violatesHealthConditions(recipe("Salat", ["2 EL Weinessig"]), ["halal"])).toBe(false);
  });
  test("ohne Bedingungen ist alles erlaubt", () => expect(violatesHealthConditions(curry, [])).toBe(false));
});

describe("scoreMeal", () => {
  const meal = recipe("Spaghetti mit Tomatensoße", ["400 g Spaghetti", "1 Dose Tomaten"]);
  test("abgelehnte Gerichte sind ausgeschlossen", () =>
    expect(scoreMeal(meal, ctx({ rejectedMeals: [meal.name] }))).toBe(-1));
  test("Bewertung, Favorit und Vorlieben heben, Abneigungen und Wiederholung senken", () => {
    const base = scoreMeal(meal, ctx());
    expect(scoreMeal(meal, ctx({ mealRatings: { [meal.name]: 5 } }))).toBeGreaterThan(base);
    expect(scoreMeal(meal, ctx({ favoriteNames: [meal.name] }))).toBeGreaterThan(base);
    expect(scoreMeal(meal, ctx({ recentNames: [meal.name] }))).toBeLessThan(base);
    const likes = [{ type: "child", age: 7, favorite_foods: ["Nudeln"], disliked_foods: null }];
    const dislikes = [{ type: "adult", age: null, favorite_foods: null, disliked_foods: ["Tomaten"] }];
    expect(scoreMeal(meal, ctx({ familyMembers: likes }))).toBeGreaterThan(base);
    expect(scoreMeal(meal, ctx({ familyMembers: dislikes }))).toBeLessThan(base);
  });
  test("Gesundheitsbedingung schließt aus", () =>
    expect(scoreMeal(meal, ctx({ healthConditions: ["gluten_free"] }))).toBe(-1));
});

describe("ähnliche Gerichte", () => {
  test("dishKeywords ohne Füllwörter und Herkunft", () =>
    expect([...dishKeywords("Asiatische Gemüse-Reis-Pfanne mit Tofu")]).toEqual(["gemüs", "rei", "pfann", "tofu"]));
  test("gleiche Pfanne in anderer Küche ist ähnlich", () =>
    expect(isSimilarDish("Mediterrane Quinoa-Pfanne", "Skandinavische Quinoa-Pfanne")).toBe(true));
  test("Beilagen zählen nicht", () =>
    expect(isSimilarDish("Kassler mit Sauerkraut", "Kassler mit Kartoffelpüree")).toBe(true));
  test("verschiedene Gerichte sind nicht ähnlich", () =>
    expect(isSimilarDish("Spaghetti Bolognese", "Gemüse-Curry")).toBe(false));
});

describe("preferredTypeFor", () => {
  test("Wochenrhythmus", () => {
    expect(preferredTypeFor("2026-10-12")).toBe("vegetarisch"); // Mo
    expect(preferredTypeFor("2026-10-13")).toBe("fleisch"); // Di
    expect(preferredTypeFor("2026-10-14")).toBe("vegetarisch"); // Mi
    expect(preferredTypeFor("2026-10-17")).toBe("wochenende"); // Sa
    expect(preferredTypeFor("2026-10-18")).toBe("wochenende"); // So
  });
});

describe("pickMeal", () => {
  test("eine Woche ohne Wiederholung und im richtigen Rhythmus", () => {
    const used = new Set<string>();
    const days = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];
    const picks = days.map((d) => pickMeal(d, ctx(), used));
    expect(picks.every(Boolean)).toBe(true);
    expect(new Set(picks.map((p) => p!.name)).size).toBe(days.length);
    days.forEach((d, i) => expect(picks[i]!.type).toBe(preferredTypeFor(d)));
  });
  test("hält sich an Gesundheitsbedingungen", () => {
    const used = new Set<string>();
    for (let i = 0; i < 14; i++) {
      const p = pickMeal("2026-10-13", ctx({ healthConditions: ["vegetarian", "gluten_free"] }), used);
      expect(p).not.toBeNull();
      expect(violatesHealthConditions(p!, ["vegetarian", "gluten_free"])).toBe(false);
    }
  });
  test("wiederholt das am längsten zurückliegende, wenn alle dran waren", () => {
    const pool = [recipe("A", ["x"]), recipe("B", ["y"])];
    const used = new Set(["A", "B"]);
    expect(pickMeal("2026-10-12", ctx(), used, pool)?.name).toBe("A");
    expect([...used]).toEqual(["B", "A"]);
  });
  test("leerer Pool ergibt null", () => expect(pickMeal("2026-10-12", ctx(), new Set(), [])).toBeNull());
});

describe("pickReplacement", () => {
  test("nimmt das beste passende Gericht, das nicht ausgeschlossen ist", () => {
    const pool = [
      recipe("Curry", ["Reis"], "vegetarisch"),
      recipe("Schnitzel", ["Schweineschnitzel"], "fleisch"),
      recipe("Gulasch", ["Rindfleisch"], "fleisch"),
    ];
    const r = pickReplacement("2026-10-13", ctx({ mealRatings: { Gulasch: 5 } }), pool, new Set(["Schnitzel"]));
    expect(r?.name).toBe("Gulasch");
  });
});
