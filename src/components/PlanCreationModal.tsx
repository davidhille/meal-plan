import { useState } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { PlanDurationType } from '../types';

interface PlanCreationModalProps {
  onCreate: (startDate: string, endDate: string) => Promise<void>;
  onClose: () => void;
}

type DurationOption = {
  id: PlanDurationType;
  label: string;
  getDates: () => [string, string];
};

export default function PlanCreationModal({ onCreate, onClose }: PlanCreationModalProps) {
  const [durationType, setDurationType] = useState<PlanDurationType>('next_week');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const durationOptions: DurationOption[] = [
    {
      id: 'next_day',
      label: 'Nächster Tag',
      getDates: () => {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        return [dateStr, dateStr];
      },
    },
    {
      id: 'next_week',
      label: 'Nächste Woche (7 Tage)',
      getDates: () => {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const end = new Date(tomorrow);
        end.setDate(end.getDate() + 6);
        return [
          tomorrow.toISOString().split('T')[0],
          end.toISOString().split('T')[0],
        ];
      },
    },
    {
      id: 'next_month',
      label: 'Nächster Monat (30 Tage)',
      getDates: () => {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const end = new Date(tomorrow);
        end.setDate(end.getDate() + 29);
        return [
          tomorrow.toISOString().split('T')[0],
          end.toISOString().split('T')[0],
        ];
      },
    },
  ];

  const handleCreate = async () => {
    try {
      setLoading(true);

      let startDate = customStart;
      let endDate = customEnd;

      if (durationType !== 'custom') {
        const option = durationOptions.find((o) => o.id === durationType);
        if (option) {
          [startDate, endDate] = option.getDates();
        }
      }

      if (!startDate || !endDate) {
        alert('Bitte Datum eingeben');
        return;
      }

      if (new Date(startDate) > new Date(endDate)) {
        alert('Startdatum muss vor Enddatum liegen');
        return;
      }

      await onCreate(startDate, endDate);
    } finally {
      setLoading(false);
    }
  };

  const isCustom = durationType === 'custom';
  const selectedOption = durationOptions.find((o) => o.id === durationType);
  let [previewStart, previewEnd] = selectedOption?.getDates() || ['', ''];

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Neuen Plan erstellen</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Zeitraum</label>
            <div className="space-y-2">
              {durationOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setDurationType(option.id);
                    setCustomStart('');
                    setCustomEnd('');
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                    durationType === option.id
                      ? 'bg-green-50 border-green-300 text-green-700 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <p>{option.label}</p>
                  {durationType === option.id && (
                    <p className="text-xs text-green-600 mt-1">
                      {option.getDates()[0]} bis {option.getDates()[1]}
                    </p>
                  )}
                </button>
              ))}

              <button
                onClick={() => setDurationType('custom')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                  isCustom
                    ? 'bg-green-50 border-green-300 text-green-700 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Benutzerdefiniert
              </button>
            </div>
          </div>

          {isCustom && (
            <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Von Datum
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  min={new Date(today.getTime() + 86400000).toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bis Datum
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  min={customStart || new Date(today.getTime() + 86400000).toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          <div className="bg-sand border border-amber-100 rounded-lg px-3 py-2 flex gap-2 text-xs text-amber-900">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <p>Der Plan berücksichtigt eure Familie, Vorlieben und Bewertungen. Dabei entstehen auch ein paar neue KI-Rezepte – das kann bis zu einer halben Minute dauern.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-11 px-4 rounded-full text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || (!isCustom && !previewStart) || (isCustom && (!customStart || !customEnd))}
            className="flex-1 h-11 px-4 rounded-full text-sm font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Plan wird erstellt …
              </>
            ) : (
              <>
                <Calendar size={14} />
                Plan erstellen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
