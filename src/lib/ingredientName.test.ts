import { describe, expect, test } from "bun:test";
import { cleanIngredientName } from "./ingredientName";

describe("cleanIngredientName", () => {
  test("entfernt „Etwas“ und „zum Braten“ & Co.", () => {
    expect(cleanIngredientName("Etwas Butter zum Braten")).toBe("Butter");
    expect(cleanIngredientName("Etwas Öl zum Braten")).toBe("Öl");
    expect(cleanIngredientName("Olivenöl zum Anbraten")).toBe("Olivenöl");
    expect(cleanIngredientName("Butter zum Ausfetten der Form")).toBe("Butter");
    expect(cleanIngredientName("Salz nach Geschmack")).toBe("Salz");
    expect(cleanIngredientName("Ein bisschen Mehl zum Bestäuben")).toBe("Mehl");
  });
  test("lässt normale Namen unverändert", () => {
    expect(cleanIngredientName("Speck")).toBe("Speck");
    expect(cleanIngredientName("Rinderrouladen")).toBe("Rinderrouladen");
    expect(cleanIngredientName("Etwas")).toBe("Etwas");
  });
});
