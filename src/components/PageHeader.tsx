import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
}

/** Seitenkopf im Stil der Emergent-Version: kleine Überzeile, große Outfit-Überschrift */
export default function PageHeader({ title, eyebrow, subtitle, action }: PageHeaderProps) {
  return (
    <header className="px-5 pt-6 pb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 mb-1">{eyebrow}</p>
        )}
        <h1 className="text-[28px] leading-tight font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 pt-1">{action}</div>}
    </header>
  );
}
