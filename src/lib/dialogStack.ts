// Offene Fenster (für useDialog): Reihenfolge für Escape und Scroll-Sperre der Seite.

const stack: symbol[] = [];
// Scroll-Zustand der Seite vor dem ersten offenen Fenster
let overflowBeforeDialogs = '';

/**
 * Seite sperren, solange irgendein Fenster offen ist. Bewusst über die Anzahl statt „vorherigen Wert merken“:
 * Schließen und öffnen sich Fenster im selben Moment (z. B. Bearbeiten speichern → Rezept-Ansicht neu),
 * räumt React nicht in umgekehrter Reihenfolge auf – sonst blieb die Seite gesperrt.
 */
function updateScrollLock() {
  document.body.style.overflow = stack.length > 0 ? 'hidden' : overflowBeforeDialogs;
}

/** Fenster öffnet sich */
export function pushDialog(id: symbol) {
  if (stack.length === 0) overflowBeforeDialogs = document.body.style.overflow === 'hidden' ? '' : document.body.style.overflow;
  stack.push(id);
  updateScrollLock();
}

/** Fenster schließt sich – egal in welcher Reihenfolge */
export function popDialog(id: symbol) {
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
  updateScrollLock();
}

/** Ist das das oberste offene Fenster? (Escape schließt nur dieses) */
export const isTopDialog = (id: symbol) => stack[stack.length - 1] === id;
