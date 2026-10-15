import { ViewTab } from '../types';
import { Settings, Heart, ChefHat } from 'lucide-react';

interface TabSwitcherProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

export default function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  const tabs: {
    id: ViewTab;
    label: string;
    icon?: React.ReactNode;
    title?: string;
  }[] = [
    { id: 'speiseplan', label: 'Speiseplan' },
    { id: 'einkaufsliste', label: 'Einkaufsliste' },
    { id: 'rezepte', label: '', icon: <ChefHat size={18} />, title: 'Rezepte' },
    {
      id: 'favoriten',
      label: '',
      icon: <Heart size={18} />,
      title: 'Favoriten',
    },
    {
      id: 'einstellungen',
      label: '',
      icon: <Settings size={18} />,
      title: 'Einstellungen',
    },
  ];

  return (
    <nav className="bg-gray-50 pt-3 pb-3" aria-label="Bereiche">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex gap-1 p-1 rounded-2xl bg-brand-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.title}
              aria-label={tab.title || tab.label}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`${tab.icon ? 'w-11 flex-none' : 'flex-1'} h-10 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-brand-700 text-white font-extrabold shadow-sm'
                  : 'text-gray-600 font-semibold hover:text-brand-800 hover:bg-brand-50'
              }`}
            >
              {tab.icon || tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
