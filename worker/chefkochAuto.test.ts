import { describe, expect, test } from "bun:test";
import { newestTopMainUrl } from "./chefkoch";

describe("Chefkoch-Automatik", () => {
  test("Such-Adresse: neueste Hauptspeisen ab 4,5 Sternen", () => {
    expect(newestTopMainUrl()).toBe("https://www.chefkoch.de/rs/s0t21r4.5o6/Hauptspeise-Rezepte.html");
    expect(newestTopMainUrl(2)).toBe("https://www.chefkoch.de/rs/s2t21r4.5o6/Hauptspeise-Rezepte.html");
  });
});
