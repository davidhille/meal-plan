// Tab bleibt im obersten Fenster (WCAG 2.4.3): reine Rechnung, das DOM-Teil steht in useDialog.ts

/** Was im Fenster per Tab erreichbar ist (sichtbar, nicht deaktiviert) */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Wohin springt der Fokus bei Tab bzw. Umschalt+Tab?
 * `current` = Position des fokussierten Elements in der Liste, -1 = Fokus liegt außerhalb der Liste (z. B. auf dem Fenster selbst).
 * Gibt den Index zurück, auf den man selbst springen muss, oder `null`, wenn der Browser normal weiterspringen darf.
 */
export function trapIndex(count: number, current: number, shift: boolean): number | null {
  if (count === 0) return null;
  if (current === -1) return shift ? count - 1 : 0;
  if (!shift && current === count - 1) return 0;
  if (shift && current === 0) return count - 1;
  return null;
}
