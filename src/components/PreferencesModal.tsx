import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useDialog } from '../lib/useDialog';

interface PreferencesModalProps {
  healthGoal: string;
  healthConditions: string[];
  onSave: (goal: string, conditions: string[]) => void;
  onClose: () => void;
}

const HEALTH_GOALS = [
  { id: 'balanced', label: 'Ausgewogene Ernährung' },
  { id: 'weight_loss', label: 'Gewichtsabnahme' },
  { id: 'muscle_gain', label: 'Muskelaufbau' },
  { id: 'healthy_lifestyle', label: 'Gesunder Lebensstil' },
];

const CONDITIONS = [
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'gluten_free', label: 'Glutenfrei' },
  { id: 'lactose_intolerant', label: 'Laktoseintolerant' },
  { id: 'nut_allergy', label: 'Nussallergie' },
  { id: 'vegetarian', label: 'Vegetarisch' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'kosher', label: 'Koscher' },
  { id: 'halal', label: 'Halal' },
];

export default function PreferencesModal({
  healthGoal,
  healthConditions,
  onSave,
  onClose,
}: PreferencesModalProps) {
  const [goal, setGoal] = useState(healthGoal);
  const [conditions, setConditions] = useState<Set<string>>(new Set(healthConditions));
  const dialogRef = useDialog(onClose);

  const toggleCondition = (id: string) => {
    const newSet = new Set(conditions);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setConditions(newSet);
  };

  const handleSave = () => {
    onSave(goal, Array.from(conditions));
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferencesmodal-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 id="preferencesmodal-title" className="text-base font-semibold text-gray-900">Ernährungseinstellungen</h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {/* Health Goal */}
          <div>
            <p id="prefs-goal" className="block text-sm font-medium text-gray-700 mb-2">Gesundheitsziel</p>
            <div className="space-y-2" role="group" aria-labelledby="prefs-goal">
              {HEALTH_GOALS.map((g) => (
                <button
                  key={g.id}
                  aria-pressed={goal === g.id}
                  onClick={() => setGoal(g.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                    goal === g.id
                      ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Health Conditions */}
          <div>
            <p id="prefs-conditions" className="block text-sm font-medium text-gray-700 mb-2">
              Krankheiten & Einschränkungen
            </p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="prefs-conditions">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={conditions.has(c.id)}
                  onClick={() => toggleCondition(c.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    conditions.has(c.id)
                      ? 'bg-orange-50 border-orange-300 text-orange-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {conditions.size > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex gap-2 text-xs text-amber-900">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <p>Gerichte, die nicht dazu passen, werden bei der Planung ausgeschlossen.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
