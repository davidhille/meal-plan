import { useState } from 'react';
import { X, Calendar, AlertCircle, Download } from 'lucide-react';
import { MealPlan, PlanDurationType, PlanMeal } from '../types';
import { toIso, formatShortDate } from '../lib/dateUtils';
import { useDialog } from '../lib/useDialog';
import { exportPlan } from '../lib/planExport';

/** Was mit einem noch laufenden Plan geschieht: Tage hinzufügen (Standard) oder alles neu planen */
export type PlanMode = 'extend' | 'replace';

interface PlanCreationModalProps {
  onCreate: (startDate: string, endDate: string, mode: PlanMode) => Promise<void>;
  /** Läuft noch ein Plan mit Gerichten? Dann steht die Wahl „hinzufügen oder alles neu“ im Fenster */
  running?: { plan: MealPlan; meals: PlanMeal[]; portions: number };
  onClose: () => void;
}

type DurationOption = {
  id: PlanDurationType;
  label: string;
  getDates: () => [string, string];
};

export default function PlanCreationModal({ onCreate, running, onClose }: PlanCreationModalProps) {
  const [mode, setMode] = useState<PlanMode>('extend');
  const [durationType, setDurationType] = useState<PlanDurationType>('next_week');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialog(() => !loading && onClose());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const durationOptions: DurationOption[] = [
    {
      id: 'next_day',
      label: 'Nächster Tag',
      getDates: () => {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = toIso(tomorrow);
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
        return [toIso(tomorrow), toIso(end)];
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
        return [toIso(tomorrow), toIso(end)];
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
        setError('Bitte Start- und Enddatum wählen.');
        return;
      }

      if (startDate > endDate) {
        setError('Das Enddatum liegt vor dem Startdatum.');
        return;
      }
      setError(null);

      await onCreate(startDate, endDate, running ? mode : 'replace');
    } catch (e) {
      setError((e as Error).message || 'Der Plan konnte nicht erstellt werden. Bitte noch einmal versuchen.');
    } finally {
      setLoading(false);
    }
  };

  const isCustom = durationType === 'custom';
  const selectedOption = durationOptions.find((o) => o.id === durationType);
  const [previewStart] = selectedOption?.getDates() || ['', ''];
  const tomorrowIso = toIso(new Date(today.getTime() + 86400000));
  const runningCount = running ? running.meals.filter((m) => !m.rejected).length : 0;
  const replacing = !!running && mode === 'replace';
  // Liegt der gewählte Zeitraum (teilweise) im laufenden Plan? Dann füllt „hinzufügen“ nur die freien Tage.
  const [rangeStart, rangeEnd] = isCustom ? [customStart, customEnd] : selectedOption?.getDates() ?? ['', ''];
  const overlaps = !!running && !!rangeStart && !!rangeEnd && rangeStart <= running.plan.end_date && rangeEnd >= running.plan.start_date;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-dialog-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 id="plan-dialog-title" className="text-base font-semibold text-gray-900">{running ? 'Zeitraum planen' : 'Neuen Plan erstellen'}</h2>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Schließen"
            className="tap w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          <div>
            <p id="plan-range-label" className="block text-sm font-medium text-gray-700 mb-2">Zeitraum</p>
            <div className="space-y-2" role="group" aria-labelledby="plan-range-label">
              {durationOptions.map((option) => (
                <button
                  key={option.id}
                  aria-pressed={durationType === option.id}
                  onClick={() => {
                    setError(null);
                    setDurationType(option.id);
                    setCustomStart('');
                    setCustomEnd('');
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                    durationType === option.id
                      ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <p>{option.label}</p>
                  {durationType === option.id && (
                    <p className="text-xs text-brand-700 mt-1">
                      {option.getDates()[0] === option.getDates()[1]
                        ? formatShortDate(option.getDates()[0])
                        : `${formatShortDate(option.getDates()[0])} – ${formatShortDate(option.getDates()[1])}`}
                    </p>
                  )}
                </button>
              ))}

              <button
                aria-pressed={isCustom}
                onClick={() => setDurationType('custom')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                  isCustom
                    ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium'
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
                <label htmlFor="plan-from" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Von
                </label>
                <input
                  id="plan-from"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  min={tomorrowIso}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label htmlFor="plan-to" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bis
                </label>
                <input
                  id="plan-to"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  min={customStart || tomorrowIso}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          )}

          {running && (
            <div>
              <p id="plan-mode-label" className="block text-sm font-medium text-gray-700 mb-2">
                Dein Plan vom {formatShortDate(running.plan.start_date)} bis {formatShortDate(running.plan.end_date)} läuft noch
              </p>
              <div className="space-y-2" role="group" aria-labelledby="plan-mode-label">
                <button
                  aria-pressed={mode === 'extend'}
                  onClick={() => setMode('extend')}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                    mode === 'extend' ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <p>Zum bestehenden Plan hinzufügen</p>
                  <p className={`text-xs mt-1 ${mode === 'extend' ? 'text-brand-700' : 'text-gray-500'} font-normal`}>
                    Geplante Tage bleiben, auch verschobene Gerichte und leere Tage. Nur freie Tage bekommen ein Gericht.
                  </p>
                </button>
                <button
                  aria-pressed={mode === 'replace'}
                  onClick={() => setMode('replace')}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border ${
                    mode === 'replace' ? 'bg-brand-50 border-brand-300 text-brand-700 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <p>Alles neu planen</p>
                  <p className={`text-xs mt-1 ${mode === 'replace' ? 'text-brand-700' : 'text-gray-500'} font-normal`}>
                    Ersetzt den bisherigen Plan mit {runningCount} {runningCount === 1 ? 'Gericht' : 'Gerichten'}.
                  </p>
                </button>
              </div>
              {mode === 'extend' && overlaps && (
                <p className="mt-2 text-xs text-gray-600">
                  Ein Teil des Zeitraums ist schon geplant. Dort werden nur freie Tage gefüllt. Für mehr Gerichte wähle Tage nach dem{' '}
                  {formatShortDate(running.plan.end_date)}.
                </p>
              )}
              {replacing && (
                <button
                  type="button"
                  onClick={() => exportPlan(running.plan, running.meals, running.portions)}
                  className="mt-2 inline-flex items-center gap-1.5 h-11 px-3 rounded-lg text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100"
                >
                  <Download size={14} aria-hidden="true" />
                  Vorher herunterladen
                </button>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex gap-2 text-xs text-amber-900">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <p>Der Plan berücksichtigt eure Familie, Vorlieben und Bewertungen. Dabei entstehen auch ein paar neue KI-Rezepte – das kann bis zu einer halben Minute dauern.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || (!isCustom && !previewStart) || (isCustom && (!customStart || !customEnd))}
            className={`flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-white ${replacing ? 'bg-red-700 hover:bg-red-800' : 'bg-brand-700 hover:bg-brand-800'} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {running && !replacing ? 'Plan wird ergänzt …' : 'Plan wird erstellt …'}
              </>
            ) : (
              <>
                <Calendar size={14} />
                {!running ? 'Plan erstellen' : replacing ? 'Plan ersetzen' : 'Hinzufügen'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
