import { useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { DayRule, DayRules, Profile } from '../types';
import { saveDayRules } from '../lib/api';
import { MINUTE_CHOICES, WEEKDAYS, describeDayRules } from '../lib/dayRules';
import CollapsibleCard from './CollapsibleCard';

interface DayRulesSettingsProps {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}

const valueOf = (r: DayRule | undefined) => (r?.off ? 'off' : r?.maxMinutes ? String(r.maxMinutes) : '');

/** Einstellungen → Wochentage: frei (nicht planen) oder höchstens X Minuten Kochzeit */
export default function DayRulesSettings({ profile, onSaved }: DayRulesSettingsProps) {
  const rules: DayRules = profile.day_rules ?? {};
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = async (key: string, value: string) => {
    const next: DayRules = { ...rules };
    if (value === 'off') next[key] = { off: true };
    else if (value) next[key] = { maxMinutes: Number(value) };
    else delete next[key];
    setSaving(key);
    setError(null);
    try {
      onSaved(await saveDayRules(next));
    } catch (e) {
      setError((e as Error).message || 'Die Einstellung konnte nicht gespeichert werden.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <CollapsibleCard storageKey="wochentage" title="Wochentage" icon={<CalendarClock size={16} />} summary={describeDayRules(rules)}>
      <p className="px-4 pb-3 text-xs text-gray-500">
        Freie Tage werden nicht geplant (z. B. auswärts essen oder Reste). An Tagen mit wenig Zeit kommen nur Gerichte, die
        höchstens so lange dauern. Gilt für neue Pläne und für „Neu generieren“.
      </p>
      <ul className="border-t border-gray-100 divide-y divide-gray-100">
        {WEEKDAYS.map((d) => (
          <li key={d.key} className="flex items-center gap-3 px-4 py-2">
            <label htmlFor={`tag-${d.key}`} className="flex-1 text-sm text-gray-800">
              {d.long}
            </label>
            {saving === d.key && <Loader2 size={14} className="animate-spin text-gray-400" aria-hidden="true" />}
            <select
              id={`tag-${d.key}`}
              value={valueOf(rules[d.key])}
              disabled={!!saving}
              onChange={(e) => change(d.key, e.target.value)}
              className={`h-9 px-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                rules[d.key] ? 'border-brand-300 bg-brand-50 text-brand-800 font-semibold' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <option value="">Normal</option>
              <option value="off">Frei – nicht planen</option>
              {MINUTE_CHOICES.map((m) => (
                <option key={m} value={m}>
                  höchstens {m} Min
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="px-4 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </CollapsibleCard>
  );
}
