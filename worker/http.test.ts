import { describe, expect, test } from "bun:test";
import { GENERIC_ERROR, UserError, publicError, sameHost } from "./http";
import { ImportError } from "./recipeImport";
import { RecipeEditError } from "./recipeEdits";

describe("publicError", () => {
  test("gewollte Meldungen gehen unverändert mit ihrem Status an den Browser", () => {
    expect(publicError(new UserError("Bitte einen Namen angeben."))).toEqual({ status: 400, message: "Bitte einen Namen angeben." });
    expect(publicError(new UserError("Zu viele", 429))).toEqual({ status: 429, message: "Zu viele" });
  });
  test("Import- und Bearbeitungsfehler sind gewollte Meldungen", () => {
    expect(publicError(new ImportError("Das ist kein gültiger Link."))).toEqual({ status: 422, message: "Das ist kein gültiger Link." });
    expect(publicError(new RecipeEditError("Gericht nicht gefunden.", 404))).toEqual({ status: 404, message: "Gericht nicht gefunden." });
  });
  test("Datenbank- und Bibliotheksfehler werden nie weitergegeben", () => {
    const sqlError = new Error('relation "plan_meals" does not exist');
    expect(publicError(sqlError)).toEqual({ status: 500, message: GENERIC_ERROR });
    expect(publicError("irgendwas")).toEqual({ status: 500, message: GENERIC_ERROR });
    expect(GENERIC_ERROR).not.toContain("relation");
  });
});

describe("sameHost", () => {
  test("eigene Seite", () => {
    expect(sameHost("https://miyummy.com", "https://miyummy.com/api/plans")).toBe(true);
  });
  test("fremde Seite", () => {
    expect(sameHost("https://evil.example", "https://miyummy.com/api/plans")).toBe(false);
  });
  test("unlesbare Herkunft („null“) wirft nicht, sondern gilt als fremd", () => {
    expect(sameHost("null", "https://miyummy.com/api/plans")).toBe(false);
    expect(sameHost("", "https://miyummy.com/api/plans")).toBe(false);
  });
});
