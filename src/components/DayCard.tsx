import { Meal, MealType } from '../types';
import { ChevronRight, Leaf, Beef, Sunset, Star, X } from 'lucide-react';

interface DayCardProps {
  meal: Meal;
  rating?: number;
  showReject?: boolean;
  onReject?: () => void;
  onClick: () => void;
}

const typeConfig: Record<MealType, { bar: string; label: string; icon: React.ReactNode }> = {
  vegetarisch: {
    bar: 'bg-green-500',
    label: 'Vegetarisch',
    icon: <Leaf size={11} className="text-green-600" />,
  },
  fleisch: {
    bar: 'bg-orange-400',
    label: 'Fleisch',
    icon: <Beef size={11} className="text-orange-500" />,
  },
  wochenende: {
    bar: 'bg-blue-500',
    label: 'Wochenende',
    icon: <Sunset size={11} className="text-blue-500" />,
  },
};

export default function DayCard({ meal, rating, showReject, onReject, onClick }: DayCardProps) {
  const config = typeConfig[meal.type];

  return (
    <div className="flex gap-2 items-stretch">
      <button
        onClick={onClick}
        className="flex-1 text-left bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform duration-100 flex"
      >
        <div className={`w-1 flex-shrink-0 ${config.bar}`} />
        <div className="flex items-center gap-3 px-4 py-4 flex-1 min-w-0">
          {meal.imageUrl ? (
            <img
              src={meal.imageUrl}
              alt={meal.meal}
              className="flex-shrink-0 w-12 h-12 rounded-lg object-cover border border-gray-100"
            />
          ) : (
            <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-lg flex flex-col items-center justify-center border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 leading-tight">{meal.dayShort}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{meal.meal}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{meal.description}</p>
            <div className="flex items-center gap-1 mt-1.5">
              {config.icon}
              <span className="text-xs text-gray-400">{config.label}</span>
              {rating && (
                <span className="ml-auto text-xs text-yellow-500 font-medium flex items-center gap-0.5">
                  <Star size={11} className="fill-yellow-400" />
                  {rating}
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
        </div>
      </button>
      {showReject && onReject && (
        <button
          onClick={onReject}
          className="w-10 h-auto flex items-center justify-center rounded-xl shadow-sm border border-gray-100 bg-white text-red-500 hover:bg-red-50 active:scale-95 transition-all"
          title="Ablehnen"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
