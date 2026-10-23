import { CalendarDays, ChefHat, Loader2, Wheat } from 'lucide-react';
import CardActionBar, { CardAction } from './CardActionBar';

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
  const actions: CardAction[] = [];
  if (onMove)
    actions.push({
      key: 'move',
      label: 'Verschieben',
      icon: <CalendarDays size={16} />,
      onClick: onMove,
      title: 'Verschieben oder Tag leeren',
      ariaLabel: `Brotzeit am ${day}: auf anderen Tag verschieben oder Tag leeren`,
    });
  if (onCook)
    actions.push({
      key: 'cook',
      label: 'Doch kochen',
      icon: busy ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />,
      onClick: onCook,
      title: 'Doch kochen – Gericht planen',
      ariaLabel: `${day}: doch kochen, Gericht planen`,
    });
  return (
    <article
      className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-opacity ${busy ? 'opacity-60' : ''} ${
        isToday ? 'border-brand-300 ring-1 ring-brand-300' : 'border-gray-100'
      }`}
    >
      <div className="flex">
        {/* Neutral: kein Gericht, nichts einkaufen */}
        <div className="w-1 flex-shrink-0 bg-gray-300" />
        <div className="flex items-center gap-3.5 p-3.5 flex-1 min-w-0">
          <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
            <Wheat size={26} className="text-gray-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              {isToday && <span className="mr-1.5 px-1.5 py-px rounded bg-brand-700 text-white normal-case tracking-normal">Heute</span>}
              {day}
            </p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-gray-900">Brotzeit</h3>
            <p className="text-xs text-gray-500 mt-0.5">Nicht kochen, nichts einkaufen</p>
          </div>
        </div>
      </div>
      <CardActionBar actions={actions} disabled={busy} />
    </article>
  );
}
