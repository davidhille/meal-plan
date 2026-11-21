import { useState } from 'react';
import { Check, Loader2, Plus, Repeat } from 'lucide-react';
import {
  VARIETY_CATEGORIES,
  VarietyCategory,
  VarietyOverride,
  VarietyOverrides,
  inVarietyCategory,
  toggleVarietyCategory,
} from '../lib/varietyCategories';
import { setVarietyOverride } from '../lib/api';

interface RecipeVarietyAssignProps {
  recipeName: string;
  overrides: VarietyOverrides;
  onChange: (list: VarietyOverride[]) => void;
}

/** In der Rezept-Ansicht: wofür das Gericht bei den Mengen-Regeln zählt („höchstens 2× Asiatisch pro Woche“), mit Korrektur von Hand */
export default function RecipeVarietyAssign({ recipeName, overrides, onChange }: RecipeVarietyAssignProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = VARIETY_CATEGORIES.filter((c) => inVarietyCategory(c, recipeName, overrides));

  const toggle = async (c: VarietyCategory) => {
    if (busy) return;
    setBusy(c.id);
    setError(null);
    try {
      onChange(await setVarietyOverride(recipeName, c.id, toggleVarietyCategory(c, recipeName, overrides)));
    } catch (e) {
      setError((e as Error).message || 'Die Zuordnung konnte nicht gespeichert werden.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Repeat size={12} className="text-gray-500" aria-hidden="true" />
        <p className="flex-1 text-xs font-semibold text-gray-500">Zählt für Mengen-Regeln</p>
        <button
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          {editing ? 'Fertig' : 'Anpassen'}
        </button>
      </div>
      {editing ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zählt für Mengen-Regeln">
          {VARIETY_CATEGORIES.map((c) => {
            const on = inVarietyCategory(c, recipeName, overrides);
            return (
              <button
                key={c.id}
                aria-pressed={on}
                disabled={!!busy}
                onClick={() => toggle(c)}
                className={`flex items-center gap-1 px-3 h-8 rounded-full text-xs font-semibold transition-colors ${
                  on ? 'bg-brand-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-brand-50'
                }`}
              >
                {busy === c.id ? <Loader2 size={11} className="animate-spin" /> : on ? <Check size={11} /> : <Plus size={11} />}
                {c.label}
              </button>
            );
          })}
        </div>
      ) : active.length > 0 ? (
        <p className="flex flex-wrap gap-1.5">
          {active.map((c) => (
            <span key={c.id} className="px-2.5 h-7 flex items-center rounded-full bg-brand-50 text-xs font-medium text-brand-800">
              {c.label}
            </span>
          ))}
        </p>
      ) : (
        <p className="text-xs text-gray-500">Keine erkannt – über „Anpassen“ zuordnen.</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
