import { describe, expect, test } from "bun:test";
import { parseAiSide } from "./aiSides";
import { parseSideInput } from "./routes/sides";

describe("parseAiSide", () => {
  test("liest das Modell-Objekt mit response", () => {
    const s = parseAiSide({ response: { name: "„Ofenkürbis“", duration_min: 25, ingredients: ["1 Kürbis", "2 EL Öl"], steps: ["1. Schneiden", "Backen"] } }, "beilage");
    expect(s?.name).toBe("Ofenkürbis");
    expect(s?.instructions).toBe("Schneiden\nBacken");
  });
  test("verwirft zu wenig Inhalt", () => {
    expect(parseAiSide({ name: "X", ingredients: ["a"], steps: [] }, "salat")).toBeNull();
    expect(parseAiSide("kein json", "salat")).toBeNull();
  });
});

describe("parseSideInput", () => {
  test("braucht Name, Art und Zutaten", () => {
    expect(parseSideInput({ name: "A", kind: "salat", ingredients: ["1 Gurke"] })?.kind).toBe("salat");
    expect(parseSideInput({ name: "A", kind: "suppe", ingredients: ["1 Gurke"] })).toBeNull();
    expect(parseSideInput({ name: "A", kind: "salat", ingredients: [] })).toBeNull();
  });
  test("nur https-Quellen", () => {
    expect(parseSideInput({ name: "A", kind: "beilage", ingredients: ["x"], sourceUrl: "http://a" })?.sourceUrl).toBeNull();
  });
});
