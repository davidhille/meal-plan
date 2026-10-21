import { CalendarDays, ChefHat, Loader2, Wheat } from 'lucide-react';

interface BrotzeitCardProps {
  /** „Freitag, 23.10.“ */
  day: string;
  isToday?: boolean;
  busy?: boolean;
  /** Verschieben oder Tag leeren */
  onMove?: () => void;
  /** Doch kochen: ein Gericht für den Tag planen */
  onCook?: () => void;
}

/** Tag im Plan, an dem nicht gekocht wird – nur ein Platzhalter, nichts auf der Einkaufsliste */
export default function BrotzeitCard({ day, isToday, busy, onMove, onCook }: BrotzeitCardProps) {
  return (
    <div className={`flex gap-2 items-stretch transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <div
        className={`flex-1 min-w-0 flex bg-white rounded-xl shadow-sm border overflow-hidden ${
          isToday ? 'border-brand-300 ring-1 ring-brand-300' : 'border-gray-100'
        }`}
      >
        <div className="w-1 flex-shrink-0 bg-coral-500" />
        <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-coral-50 border border-coral-100 flex items-center justify-center">
            <Wheat size={22} className="text-coral-700" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              {isToday && <span className="mr-1.5 px-1.5 py-px rounded bg-brand-700 text-white normal-case tracking-normal">Heute</span>}
              {day}
            </p>
            <p className="text-sm font-semibold text-gray-900">Brotzeit</p>
            <p className="text-xs text-gray-500 mt-0.5">Nicht kochen, nichts einkaufen</p>
          </div>
        </div>
      </div>

      {(onMove || onCook) && (
        <div className="w-10 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {onMove && (
            <button
              onClick={onMove}
              disabled={busy}
              className="flex-1 min-h-[32px] flex items-center justify-center text-gray-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              title="Verschieben oder Tag leeren"
              aria-label={`Brotzeit am ${day}: auf anderen Tag verschieben oder Tag leeren`}
            >
              <CalendarDays size={15} />
            </button>
          )}
          {onCook && (
            <button
              onClick={onCook}
              disabled={busy}
              className="flex-1 min-h-[32px] flex items-center justify-center text-gray-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              title="Doch kochen – Gericht planen"
              aria-label={`${day}: doch kochen, Gericht planen`}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ChefHat size={15} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
