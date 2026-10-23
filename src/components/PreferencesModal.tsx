import { useState } from 'react';
import { X, AlertCircle, Check, Loader2 } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { CONDITION_LABELS, FOCUS_OPTIONS } from '../lib/health';
import { FAMILY_DISLIKES } from '../lib/familyDislikes';

interface PreferencesModalProps {
  healthFocus: string[];
  healthConditions: string[];
  meatMaxPerWeek: number | null;
  /** „Kommt nie in den Plan“ (Kennungen aus lib/familyDislikes.ts) */
  familyDislikes: string[];
  onSave: (focus: string[], conditions: string[], meatMaxPerWeek: number | null, familyDislikes: string[]) => Promise<void>;
  onClose: () => void;
}

const CONDITIONS = Object.entries(CONDITION_LABELS).map(([id, label]) => ({ id, label }));
const MEAT_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Keine Grenze' },
  { value: 0, label: 'Kein Fleisch' },
  ...[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}×` })),
];

const toggle = (set: Set<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Gesundheit & Ernährung: Schwerpunkte (mehrere), Einschränkungen (mehrere), Regeln */
export default function PreferencesModal({ healthFocus, healthConditions, meatMaxPerWeek, familyDislikes, onSave, onClose }: PreferencesModalProps) {
  const [focus, setFocus] = useState<Set<string>>(new Set(healthFocus));
  const [conditions, setConditions] = useState<Set<string>>(new Set(healthConditions));
  const [meatMax, setMeatMax] = useState<number | null>(meatMaxPerWeek);
  const [never, setNever] = useState<Set<string>>(new Set(familyDislikes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialog(onClose);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // Reihenfolge wie in der Liste, nicht wie angeklickt
      await onSave(
        FOCUS_OPTIONS.map((f) => f.id).filter((id) => focus.has(id)),
        CONDITIONS.map((c) => c.id).filter((id) => conditions.has(id)),
        meatMax,
        FAMILY_DISLIKES.map((d) => d.id).filter((id) => never.has(id))
      );
    } catch (e) {
      setError((e as Error).message || 'Die Einstellungen konnten nicht gespeichert werden.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferencesmodal-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 id="preferencesmodal-title" className="text-base font-semibold text-gray-900">
            Ernährungseinstellungen
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="tap w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">
          {/* Schwerpunkte */}
          <div>
            <p id="prefs-focus" className="text-sm font-medium text-gray-700">
              Schwerpunkte
            </p>
            <p className="text-xs text-gray-500 mb-2">Mehrere möglich. Passende Gerichte kommen öfter, ausgeschlossen wird nichts.</p>
            <div className="space-y-1.5" role="group" aria-labelledby="prefs-focus">
              {FOCUS_OPTIONS.map((f) => {
                const on = focus.has(f.id);
                return (
                  <button
                    key={f.id}
                    aria-pressed={on}
                    onClick={() => setFocus(toggle(focus, f.id))}
                    className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg border transition-colors ${
                      on ? 'bg-brand-50 border-brand-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                        on ? 'bg-brand-700 border-brand-700 text-white' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {on && <Check size={12} />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-sm ${on ? 'font-semibold text-brand-800' : 'text-gray-700'}`}>{f.label}</span>
                      <span className="block text-xs text-gray-500">{f.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Einschränkungen */}
          <div>
            <p id="prefs-conditions" className="text-sm font-medium text-gray-700">
              Krankheiten & Einschränkungen
            </p>
            <p className="text-xs text-gray-500 mb-2">Mehrere möglich. Gerichte, die nicht passen, werden nie geplant.</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="prefs-conditions">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={conditions.has(c.id)}
                  onClick={() => setConditions(toggle(conditions, c.id))}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    conditions.has(c.id)
                      ? 'bg-coral-50 border-coral-300 text-coral-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {conditions.has('diabetes') && (
              <p className="mt-1.5 text-xs text-gray-500">Diabetes schließt nichts aus, Gerichte mit viel Zucker kommen seltener.</p>
            )}
          </div>

          {/* Kommt nie in den Plan */}
          <div>
            <p id="prefs-never" className="text-sm font-medium text-gray-700">
              Kommt nie in den Plan
            </p>
            <p className="text-xs text-gray-500 mb-2">
              Gilt für die ganze Familie. Abneigungen einzelner Familienmitglieder schließen erst aus, wenn die Mehrheit sie teilt.
            </p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="prefs-never">
              {FAMILY_DISLIKES.map((d) => (
                <button
                  key={d.id}
                  aria-pressed={never.has(d.id)}
                  onClick={() => setNever(toggle(never, d.id))}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    never.has(d.id) ? 'bg-coral-50 border-coral-300 text-coral-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Regeln */}
          <div>
            <p id="prefs-meat" className="text-sm font-medium text-gray-700">
              Fleisch pro Woche
            </p>
            <p className="text-xs text-gray-500 mb-2">
              Höchstens so viele Fleischgerichte pro Kalenderwoche. Fisch zählt nicht mit; an den übrigen Tagen gibt es Fisch oder
              Vegetarisches.
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="prefs-meat">
              {MEAT_OPTIONS.map((o) => (
                <button
                  key={String(o.value)}
                  role="radio"
                  aria-checked={meatMax === o.value}
                  onClick={() => setMeatMax(o.value)}
                  className={`px-3 h-9 rounded-lg text-xs font-semibold border ${
                    meatMax === o.value ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {conditions.size > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex gap-2 text-xs text-amber-900">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <p>Die Prüfung läuft über die Zutatenliste – eine Hilfe, keine Allergie-Garantie.</p>
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
          {error && (
            <p role="alert" className="mb-2 text-xs text-center text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-11 px-4 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
