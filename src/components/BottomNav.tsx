import { CalendarDays, ShoppingBag, Heart, User } from 'lucide-react';
import { ViewTab } from '../types';

interface BottomNavProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

const TABS: { id: ViewTab; label: string; Icon: typeof CalendarDays }[] = [
  { id: 'speiseplan', label: 'Plan', Icon: CalendarDays },
  { id: 'einkaufsliste', label: 'Einkauf', Icon: ShoppingBag },
  { id: 'favoriten', label: 'Favoriten', Icon: Heart },
  { id: 'einstellungen', label: 'Profil', Icon: User },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 pb-safe">
      <div className="max-w-lg mx-auto grid grid-cols-4">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                active ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span
                className={`flex items-center justify-center w-10 h-7 rounded-full transition-colors ${
                  active ? 'bg-green-50' : ''
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
