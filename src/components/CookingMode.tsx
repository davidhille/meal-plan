import { useEffect, useRef, useState } from 'react';
import { BellRing, Check, ChefHat, ChevronLeft, ChevronRight, Star, Timer, X } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { findTimers, formatCountdown } from '../lib/cooking';

interface CookingModeProps {
  name: string;
  /** Zutaten, schon auf die gewählten Portionen umgerechnet */
  ingredients: string[];
  steps: string[];
  /** z. B. „3,5 Portionen“ */
  amountLabel: string;
  /** Am Ende: „Gericht bewerten“ (schließt den Kochmodus) */
  onRate?: () => void;
  onClose: () => void;
}

interface RunningTimer {
  id: number;
  label: string;
  step: number;
  endsAt: number;
  done: boolean;
}

/** Bildschirm anlassen, solange gekocht wird (wo der Browser das kann) */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    let active = true;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock!.request('screen').then(
        (s) => {
          if (active) sentinel = s;
          else s.release().catch(() => {});
        },
        () => {}
      );
    };
    request();
    // Nach dem Wechsel in eine andere App gibt der Browser die Sperre frei → neu anfordern
    document.addEventListener('visibilitychange', request);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', request);
      sentinel?.release().catch(() => {});
    };
  }, []);
}

/** Kurzer Signalton (drei Pieptöne) und Vibration */
function ring() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.45, 0.9].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.35);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch {
    // Ton ist nur ein Extra
  }
}

/** Kochmodus: Vollbild, große Schrift, Schritt für Schritt, Timer aus dem Text, Bildschirm bleibt an */
export default function CookingMode({ name, ingredients, steps, amountLabel, onRate, onClose }: CookingModeProps) {
  const dialogRef = useDialog(onClose);
  useWakeLock();
  // -1 = Zutaten bereitlegen, 0..n-1 = Schritte, n = fertig
  const [page, setPage] = useState(-1);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const nextId = useRef(1);

  const last = steps.length;
  const go = (p: number) => setPage(Math.max(-1, Math.min(last, p)));

  // Pfeiltasten (z. B. am Tablet mit Tastatur)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPage((p) => Math.min(last, p + 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(-1, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  // Laufende Timer: jede Sekunde neu zeichnen, abgelaufene melden
  const running = timers.some((t) => !t.done);
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setTimers((prev) => {
        if (!prev.some((x) => !x.done && x.endsAt <= t)) return prev;
        ring();
        return prev.map((x) => (!x.done && x.endsAt <= t ? { ...x, done: true } : x));
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  const startTimer = (label: string, seconds: number, step: number) => {
    setNow(Date.now());
    setTimers((prev) => [...prev, { id: nextId.current++, label, step, endsAt: Date.now() + seconds * 1000, done: false }]);
  };
  const removeTimer = (id: number) => setTimers((prev) => prev.filter((t) => t.id !== id));

  const step = page >= 0 && page < last ? steps[page] : null;
  const stepTimers = step ? findTimers(step) : [];
  const progress = last ? Math.max(0, Math.min(1, (page + 1) / last)) : 0;

  return (
    <div className="fixed inset-0 z-[80] flex justify-center bg-black/60 sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cooking-title"
        tabIndex={-1}
        className="outline-none flex flex-col w-full max-w-2xl h-full bg-white sm:rounded-2xl overflow-hidden shadow-xl"
      >
        {/* Kopf */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button
            onClick={onClose}
            aria-label="Kochmodus beenden"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex-shrink-0"
          >
            <X size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider">
              {page < 0 ? 'Zutaten bereitlegen' : page >= last ? 'Fertig' : `Schritt ${page + 1} von ${last}`}
            </p>
            <h2 id="cooking-title" className="text-base font-semibold text-gray-900 truncate">
              {name}
            </h2>
          </div>
        </div>
        <div className="h-1.5 mx-4 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress * 100}%` }} />
        </div>

        {/* Laufende Timer – bleiben über alle Schritte sichtbar */}
        {timers.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-4 pt-3" aria-label="Timer" aria-live="polite">
            {timers.map((t) => (
              <li
                key={t.id}
                className={`flex items-center gap-2 pl-3 pr-1 h-10 rounded-full text-sm font-semibold ${
                  t.done ? 'bg-coral-700 text-white animate-pulse' : 'bg-brand-50 text-brand-800'
                }`}
              >
                {t.done ? <BellRing size={15} aria-hidden="true" /> : <Timer size={15} aria-hidden="true" />}
                <span className="tabular-nums">{t.done ? `${t.label} fertig!` : formatCountdown((t.endsAt - now) / 1000)}</span>
                <span className="text-xs font-medium opacity-75">Schritt {t.step + 1}</span>
                <button
                  onClick={() => removeTimer(t.id)}
                  aria-label={t.done ? 'Timer bestätigen' : `Timer ${t.label} abbrechen`}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10"
                >
                  {t.done ? <Check size={15} /> : <X size={15} />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Inhalt */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {page < 0 ? (
            <>
              <p className="mb-3 text-sm text-gray-500">Für {amountLabel} – zum Abhaken antippen.</p>
              <ul className="space-y-1">
                {ingredients.map((ing, i) => {
                  const on = checked.has(i);
                  return (
                    <li key={i}>
                      <button
                        aria-pressed={on}
                        onClick={() =>
                          setChecked((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })
                        }
                        className="w-full flex items-center gap-3 py-3 text-left border-b border-gray-100"
                      >
                        <span
                          className={`w-6 h-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center ${
                            on ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300'
                          }`}
                        >
                          {on && <Check size={14} />}
                        </span>
                        <span className={`text-lg ${on ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{ing}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : step ? (
            <>
              <p className="text-2xl leading-relaxed text-gray-900">{step}</p>
              {stepTimers.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {stepTimers.map((t) => (
                    <button
                      key={t.seconds}
                      onClick={() => startTimer(t.label, t.seconds, page)}
                      className="flex items-center gap-2 px-4 h-12 rounded-xl bg-brand-700 text-white text-base font-semibold hover:bg-brand-800 active:scale-95"
                    >
                      <Timer size={18} />
                      Timer {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3">
              <ChefHat size={44} className="text-brand-600" aria-hidden="true" />
              <p className="text-2xl font-semibold text-gray-900">Guten Appetit!</p>
              {onRate && (
                <button
                  onClick={onRate}
                  className="mt-2 flex items-center gap-2 px-5 h-12 rounded-xl bg-white border border-gray-300 text-base font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Star size={18} />
                  Gericht bewerten
                </button>
              )}
            </div>
          )}
        </div>

        {/* Blättern – große Knöpfe für Finger mit Mehl dran */}
        <div className="grid grid-cols-2 gap-3 px-4 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => go(page - 1)}
            disabled={page < 0}
            className="h-14 flex items-center justify-center gap-1 rounded-xl bg-white border border-gray-200 text-base font-semibold text-gray-700 disabled:opacity-40"
          >
            <ChevronLeft size={20} />
            Zurück
          </button>
          {page < last ? (
            <button
              onClick={() => go(page + 1)}
              className="h-14 flex items-center justify-center gap-1 rounded-xl bg-brand-700 text-white text-base font-semibold hover:bg-brand-800"
            >
              {page < 0 ? 'Los geht’s' : page === last - 1 ? 'Fertig' : 'Weiter'}
              <ChevronRight size={20} />
            </button>
          ) : (
            <button onClick={onClose} className="h-14 rounded-xl bg-brand-700 text-white text-base font-semibold hover:bg-brand-800">
              Schließen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
