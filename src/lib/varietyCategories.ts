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

const fromCategories = (id: string): VarietyCategory => {
  const c = ALL_CATEGORIES.find((x) => x.id === id);
  if (!c) throw new Error(`Unbekannte Kategorie: ${id}`);
  return { id, label: c.label, re: c.name };
};

export const VARIETY_CATEGORIES: VarietyCategory[] = [
  { id: 'nudeln', label: 'Nudeln & Pasta', re: NUDELN },
  { id: 'meeresfruechte', label: 'Garnelen & Meeresfrüchte', re: MEERESFRUECHTE },
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

/** Solange eine Familie nichts eingestellt hat (`profiles.variety_rules` ist NULL) */
export const DEFAULT_VARIETY_RULES: VarietyRule[] = [
  { id: 'meeresfruechte', period: 'week', max: 1 },
  { id: 'nudeln', period: 'week', max: 2 },
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
