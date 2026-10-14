import { createContext, useContext } from 'react';
import { RatingNote } from '../types';

export interface RatingsState {
  /** Sterne je Gericht */
  ratings: Record<string, number>;
  /** Kommentare je Gericht (nur, wo es einen gibt) */
  notes: Record<string, RatingNote>;
  /** Bewertung speichern (wirft bei Fehlern) */
  rate?: (mealName: string, rating: number, notes: string) => Promise<void>;
}

/** Bewertungen der Familie – überall, wo ein Rezept angezeigt wird, ohne sie durch jede Ansicht zu reichen */
export const RatingsContext = createContext<RatingsState>({ ratings: {}, notes: {} });

export const useRatings = () => useContext(RatingsContext);

/** „2026-10-14 18:03:…“ → „14.10.2026“ */
export function formatRatingDate(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
