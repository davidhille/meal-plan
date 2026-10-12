import { PlanWeek } from '../lib/dateUtils';

interface WeekSelectorProps {
  weeks: PlanWeek[];
  selectedWeekKey: string | null;
  onSelectWeek: (key: string) => void;
}

export default function WeekSelector({ weeks, selectedWeekKey, onSelectWeek }: WeekSelectorProps) {
  if (weeks.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 py-3">
        {weeks.map((week) => (
          <button
            key={week.key}
            onClick={() => onSelectWeek(week.key)}
            className={`flex-shrink-0 px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              selectedWeekKey === week.key
                ? 'bg-green-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            KW {week.kw}
          </button>
        ))}
      </div>
    </div>
  );
}
