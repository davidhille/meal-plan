import { useState } from 'react';
import { Leaf } from 'lucide-react';
import { Profile } from '../types';
import { saveVegMin } from '../lib/api';
import CollapsibleCard from './CollapsibleCard';

/** Standard, wenn nichts eingestellt ist (gleich wie `DEFAULT_VEG_MIN` im Worker) */
const DEFAULT_VEG_MIN = 3;
const OPTIONS = [0, 1, 2, 3, 4, 5];

const label = (n: number) => (n === 0 ? 'Keine Vorgabe' : `Mindestens ${n}× pro Woche`);

/** Einstellungen → Planung: wie viele vegetarische Gerichte pro Woche mindestens (die Fleisch-Grenze steht bei den Vorlieben) */
export default function VegMinSettings({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const value = profile.veg_min_per_week ?? DEFAULT_VEG_MIN;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (n: number) => {
    if (n === value || saving) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveVegMin(n));
    } catch (e) {
      setError((e as Error).message || 'Die Einstellung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleCard storageKey="vegetarisch" title="Vegetarisch pro Woche" icon={<Leaf size={16} />} summary={label(value)}>
      <p className="px-4 pb-3 text-xs text-gray-500">
        So viele vegetarische Gerichte sollen pro Woche mindestens im Plan stehen, an beliebigen Tagen. Bei kurzen Plänen
        anteilig. Wochentage sind schnell (bis 45 Minuten), Samstag und Sonntag dürfen aufwendig sein; das richtet sich nach
        der Zubereitungszeit des Gerichts.
      </p>
      <div role="radiogroup" aria-label="Vegetarisch pro Woche" className="border-t border-gray-100 divide-y divide-gray-100">
        {OPTIONS.map((n) => (
          <label key={n} className="flex items-center gap-3 px-4 py-3 min-h-11 cursor-pointer">
            <input
              type="radio"
              name="veg-min"
              checked={value === n}
              disabled={saving}
              onChange={() => choose(n)}
              className="accent-brand-700"
            />
            <span className="text-sm font-medium text-gray-800">{label(n)}</span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="px-4 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </CollapsibleCard>
  );
}
