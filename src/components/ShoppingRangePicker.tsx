import { useState, type ReactNode } from 'react';
import { CalendarRange } from 'lucide-react';
import { PlanWeek, formatShortDate } from '../lib/dateUtils';

interface ShoppingRangePickerProps {
  weeks: PlanWeek[];
  /** Index der Woche, in der heute liegt (für „Diese Woche“ / „Nächste Woche“) */
  currentIndex: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  /** Zusammenfassung unter der Auswahl, z. B. „7 Gerichte“ */
  summary: string;
  /** Zusatz unter der Zusammenfassung (z. B. vergangene Tage einblenden) */
  summaryExtra?: ReactNode;
}

function weekName(index: number, currentIndex: number, kw: number) {
  if (index === currentIndex) return 'Diese Woche';
  if (index === currentIndex + 1) return 'Nächste Woche';
  if (index === currentIndex - 1) return 'Letzte Woche';
  return `KW ${kw}`;
}

/**
 * Für welche Wochen eingekauft wird. Mehrere aufeinanderfolgende Wochen lassen sich kombinieren:
 * Antippen einer Woche außerhalb erweitert den Bereich, Antippen eines Randes nimmt ihn wieder heraus.
 * Wochen vor der aktuellen sind ausgeblendet („Frühere Wochen anzeigen“), solange keine davon gewählt ist.
 */
export default function ShoppingRangePicker({ weeks, currentIndex, start, end, onChange, summary, summaryExtra }: ShoppingRangePickerProps) {
  const [showEarlier, setShowEarlier] = useState(false);
  const earlierCount = Math.max(0, currentIndex);
  // Eine gewählte frühere Woche bleibt sichtbar, sonst ließe sie sich nicht mehr abwählen
  const firstShown = showEarlier || start < currentIndex ? 0 : earlierCount;
  const toggle = (i: number) => {
    if (i < start) onChange(i, end);
    else if (i > end) onChange(start, i);
    else if (start === end) return; // mindestens eine Woche bleibt gewählt
    else if (i === start) onChange(start + 1, end);
    else if (i === end) onChange(start, end - 1);
    else onChange(i, i); // mitten im Bereich: nur diese Woche
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3" aria-labelledby="einkauf-fuer">
      <h2 id="einkauf-fuer" className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <CalendarRange size={13} aria-hidden="true" />
        Einkauf für
      </h2>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 pb-0.5" role="group" aria-label="Wochen für die Einkaufsliste">
        {weeks.map((w, i) => {
          if (i < firstShown) return null;
          const active = i >= start && i <= end;
          return (
            <button
              key={w.key}
              onClick={() => toggle(i)}
              aria-pressed={active}
              className={`flex-none px-3 py-1.5 rounded-lg text-left transition-colors border ${
                active ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="block text-sm font-semibold leading-tight">{weekName(i, currentIndex, w.kw)}</span>
              <span className={`block text-xs leading-tight ${active ? 'text-brand-100' : 'text-gray-500'}`}>
                {formatShortDate(w.weekStart).replace(/^\w+\.?,\s*/, '')} – {formatShortDate(w.weekEnd).replace(/^\w+\.?,\s*/, '')}
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-1 mt-2 text-xs text-gray-600" aria-live="polite">
        {summary}
      </p>
      {earlierCount > 0 && start >= currentIndex && (
        <button
          onClick={() => setShowEarlier(!showEarlier)}
          aria-expanded={showEarlier}
          className="px-1 mt-0.5 text-xs font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          {showEarlier ? 'Frühere Wochen ausblenden' : 'Frühere Wochen anzeigen'}
        </button>
      )}
      {summaryExtra}
      {start === end && end < weeks.length - 1 && (
        <p className="px-1 mt-0.5 text-xs text-gray-500">Tipp: Weitere Woche antippen, um gleich mit einzukaufen.</p>
      )}
    </section>
  );
}
