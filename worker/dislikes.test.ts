import { describe, expect, test } from "bun:test";
import { excludedByDislikes, matchesDislikeGroup } from "./dislikes";
import { dislikeMatches, scoreMeal, type Recipe, type ScoringContext } from "./meals";

const dish = (name: string, ingredients: string[] = []) => ({ name, ingredients });

// Die von Familie Hille ausgeblendeten Fisch- und Lammgerichte (Stand 23.10.2026, nur Namen)
const FISCH_ODER_MEERESFRUECHTE = [
  "Cajun-Fisch-Tacos",
  "Fideuà – spanische Nudelpfanne mit Meeresfrüchten",
  "Fisch in Knusperpanade mit Kartoffelsalat",
  "Fischpastete mit drei Fischsorten und Ei",
  "Französischer Fischeintopf mit Rouille",
  "Ganzer Wolfsbarsch mit marokkanischen Gewürzen",
  "Garnelen mit Zuckerschoten",
  "Gebratener Seehecht in Bohnen-Chorizo-Brühe",
  "Gedämpfte Forelle Thai-Art im Päckchen",
  "Gegrillte portugiesische Sardinen",
  "Honig-Teriyaki-Lachs",
  "Kabeljau mit Tomaten und Oliven aus dem Ofen",
  "Kedgeree – Curryreis mit Räucherfisch und Ei",
  "Kokos-Fisch-Curry mit Reis",
  "Lachs-Garnelen-Risotto mit Spargel",
  "Norwegische cremige Fischsuppe",
  "Nuggets vom Loup de mer im Bierteig",
  "Poke Bowl mit Lachs",
  "Seelachs mit Senfsoße und Salzkartoffeln",
  "Spaghetti Puttanesca mit Sardinen",
  "Vietnamesische Karamell-Forelle mit Pak Choi",
];
const LAMM = [
  "Fårikål – norwegischer Lamm-Kohl-Eintopf",
  "Griechische gefüllte Tomaten mit Lamm und Reis",
  "Irish Stew mit Lamm",
  "Kreuzkümmel-Lamm-Wraps mit Krautsalat und Paprika-Mayo",
  "Lamm-Kartoffel-Pie",
  "Lancashire Hotpot – Lammeintopf mit Kartoffeldeckel",
  "Marokkanische Lamm-Tajine mit Kürbis",
];

describe("Familien-Nein (Hauptzutat)", () => {
  test("erkennt die ausgeblendeten Fisch- und Meeresfrüchte-Gerichte am Namen", () => {
    const missed = FISCH_ODER_MEERESFRUECHTE.filter(
      (n) => !matchesDislikeGroup(dish(n), "fisch") && !matchesDislikeGroup(dish(n), "meeresfruechte")
    );
    expect(missed).toEqual([]);
  });
  test("erkennt Lammgerichte, aber nicht Flammkuchen", () => {
    expect(LAMM.filter((n) => !matchesDislikeGroup(dish(n), "lamm"))).toEqual([]);
    expect(matchesDislikeGroup(dish("Flammkuchen Elsässer Art"), "lamm")).toBe(false);
  });
  test("Fischsauce als Würze zählt nicht als Fisch", () => {
    expect(matchesDislikeGroup(dish("Thai-Curry mit Gemüse", ["2 EL Fischsauce", "400 ml Kokosmilch"]), "fisch")).toBe(false);
  });
  test("Gemüse-Bratwurst ist kein Schwein", () => {
    expect(matchesDislikeGroup(dish("Gemüsebratwurstpfanne", ["4 vegane Bratwürste"]), "schwein")).toBe(false);
  });
});

describe("Ausschluss beim Planen", () => {
  const members = (dislikes: string[][]) => dislikes.map((d) => ({ disliked_foods: d }));
  const curry = dish("Kokos-Fisch-Curry mit Reis", ["400 g Kabeljau", "400 ml Kokosmilch"]);
  const check = (familyDislikes: string[], m: { disliked_foods: string[] }[]) =>
    excludedByDislikes(curry, familyDislikes, m, (d) => dislikeMatches({ ...curry, type: "fleisch", instructions: "" } as Recipe, d));

  test("Familien-Nein schließt immer aus", () => {
    expect(check(["fisch"], members([[], [], [], []]))).toBe(true);
  });
  test("Abneigung von 1 von 4 schließt nicht aus (nur Abzug)", () => {
    expect(check([], members([["Fisch"], [], [], []]))).toBe(false);
  });
  test("Abneigung von 2 von 4 ist keine Mehrheit", () => {
    expect(check([], members([["Fisch"], ["Lachs", "Kabeljau"], [], []]))).toBe(false);
  });
  test("Abneigung von 3 von 4 schließt aus", () => {
    expect(check([], members([["Fisch"], ["Kabeljau"], ["fisch"], []]))).toBe(true);
  });

  test("scoreMeal: Familien-Nein → nie planen", () => {
    const ctx: ScoringContext = {
      healthFocus: [],
      healthConditions: [],
      familyMembers: [{ type: "adult", age: null, favorite_foods: null, disliked_foods: null }],
      mealRatings: {},
      rejectedMeals: [],
      familyDislikes: ["fisch"],
    } as unknown as ScoringContext;
    const r = { name: curry.name, type: "fleisch", ingredients: curry.ingredients, instructions: "" } as Recipe;
    expect(scoreMeal(r, ctx)).toBe(-1);
    expect(scoreMeal(r, { ...ctx, familyDislikes: [] })).toBeGreaterThanOrEqual(0);
  });
});
