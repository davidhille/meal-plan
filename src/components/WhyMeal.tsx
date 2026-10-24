import { useState } from 'react';
import { Check, ChevronDown, Lightbulb, Loader2 } from 'lucide-react';
import { getMealWhy } from '../lib/api';

/** „Warum dieses Gericht?“: klappt auf und holt die Gründe erst beim ersten Öffnen */
export default function WhyMeal({ planMealId }: { planMealId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reasons, setReasons] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    const result = await getMealWhy(planMealId);
    setLoading(false);
    if (result) setReasons(result);
    else setFailed(true);
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && reasons === null && !loading) void load();
  };

  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 min-h-11 px-3 text-left text-sm font-semibold text-gray-800"
      >
        <Lightbulb size={15} className="text-brand-700 flex-shrink-0" aria-hidden="true" />
        <span className="flex-1">Warum dieses Gericht?</span>
        <ChevronDown size={15} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="px-3 pb-3" aria-live="polite">
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-gray-600">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Gründe werden geladen …
            </p>
          ) : failed ? (
            <p className="text-xs text-red-700">
              Die Gründe konnten nicht geladen werden.{' '}
              <button onClick={load} className="font-semibold underline underline-offset-2">
                Noch einmal versuchen
              </button>
            </p>
          ) : reasons && reasons.length > 0 ? (
            <>
              <ul className="space-y-1.5">
                {reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check size={14} className="mt-0.5 flex-shrink-0 text-brand-700" aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-600">So passt das Gericht zu euren Einstellungen von heute.</p>
            </>
          ) : (
            <p className="text-xs text-gray-600">Kein besonderer Grund hinterlegt – das Gericht erfüllt eure Regeln.</p>
          )}
        </div>
      )}
    </div>
  );
}
