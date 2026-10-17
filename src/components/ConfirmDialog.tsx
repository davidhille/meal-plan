import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useDialog } from '../lib/useDialog';

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** Rote Bestätigung für Löschen/Ausblenden */
  danger?: boolean;
  onConfirm: () => Promise<void>;
  /** Zweite Möglichkeit über den beiden Knöpfen (z. B. „Plan verlängern“ statt „Ersetzen“) */
  secondaryLabel?: string;
  onSecondary?: () => Promise<void>;
  onClose: () => void;
}

/** Rückfrage vor dem Speichern */
export default function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, secondaryLabel, onSecondary, onClose }: ConfirmDialogProps) {
  const dialogRef = useDialog(onClose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden px-4 py-5 space-y-4"
      >
        <h2 id="confirm-title" className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        <div className="text-sm text-gray-700 leading-relaxed">{message}</div>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        {secondaryLabel && onSecondary && (
          <button
            onClick={() => run(onSecondary)}
            disabled={busy}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {secondaryLabel}
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 h-11 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            Abbrechen
          </button>
          <button
            onClick={() => run(onConfirm)}
            disabled={busy}
            className={`flex-1 h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 ${
              danger ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300' : 'bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300'
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
