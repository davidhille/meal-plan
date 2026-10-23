import { History } from 'lucide-react';
import { PlanWeek, formatShortDate } from '../lib/dateUtils';

interface WeekSelectorProps {
  weeks: PlanWeek[];
  selectedWeekKey: string | null;
  onSelectWeek: (key: string) => void;
  /** Anzahl ausgeblendeter vergangener Wochen */
  pastCount?: number;
  showPast?: boolean;
  onTogglePast?: () => void;
}

export default function WeekSelector({ weeks, selectedWeekKey, onSelectWeek, pastCount = 0, showPast, onTogglePast }: WeekSelectorProps) {
  if (weeks.length === 0) return null;

  return (
    <nav className="bg-gray-50 pt-3" aria-label="Kalenderwoche">
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 pb-3 max-w-2xl mx-auto">
        {pastCount > 0 && onTogglePast && (
          <button
            onClick={onTogglePast}
            aria-pressed={!!showPast}
            title={showPast ? 'Vergangene Wochen ausblenden' : 'Vergangene Wochen anzeigen'}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showPast ? 'bg-brand-100 text-brand-800' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <History size={14} aria-hidden="true" />
            {showPast ? 'Ausblenden' : `Frühere (${pastCount})`}
          </button>
        )}
        {weeks.map((week) => (
          <button
            key={week.key}
            onClick={() => onSelectWeek(week.key)}
            aria-pressed={selectedWeekKey === week.key}
            title={`${formatShortDate(week.weekStart)} – ${formatShortDate(week.weekEnd)}`}
            className={`flex-shrink-0 px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              selectedWeekKey === week.key
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            KW {week.kw}
          </button>
        ))}
      </div>
    </nav>
  );
}
