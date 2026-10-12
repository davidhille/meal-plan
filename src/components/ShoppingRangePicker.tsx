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
 */
export default function ShoppingRangePicker({ weeks, currentIndex, start, end, onChange, summary }: ShoppingRangePickerProps) {
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
          const active = i >= start && i <= end;
          return (
            <button
              key={w.key}
              onClick={() => toggle(i)}
              aria-pressed={active}
              className={`flex-none px-3 py-1.5 rounded-lg text-left transition-colors border ${
                active ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="block text-sm font-semibold leading-tight">{weekName(i, currentIndex, w.kw)}</span>
              <span className={`block text-[11px] leading-tight ${active ? 'text-green-100' : 'text-gray-500'}`}>
                {formatShortDate(w.weekStart).replace(/^\w+\.?,\s*/, '')} – {formatShortDate(w.weekEnd).replace(/^\w+\.?,\s*/, '')}
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-1 mt-2 text-xs text-gray-600" aria-live="polite">
        {summary}
      </p>
      {start === end && end < weeks.length - 1 && (
        <p className="px-1 mt-0.5 text-[11px] text-gray-500">Tipp: Weitere Woche antippen, um gleich mit einzukaufen.</p>
      )}
    </section>
  );
}
