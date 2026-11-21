import { useState } from 'react';
import { Salad } from 'lucide-react';
import { Profile } from '../types';
import { saveSidesMode } from '../lib/api';
import { SidesMode, parseSidesMode } from '../lib/sidesSuggest';
import CollapsibleCard from './CollapsibleCard';

const OPTIONS: { id: SidesMode; label: string; hint: string }[] = [
  { id: 'off', label: 'Aus', hint: 'Beilagen und Salate wählt ihr selbst am Gericht.' },
  { id: 'suggest', label: 'Nur vorschlagen', hint: 'Fehlt zu einem Gericht eine Beilage, steht auf der Karte ein Vorschlag zum Übernehmen.' },
  { id: 'auto', label: 'Automatisch', hint: 'Beim Planen werden fehlende Beilagen und Salate gleich ergänzt; ihr könnt sie danach ändern.' },
];

/** Einstellungen → Planung: Beilagen und Salate zu Gerichten ohne Sättigungsbeilage (siehe lib/sidesSuggest.ts) */
export default function SidesSettings({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const mode = parseSidesMode(profile.sides_mode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (next: SidesMode) => {
    if (next === mode || saving) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveSidesMode(next));
    } catch (e) {
      setError((e as Error).message || 'Die Einstellung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleCard
      storageKey="beilagen"
      title="Beilagen und Salate"
      icon={<Salad size={16} />}
      summary={OPTIONS.find((o) => o.id === mode)?.label}
    >
      <p className="px-4 pb-3 text-xs text-gray-500">
        Manche Gerichte haben keine Beilage, brauchen aber eine (z. B. Schnitzel). Vorgeschlagen wird nur, wenn Nudeln, Reis,
        Kartoffeln oder Brot fehlen, ein Salat nur, wenn auch kein Gemüse dabei ist. Nudeln schlägt die App nicht vor.
      </p>
      <div role="radiogroup" aria-label="Beilagen und Salate" className="border-t border-gray-100 divide-y divide-gray-100">
        {OPTIONS.map((o) => (
          <label key={o.id} className="flex items-start gap-3 px-4 py-3 min-h-11 cursor-pointer">
            <input
              type="radio"
              name="sides-mode"
              checked={mode === o.id}
              disabled={saving}
              onChange={() => choose(o.id)}
              className="mt-0.5 accent-brand-700"
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">{o.label}</span>
              <span className="block text-xs text-gray-500">{o.hint}</span>
            </span>
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
