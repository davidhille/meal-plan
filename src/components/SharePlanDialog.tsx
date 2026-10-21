import { useState } from 'react';
import { Check, Copy, Link2, Loader2, Share2, X } from 'lucide-react';
import { MealPlan } from '../types';
import { sharePlan, unsharePlan } from '../lib/api';
import { formatShortDate } from '../lib/dateUtils';
import { useDialog } from '../lib/useDialog';

interface SharePlanDialogProps {
  plan: MealPlan;
  onSharedChange: (shared: boolean) => void;
  onClose: () => void;
}

/** Wochenplan teilen: Nur-Lese-Link ohne Zugang (Gerichte und Rezepte, keine Einkaufsliste, keine Bewertungen) */
export default function SharePlanDialog({ plan, onSharedChange, onClose }: SharePlanDialogProps) {
  const dialogRef = useDialog(onClose);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'revoke' | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shared = url !== null || !!plan.shared;

  const run = async (kind: 'create' | 'revoke', fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setBusy(null);
    }
  };

  const create = () =>
    run('create', async () => {
      setUrl(await sharePlan(plan.id));
      setCopied(false);
      onSharedChange(true);
    });

  const revoke = () =>
    run('revoke', async () => {
      await unsharePlan(plan.id);
      setUrl(null);
      onSharedChange(false);
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Kopieren ging nicht – bitte den Link markieren und kopieren.');
    }
  };

  const share = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: 'Unser Speiseplan', text: 'Unser Speiseplan bei miyummy:', url });
    } catch {
      /* abgebrochen */
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <Share2 size={18} className="text-brand-700" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h2 id="share-title" className="text-base font-semibold text-gray-900">
              Speiseplan teilen
            </h2>
            <p className="text-xs text-gray-500">
              {formatShortDate(plan.start_date)} – {formatShortDate(plan.end_date)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            Wer den Link hat, sieht den Plan mit Rezepten – ohne Zugang und ohne etwas ändern zu können. Einkaufsliste,
            Bewertungen und Einstellungen bleiben privat. Änderungen am Plan sind sofort mit drin.
          </p>

          {url ? (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 space-y-2" role="status">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Link zum Plan"
                className="w-full h-9 px-3 rounded-xl border border-brand-200 bg-white text-xs text-gray-700"
              />
              <div className="flex gap-2">
                <button
                  onClick={copy}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-white border border-brand-200 text-brand-800 hover:bg-brand-100"
                >
                  {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copied ? 'Kopiert' : 'Kopieren'}
                </button>
                {typeof navigator.share === 'function' && (
                  <button
                    onClick={share}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold bg-brand-700 text-white hover:bg-brand-800"
                  >
                    <Share2 size={14} aria-hidden="true" /> Teilen
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={create}
              disabled={!!busy}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 disabled:bg-brand-300"
            >
              {busy === 'create' ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              {shared ? 'Neuen Link erstellen' : 'Link erstellen'}
            </button>
          )}

          {shared && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-xs text-gray-500">
                {url ? 'Ein neuer Link macht den alten ungültig.' : 'Der Plan ist schon geteilt. Ein neuer Link macht den alten ungültig.'}
              </p>
              <button
                onClick={revoke}
                disabled={!!busy}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                {busy === 'revoke' && <Loader2 size={12} className="animate-spin" />}
                Link zurückziehen
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
