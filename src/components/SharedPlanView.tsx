import { useEffect, useState } from 'react';
import { CakeSlice, ChevronDown, Clock, Wheat } from 'lucide-react';
import AppIcon from './AppIcon';
import Logo from './Logo';
import { getSharedPlan, type SharedPlan } from '../lib/api';
import { formatShortDate, toIso } from '../lib/dateUtils';
import { toSteps } from '../lib/cooking';

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

/** Geteilter Speiseplan (Link mit ?plan=…): nur lesen, ohne Anmeldung */
export default function SharedPlanView({ token }: { token: string }) {
  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    document.title = 'Speiseplan – miyummy';
    getSharedPlan(token)
      .then(setPlan)
      .catch((e) => setError((e as Error).message || 'Der Plan konnte nicht geladen werden.'));
  }, [token]);

  const today = toIso(new Date());
  const meals = plan?.meals ?? [];
  const past = meals.filter((m) => m.date < today);
  const shown = showPast ? meals : meals.filter((m) => m.date >= today);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="max-w-2xl mx-auto flex items-center gap-3 px-4 pt-4 pb-2">
        <AppIcon size={40} />
        <div>
          <p className="leading-none">
            <Logo size={26} />
          </p>
          <p className="text-xs text-gray-500 mt-1">Familien-Speiseplaner</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-10 space-y-3">
        {error ? (
          <p role="alert" className="mt-6 text-sm text-gray-700">
            {error}
          </p>
        ) : !plan ? (
          <p role="status" className="mt-6 text-sm text-gray-500">
            Wird geladen …
          </p>
        ) : (
          <>
            <div className="pt-2">
              <h1 className="text-lg font-bold text-gray-900">{plan.family ? `Speiseplan · ${plan.family}` : 'Speiseplan'}</h1>
              <p className="text-sm text-gray-500">
                {formatShortDate(plan.startDate)} – {formatShortDate(plan.endDate)}
              </p>
            </div>
            {past.length > 0 && (
              <button onClick={() => setShowPast((v) => !v)} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                {showPast ? 'Vergangene Tage ausblenden' : `Vergangene Tage anzeigen (${past.length})`}
              </button>
            )}
            {shown.length === 0 && <p className="text-sm text-gray-500">Für die kommenden Tage ist nichts geplant.</p>}
            <ul className="space-y-2">
              {shown.map((m) => {
                const key = `${m.date}-${m.name}`;
                const expanded = open === key;
                return (
                  <li key={key} className={`bg-white rounded-xl border overflow-hidden ${m.date === today ? 'border-brand-300' : 'border-gray-100'}`}>
                    {m.brotzeit ? (
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="w-12 h-12 rounded-lg bg-coral-50 flex items-center justify-center flex-shrink-0">
                          <Wheat size={20} className="text-coral-700" aria-hidden="true" />
                        </span>
                        <span>
                          <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">{longDate(m.date)}</span>
                          <span className="block text-sm font-semibold text-gray-900">Brotzeit</span>
                        </span>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setOpen(expanded ? null : key)}
                          aria-expanded={expanded}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                        >
                          {m.imageUrl ? (
                            <img src={m.imageUrl} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                          ) : (
                            <span className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" aria-hidden="true" />
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {m.date === today ? 'Heute · ' : ''}
                              {longDate(m.date)}
                            </span>
                            <span className="block text-sm font-semibold text-gray-900">{m.name}</span>
                            <span className="flex flex-wrap gap-x-3 text-xs text-gray-500">
                              {m.durationMin ? (
                                <span className="flex items-center gap-1">
                                  <Clock size={11} aria-hidden="true" />
                                  {m.durationMin} Min
                                </span>
                              ) : null}
                              {m.dessert && (
                                <span className="flex items-center gap-1 text-amber-700">
                                  <CakeSlice size={11} aria-hidden="true" />
                                  {m.dessert}
                                </span>
                              )}
                            </span>
                          </span>
                          <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        {expanded && (
                          <div className="px-4 pb-4 grid gap-3 sm:grid-cols-2 border-t border-gray-100 pt-3">
                            <div>
                              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zutaten (4 Portionen)</h2>
                              <ul className="mt-1 text-sm text-gray-700 list-disc pl-5 space-y-0.5">
                                {m.ingredients.map((i, idx) => (
                                  <li key={idx}>{i}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Zubereitung</h2>
                              <ol className="mt-1 text-sm text-gray-700 list-decimal pl-5 space-y-1">
                                {toSteps(m.instructions).map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="pt-4 text-center text-xs text-gray-500">
              Geteilt mit miyummy · <a href="/" className="font-semibold text-brand-700 hover:text-brand-800">miyummy.com</a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
