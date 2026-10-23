import { ReactNode, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleCardProps {
  /** Merkt sich auf diesem Gerät, ob die Karte offen ist */
  storageKey: string;
  title: string;
  icon?: ReactNode;
  /** Kurzinfo, die im zugeklappten Zustand unter dem Titel steht */
  summary?: ReactNode;
  /** Zusätzlicher Knopf rechts im Kopf (z. B. „+“) */
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

function readOpen(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(`offen-${key}`);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

/** Auf- und zuklappbare Karte für die Einstellungen */
export default function CollapsibleCard({ storageKey, title, icon, summary, action, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(() => readOpen(storageKey, defaultOpen));
  const contentId = useId();

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(`offen-${storageKey}`, v ? '0' : '1');
      } catch {
        // Zustand gilt dann nur bis zum Neuladen
      }
      return !v;
    });
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Pfeil sitzt immer ganz rechts; ein Zusatz-Knopf liegt links daneben über dem Kopf */}
      <div className="relative">
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          className={`w-full flex items-center gap-2 pl-4 pr-4 py-3.5 text-left rounded-xl hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${
            open ? 'rounded-b-none' : ''
          }`}
        >
          {icon && <span className="text-gray-500 flex-shrink-0" aria-hidden="true">{icon}</span>}
          <span className={`flex-1 min-w-0 ${action ? 'pr-10' : ''}`}>
            <span className="block text-sm font-semibold text-gray-800">{title}</span>
            {!open && summary && <span className="block text-xs text-gray-500 truncate mt-0.5">{summary}</span>}
          </span>
          <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {action && <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center">{action}</div>}
      </div>
      <div id={contentId} hidden={!open} className="pt-3 border-t border-gray-100">
        {open && children}
      </div>
    </section>
  );
}
