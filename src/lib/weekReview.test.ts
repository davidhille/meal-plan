import { describe, expect, test } from 'bun:test';
import { weekReview } from './weekReview';
import { PlanMeal } from '../types';

const pm = (meal_date: string, meal_name: string, brotzeit = false): PlanMeal =>
  ({ id: meal_date, plan_id: 'p', meal_date, meal_name, meal_type: 'vegetarisch', ingredients: [], instructions: '', rejected: false, created_at: '', brotzeit }) as PlanMeal;

const meals = [pm('2026-10-12', 'A'), pm('2026-10-13', 'B'), pm('2026-10-14', 'Brotzeit', true), pm('2026-10-15', 'C'), pm('2026-10-19', 'D')];

describe('Wochen-Rückblick', () => {
  test('Montag: Vorwoche', () => {
    const r = weekReview(meals, { A: 5, B: 3 }, new Date(2026, 9, 19, 9));
    expect(r?.weekStart).toBe('2026-10-12');
    expect(r?.cooked.map((m) => m.meal_name)).toEqual(['A', 'B', 'C']);
    expect(r?.brotzeit).toBe(1);
    expect(r?.best.map((b) => b.pm.meal_name)).toEqual(['A']);
    expect(r?.unrated.map((m) => m.meal_name)).toEqual(['C']);
  });
  test('Sonntag: laufende Woche; Mittwoch: nichts', () => {
    expect(weekReview(meals, {}, new Date(2026, 9, 18, 19))?.weekStart).toBe('2026-10-12');
    expect(weekReview(meals, {}, new Date(2026, 9, 21, 12))).toBeNull();
  });
});
