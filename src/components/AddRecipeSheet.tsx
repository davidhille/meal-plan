import { ChefHat, Link2, Plus, Sparkles, X } from 'lucide-react';
import { useDialog } from '../lib/useDialog';

export type AddRecipeWay = 'chefkoch' | 'ai' | 'link';

interface AddRecipeSheetProps {
  onPick: (way: AddRecipeWay) => void;
  onClose: () => void;
}

const WAYS: { id: AddRecipeWay; title: string; text: string; Icon: typeof ChefHat }[] = [
  { id: 'chefkoch', title: 'Bei Chefkoch suchen', text: 'Rezepte mit Filtern finden und übernehmen', Icon: ChefHat },
  { id: 'ai', title: 'Mit KI erstellen', text: 'Wunsch beschreiben, die KI schreibt das Rezept', Icon: Sparkles },
  { id: 'link', title: 'Von einem Link importieren', text: 'Rezept-Seite aus dem Web (z. B. Blog) einlesen', Icon: Link2 },
];

/** „Rezept hinzufügen“: die drei Wege an einer Stelle */
export default function AddRecipeSheet({ onPick, onClose }: AddRecipeSheetProps) {
  const dialogRef = useDialog(onClose);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-recipe-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="outline-none bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl overflow-hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <Plus size={18} className="text-brand-700" aria-hidden="true" />
          <h2 id="add-recipe-title" className="flex-1 text-base font-semibold text-gray-900">
            Rezept hinzufügen
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>
        <ul className="p-3 space-y-2">
          {WAYS.map(({ id, title, text, Icon }) => (
            <li key={id}>
              <button
                onClick={() => onPick(id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 text-left hover:bg-brand-50 hover:border-brand-200 transition-colors"
              >
                <span className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{title}</span>
                  <span className="block text-xs text-gray-600">{text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
