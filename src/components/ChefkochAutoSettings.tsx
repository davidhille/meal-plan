import { useState } from 'react';
import { ChefHat, Loader2 } from 'lucide-react';
import { Profile } from '../types';
import { setChefkochAuto } from '../lib/api';
import { toIso } from '../lib/dateUtils';
import CollapsibleCard from './CollapsibleCard';

/** Einstellungen → Neue Rezepte von Chefkoch (täglich automatisch) */
export default function ChefkochAutoSettings({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = !!profile.chefkoch_auto;
  const today = profile.chefkoch_auto_day === toIso(new Date()) ? profile.chefkoch_auto_count ?? 0 : 0;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await setChefkochAuto(!on));
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CollapsibleCard
      storageKey="chefkoch-auto"
      title="Neue Rezepte von Chefkoch"
      icon={<ChefHat size={16} />}
      summary={on ? `An · heute ${today} von 10 übernommen` : 'Aus'}
    >
      <div className="px-4 pb-4 space-y-3">
        <p className="text-sm text-gray-600 leading-relaxed">
          Jeden Tag bis zu 10 neue Hauptspeisen von Chefkoch in die Rezepte – nur mit mindestens 4,5 Sternen und 2 Bewertungen, und nur,
          was zu den Gesundheitseinstellungen und „Kommt nie in den Plan“ passt. Mit Foto und Link zum Original; sie werden wie eigene
          Rezepte mit eingeplant. Neue sind unter Rezepte mit „Neu“ markiert – dort kannst du sie behalten oder ausblenden.
        </p>
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-800">Täglich automatisch übernehmen</span>
          <button
            role="switch"
            aria-checked={on}
            onClick={toggle}
            disabled={busy}
            className={`relative w-12 h-7 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-brand-700' : 'bg-gray-300'} disabled:opacity-60`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
            {busy && <Loader2 size={12} className="absolute inset-0 m-auto animate-spin text-white" />}
          </button>
        </label>
        {on && <p className="text-xs text-gray-500">Heute übernommen: {today} von 10. Neue Rezepte findest du unter Rezepte (Markierung „Neu“).</p>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </CollapsibleCard>
  );
}
