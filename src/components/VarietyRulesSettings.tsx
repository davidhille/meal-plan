import { useState } from 'react';
import { Loader2, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Profile } from '../types';
import { saveVarietyRules } from '../lib/api';
import {
  DEFAULT_VARIETY_RULES,
  VARIETY_CATEGORIES,
  VARIETY_LIMIT,
  VarietyPeriod,
  VarietyRule,
  describeVarietyRules,
  varietyLabel,
} from '../lib/varietyCategories';
import CollapsibleCard from './CollapsibleCard';

interface VarietyRulesSettingsProps {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}

const selectClass =
  'h-9 px-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300';

/** Auswahl 1…n (Woche bis 7, Monat bis 15); ein schon gespeicherter, größerer Wert bleibt wählbar */
const choicesFor = (period: VarietyPeriod, current: number | undefined, from: number) => {
  const top = Math.max(period === 'week' ? VARIETY_LIMIT.week : 15, current ?? 0);
  return Array.from({ length: top - from + 1 }, (_, i) => from + i);
};

/**
 * Einstellungen → Planung: „Wie oft darf es vorkommen?“ – höchstens bzw. mindestens so oft pro Woche oder Monat
 * (z. B. höchstens 2× Nudeln pro Woche, höchstens 2× Garnelen pro Monat, mindestens 1× Fisch pro Woche).
 */
export default function VarietyRulesSettings({ profile, onSaved }: VarietyRulesSettingsProps) {
  const isDefault = profile.variety_rules == null;
  const rules: VarietyRule[] = profile.variety_rules ?? DEFAULT_VARIETY_RULES;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = async (next: VarietyRule[] | null) => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveVarietyRules(next));
    } catch (e) {
      setError((e as Error).message || 'Die Regeln konnten nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const update = (index: number, patch: Partial<VarietyRule>) => {
    const rule: VarietyRule = { ...rules[index], ...patch };
    // Beim Wechsel zwischen Woche und Monat passen die Zahlen in den kleineren Rahmen
    const limit = VARIETY_LIMIT[rule.period];
    if (rule.min !== undefined) rule.min = Math.min(rule.min, limit);
    if (rule.max !== undefined) rule.max = Math.min(rule.max, limit);
    if (rule.min === undefined && rule.max === undefined) {
      setError('Bitte „mindestens“ oder „höchstens“ angeben – oder die Regel löschen.');
      return;
    }
    if (rule.min !== undefined && rule.max !== undefined && rule.min > rule.max) {
      setError('„Mindestens“ darf nicht größer sein als „höchstens“.');
      return;
    }
    if (rules.some((r, i) => i !== index && r.id === rule.id && r.period === rule.period)) {
      setError(`Für „${varietyLabel(rule.id)}“ gibt es in diesem Zeitraum schon eine Regel.`);
      return;
    }
    persist(rules.map((r, i) => (i === index ? rule : r)));
  };

  const addRule = () => {
    const free = VARIETY_CATEGORIES.find((c) => !rules.some((r) => r.id === c.id && r.period === 'week'));
    if (free) persist([...rules, { id: free.id, period: 'week', max: 2 }]);
  };

  const parse = (value: string) => (value === '' ? undefined : Number(value));

  return (
    <CollapsibleCard
      storageKey="mengen-regeln"
      title="Wie oft darf es vorkommen?"
      icon={<SlidersHorizontal size={16} />}
      summary={isDefault ? `Standard: ${describeVarietyRules(null)}` : describeVarietyRules(profile.variety_rules)}
    >
      <p className="px-4 pb-3 text-xs text-gray-500">
        Begrenze, wie oft Nudeln, Garnelen und Co. im Plan vorkommen, oder lege fest, was mindestens einmal dran sein soll (z. B.
        Fisch). Gezählt wird pro Kalenderwoche bzw. Kalendermonat, schon geplante Tage zählen mit. „Höchstens“ gilt beim Planen
        und bei „Neu“, „mindestens“ nur beim Planen.
      </p>
      <ul className="border-t border-gray-100 divide-y divide-gray-100">
        {rules.map((r, i) => (
          <li key={i} className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <select
                aria-label="Kategorie"
                value={r.id}
                disabled={saving}
                onChange={(e) => update(i, { id: e.target.value })}
                className={`${selectClass} flex-1 min-w-0 font-semibold`}
              >
                {VARIETY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={saving}
                onClick={() => persist(rules.filter((_, j) => j !== i))}
                aria-label={`Regel „${varietyLabel(r.id)}“ löschen`}
                className="tap p-2 text-gray-500 hover:text-red-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                mindestens
                <select
                  value={r.min ?? ''}
                  disabled={saving}
                  onChange={(e) => update(i, { min: parse(e.target.value) })}
                  className={selectClass}
                >
                  <option value="">kein Minimum</option>
                  {choicesFor(r.period, r.min, 1).map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                höchstens
                <select
                  value={r.max ?? ''}
                  disabled={saving}
                  onChange={(e) => update(i, { max: parse(e.target.value) })}
                  className={selectClass}
                >
                  <option value="">keine Grenze</option>
                  <option value="0">nie</option>
                  {choicesFor(r.period, r.max, 1).map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                pro
                <select
                  value={r.period}
                  disabled={saving}
                  onChange={(e) => update(i, { period: e.target.value as VarietyPeriod })}
                  className={selectClass}
                >
                  <option value="week">Woche</option>
                  <option value="month">Monat</option>
                </select>
              </label>
            </div>
          </li>
        ))}
        {rules.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Keine Regeln: Der Plan achtet nur auf Abwechslung im Namen.</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-gray-100">
        <button
          type="button"
          disabled={saving}
          onClick={addRule}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          <Plus size={16} aria-hidden="true" />
          Regel hinzufügen
        </button>
        {!isDefault && (
          <button
            type="button"
            disabled={saving}
            onClick={() => persist(null)}
            className="inline-flex items-center h-9 px-3 rounded-lg text-sm text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            Standard wiederherstellen
          </button>
        )}
        {saving && <Loader2 size={14} className="animate-spin text-gray-400" aria-hidden="true" />}
      </div>
      {error && (
        <p role="alert" className="px-4 pb-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </CollapsibleCard>
  );
}
