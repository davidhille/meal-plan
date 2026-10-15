import { Filter } from 'lucide-react';
import { RecipeFilter } from '../types';

interface CustomFilterChipsProps {
  filters: RecipeFilter[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}

/** Eigene Filter aus den Einstellungen – lassen sich mit der Kategorie kombinieren */
export default function CustomFilterChips({ filters, activeId, onChange }: CustomFilterChipsProps) {
  if (filters.length === 0) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1" role="group" aria-label="Eigene Filter">
      {filters.map((f) => {
        const active = activeId === f.id;
        return (
          <button
            key={f.id}
            aria-pressed={active}
            onClick={() => onChange(active ? null : f.id)}
            className={`flex-none flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
              active ? 'bg-brand-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-brand-50'
            }`}
          >
            <Filter size={11} aria-hidden="true" />
            {f.name}
          </button>
        );
      })}
    </div>
  );
}
