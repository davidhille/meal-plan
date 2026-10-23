import { ViewTab } from '../types';
import { BookOpen, CalendarDays, Heart, Settings, ShoppingCart } from 'lucide-react';

interface TabSwitcherProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  /** top = Leiste oben (Tablet/PC), bottom = feste Tab-Leiste unten (Handy) */
  variant?: 'top' | 'bottom';
}

/** Hauptbereiche – immer mit Symbol und Text (keine reinen Symbol-Knöpfe) */
const TABS: { id: ViewTab; label: string; short: string; Icon: typeof Heart }[] = [
  { id: 'speiseplan', label: 'Speiseplan', short: 'Plan', Icon: CalendarDays },
  { id: 'einkaufsliste', label: 'Einkaufsliste', short: 'Einkauf', Icon: ShoppingCart },
  { id: 'rezepte', label: 'Rezepte', short: 'Rezepte', Icon: BookOpen },
  { id: 'favoriten', label: 'Favoriten', short: 'Favoriten', Icon: Heart },
  { id: 'einstellungen', label: 'Einstellungen', short: 'Einstellungen', Icon: Settings },
];

export default function TabSwitcher({ activeTab, onTabChange, variant = 'top' }: TabSwitcherProps) {
  if (variant === 'bottom') {
    return (
      <nav
        aria-label="Bereiche"
        className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          {TABS.map(({ id, short, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`h-16 flex flex-col items-center justify-center gap-1 min-w-0 transition-colors ${
                  active ? 'text-brand-700' : 'text-gray-500 hover:text-brand-800'
                }`}
              >
                <span
                  className={`h-7 w-12 flex items-center justify-center rounded-full transition-colors ${active ? 'bg-brand-100' : ''}`}
                  aria-hidden="true"
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                </span>
                <span className={`whitespace-nowrap text-xs leading-none tracking-[-0.025em] ${active ? 'font-bold' : 'font-medium'}`}>
                  {short}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-gray-50 pt-3 pb-3" aria-label="Bereiche">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex gap-1 p-1 rounded-2xl bg-brand-100">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex-1 h-10 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 ${
                  active ? 'bg-brand-700 text-white font-extrabold shadow-sm' : 'text-gray-600 font-semibold hover:text-brand-800 hover:bg-brand-50'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
