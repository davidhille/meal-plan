import type { ReactNode } from 'react';

export interface CardAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Vollständige Beschreibung für Screenreader */
  ariaLabel: string;
  title?: string;
  pressed?: boolean;
  /** danger = rot (z. B. Ablehnen), active = hervorgehoben (z. B. gemerkt) */
  tone?: 'default' | 'danger' | 'active';
}

const TONE: Record<NonNullable<CardAction['tone']>, string> = {
  default: 'text-gray-600 hover:bg-brand-50 hover:text-brand-800',
  active: 'text-coral-700 hover:bg-coral-50',
  danger: 'text-gray-600 hover:bg-red-50 hover:text-red-700',
};

/** Aktionsleiste unten in einer Karte: Symbol mit kurzer Beschriftung, gleich breite Felder */
export default function CardActionBar({ actions, disabled }: { actions: CardAction[]; disabled?: boolean }) {
  if (!actions.length) return null;
  return (
    <div
      className="grid border-t border-gray-100 divide-x divide-gray-100"
      style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
    >
      {actions.map((a) => (
        <button
          key={a.key}
          onClick={a.onClick}
          disabled={disabled}
          title={a.title}
          aria-label={a.ariaLabel}
          aria-pressed={a.pressed}
          className={`min-w-0 h-12 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${
            TONE[a.tone ?? 'default']
          }`}
        >
          <span aria-hidden="true">{a.icon}</span>
          <span className="max-w-full truncate tracking-tight">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
