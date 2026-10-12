import { useEffect, useMemo, useState } from 'react';
import { CakeSlice, Clock, Loader2, Search, X } from 'lucide-react';
import { Dessert, DessertCategory, Meal, PlanMeal, RecipeFilter } from '../types';
import { matchesRecipeFilter } from '../lib/recipeFilters';
import CustomFilterChips from './CustomFilterChips';
import { DESSERT_CREDIT as CREDIT, dessertPreview as preview } from '../lib/desserts';
import MealModal from './MealModal';
import DayAssignSheet from './DayAssignSheet';

interface DessertsViewProps {
  /** Gerichte des Plans – der Nachtisch lässt sich an einen Tag hängen */
  planMeals?: PlanMeal[];
  onAssign?: (pm: PlanMeal, dessert: Dessert) => Promise<void>;
  /** Auswahlmodus (Nachtisch zum Gericht): Das Rezept bekommt einen Button „Zum Gericht hinzufügen“ */
  onPick?: (dessert: Dessert) => Promise<void>;
  /** Eigene Filter aus den Einstellungen */
  customFilters?: RecipeFilter[];
}

const CATEGORIES: { id: DessertCategory | 'alle'; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'kuchen', label: 'Kuchen & Torten' },
  { id: 'gebaeck', label: 'Gebäck' },
  { id: 'creme', label: 'Cremes & Pudding' },
  { id: 'pfanne', label: 'Pfannkuchen & Co.' },
  { id: 'obst', label: 'Mit Obst' },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<DessertCategory, string>;


const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Lange Zeiten (inkl. Kühlen/Gehen) in halben Stunden, z. B. „4½ Std“ */
function formatDuration(min: number) {
  if (min < 120) return `${min} Min`;
  const h = Math.round(min / 30) / 2;
  return `${Math.floor(h)}${h % 1 ? '½' : ''} Std`;
}

function toMeal(d: Dessert): Meal {
  return {
    day: CATEGORY_LABEL[d.category],
    dayShort: '',
    meal: d.name,
    description: '',
    type: 'vegetarisch',
    ingredients: d.ingredients,
    instructions: d.instructions,
    imageUrl: d.imageUrl,
    imageCredit: CREDIT,
    durationMin: d.durationMin,
  };
}

export default function DessertsView({ planMeals = [], onAssign, onPick, customFilters = [] }: DessertsViewProps) {
  const [desserts, setDesserts] = useState<Dessert[] | null>(null);
  const [category, setCategory] = useState<DessertCategory | 'alle'>('alle');
  const [customId, setCustomId] = useState<string | null>(null);
  const custom = customFilters.find((f) => f.id === customId) ?? null;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Dessert | null>(null);
  const [assign, setAssign] = useState<Dessert | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Die Sammlung erst laden, wenn der Reiter geöffnet wird
  useEffect(() => {
    let cancelled = false;
    import('../data/desserts').then((m) => {
      if (!cancelled) setDesserts(m.DESSERTS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (!desserts) return [];
    const q = normalize(query.trim());
    return desserts.filter(
      (d) =>
        (category === 'alle' || d.category === category) &&
        (!custom || matchesRecipeFilter(custom, d)) &&
        (!q || normalize(d.name).includes(q) || d.ingredients.some((i) => normalize(i).includes(q)))
    );
  }, [desserts, category, query, custom]);

  if (!desserts) {
    return (
      <div className="px-4 py-12 flex justify-center" role="status" aria-label="Nachtische werden geladen">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-4 space-y-3">
        <label className="relative block">
          <span className="sr-only">Nachtisch suchen</span>
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen, z. B. Apfel oder Schokolade"
            className="w-full h-11 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Suche leeren"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            >
              <X size={14} />
            </button>
          )}
        </label>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1" role="group" aria-label="Kategorie">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`flex-none px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
                category === c.id ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <CustomFilterChips filters={customFilters} activeId={customId} onChange={setCustomId} />

        <p className="text-xs text-gray-500 px-1" aria-live="polite">
          {visible.length === desserts.length ? `${desserts.length} Nachtische` : `${visible.length} von ${desserts.length} Nachtischen`}
        </p>

        {visible.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center gap-2">
            <CakeSlice size={28} className="text-gray-300" />
            <p className="text-sm text-gray-500">Nichts gefunden – versuch es mit einem anderen Begriff.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {visible.map((d) => (
              <li key={d.name}>
                <button
                  onClick={() => setSelected(d)}
                  className="w-full h-full text-left bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-[4/3] bg-gray-100">
                    <CakeSlice size={28} aria-hidden="true" className="absolute inset-0 m-auto text-gray-300" />
                    <img
                      src={preview(d.imageUrl)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.src !== d.imageUrl) img.src = d.imageUrl;
                        else img.style.visibility = 'hidden';
                      }}
                      className="relative w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h2 className="text-sm leading-snug font-semibold text-gray-800 line-clamp-2">{d.name}</h2>
                    <p className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Clock size={12} aria-hidden="true" />
                      {formatDuration(d.durationMin)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <MealModal
          meal={toMeal(selected)}
          yieldLabel={selected.yield}
          onChoose={onPick ? () => onPick(selected) : onAssign ? async () => setAssign(selected) : undefined}
          chooseLabel={onPick ? 'Zum Gericht hinzufügen' : 'An einen Tag hängen'}
          onClose={() => setSelected(null)}
        />
      )}

      {assign && onAssign && (
        <DayAssignSheet
          mode="dessert"
          itemName={assign.name}
          planMeals={planMeals}
          onConfirm={async (pm) => {
            await onAssign(pm, assign);
            setSelected(null);
            setNotice(`„${assign.name}“ hängt jetzt am Speiseplan.`);
            setTimeout(() => setNotice(null), 4000);
          }}
          onClose={() => setAssign(null)}
        />
      )}

      {notice && (
        <div role="status" className="fixed bottom-6 inset-x-4 z-40 max-w-md mx-auto px-4 py-3 rounded-2xl bg-gray-800 text-white text-sm shadow-lg">
          {notice}
        </div>
      )}
    </>
  );
}
