import { useEffect, useMemo, useState } from 'react';
import { ChefHat, ChevronRight, EyeOff, Link2, Search, Trash2 } from 'lucide-react';
import { Profile, Side, SideKind } from '../types';
import { deleteCustomSide, getCustomSides, setSideVisibility } from '../lib/api';
import { SIDES } from '../data/sides';
import { SIDE_CARB_LABEL, SIDE_KIND_LABEL, planSideToMeal, toPlanSide } from '../lib/sides';
import ChefkochSearchModal from './ChefkochSearchModal';
import SideAddSheet from './SideAddSheet';
import MealModal from './MealModal';
import ConfirmDialog from './ConfirmDialog';

interface SidesViewProps {
  profile: Profile | null;
  onProfileChange?: (p: Profile) => void;
  defaultPortions?: number;
}

const KINDS: SideKind[] = ['beilage', 'salat'];

/** Rezepte → Beilagen: feste Sammlung und eigene Beilagen/Salate ansehen, ausblenden, löschen, bei Chefkoch suchen oder per Link/KI hinzufügen */
export default function SidesView({ profile, onProfileChange, defaultPortions }: SidesViewProps) {
  const [kind, setKind] = useState<SideKind>('beilage');
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState<Side[]>([]);
  const [open, setOpen] = useState<Side | null>(null);
  const [showChefkoch, setShowChefkoch] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [toDelete, setToDelete] = useState<Side | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hidden = profile?.hidden_sides ?? [];

  const reload = () =>
    getCustomSides()
      .then(setCustom)
      .catch(() => undefined);
  useEffect(() => {
    void reload();
  }, []);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice((n) => (n === text ? null : n)), 4000);
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const own = new Set(custom.map((c) => c.name));
    return [...custom, ...SIDES.filter((s) => !own.has(s.name) && !hidden.includes(s.name))].filter(
      (s) => s.kind === kind && (!q || s.name.toLowerCase().includes(q))
    );
  }, [custom, hidden, kind, query]);

  const hiddenList = SIDES.filter((s) => hidden.includes(s.name) && s.kind === kind);

  const toggleHidden = async (name: string, hide: boolean) => {
    setError(null);
    try {
      onProfileChange?.(await setSideVisibility(name, hide));
      flash(hide ? `„${name}“ ist ausgeblendet und kommt nicht mehr als Vorschlag.` : `„${name}“ ist wieder da.`);
    } catch (e) {
      setError((e as Error).message || 'Das hat nicht geklappt.');
    }
  };

  const tab = (k: SideKind) =>
    `h-9 rounded-lg text-sm font-semibold transition-colors ${kind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`;

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="grid grid-cols-2 p-1 rounded-xl bg-gray-200/70" role="group" aria-label="Art">
        {KINDS.map((k) => (
          <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={tab(k)}>
            {k === 'beilage' ? 'Beilagen' : 'Salate'}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          aria-label={`${SIDE_KIND_LABEL[kind]} suchen`}
          placeholder="Suchen"
          className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowChefkoch(true)}
          className="min-h-11 px-3 rounded-xl text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800 flex items-center justify-center gap-1.5"
        >
          <ChefHat size={15} aria-hidden="true" /> Bei Chefkoch suchen
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="min-h-11 px-3 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
        >
          <Link2 size={15} aria-hidden="true" /> Link oder KI
        </button>
      </div>

      {notice && (
        <p role="status" className="text-xs text-brand-700 font-medium">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {list.map((s) => (
          <li key={s.name} className="flex items-stretch gap-1">
            <button
              onClick={() => setOpen(s)}
              className="flex-1 min-w-0 flex items-center gap-3 min-h-11 px-3 py-2.5 rounded-xl bg-white border border-gray-100 text-left hover:bg-gray-50"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-gray-800 truncate">{s.name}</span>
                <span className="block text-xs text-gray-500">
                  {[s.custom ? 'Eigene' : null, s.carb ? SIDE_CARB_LABEL[s.carb] : null, s.durationMin ? `${s.durationMin} Min` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <ChevronRight size={14} className="text-gray-300 flex-shrink-0" aria-hidden="true" />
            </button>
            {s.custom ? (
              <button
                onClick={() => setToDelete(s)}
                aria-label={`${s.name} löschen`}
                title="Löschen"
                className="tap w-11 flex-shrink-0 flex items-center justify-center rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <button
                onClick={() => toggleHidden(s.name, true)}
                aria-label={`${s.name} ausblenden`}
                title="Ausblenden – kommt nicht mehr als Vorschlag oder in der Auswahl"
                className="tap w-11 flex-shrink-0 flex items-center justify-center rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50"
              >
                <EyeOff size={15} />
              </button>
            )}
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-sm text-gray-500">Nichts gefunden.</li>}
      </ul>

      {hiddenList.length > 0 && (
        <details className="rounded-xl bg-white border border-gray-100">
          <summary className="px-3 py-3 min-h-11 text-sm font-semibold text-gray-700 cursor-pointer">
            Ausgeblendet ({hiddenList.length})
          </summary>
          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {hiddenList.map((s) => (
              <li key={s.name} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{s.name}</span>
                <button onClick={() => toggleHidden(s.name, false)} className="min-h-11 px-3 text-xs font-semibold text-brand-700">
                  Wieder einblenden
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {open && <MealModal meal={planSideToMeal(toPlanSide(open))} allowRating={false} defaultPortions={defaultPortions} onClose={() => setOpen(null)} />}

      {showChefkoch && (
        <ChefkochSearchModal
          mode={kind}
          existingNames={new Set([...custom, ...SIDES].map((s) => s.name))}
          onSaved={() => void reload()}
          onClose={() => setShowChefkoch(false)}
        />
      )}

      {showAdd && (
        <SideAddSheet
          mealName=""
          initialKind={kind}
          onClose={() => setShowAdd(false)}
          onAdded={(side) => {
            setShowAdd(false);
            void reload();
            setKind(side.kind);
            flash(`„${side.name}“ ist jetzt bei den Beilagen.`);
          }}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Beilage löschen?"
          message={
            <>
              <strong>{toDelete.name}</strong> verschwindet aus euren eigenen Beilagen. Schon geplante Tage behalten sie.
            </>
          }
          confirmLabel="Löschen"
          danger
          onConfirm={async () => {
            setCustom(await deleteCustomSide(toDelete.name));
          }}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
