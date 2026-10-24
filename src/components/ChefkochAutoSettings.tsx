import { useState } from 'react';
import { ChefHat, Loader2 } from 'lucide-react';
import { Profile } from '../types';
import { runChefkochAuto, setChefkochAuto, setChefkochAutoTime } from '../lib/api';
import { toIso } from '../lib/dateUtils';
import CollapsibleCard from './CollapsibleCard';

/** Einstellungen → Neue Rezepte von Chefkoch (täglich automatisch) */
export default function ChefkochAutoSettings({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [savingTime, setSavingTime] = useState(false);
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

  const changeTime = async (time: string) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
    setSavingTime(true);
    setError(null);
    try {
      onSaved(await setChefkochAutoTime(time));
    } catch (e) {
      setError((e as Error).message || 'Die Uhrzeit konnte nicht gespeichert werden.');
    } finally {
      setSavingTime(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const { added, profile: updated } = await runChefkochAuto();
      onSaved(updated);
      const full = (updated.chefkoch_auto_day === toIso(new Date()) ? updated.chefkoch_auto_count ?? 0 : 0) >= 10;
      setResult(
        added.length > 0
          ? `${added.length} neue ${added.length === 1 ? 'Rezept' : 'Rezepte'} übernommen – du findest ${added.length === 1 ? 'es' : 'sie'} unter Rezepte mit „Neu“.`
          : full
            ? 'Heute sind schon 10 Rezepte übernommen – morgen geht es weiter.'
            : 'Gerade nichts Passendes gefunden. Du kannst es gleich noch einmal versuchen.'
      );
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setRunning(false);
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
          Jeden Tag ab der eingestellten Uhrzeit bis zu 10 neue Hauptspeisen von Chefkoch in die Rezepte – nur mit mindestens 4,5 Sternen und 2 Bewertungen, und nur,
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
        {on && (
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-800">Ab wann täglich holen</span>
            <span className="flex items-center gap-2">
              {savingTime && <Loader2 size={14} className="animate-spin text-gray-400" aria-hidden="true" />}
              <input
                type="time"
                value={profile.chefkoch_auto_time ?? '06:00'}
                onChange={(e) => changeTime(e.target.value)}
                aria-label="Uhrzeit, ab der die Automatik täglich neue Rezepte holt"
                className="h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </span>
          </label>
        )}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="h-11 px-4 inline-flex items-center gap-2 rounded-xl border border-brand-300 bg-white text-sm font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-60"
          >
            {running ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ChefHat size={16} aria-hidden="true" />}
            {running ? 'Chefkoch wird durchsucht …' : 'Jetzt Rezepte holen'}
          </button>
          {result && <p role="status" className="text-xs text-gray-600">{result}</p>}
        </div>
        {on && <p className="text-xs text-gray-500">Heute übernommen: {today} von 10. Neue Rezepte findest du unter Rezepte (Markierung „Neu“).</p>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </CollapsibleCard>
  );
}
