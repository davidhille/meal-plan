import { describe, expect, test } from "bun:test";
import { newestTopMainUrl } from "./chefkoch";
import { sourceKey } from "./repo";

describe("Chefkoch-Automatik", () => {
  test("Such-Adresse: neueste Hauptspeisen ab 4,5 Sternen", () => {
    expect(newestTopMainUrl()).toBe("https://www.chefkoch.de/rs/s0t21r4.5o6/Hauptspeise-Rezepte.html");
    expect(newestTopMainUrl(2)).toBe("https://www.chefkoch.de/rs/s2t21r4.5o6/Hauptspeise-Rezepte.html");
  });
});

describe("Gleiche Quelle", () => {
  test("Chefkoch über die Rezept-Nummer, Titel in der Adresse egal", () => {
    expect(sourceKey("https://www.chefkoch.de/rezepte/4441541785841709/Haehnchenbrust-in-cremiger-Knoblauchsauce.html")).toBe(
      sourceKey("https://www.chefkoch.de/rezepte/4441541785841709/Anderer-Titel.html?portionen=2")
    );
  });
  test("andere Seiten: Adresse ohne Parameter", () => {
    expect(sourceKey("https://blog.de/rezept/curry/?utm=x")).toBe("https://blog.de/rezept/curry");
  });
});
