import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Inbox, MessageSquare, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';
import {
  clearAdminErrors, deleteFeedback, getAdminErrors, getAdminFeedback, setFeedbackDone, type AppError, type FeedbackEntry,
} from '../lib/api';

const when = (v: string) =>
  new Date(v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

/** Einstellungen → Meldungen (nur Betreiber): Feedback der Familien und Fehler der App */
export default function AdminInbox() {
  const [feedback, setFeedback] = useState<FeedbackEntry[] | null>(null);
  const [errors, setErrors] = useState<AppError[] | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setProblem(null);
    try {
      const [f, e] = await Promise.all([getAdminFeedback(), getAdminErrors()]);
      setFeedback(f);
      setErrors(e);
    } catch (e) {
      setProblem((e as Error).message || 'Die Meldungen ließen sich nicht laden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([getAdminFeedback(), getAdminErrors()])
      .then(([f, e]) => {
        setFeedback(f);
        setErrors(e);
      })
      .catch(() => {});
  }, []);

  if (!feedback || !errors) return null;
  const open = feedback.filter((f) => !f.done).length;
  const recentErrors = errors.filter((e) => Date.now() - Date.parse(e.createdAt.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')) < 86_400_000).length;

  const act = async (fn: () => Promise<void>) => {
    setProblem(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setProblem((e as Error).message || 'Das hat nicht geklappt.');
    }
  };

  return (
    <CollapsibleCard
      storageKey="meldungen"
      title="Meldungen"
      icon={<Inbox size={16} />}
      summary={`${open} ${open === 1 ? 'neues Feedback' : 'neue Feedbacks'} · ${recentErrors} ${recentErrors === 1 ? 'Fehler' : 'Fehler'} in 24 Std.`}
      action={
        <button onClick={load} disabled={loading} aria-label="Meldungen aktualisieren" title="Aktualisieren"
          className="tap w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      <div className="px-4 pb-4 space-y-4">
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <MessageSquare size={13} aria-hidden="true" /> Feedback der Familien
          </h3>
          {feedback.length === 0 && <p className="text-xs text-gray-500">Noch kein Feedback.</p>}
          <ul className="space-y-2">
            {feedback.map((f) => (
              <li key={f.id} className={`rounded-xl border p-3 ${f.done ? 'border-gray-100 bg-gray-50' : 'border-brand-200 bg-brand-50/50'}`}>
                <p className="text-[11px] text-gray-500">
                  {when(f.createdAt)} · {f.userName ?? 'Unbekannt'}{f.family ? ` (${f.family})` : ''}
                </p>
                <p className={`mt-1 text-sm whitespace-pre-wrap ${f.done ? 'text-gray-500' : 'text-gray-800'}`}>{f.message}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => act(() => setFeedbackDone(f.id, !f.done))}
                    className="h-8 px-2.5 flex items-center gap-1 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {f.done ? <Undo2 size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
                    {f.done ? 'Wieder offen' : 'Erledigt'}
                  </button>
                  <button
                    onClick={() => act(() => deleteFeedback(f.id))}
                    aria-label="Feedback löschen"
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <AlertTriangle size={13} aria-hidden="true" /> Fehler der App
            </h3>
            {errors.length > 0 && (
              <button onClick={() => act(clearAdminErrors)} className="text-xs font-semibold text-red-600 hover:text-red-700">
                Alle löschen
              </button>
            )}
          </div>
          {errors.length === 0 && <p className="text-xs text-gray-500">Keine Fehler protokolliert.</p>}
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
            {(showAllErrors ? errors : errors.slice(0, 8)).map((e) => (
              <li key={e.id} className="px-3 py-2">
                <p className="text-[11px] text-gray-500">
                  {when(e.createdAt)} · {e.source}
                  {e.family ? ` · ${e.family}` : ''}
                </p>
                <p className="text-xs text-gray-800 break-words">{e.message}</p>
              </li>
            ))}
          </ul>
          {errors.length > 8 && (
            <button onClick={() => setShowAllErrors((v) => !v)} className="text-xs font-semibold text-brand-700">
              {showAllErrors ? 'Weniger anzeigen' : `Alle ${errors.length} anzeigen`}
            </button>
          )}
        </section>
        {problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}
      </div>
    </CollapsibleCard>
  );
}
