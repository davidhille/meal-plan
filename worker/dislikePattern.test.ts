import { describe, expect, test } from "bun:test";
import { dislikeHint } from "./dislikePattern";

const lamm = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Lammgericht ${i + 1}`, ingredients: ["500 g Lammfleisch"] }));
const pasta = { name: "Spaghetti", ingredients: ["400 g Spaghetti"] };

describe("Muster-Vorschlag beim Ausblenden", () => {
  test("beim 3. ausgeblendeten Lammgericht kommt der Hinweis", () => {
    const rejected = [pasta, ...lamm(3)];
    expect(dislikeHint(rejected, lamm(3)[2], [])).toEqual({ id: "lamm", label: "Lamm", count: 3 });
  });
  test("beim 1., 2. und 4. noch nicht, beim 6. noch einmal", () => {
    for (const n of [1, 2, 4, 5]) expect(dislikeHint(lamm(n), lamm(n)[n - 1], [])).toBeNull();
    expect(dislikeHint(lamm(6), lamm(6)[5], [])?.count).toBe(6);
  });
  test("ist die Hauptzutat schon „nie“, kommt kein Hinweis", () => {
    expect(dislikeHint(lamm(3), lamm(3)[2], ["lamm"])).toBeNull();
  });
  test("das ausgeblendete Gericht muss selbst zur Hauptzutat gehören", () => {
    expect(dislikeHint([...lamm(3), pasta], pasta, [])).toBeNull();
  });
  test("gleiche Namen zählen nur einmal", () => {
    const dup = [lamm(1)[0], lamm(1)[0], lamm(2)[1]];
    expect(dislikeHint(dup, dup[2], [])).toBeNull();
  });
});
