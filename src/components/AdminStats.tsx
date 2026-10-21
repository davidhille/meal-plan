import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';
import { getAdminStats, type AdminStats as Stats, type AiUsage } from '../lib/api';

const num = (n: number) => Math.round(n).toLocaleString('de-DE');

const parseTs = (v: string) => new Date(v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
const formatDate = (v: string | null) =>
  v ? parseTs(v).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;
const shortDay = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.`;
};

/** Ein Zahlenpaar im Raster: Wert oben, Beschriftung darunter */
function Figure({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg bg-white border border-gray-100 px-2 py-1.5 text-center">
      <p className="text-sm font-semibold text-gray-800 tabular-nums">{value}</p>
      <p className="text-[11px] leading-tight text-gray-500">{label}</p>
    </div>
  );
}

/** KI-Verbrauch einer Familie (oder der App) in einer Zeile plus Aufteilung */
function AiLine({ ai }: { ai: AiUsage }) {
  if (!ai.month) return <p className="text-xs text-gray-500">KI: in den letzten 30 Tagen nichts verbraucht</p>;
  return (
    <div className="text-xs text-gray-600 space-y-0.5">
      <p>
        <span className="font-semibold text-brand-800">KI</span> · heute {num(ai.today)} · 7 Tage {num(ai.week)} ·{' '}
        <span className="font-semibold text-gray-800">30 Tage {num(ai.month)}</span> Neurons
      </p>
      <p className="text-gray-500">
        Rezepte {num(ai.recipes)} ({ai.recipeCalls}×) · Bilder {num(ai.images)} ({ai.imageCalls}×)
      </p>
    </div>
  );
}

/** Einstellungen → Statistik (nur Betreiber): Nutzung pro Familie und geschätzter KI-Verbrauch */
export default function AdminStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await getAdminStats());
    } catch (e) {
      setError((e as Error).message || 'Die Statistik ließ sich nicht laden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((e: Error) => setError(e.message || 'Die Statistik ließ sich nicht laden.'));
  }, []);

  if (!stats) {
    return error ? <p role="alert" className="text-xs text-red-600 px-1">{error}</p> : null;
  }

  const today = stats.daily[stats.daily.length - 1]?.neurons ?? 0;
  const share = Math.min(100, (today / stats.dailyLimit) * 100);
  const high = today >= stats.dailyLimit * 0.8;
  const scale = Math.max(stats.dailyLimit, ...stats.daily.map((d) => d.neurons));
  const limitPos = (stats.dailyLimit / scale) * 100;
  const month = stats.daily.reduce((s, d) => s + d.neurons, 0);
  const overDays = stats.daily.filter((d) => d.neurons > stats.dailyLimit).length;
  const since = formatDate(stats.since);

  return (
    <CollapsibleCard
      storageKey="statistik"
      title="Statistik"
      icon={<BarChart3 size={16} />}
      summary={`KI heute ${num(today)} von ${num(stats.dailyLimit)} Neurons`}
      action={
        <button onClick={load} disabled={loading} aria-label="Statistik aktualisieren" title="Aktualisieren"
          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      <div className="px-4 pb-4 space-y-4">
        {/* Heute gegen das Gratis-Kontingent */}
        <section className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-semibold text-gray-700">KI heute (Gratis-Kontingent)</span>
            <span className="tabular-nums text-gray-600">
              {num(today)} / {num(stats.dailyLimit)} · {Math.round(share)} %
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-label="KI-Verbrauch heute"
            aria-valuemin={0} aria-valuemax={stats.dailyLimit} aria-valuenow={Math.round(today)}>
            <div className={`h-full rounded-full ${high ? 'bg-coral-700' : 'bg-brand-600'}`} style={{ width: `${share}%` }} />
          </div>
          <p className="text-[11px] text-gray-500">Das Kontingent läuft um 2 Uhr (Winterzeit 1 Uhr) neu an.</p>
        </section>

        {/* Verlauf 30 Tage */}
        <section className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-semibold text-gray-700">Letzte 30 Tage</span>
            <span className="tabular-nums text-gray-600">
              {num(month)} Neurons{overDays ? ` · ${overDays}× über dem Gratis-Kontingent` : ''}
            </span>
          </div>
          <div
            className="relative h-24 flex items-end gap-[2px] border-b border-gray-200"
            role="img"
            aria-label={`KI-Verbrauch pro Tag der letzten 30 Tage, zusammen ${num(month)} Neurons, höchstens ${num(Math.max(...stats.daily.map((d) => d.neurons)))} an einem Tag`}
          >
            <div className="absolute inset-x-0 border-t border-dashed border-coral-500" style={{ bottom: `${limitPos}%` }} aria-hidden="true" />
            {stats.daily.map((d) => (
              <div key={d.day} className="flex-1 h-full flex items-end" title={`${shortDay(d.day)}: ${num(d.neurons)} Neurons`}>
                <div
                  className={`w-full rounded-t-sm ${d.neurons > stats.dailyLimit ? 'bg-coral-700' : 'bg-brand-500'}`}
                  style={{ height: `${(d.neurons / scale) * 100}%`, minHeight: d.neurons > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 tabular-nums">
            <span>{shortDay(stats.daily[0].day)}</span>
            <span className="text-coral-700">– – Gratis-Grenze</span>
            <span>heute</span>
          </div>
        </section>

        {/* Pro Familie */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-700">Familien</h3>
          <ul className="space-y-2">
            {stats.families.map((f) => {
              const label = f.name || (f.own ? 'Eure Familie' : 'Ohne Namen');
              const last = formatDate(f.lastActiveAt);
              return (
                <li key={f.id} className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {label}
                      {f.own && <span className="font-normal text-gray-500"> (ihr)</span>}
                      {f.disabled && <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-red-700">Gesperrt</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {f.userCount} {f.userCount === 1 ? 'Zugang' : 'Zugänge'} · {last ? `zuletzt aktiv ${last}` : 'noch nicht angemeldet'}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Figure value={f.planCount} label={f.planCount === 1 ? 'Plan' : 'Pläne'} />
                    <Figure value={f.meals30} label="Gerichte (30 T.)" />
                    <Figure value={f.ratingCount} label="Bewertungen" />
                    <Figure value={f.favoriteCount} label="Favoriten" />
                    <Figure value={f.aiRecipeCount} label="KI-Rezepte" />
                    <Figure value={f.importCount} label="Importe" />
                  </div>
                  <AiLine ai={f.ai} />
                </li>
              );
            })}
            <li className="rounded-xl border border-dashed border-gray-200 p-3 space-y-1">
              <p className="text-sm font-medium text-gray-800">Automatisch</p>
              <p className="text-xs text-gray-500">Bilder, die die App im Hintergrund nachzieht (und Verbrauch gelöschter Familien)</p>
              <AiLine ai={stats.automatic} />
            </li>
          </ul>
        </section>

        <p className="text-[11px] text-gray-500">
          Neurons sind geschätzt nach der Cloudflare-Preisliste (Tokens bzw. Bildgröße und Schritte). Die genaue Abrechnung
          steht im Cloudflare-Dashboard unter Workers AI.{' '}
          {since ? `Gezählt seit ${since}.` : 'Gezählt wird ab jetzt – noch keine KI-Aufrufe erfasst.'}
        </p>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </CollapsibleCard>
  );
}
