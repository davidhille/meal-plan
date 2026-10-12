import { ViewTab } from '../types';
import { Settings } from 'lucide-react';

interface TabSwitcherProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
}

export default function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
  const tabs: { id: ViewTab; label: string; icon?: React.ReactNode }[] = [
    { id: 'speiseplan', label: 'Speiseplan' },
    { id: 'einkaufsliste', label: 'Einkaufsliste' },
    { id: 'einstellungen', label: '', icon: <Settings size={18} /> },
  ];

  return (
    <div className="bg-white border-b border-gray-100 px-4 pt-1">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-3 text-sm font-medium transition-all duration-200 border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.icon || tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
