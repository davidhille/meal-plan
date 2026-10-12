interface WeekSelectorProps {
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
}

export default function WeekSelector({ selectedWeek, onSelectWeek }: WeekSelectorProps) {
  return (
    <div className="bg-white border-b border-gray-100">
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 py-3">
        {[1, 2, 3, 4].map((week) => (
          <button
            key={week}
            onClick={() => onSelectWeek(week)}
            className={`flex-shrink-0 px-5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              selectedWeek === week
                ? 'bg-green-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            Woche {week}
          </button>
        ))}
      </div>
    </div>
  );
}
