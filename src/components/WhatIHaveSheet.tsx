import { useMemo, useState } from 'react';
import { Check, Clock, Refrigerator, X } from 'lucide-react';
import { CatalogRecipe } from '../types';
import { useDialog } from '../lib/useDialog';
import { matchHave, parseHave } from '../lib/whatIHave';

interface WhatIHaveSheetProps {
  recipes: CatalogRecipe[];
  /** Gericht ansehen (Rezept-Ansicht der Übersicht) */
  onOpen: (recipe: CatalogRecipe) => void;
  onClose: () => void;
}

const STORAGE_KEY = 'was-hab-ich-da';
const IDEAS = ['Zucchini, Feta, Reis', 'Hackfleisch, Paprika', 'Kartoffeln, Eier, Spinat', 'Hähnchen, Brokkoli'];

function readLast(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** „Was hab ich da?“: Zutaten eingeben → Gerichte aus der Sammlung, die möglichst viele davon verwenden (ohne KI) */
export default function WhatIHaveSheet({ recipes, onOpen, onClose }: WhatIHaveSheetProps) {
  const dialogRef = useDialog(onClose);
  const [input, setInput] = useState(readLast);
  const have = useMemo(() => parseHave(input), [input]);
  const matches = useMemo(() => matchHave(recipes.filter((r) => !r.unsuitable), have).slice(0, 40), [recipes, have]);

  const change = (value: string) => {
    setInput(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // nur Komfort
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="have-title"
        tabIndex={-1}
        className="outline-none bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100">
          <Refrigerator size={18} className="text-brand-700" aria-hidden="true" />
          <h2 id="have-title" className="flex-1 text-base font-semibold text-gray-900">
            Was hab ich da?
          </h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 space-y-2">
          <label className="block">
            <span className="text-xs font-semibold text-gray-500">Zutaten, mit Komma getrennt</span>
            <input
              value={input}
              onChange={(e) => change(e.target.value)}
              placeholder="z. B. Zucchini, Feta, Reis"
              autoFocus
              className="mt-1 w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </label>
          {!input && (
            <div className="flex flex-wrap gap-1.5" aria-label="Beispiele">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  onClick={() => change(idea)}
                  className="px-2.5 h-8 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  {idea}
                </button>
              ))}
            </div>
          )}
          {have.length > 0 && (
            <p className="text-xs text-gray-500" aria-live="polite">
              {matches.length ? `${matches.length === 40 ? '40+' : matches.length} Gerichte gefunden` : 'Kein Gericht gefunden – andere Zutaten probieren.'}
            </p>
          )}
        </div>

        <ul className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {matches.map(({ recipe, matched }) => {
            const all = matched.length === have.length;
            return (
              <li key={recipe.name}>
                <button
                  onClick={() => onOpen(recipe)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl border border-gray-100 bg-white text-left hover:bg-gray-50"
                >
                  {recipe.imageUrl ? (
                    <img src={recipe.imageUrl} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                  ) : (
                    <span className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" aria-hidden="true" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 line-clamp-2">{recipe.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs">
                      <span className={`flex items-center gap-1 font-semibold ${all ? 'text-brand-700' : 'text-gray-600'}`}>
                        {all && <Check size={12} aria-hidden="true" />}
                        {matched.length} von {have.length}
                      </span>
                      <span className="text-gray-500 truncate">{matched.join(', ')}</span>
                      {recipe.durationMin ? (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Clock size={11} aria-hidden="true" />
                          {recipe.durationMin} Min
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
