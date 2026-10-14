import { describe, expect, test } from "bun:test";
import { photoConflict, photoFit, recipeText } from "./images";

const pixabay = (tags: string, slug: string) => `${tags} https://pixabay.com/de/photos/${slug}/`;

describe("photoFit – Ersatzfotos müssen zum Rezept passen", () => {
  test("Cheeseburger-Suppe: Kürbissuppe passt nicht", () => {
    const ing = ["500 g Rinderhackfleisch", "2 Zwiebeln", "150 g Gewürzgurken", "200 g Schmelzkäse", "150 g Cheddarkäse"];
    expect(photoFit("Cheeseburger Suppe", ing, pixabay("kürbissuppe, suppe, kürbis", "k%C3%BCrbissuppe-suppe-4508015"))).toBe(-1);
    // Allgemeine „Suppe“ ohne Cheeseburger reicht nicht
    expect(photoFit("Cheeseburger Suppe", ing, pixabay("suppe, schüssel, essen", "suppe-sch%C3%BCssel-123"))).toBe(-1);
    expect(photoFit("Cheeseburger Suppe", ing, pixabay("cheeseburger suppe, suppe, hackfleisch, käse", "cheeseburger-suppe-1"))).toBeGreaterThan(0);
  });

  test("Cordon bleu mit Kartoffelsalat: Foto mit Pommes passt nicht", () => {
    const ing = ["4 Schweineschnitzel", "4 Scheiben Kochschinken", "4 Scheiben Emmentaler", "1 kg festkochende Kartoffeln"];
    expect(photoFit("Cordon bleu mit Kartoffelsalat", ing, pixabay("cordon bleu, pommes frites, essen", "cordon-bleu-pommes-frites-essen-4727459"))).toBe(-1);
    expect(photoFit("Cordon bleu mit Kartoffelsalat", ing, pixabay("cordon bleu, schnitzel, kartoffelsalat", "cordon-bleu-schnitzel-2"))).toBeGreaterThan(0);
  });

  test("Hähnchen-Gemüse-Pfanne: Tofu und Brokkoli passen nicht", () => {
    const ing = ["Hähnchenbrust (ca. 600 g)", "Reis (ca. 250 g)", "Paprika (1 rote)", "Zucchini (1)", "Champignons (250 g)"];
    const name = "Cremige Hähnchen-Gemüse-Pfanne mit Reis und Zitronenkräutern";
    expect(photoFit(name, ing, pixabay("mahlzeit, lebensmittel, tofu, reis, pfanne, brokkoli", "mahlzeit-lebensmittel-tofu-reis-5921491"))).toBe(-1);
    expect(photoFit(name, ing, pixabay("hähnchen, pfanne, paprika, zucchini", "h%C3%A4hnchen-pfanne-3"))).toBeGreaterThan(0);
  });

  test("Falafel-Teller: Hummus-Brot zum Frühstück passt nicht", () => {
    const ing = ["400g Falafel", "200g Hummus", "4 Fladenbrote", "1 Gurke"];
    expect(photoFit("Falafel-Teller mit Hummus und Salat", ing, pixabay("frühstück, gesund, hummus, teller", "fr%C3%BChst%C3%BCck-gesund-hummus-verbreitung-1804457"))).toBe(-1);
    expect(photoFit("Falafel-Teller mit Hummus und Salat", ing, pixabay("falafel, teller, hummus, salat", "falafel-teller-4"))).toBeGreaterThan(0);
  });

  test("besser passende Fotos bekommen mehr Punkte", () => {
    const ing = ["500 g Spätzle", "200 g Bergkäse", "3 Zwiebeln"];
    const plain = photoFit("Käsespätzle mit Röstzwiebeln", ing, "käsespätzle");
    const better = photoFit("Käsespätzle mit Röstzwiebeln", ing, "käsespätzle röstzwiebeln bergkäse");
    expect(plain).toBeGreaterThanOrEqual(0);
    expect(better).toBeGreaterThan(plain);
  });

  test("Nachtische dürfen „Dessert“ und „Kuchen“ zeigen, Hauptgerichte nicht", () => {
    expect(photoConflict(recipeText("Apfelstrudel", ["4 Äpfel"], "nachtisch"), "apfelstrudel dessert kuchen")).toBeNull();
    expect(photoConflict(recipeText("Apfel-Auflauf", ["4 Äpfel"], "vegetarisch"), "auflauf dessert")).toBe("dessert");
  });
});
