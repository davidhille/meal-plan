import { useEffect, useState } from 'react';
import { BellRing, Loader2, Send } from 'lucide-react';
import { getPushState, PushState, saveReminderTime, sendTestPush, subscribePush, unsubscribePush } from '../lib/api';
import { currentSubscription, deviceLabel, pushSupport, subscribeThisDevice } from '../lib/push';
import CollapsibleCard from './CollapsibleCard';

/** Einstellungen → Erinnerung zum Bewerten (Push aufs Handy) */
export default function ReminderSettings({ onTimeChange }: { onTimeChange?: (time: string) => void }) {
  const support = pushSupport();
  const [state, setState] = useState<PushState | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState<'on' | 'off' | 'test' | 'time' | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [time, setTime] = useState('20:00');

  useEffect(() => {
    getPushState()
      .then((s) => {
        setState(s);
        setTime(s.reminderTime);
      })
      .catch((e) => setMessage({ text: (e as Error).message, error: true }));
    currentSubscription()
      .then((sub) => setEndpoint(sub?.endpoint ?? null))
      .catch(() => setEndpoint(null));
  }, []);

  const active = !!endpoint && !!state?.endpoints.includes(endpoint);
  const otherDevices = state ? state.endpoints.filter((e) => e !== endpoint).length : 0;

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ text: (e as Error).message || 'Das hat nicht geklappt.', error: true });
    } finally {
      setBusy(null);
    }
  };

  const turnOn = () =>
    run('on', async () => {
      if (!state) return;
      const sub = await subscribeThisDevice(state.publicKey);
      setState(await subscribePush(sub.toJSON(), deviceLabel()));
      setEndpoint(sub.endpoint);
      setMessage({ text: `Eingeschaltet. Erinnerung täglich ab ${time} Uhr, wenn das Essen noch nicht bewertet ist.` });
    });

  const turnOff = () =>
    run('off', async () => {
      if (!endpoint) return;
      const sub = await currentSubscription();
      await sub?.unsubscribe().catch(() => {});
      setState(await unsubscribePush(endpoint));
      setEndpoint(null);
    });

  const test = () =>
    run('test', async () => {
      if (!endpoint) return;
      await sendTestPush(endpoint);
      setMessage({ text: 'Test verschickt – die Benachrichtigung sollte gleich erscheinen.' });
    });

  const saveTime = (value: string) => {
    setTime(value);
    if (!/^\d\d:\d\d$/.test(value) || value === state?.reminderTime) return;
    run('time', async () => {
      setState(await saveReminderTime(value));
      onTimeChange?.(value);
    });
  };

  const summary = !state
    ? undefined
    : active
      ? `Auf diesem Gerät an · ${state.reminderTime} Uhr`
      : state.endpoints.length
        ? `Auf ${state.endpoints.length} Gerät${state.endpoints.length > 1 ? 'en' : ''} an · ${state.reminderTime} Uhr`
        : 'Aus';

  return (
    <CollapsibleCard storageKey="erinnerung" title="Erinnerung zum Bewerten" icon={<BellRing size={16} />} summary={summary}>
      <div className="px-4 pb-4 space-y-3">
        <p className="text-xs text-gray-500">
          Abends eine Benachrichtigung aufs Handy, wenn das Essen von heute noch keine Sterne hat. Bewertungen machen die
          nächsten Pläne besser.
        </p>

        {support === 'ios-install' ? (
          <p className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            Auf dem iPhone geht das nur mit der installierten App: in Safari auf <strong>Teilen → Zum Home-Bildschirm</strong>,
            die App von dort öffnen und hier einschalten.
          </p>
        ) : support === 'unsupported' ? (
          <p className="text-xs text-gray-500">Dieser Browser kann keine Benachrichtigungen empfangen.</p>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">Uhrzeit</span>
              <input
                type="time"
                value={time}
                step={900}
                onChange={(e) => saveTime(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </label>

            {active ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={test}
                  disabled={!!busy}
                  className="h-10 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Test senden
                </button>
                <button
                  onClick={turnOff}
                  disabled={!!busy}
                  className="h-10 rounded-lg border border-gray-200 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  {busy === 'off' ? <Loader2 size={14} className="mx-auto animate-spin" /> : 'Hier ausschalten'}
                </button>
              </div>
            ) : (
              <button
                onClick={turnOn}
                disabled={!!busy || !state}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 disabled:bg-gray-200 disabled:text-gray-500"
              >
                {busy === 'on' ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
                Auf diesem Gerät einschalten
              </button>
            )}
            {otherDevices > 0 && (
              <p className="text-xs text-gray-500">
                Außerdem auf {otherDevices} weiteren Gerät{otherDevices > 1 ? 'en' : ''} eingeschaltet.
              </p>
            )}
          </>
        )}

        {message && (
          <p role={message.error ? 'alert' : 'status'} className={`text-xs ${message.error ? 'text-red-600' : 'text-brand-800'}`}>
            {message.text}
          </p>
        )}
      </div>
    </CollapsibleCard>
  );
}
