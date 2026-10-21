import { describe, expect, test } from "bun:test";
import { DEFAULT_PANTRY, buildPlanItems, familyPortions, isPantry, mergeKey, pantryOverview } from "./shopping";

const displays = (r: ReturnType<typeof buildPlanItems>) => r.items.map((i) => `${i.defaultLabel}:${i.display}`);

describe("familyPortions (Worker)", () => {
  test("gleich wie im Frontend", () => {
    expect(familyPortions([])).toBe(4);
    expect(
      familyPortions([
        { type: "adult", age: null },
        { type: "adult", age: null },
        { type: "child", age: 7 },
        { type: "child", age: 5 },
      ])
    ).toBe(3.5);
  });
});

describe("mergeKey", () => {
  test("Einzahl und Mehrzahl ergeben denselben Schlüssel", () => {
    expect(mergeKey("Zwiebeln")).toBe(mergeKey("Zwiebel"));
    expect(mergeKey("Karotten (gewürfelt)")).toBe(mergeKey("Karotte"));
  });
});

describe("buildPlanItems", () => {
  const bolognese = ["400 g Spaghetti", "200 g Hackfleisch", "2 Zwiebeln", "Salz", "Pfeffer"];
  const ofenkartoffeln = ["1,5 kg Kartoffeln", "1 Zwiebel", "500 g Spaghetti", "Salz, Pfeffer, Petersilie", "1 TL Chiliflocken"];

  test("fasst gleiche Zutaten zusammen und sortiert Vorrat aus", () => {
    const r = buildPlanItems([bolognese, ofenkartoffeln], 4);
    expect(displays(r)).toEqual([
      "metzger:200 g Hackfleisch",
      "knuspr:1,5 kg Kartoffeln",
      "knuspr:Petersilie",
      "knuspr:900 g Spaghetti",
      "knuspr:3 Zwiebeln",
    ]);
    expect(r.pantryNeeded).toEqual(["Chiliflocken", "Pfeffer", "Salz"]);
  });

  test("rechnet auf die Familienportionen um, Stückware wird aufgerundet", () => {
    const r = buildPlanItems([["400 g Spaghetti", "3 Zwiebeln", "1 Dose Tomaten"]], 3);
    expect(r.items.map((i) => i.display)).toEqual(["300 g Spaghetti", "1 Dose Tomaten", "3 Zwiebeln"]);
  });

  test("Dosen werden addiert und in der Mehrzahl angezeigt", () => {
    const r = buildPlanItems([["1 Dose Kokosmilch"], ["1 Dose Kokosmilch"]], 4);
    expect(r.items.map((i) => i.display)).toEqual(["2 Dosen Kokosmilch"]);
  });

  test("eigener Vorrat kommt nicht auf die Liste", () => {
    const r = buildPlanItems([["2 Zwiebeln", "400 g Reis"]], 4, new Set([mergeKey("Zwiebeln")]));
    expect(r.items.map((i) => i.display)).toEqual(["400 g Reis"]);
    expect(r.pantryNeeded).toEqual(["Zwiebeln"]);
  });

  test("Brühe ist kein Fleisch, frische Kräuter sind kein Vorrat", () => {
    const r = buildPlanItems([["500 ml Hühnerbrühe", "1 Bund frischer Thymian"]], 4);
    const labels = Object.fromEntries(r.items.map((i) => [i.baseName, i.defaultLabel]));
    expect(labels["Hühnerbrühe"]).toBe("knuspr");
    expect(Object.keys(labels)).toContain("Frischer Thymian");
  });

  test("Gäste: zusätzliche Portionen nur für dieses Gericht", () => {
    const r = buildPlanItems([["400 g Spaghetti"], ["400 g Spaghetti"]], 4, new Set(), [], new Set(), [4, 0]);
    expect(r.items.map((i) => i.display)).toEqual(["1,2 kg Spaghetti"]);
  });

  test("Nachtisch-Zutaten werden nicht umgerechnet", () => {
    const r = buildPlanItems([["400 g Spaghetti"]], 2, new Set(), [["250 g Quark"]]);
    expect(r.items.map((i) => i.display)).toEqual(["250 g Quark", "200 g Spaghetti"]);
  });
});

describe("Vorrat", () => {
  test("jeder Standard-Eintrag wird auch als Vorrat erkannt", () => {
    for (const d of DEFAULT_PANTRY) expect(isPantry(d)).toBe(true);
  });

  test("herausgenommener Standard-Eintrag kommt wieder auf die Liste", () => {
    const ing = [["1 TL Kurkuma", "1 TL Salz", "2 Zwiebeln"]];
    expect(buildPlanItems(ing, 4).items.map((i) => i.baseName)).toEqual(["Zwiebeln"]);
    const r = buildPlanItems(ing, 4, new Set(), [], new Set(["kurkuma"]));
    expect(r.items.map((i) => i.baseName)).toEqual(["Kurkuma", "Zwiebeln"]);
    expect(r.pantryNeeded).toEqual(["Salz"]);
  });

  test("Übersicht: Gebrauchtes zuerst, eigene Einträge, Plan-Zutaten ohne Eintrag", () => {
    const list = pantryOverview(["Paprikapulver edelsüß", "Eier", "Italienische Kräuter"], ["Eier", "Reis"], new Set(["kurkuma"]));
    const needed = list.filter((e) => e.needed).map((e) => `${e.kind}:${e.name}`);
    expect(needed).toEqual(["custom:Eier", "plan:Italienische Kräuter", "default:Paprikapulver"]);
    expect(list.some((e) => e.name === "Kurkuma")).toBe(false);
    expect(list.find((e) => e.name === "Reis")).toEqual({ name: "Reis", needed: false, kind: "custom" });
  });

  test("eigener Eintrag, der schon Standard ist, erscheint nur einmal", () => {
    const list = pantryOverview(["Zucker"], ["Zucker", "Wasser"], new Set());
    expect(list.filter((e) => e.name === "Zucker")).toEqual([{ name: "Zucker", needed: true, kind: "default" }]);
  });
});
