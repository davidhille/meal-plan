import { useState } from 'react';
import { Minus, Plus, UserPlus } from 'lucide-react';

interface GuestStepperProps {
  guests: number;
  /** Speichern; wirft bei Fehlern */
  onChange: (guests: number) => Promise<void>;
}

/** Gäste an diesem Tag: zusätzliche Portionen für dieses Gericht (Einkaufsliste rechnet mit) */
export default function GuestStepper({ guests, onChange }: GuestStepperProps) {
  const [value, setValue] = useState(guests);
  const [error, setError] = useState<string | null>(null);

  const set = async (next: number) => {
    const prev = value;
    setValue(next);
    setError(null);
    try {
      await onChange(next);
    } catch (e) {
      setValue(prev);
      setError((e as Error).message || 'Konnte nicht gespeichert werden.');
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-gray-700">
          <UserPlus size={14} className="text-gray-500" aria-hidden="true" />
          Gäste an diesem Tag
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => set(Math.max(0, value - 1))}
            disabled={value <= 0}
            aria-label="Ein Gast weniger"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 active:scale-95 disabled:opacity-40"
          >
            <Minus size={14} />
          </button>
          <span className="w-6 text-center text-sm font-semibold text-gray-900" aria-live="polite">
            {value}
          </span>
          <button
            onClick={() => set(Math.min(20, value + 1))}
            aria-label="Ein Gast mehr"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 active:scale-95"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {value ? `Portionen und Einkaufsliste rechnen ${value === 1 ? 'einen Gast' : `${value} Gäste`} mit ein.` : 'Kommt Besuch? Dann rechnet die Einkaufsliste mit.'}
      </p>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
