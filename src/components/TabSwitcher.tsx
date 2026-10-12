import { ViewTab } from '../types';
import { Settings, Heart, CakeSlice } from 'lucide-react';

interface TabSwitcherProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

export default function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  const tabs: { id: ViewTab; label: string; icon?: React.ReactNode; title?: string }[] = [
    { id: 'speiseplan', label: 'Speiseplan' },
    { id: 'einkaufsliste', label: 'Einkaufsliste' },
    { id: 'nachtisch', label: '', icon: <CakeSlice size={18} />, title: 'Nachtisch' },
    { id: 'favoriten', label: '', icon: <Heart size={18} />, title: 'Favoriten' },
    { id: 'einstellungen', label: '', icon: <Settings size={18} />, title: 'Einstellungen' },
  ];

  return (
    <nav className="bg-white border-b border-gray-100 px-4 pt-1" aria-label="Bereiche">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.title}
            aria-label={tab.title || tab.label}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`${tab.icon ? 'w-14 flex-none' : 'flex-1'} py-3 text-sm font-medium transition-all duration-200 border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-green-500 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-600'
            }`}
          >
            {tab.icon || tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
