// Kennzahlen „Passt der Plan auf Anhieb?“ pro Familie (Admin → Statistik)
// Grundlage: docs/ux-discovery/2026-10-23-miyummy-discovery.md, Abschnitt 5. Hier steht nur die Rechnung,
// die Abfrage der Zeilen steht in routes/admin.ts. Ausgeblendete Zeilen (`rejected`) und Brotzeiten kommen gar nicht erst hierher.
import { excludedByDislikes } from "./dislikes";
import { dislikeMatches } from "./meals";

/** Ein sichtbares Gericht im Plan (Zeitraum: ab 30 Tage zurück, auch kommende Tage des laufenden Plans) */
export interface QualityMeal {
  name: string;
  ingredients: string[];
  planId: string;
  /** Wie oft der Tag nach dem Planen angefasst wurde (getauscht oder ausgeblendet = Länge von `skipped_names`) */
  interventions: number;
  /** Tag ist heute oder schon vorbei (nur dann kann man Bewertung erwarten) */
  past: boolean;
  /** Die Familie hat dieses Gericht bewertet */
  rated: boolean;
}

export interface QualityInput {
  meals: QualityMeal[];
  /** `profiles.family_dislikes` */
  familyDislikes: string[];
  members: { disliked_foods: string[] | null }[];
  /** Ausgeblendete Gerichte laut `rejected_meals` (ohne endgültig gelöschte) */
  hidden7: number;
  hidden30: number;
}

/** Zielwerte aus dem Discovery-Doc; die Anzeige vergleicht damit */
export const QUALITY_TARGETS = {
  dislikeHits: 0,
  hiddenPerWeek: 1,
  interventionsPerPlan: 1,
  ratedShare: 50,
  unchangedShare: 80,
} as const;

export interface PlanQuality {
  /** Gerichte im Zeitraum (ohne Brotzeit und Ausgeblendetes) */
  meals: number;
  /** Gerichte, die laut Familien-Nein/Mehrheit gar nicht im Plan stehen dürften */
  dislikeHits: number;
  hidden7: number;
  hidden30: number;
  /** Eingriffe (Tauschen + Ausblenden) je Plan, eine Nachkommastelle; null = noch kein Plan */
  interventionsPerPlan: number | null;
  /** Anteil der Gerichte, die unverändert im Plan blieben, in % (null = keine Gerichte) */
  unchangedShare: number | null;
  /** Anteil der gekochten Gerichte (Tag vorbei), die bewertet wurden, in % (null = noch keins gekocht) */
  ratedShare: number | null;
  /** Grundlage der Quote: gekochte Gerichte */
  cooked: number;
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);

export function computePlanQuality({ meals, familyDislikes, members, hidden7, hidden30 }: QualityInput): PlanQuality {
  const plans = new Set(meals.map((m) => m.planId));
  const interventions = meals.reduce((sum, m) => sum + m.interventions, 0);
  const cooked = meals.filter((m) => m.past);
  return {
    meals: meals.length,
    dislikeHits: meals.filter((m) => excludedByDislikes(m, familyDislikes, members, (d) => dislikeMatches(m, d))).length,
    hidden7,
    hidden30,
    interventionsPerPlan: plans.size ? Math.round((interventions / plans.size) * 10) / 10 : null,
    unchangedShare: percent(meals.filter((m) => m.interventions === 0).length, meals.length),
    ratedShare: percent(cooked.filter((m) => m.rated).length, cooked.length),
    cooked: cooked.length,
  };
}
