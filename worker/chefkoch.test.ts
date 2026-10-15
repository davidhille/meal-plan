import { describe, expect, test } from "bun:test";
import { chefkochSearchUrl, isChefkochRecipeUrl, parseSearchResults } from "./chefkoch";
import { parseRecipeDetails } from "./recipeImport";

const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe("chefkochSearchUrl", () => {
  test("ohne Filter", () =>
    expect(chefkochSearchUrl("Kürbis Risotto")).toBe("https://www.chefkoch.de/rs/s0tpr1o2/K%C3%BCrbis-Risotto/Rezepte.html"));
  test("Hauptspeise, vegetarisch, bis 30 Min, ab 4 Sternen, nach Bewertung", () =>
    expect(chefkochSearchUrl("Curry", { main: true, vegetarian: true, maxMinutes: 30, topRated: true, sort: "rating" })).toBe(
      "https://www.chefkoch.de/rs/s0t21,32p30r4o3/Curry/Rezepte.html"
    ));
  test("vegan statt vegetarisch, Zeit auf die nächste Stufe gerundet", () =>
    expect(chefkochSearchUrl("Linsen", { vegetarian: true, vegan: true, maxMinutes: 45 })).toBe(
      "https://www.chefkoch.de/rs/s0t57p60r1o2/Linsen/Rezepte.html"
    ));
});

describe("isChefkochRecipeUrl", () => {
  test("Rezeptseite", () => expect(isChefkochRecipeUrl("https://www.chefkoch.de/rezepte/745721177147257/Lasagne.html")).toBe(true));
  test("andere Seite oder fremde Domain", () => {
    expect(isChefkochRecipeUrl("https://www.chefkoch.de/rs/s0/Lasagne/Rezepte.html")).toBe(false);
    expect(isChefkochRecipeUrl("https://chefkoch.de.evil.com/rezepte/1/x.html")).toBe(false);
    expect(isChefkochRecipeUrl("http://www.chefkoch.de/rezepte/1/x.html")).toBe(false);
  });
});

describe("parseSearchResults", () => {
  test("liest die ItemList, ohne Doppelte und ohne Tracking-Anhang", () => {
    const html = ld({
      "@type": "ItemList",
      itemListElement: [
        { "@type": "ListItem", position: 1, url: "https://www.chefkoch.de/rezepte/1/Curry.html?zufall=1#x" },
        { "@type": "ListItem", position: 2, url: "https://www.chefkoch.de/rezepte/2/Dal.html" },
        { "@type": "ListItem", position: 3, url: "https://www.chefkoch.de/rezepte/1/Curry.html" },
        { "@type": "ListItem", position: 4, url: "https://www.chefkoch.de/magazin/artikel.html" },
      ],
    });
    expect(parseSearchResults(html)).toEqual([
      "https://www.chefkoch.de/rezepte/1/Curry.html",
      "https://www.chefkoch.de/rezepte/2/Dal.html",
    ]);
  });
  test("ohne ItemList: Links der Seite", () => {
    const html = '<a href="https://www.chefkoch.de/rezepte/3/Gulasch.html">Gulasch</a>';
    expect(parseSearchResults(html)).toEqual(["https://www.chefkoch.de/rezepte/3/Gulasch.html"]);
  });
});

describe("parseRecipeDetails", () => {
  const html = ld({
    "@type": "Recipe",
    name: "Kürbis-Curry",
    image: ["https://img.chefkoch-cdn.de/rezepte/1/bilder/1/crop-960x640/kuerbis-curry.jpg"],
    recipeYield: "2 Portionen",
    prepTime: "PT20M",
    cookTime: "PT25M",
    recipeCategory: "Hauptspeise",
    keywords: "Gemüse, Vegetarisch, Hauptspeise",
    aggregateRating: { ratingValue: "4,6", ratingCount: 312 },
    recipeIngredient: ["500 g Kürbis", "200 ml Kokosmilch"],
    recipeInstructions: "Kürbis würfeln.\nMit Kokosmilch köcheln.",
  });
  const d = parseRecipeDetails(html, "https://www.chefkoch.de/rezepte/1/Kuerbis-Curry.html");

  test("Bild, Bewertung und Schlagwörter", () => {
    expect(d?.imageUrl).toBe("https://img.chefkoch-cdn.de/rezepte/1/bilder/1/crop-960x640/kuerbis-curry.jpg");
    expect(d?.rating).toBe(4.6);
    expect(d?.ratingCount).toBe(312);
    expect(d?.tags).toEqual(["Hauptspeise", "Gemüse", "Vegetarisch"]);
  });
  test("Rezept auf 4 Portionen, Zeit aus Vor- und Kochzeit", () => {
    expect(d?.recipe.ingredients).toEqual(["1000 g Kürbis", "400 ml Kokosmilch"]);
    expect(d?.recipe.durationMin).toBe(45);
    expect(d?.recipe.type).toBe("vegetarisch");
  });
  test("ohne Zutaten (z. B. Plus-Rezept): null", () =>
    expect(parseRecipeDetails(ld({ "@type": "Recipe", name: "Plus" }), "https://www.chefkoch.de/rezepte/9/x.html")).toBeNull());
  test("Autor wird vom Namen abgeschnitten", () => {
    const d2 = parseRecipeDetails(
      ld({ "@type": "Recipe", name: "Paprika-Sahne-Hähnchen von Sister", author: { "@type": "Person", name: "Sister" }, recipeIngredient: ["1 Hähnchen"] }),
      "https://www.chefkoch.de/rezepte/5/x.html"
    );
    expect(d2?.recipe.name).toBe("Paprika-Sahne-Hähnchen");
  });
  test("ohne Bild in den Rezeptdaten: Vorschaubild der Seite (og:image)", () => {
    const html2 =
      '<meta property="og:image" content="https://img.chefkoch-cdn.de/rezepte/7/bilder/1/crop-960x720/x.jpg">' +
      ld({ "@type": "Recipe", name: "Dal", recipeIngredient: ["200 g Linsen"] });
    expect(parseRecipeDetails(html2, "https://www.chefkoch.de/rezepte/7/x.html")?.imageUrl).toBe(
      "https://img.chefkoch-cdn.de/rezepte/7/bilder/1/crop-960x720/x.jpg"
    );
  });
});
