import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Check, Search, Plus, Trash2 } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { PlanSide, Side, SideKind } from '../types';
import { deleteCustomSide, getCustomSides } from '../lib/api';
import SideAddSheet from './SideAddSheet';
import { SIDES } from '../data/sides';
import { SIDE_CARB_LABEL, SIDE_KIND_LABEL, toPlanSide, toggleSide } from '../lib/sides';

interface SidePickerModalProps {
  /** z. B. „Montag, 13.10.“ */
  dayLabel: string;
  mealName: string;
  current?: PlanSide[] | null;
  /** Leere Liste = alles entfernen */
  onSave: (sides: PlanSide[]) => Promise<void>;
  onClose: () => void;
}

const TABS: SideKind[] = ['beilage', 'salat'];

/** Beilage und/oder Salat für ein Gericht auswählen (je Art eine); Zutaten landen mit den Portionen auf der Einkaufsliste */
export default function SidePickerModal({ dayLabel, mealName, current, onSave, onClose }: SidePickerModalProps) {
  const dialogRef = useDialog(onClose);
  const [selected, setSelected] = useState<PlanSide[]>(current ?? []);
  const [tab, setTab] = useState<SideKind>('beilage');
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState<Side[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCustomSides()
      .then((l) => !cancelled && setCustom(l))
      .catch(() => undefined); // ohne eigene Beilagen geht die feste Sammlung trotzdem
    return () => {
      cancelled = true;
    };
  }, []);

  const removeCustom = async (name: string) => {
    try {
      setCustom(await deleteCustomSide(name));
      setSelected((cur) => cur.filter((s) => s.name !== name));
    } catch (e) {
      setError((e as Error).message || 'Die Beilage konnte nicht gelöscht werden.');
    }
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Eigene zuerst, dann die feste Sammlung (gleiche Namen: die eigene gilt)
    const own = new Set(custom.map((c) => c.name));
    return [...custom, ...SIDES.filter((s) => !own.has(s.name))].filter((s) => s.kind === tab && (!q || s.name.toLowerCase().includes(q)));
  }, [tab, query, custom]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
      onClose();
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
      setSaving(false);
    }
  };

  const changed = JSON.stringify(selected.map((s) => s.name).sort()) !== JSON.stringify((current ?? []).map((s) => s.name).sort());

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-picker-title"
        tabIndex={-1}
        className="outline-none relative flex flex-col w-full max-w-2xl h-full bg-gray-50 sm:rounded-2xl overflow-hidden shadow-xl"
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 bg-white">
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="tap w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex-shrink-0"
          >
            <X size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider truncate">{dayLabel} · {mealName}</p>
            <h2 id="side-picker-title" className="text-base font-semibold text-gray-900 leading-tight">
              Beilage oder Salat
            </h2>
          </div>
        </div>

        <div className="px-4 pt-3 space-y-3 bg-white border-b border-gray-100 pb-3">
          <div className="flex gap-2" role="group" aria-label="Art">
            {TABS.map((k) => {
              const chosen = selected.find((s) => s.kind === k);
              return (
                <button
                  key={k}
                  aria-pressed={tab === k}
                  onClick={() => setTab(k)}
                  className={`flex-1 min-h-11 px-3 rounded-xl text-sm font-semibold border ${
                    tab === k ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {SIDE_KIND_LABEL[k]}
                  {chosen && <span className={`block text-xs font-normal truncate ${tab === k ? 'text-brand-100' : 'text-gray-500'}`}>{chosen.name}</span>}
                </button>
              );
            })}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`${SIDE_KIND_LABEL[tab]} suchen`}
              placeholder="Suchen"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mx-4 mt-3 text-xs text-red-600">
            {error}
          </p>
        )}

        <ul className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {list.map((s) => {
            const on = selected.some((c) => c.kind === s.kind && c.name === s.name);
            return (
              <li key={s.name} className="flex items-stretch gap-1">
                <button
                  onClick={() => setSelected((cur) => toggleSide(cur, toPlanSide(s)))}
                  aria-pressed={on}
                  className={`flex-1 min-w-0 flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-xl border text-left ${
                    on ? 'bg-brand-50 border-brand-300' : 'bg-white border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-5 h-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                      on ? 'bg-brand-700 border-brand-700 text-white' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {on && <Check size={12} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm ${on ? 'font-semibold text-brand-800' : 'text-gray-800'}`}>{s.name}</span>
                    <span className="block text-xs text-gray-500">
                      {[s.custom ? 'Eigene' : null, s.carb ? SIDE_CARB_LABEL[s.carb] : null, s.durationMin ? `${s.durationMin} Min` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
                {s.custom && (
                  <button
                    onClick={() => removeCustom(s.name)}
                    aria-label={`${s.name} aus den eigenen Beilagen löschen`}
                    title="Löschen"
                    className="tap w-11 flex-shrink-0 flex items-center justify-center rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            );
          })}
          {list.length === 0 && <li className="py-6 text-center text-sm text-gray-500">Nichts gefunden.</li>}
          <li>
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-xl border border-dashed border-brand-300 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              <Plus size={15} aria-hidden="true" />
              Eigene {SIDE_KIND_LABEL[tab]} hinzufügen (Link oder KI)
            </button>
          </li>
        </ul>

        {adding && (
          <SideAddSheet
            mealName={mealName}
            initialKind={tab}
            onClose={() => setAdding(false)}
            onAdded={(side) => {
              setCustom((cur) => [...cur.filter((c) => c.name !== side.name), side]);
              setSelected((cur) => toggleSide(cur, toPlanSide(side)));
              setTab(side.kind);
              setAdding(false);
            }}
          />
        )}

        <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-2">
          {selected.length > 0 && (
            <button
              onClick={() => setSelected([])}
              disabled={saving}
              className="px-4 min-h-11 rounded-xl text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
            >
              Alle entfernen
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || !changed}
            className="flex-1 min-h-11 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
