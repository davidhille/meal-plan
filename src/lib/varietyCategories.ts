// Mengen-Regeln: „höchstens 2× Nudeln pro Woche“, „mindestens 1× Fisch pro Woche“, „höchstens 2× Garnelen pro Monat“.
// Gemeinsam für die Planung (worker/weekVariety.ts) und die Einstellungen (VarietyRulesSettings).
// Der Name des Gerichts entscheidet (er nennt die Hauptkomponente; Zutatenlisten haben zu viele Nebendinge).
import { ALL_CATEGORIES } from './recipeCategories';

export type VarietyPeriod = 'week' | 'month';

/** Eine Regel: so oft darf (max) bzw. soll (min) die Kategorie in der Kalenderwoche bzw. im Kalendermonat vorkommen */
export interface VarietyRule {
  /** Kennung aus `VARIETY_CATEGORIES` */
  id: string;
  period: VarietyPeriod;
  min?: number;
  max?: number;
}

export interface VarietyCategory {
  id: string;
  label: string;
  /** Trifft auf den kleingeschriebenen Gerichtnamen */
  re: RegExp;
}

// „Gambas“, „Shrimps“ und „Garnelen“ oder „Penne“, „Tortelloni“ und „Lasagne“ haben keine gemeinsamen Wörter
const NUDELN =
  /nudel|pasta|spaghetti|penne|tortellini|tortelloni|lasagne|fusilli|tagliatelle|rigatoni|maccheroni|makkaroni|farfalle|linguine|ravioli|cannelloni|orecchiette|carbonara|bolognese|mie\b|udon|ramen/;
const MEERESFRUECHTE = /garnel|gambas|shrimp|scampi|krabbe|krevett|prawn|muschel|tintenfisch|calamari|meeresfr/;

// Asiatische Küche am Namen erkannt (Thai, Chinesisch, Wok, Stir-Fry, Sushi …); Indisches zählt bewusst nicht dazu
const ASIATISCH =
  /asia|thai|chines|vietnam|korea|japan|wok\b|woks|wokgem|stir.?fry|bang.?bang|pad thai|teriyaki|sushi|ramen|udon|miso|gyoza|dim sum|bao\b|kimchi|bibimbap|satay|sommerroll|frühlingsroll|tom (kha|yum)|laksa|szechuan|sichuan|kung pao|mapo|chop suey|nasi goreng|bami/;

const MEXIKANISCH = /mexikan|fajita|burrito|taco|quesadilla|enchilada|nacho|chili con|chili sin|chilli con|tex.?mex|huevos/;
// Pfannen- und Bowl-Gerichte sehen oft ähnlich aus, auch wenn die Namen verschieden sind
const BOWL_PFANNE = /bowl|pfanne|pfännchen|skillet/;

const fromCategories = (id: string): VarietyCategory => {
  const c = ALL_CATEGORIES.find((x) => x.id === id);
  if (!c) throw new Error(`Unbekannte Kategorie: ${id}`);
  return { id, label: c.label, re: c.name };
};

export const VARIETY_CATEGORIES: VarietyCategory[] = [
  { id: 'nudeln', label: 'Nudeln & Pasta', re: NUDELN },
  { id: 'meeresfruechte', label: 'Garnelen & Meeresfrüchte', re: MEERESFRUECHTE },
  { id: 'asiatisch', label: 'Asiatische Gerichte', re: ASIATISCH },
  { id: 'mexikanisch', label: 'Mexikanische Gerichte', re: MEXIKANISCH },
  { id: 'bowlpfanne', label: 'Bowls & Pfannengerichte', re: BOWL_PFANNE },
  fromCategories('fisch'),
  fromCategories('gefluegel'),
  fromCategories('rind'),
  fromCategories('schwein'),
  fromCategories('reis'),
  fromCategories('kartoffeln'),
  fromCategories('huelsenfruechte'),
  fromCategories('pizza'),
  fromCategories('auflauf'),
  fromCategories('eintopf'),
  fromCategories('suppe'),
  fromCategories('curry'),
  fromCategories('salat'),
  fromCategories('burger'),
  fromCategories('mehlspeise'),
  fromCategories('eier'),
];

/** Korrekturen von Hand: Gerichtname → Kategorie → zählt dazu (true) bzw. zählt nicht (false); geht vor der Namenserkennung */
export type VarietyOverrides = Record<string, Record<string, boolean>>;

export interface VarietyOverride {
  name: string;
  categoryId: string;
  included: boolean;
}

export const toVarietyOverrideMap = (list: VarietyOverride[]): VarietyOverrides => {
  const map: VarietyOverrides = {};
  for (const o of list) (map[o.name] ??= {})[o.categoryId] = o.included;
  return map;
};

/** Zählt das Gericht für diese Kategorie? Korrektur von Hand vor der Erkennung am Namen. */
export const inVarietyCategory = (c: VarietyCategory, name: string, overrides?: VarietyOverrides): boolean =>
  overrides?.[name]?.[c.id] ?? c.re.test(name.toLowerCase());

/** Antippen in der Rezept-Ansicht: was gespeichert wird (auto = Korrektur entfernen) */
export function toggleVarietyCategory(c: VarietyCategory, name: string, overrides?: VarietyOverrides): 'include' | 'exclude' | 'auto' {
  const auto = c.re.test(name.toLowerCase());
  if (inVarietyCategory(c, name, overrides)) return auto ? 'exclude' : 'auto';
  return auto ? 'auto' : 'include';
}

/** Solange eine Familie nichts eingestellt hat (`profiles.variety_rules` ist NULL) */
export const DEFAULT_VARIETY_RULES: VarietyRule[] = [
  { id: 'meeresfruechte', period: 'week', max: 1 },
  { id: 'nudeln', period: 'week', max: 2 },
  { id: 'asiatisch', period: 'week', max: 2 },
  { id: 'asiatisch', period: 'month', max: 5 },
  { id: 'pizza', period: 'week', max: 1 },
  { id: 'burger', period: 'week', max: 1 },
  { id: 'curry', period: 'week', max: 1 },
];

/** Größte wählbare Zahl je Zeitraum (Server und Einstellungen) */
export const VARIETY_LIMIT: Record<VarietyPeriod, number> = { week: 7, month: 31 };

export const varietyLabel = (id: string) => VARIETY_CATEGORIES.find((c) => c.id === id)?.label ?? id;

const PERIOD_LABEL: Record<VarietyPeriod, string> = { week: 'pro Woche', month: 'pro Monat' };

/** Eine Regel als Satz, z. B. „Nudeln & Pasta: höchstens 2× pro Woche“ */
export function describeVarietyRule(r: VarietyRule): string {
  const bounds =
    r.min !== undefined && r.max !== undefined
      ? r.min === r.max
        ? `genau ${r.min}×`
        : `${r.min}–${r.max}×`
      : r.min !== undefined
        ? `mindestens ${r.min}×`
        : r.max === 0
          ? 'nie'
          : `höchstens ${r.max}×`;
  return `${varietyLabel(r.id)}: ${bounds}${r.max === 0 && r.min === undefined ? '' : ` ${PERIOD_LABEL[r.period]}`}`;
}

export function describeVarietyRules(rules: VarietyRule[] | null | undefined): string {
  const list = rules ?? DEFAULT_VARIETY_RULES;
  return list.length ? list.map(describeVarietyRule).join(' · ') : 'Keine Mengen-Regeln';
}

/**
 * Gruppiert Regeln nach Kategorie (Reihenfolge des ersten Vorkommens), je Gruppe Woche vor Monat.
 * Liefert Indizes in `rules`; so zeigt die Einstellung pro Kategorie eine Karte statt zwei gleich aussehender Zeilen.
 */
export function groupVarietyRules(rules: VarietyRule[]): number[][] {
  const groups = new Map<string, number[]>();
  rules.forEach((r, i) => groups.set(r.id, [...(groups.get(r.id) ?? []), i]));
  return [...groups.values()].map((g) => g.sort((a, b) => Number(rules[a].period === 'month') - Number(rules[b].period === 'month')));
}
