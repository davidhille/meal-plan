// Hilfen für Rezept-Ansicht und Kochmodus (ohne React, damit testbar)

/** Zubereitung in Schritte zerlegen: eine Zeile pro Schritt, Nummerierung „1.“/„2)“ entfernt */
export function toSteps(instructions: string): string[] {
  return (instructions || '')
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

export interface StepTimer {
  /** z. B. „10 Min“ oder „1½ Std“ */
  label: string;
  seconds: number;
}

const UNIT_SECONDS: Record<string, number> = { sek: 1, min: 60, std: 3600 };

function unitOf(word: string): keyof typeof UNIT_SECONDS | null {
  const w = word.toLowerCase();
  if (w.startsWith('sek')) return 'sek';
  if (w.startsWith('min')) return 'min';
  if (w.startsWith('std') || w.startsWith('stund')) return 'std';
  return null;
}

const num = (s: string) => (s === '½' ? 0.5 : Number(s.replace(',', '.').replace('½', '.5')));

/**
 * Zeitangaben in einem Schritt finden: „10 Minuten“, „15–20 Min.“ (→ die längere), „1,5 Stunden“, „1½ Std“, „30 Sekunden“.
 * Doppelte Zeiten nur einmal.
 */
export function findTimers(step: string): StepTimer[] {
  const re = /(\d+(?:[.,]\d+)?½?|½)(?:\s*(?:-|–|bis)\s*(\d+(?:[.,]\d+)?½?))?\s*(Sekunden|Sek\.?|Minuten|Minute|Min\.?|Stunden|Stunde|Std\.?)(?![a-zäöü])/gi;
  const out: StepTimer[] = [];
  for (const m of step.matchAll(re)) {
    const unit = unitOf(m[3]);
    if (!unit) continue;
    const value = num(m[2] ?? m[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const seconds = Math.round(value * UNIT_SECONDS[unit]);
    if (seconds > 24 * 3600 || out.some((t) => t.seconds === seconds)) continue;
    const shown = String(value).replace('.5', '½').replace(/^0½$/, '½');
    out.push({ label: `${shown} ${unit === 'sek' ? 'Sek' : unit === 'min' ? 'Min' : 'Std'}`, seconds });
  }
  return out;
}

/** 754 → „12:34“, 3725 → „1:02:05“ */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
