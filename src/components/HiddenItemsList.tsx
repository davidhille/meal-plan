import { useState } from 'react';
import { ChevronDown, Eye, Loader2, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface HiddenItemsListProps {
  /** z. B. „Ausgeblendete Gerichte“ */
  title: string;
  names: string[];
  /** Wieder einblenden */
  onShow: (name: string) => Promise<void>;
  /** Endgültig löschen (verschwindet auch aus dieser Liste) */
  onDelete: (name: string) => Promise<void>;
  /** Erklärung im Lösch-Dialog */
  deleteHint: string;
}

/** Aufklappbare Liste der ausgeblendeten Einträge: wieder einblenden oder endgültig löschen */
export default function HiddenItemsList({ title, names, onShow, onDelete, deleteHint }: HiddenItemsListProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  if (names.length === 0) return null;

  const show = async (name: string) => {
    setBusy(name);
    try {
      await onShow(name);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-1 text-xs font-medium text-gray-600 hover:text-gray-800"
      >
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {title} ({names.length})
      </button>
      {open && (
        <ul className="mt-2 bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          {names.map((name) => (
            <li key={name} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{name}</span>
              <button
                onClick={() => show(name)}
                disabled={busy === name}
                className="flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100"
              >
                {busy === name ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                Einblenden
              </button>
              <button
                onClick={() => setToDelete(name)}
                aria-label={`${name} endgültig löschen`}
                title="Endgültig löschen"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Endgültig löschen?"
          message={
            <>
              <strong>{toDelete}</strong> wird gelöscht und lässt sich nicht wiederherstellen. {deleteHint}
            </>
          }
          confirmLabel="Endgültig löschen"
          danger
          onConfirm={() => onDelete(toDelete)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
