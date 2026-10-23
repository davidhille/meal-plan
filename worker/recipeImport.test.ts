import { describe, expect, test } from "bun:test";
import { guessType, parseRecipeHtml, stripAuthorSuffix } from "./recipeImport";

const page = (data: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`;

describe("parseRecipeHtml", () => {
  const html = page({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", name: "Chefkoch" },
      {
        "@type": "Recipe",
        name: "Omas Gulasch",
        recipeYield: "8 Portionen",
        totalTime: "PT2H30M",
        recipeIngredient: ["1 kg Rindfleisch", "2 Zwiebel(n)", "1 1/2 Dosen Tomaten"],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Fleisch anbraten." },
          { "@type": "HowToStep", text: "Schmoren &amp; servieren." },
        ],
      },
    ],
  });
  const r = parseRecipeHtml(html, "https://www.chefkoch.de/rezepte/1/gulasch.html");

  test("liest Rezept aus @graph", () => {
    expect(r?.name).toBe("Omas Gulasch");
    expect(r?.sourceUrl).toBe("https://www.chefkoch.de/rezepte/1/gulasch.html");
    expect(r?.sourcePortions).toBe(8);
    expect(r?.durationMin).toBe(150);
  });
  test("rechnet auf 4 Portionen um und löst Chefkoch-Schreibweisen auf", () =>
    expect(r?.ingredients).toEqual(["½ kg Rindfleisch", "1 Zwiebel", "1 Dose Tomaten"]));
  test("Zubereitungsschritte ohne HTML-Entities", () =>
    expect(r?.instructions).toBe("Fleisch anbraten.\nSchmoren & servieren."));
  test("lange Gerichte gehören aufs Wochenende", () => expect(r?.type).toBe("wochenende"));

  test("ohne Rezeptdaten: null", () => {
    expect(parseRecipeHtml("<html><body>Kein Rezept</body></html>", "https://x.de")).toBeNull();
    expect(parseRecipeHtml(page({ "@type": "Recipe", name: "Leer" }), "https://x.de")).toBeNull();
  });
});

describe("guessType", () => {
  const r = (ingredients: string[], durationMin?: number) => ({ name: "Test", type: "vegetarisch" as const, ingredients, instructions: "", durationMin });
  test("nach Zutaten", () => {
    expect(guessType(r(["300 g Hähnchenbrust"], 30))).toBe("fleisch");
    expect(guessType(r(["300 g Tofu"], 30))).toBe("vegetarisch");
  });
  test("über 75 Minuten: Wochenende", () => expect(guessType(r(["300 g Tofu"], 90))).toBe("wochenende"));
});

describe("Schreibweisen aus Rezeptseiten", () => {
  test("weiches Trennzeichen und zerlegte Umlaute stören die Fleisch-Erkennung nicht", () => {
    const html = page({
      "@type": "Recipe",
      name: "Hähn­chen in Sahne".normalize("NFD"),
      totalTime: "PT30M",
      recipeIngredient: ["500 g Hähn­chenbrust".normalize("NFD")],
    });
    const r = parseRecipeHtml(html, "https://www.chefkoch.de/rezepte/1/x.html");
    expect(r?.name).toBe("Hähnchen in Sahne");
    expect(r?.type).toBe("fleisch");
  });
});

describe("Nutzername im Titel", () => {
  test("entfernt Chefkoch-Nutzernamen am Ende", () => {
    expect(stripAuthorSuffix("Knoblauch-Hähnchenbrust in Parmesan-Kräuterkruste von DasperfekteDinner")).toBe(
      "Knoblauch-Hähnchenbrust in Parmesan-Kräuterkruste"
    );
    expect(stripAuthorSuffix("Hähnchenbrust in cremiger Knoblauchsauce von bettina_uphus")).toBe("Hähnchenbrust in cremiger Knoblauchsauce");
    expect(stripAuthorSuffix("Linsensuppe von koch2010")).toBe("Linsensuppe");
    expect(stripAuthorSuffix("Gulasch von Anna", "Anna")).toBe("Gulasch");
  });
  test("lässt normale Titel stehen", () => {
    expect(stripAuthorSuffix("Gulasch von Oma")).toBe("Gulasch von Oma");
    expect(stripAuthorSuffix("Filet von der Pute mit Reis")).toBe("Filet von der Pute mit Reis");
    expect(stripAuthorSuffix("Kürbissuppe")).toBe("Kürbissuppe");
  });
});
