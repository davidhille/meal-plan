import { useState } from 'react';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import CollapsibleCard from './CollapsibleCard';
import { sendFeedback } from '../lib/api';

/** Einstellungen → Feedback & Wünsche: Nachricht an den Betreiber der App */
export default function FeedbackCard() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (message.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendFeedback(message.trim());
      setMessage('');
      setSent(true);
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CollapsibleCard storageKey="feedback" title="Feedback & Wünsche" icon={<MessageSquare size={16} />} summary="Fehler gefunden oder eine Idee? Schreib uns.">
      <div className="px-4 pb-4 space-y-2">
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setSent(false);
          }}
          rows={3}
          maxLength={2000}
          aria-label="Feedback oder Wunsch"
          placeholder="Was läuft gut, was nervt, was fehlt?"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500" role={sent ? 'status' : undefined}>
            {sent ? 'Danke! Ist angekommen.' : 'Geht direkt an den Betreiber der App.'}
          </p>
          <button
            onClick={submit}
            disabled={busy || message.trim().length < 3}
            className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-brand-700 text-white text-xs font-semibold hover:bg-brand-800 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} aria-hidden="true" />}
            Senden
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </CollapsibleCard>
  );
}
