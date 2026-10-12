import { UtensilsCrossed } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <UtensilsCrossed size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">Familien-Speiseplaner</h1>
          <p className="text-xs text-gray-400">& Einkaufs-Assistent</p>
        </div>
      </div>
    </header>
  );
}
