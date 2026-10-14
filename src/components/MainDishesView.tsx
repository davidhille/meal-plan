import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, Loader2, Search, EyeOff, X, ShieldAlert, Sparkles } from 'lucide-react';
import { CatalogRecipe, Meal, MealType, PlanMeal, RecipeCatalog, RecipeFilter } from '../types';
import { matchesRecipeFilter } from '../lib/recipeFilters';
import { CONDITION_LABELS, swapExample } from '../lib/health';
import CustomFilterChips from './CustomFilterChips';
import RecipeFilterAssign from './RecipeFilterAssign';
import RecipeEditModal from './RecipeEditModal';
import AiRecipeModal from './AiRecipeModal';
import HiddenItemsList from './HiddenItemsList';
import { deleteRecipe, generateMealImage, getRecipeCatalog, resetRecipeEdit, saveRecipeEdit, setRecipeHidden } from '../lib/api';
import { RECIPE_BASE_PORTIONS } from '../lib/portions';
import MealModal from './MealModal';
import DayAssignSheet from './DayAssignSheet';
import ConfirmDialog from './ConfirmDialog';

interface MainDishesViewProps {
  planMeals: PlanMeal[];
  /** Gericht eines Tages durch das gewählte Rezept ersetzen */
  onReplace?: (pm: PlanMeal, recipe: CatalogRecipe) => Promise<void>;
  defaultPortions?: number;
  /** Eigene Filter aus den Einstellungen */
  customFilters?: RecipeFilter[];
  /** Filter-Zuordnung geändert (neue Filterliste) */
  onFiltersChange?: (filters: RecipeFilter[]) => void;
  /** Gericht bearbeitet – Plan und Favoriten neu laden */
  onRecipesChanged?: () => void;
}

const FILTERS: { id: MealType | 'alle'; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'vegetarisch', label: 'Vegetarisch' },
  { id: 'fleisch', label: 'Fleisch & Fisch' },
  { id: 'wochenende', label: 'Wochenende' },
];

const TYPE_LABEL: Record<MealType, string> = { vegetarisch: 'Vegetarisch', fleisch: 'Fleisch & Fisch', wochenende: 'Wochenende' };

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** TheMealDB-Fotos gibt es auch klein; eigene Bilder bleiben, wie sie sind */
const thumb = (url: string) => (url.startsWith('https://www.themealdb.com/') ? `${url}/small` : url);

function toMeal(r: CatalogRecipe): Meal {
  return {
    day: TYPE_LABEL[r.type],
    dayShort: '',
    meal: r.name,
    description: '',
    type: r.type,
    ingredients: r.ingredients,
    instructions: r.instructions,
    imageUrl: r.imageUrl ?? undefined,
    imageCredit: r.imageCredit,
    durationMin: r.durationMin,
  };
}

/** Übersicht aller Hauptgerichte: ansehen, in den Plan übernehmen, ausblenden */
export default function MainDishesView({
  planMeals,
  onReplace,
  defaultPortions = RECIPE_BASE_PORTIONS,
  customFilters = [],
  onFiltersChange,
  onRecipesChanged,
}: MainDishesViewProps) {
  const [catalog, setCatalog] = useState<RecipeCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MealType | 'alle'>('alle');
  const [customId, setCustomId] = useState<string | null>(null);
  const custom = customFilters.find((f) => f.id === customId) ?? null;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogRecipe | null>(null);
  const [assign, setAssign] = useState<CatalogRecipe | null>(null);
  const [hideCandidate, setHideCandidate] = useState<CatalogRecipe | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogRecipe | null>(null);
  const [showUnsuitable, setShowUnsuitable] = useState(false);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    getRecipeCatalog()
      .then(setCatalog)
      .catch((e) => setLoadError((e as Error).message || 'Die Gerichte konnten nicht geladen werden.'));
  }, []);

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 4000);
  };

  const visible = useMemo(() => {
    if (!catalog) return [];
    const q = normalize(query.trim());
    return catalog.recipes.filter(
      (r) =>
        (showUnsuitable || !r.unsuitable) &&
        (filter === 'alle' || r.type === filter) &&
        (!custom || matchesRecipeFilter(custom, r)) &&
        (!q || normalize(r.name).includes(q) || r.ingredients.some((i) => normalize(i).includes(q)))
    );
  }, [catalog, filter, query, custom, showUnsuitable]);

  if (loadError) {
    return <p className="px-4 py-12 text-sm text-center text-red-600">{loadError}</p>;
  }
  if (!catalog) {
    return (
      <div className="px-4 py-12 flex justify-center" role="status" aria-label="Gerichte werden geladen">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const suitableCount = catalog.recipes.filter((r) => !r.unsuitable).length;
  const unsuitableCount = catalog.recipes.length - suitableCount;
  const shownTotal = showUnsuitable ? catalog.recipes.length : suitableCount;
  const conditions = (catalog.healthConditions ?? []).map((c) => CONDITION_LABELS[c] ?? c).join(', ');
  const example = swapExample(catalog.healthConditions ?? []);

  /** Nach dem Bearbeiten: Übersicht übernehmen, Ansicht auf das (evtl. umbenannte) Gericht setzen */
  const applyEdit = (result: { name: string; catalog: RecipeCatalog }) => {
    setCatalog(result.catalog);
    setSelected(result.catalog.recipes.find((r) => r.name === result.name) ?? null);
    setEditing(null);
    onRecipesChanged?.();
  };

  const restore = async (name: string) => {
    try {
      setCatalog(await setRecipeHidden(name, false));
      flash(`„${name}“ wird wieder vorgeschlagen.`);
    } catch (e) {
      flash((e as Error).message || 'Das hat nicht geklappt.');
    }
  };

  return (
    <>
      <div className="px-4 py-4 space-y-3">
        <label className="relative block">
          <span className="sr-only">Gericht suchen</span>
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen, z. B. Curry oder Hähnchen"
            className="w-full h-11 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
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

        <button
          onClick={() => setShowAi(true)}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50 text-sm font-semibold text-brand-800 hover:bg-brand-50"
        >
          <Sparkles size={16} />
          Rezept mit KI erstellen
        </button>

        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1" role="group" aria-label="Art">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-none px-3 h-8 rounded-lg text-xs font-semibold transition-colors ${
                filter === f.id ? 'bg-brand-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <CustomFilterChips filters={customFilters} activeId={customId} onChange={setCustomId} />

        <p className="text-xs text-gray-500 px-1" aria-live="polite">
          {visible.length === shownTotal ? `${shownTotal} Gerichte` : `${visible.length} von ${shownTotal} Gerichten`}
        </p>
        {unsuitableCount > 0 && (
          <label className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <input
              type="checkbox"
              checked={showUnsuitable}
              onChange={(e) => setShowUnsuitable(e.target.checked)}
              className="mt-0.5 accent-amber-700"
            />
            <span>
              {unsuitableCount} weitere Gerichte passen nicht zu euren Einstellungen{conditions ? ` (${conditions})` : ''} und werden
              nie geplant. <strong>Auch diese zeigen</strong> – z. B. um Zutaten auszutauschen{example ? ` (${example})` : ''}.
            </span>
          </label>
        )}

        {visible.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center gap-2">
            <ChefHat size={28} className="text-gray-300" />
            <p className="text-sm text-gray-500">Nichts gefunden – versuch es mit einem anderen Begriff.</p>
            {!showUnsuitable && unsuitableCount > 0 && (
              <button onClick={() => setShowUnsuitable(true)} className="text-xs font-semibold text-brand-700 hover:underline">
                Auch unpassende Gerichte durchsuchen
              </button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {visible.map((r) => (
              <li key={r.name} className="relative">
                <button
                  onClick={() => setSelected(r)}
                  className="w-full h-full text-left bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-[4/3] bg-gray-100">
                    <ChefHat size={28} aria-hidden="true" className="absolute inset-0 m-auto text-gray-300" />
                    {r.imageUrl && (
                      <img
                        src={thumb(r.imageUrl)}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (r.imageUrl && !img.src.endsWith(r.imageUrl)) img.src = r.imageUrl;
                          else img.style.visibility = 'hidden';
                        }}
                        className="relative w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <h2 className="text-sm leading-snug font-semibold text-gray-800 line-clamp-2">{r.name}</h2>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span className="whitespace-nowrap">{TYPE_LABEL[r.type]}</span>
                      {r.durationMin ? (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock size={12} aria-hidden="true" />
                          {r.durationMin} Min
                        </span>
                      ) : null}
                    </p>
                    {r.unsuitable && (
                      <p className="flex items-center gap-1 mt-1 text-[11px] font-medium text-amber-800">
                        <ShieldAlert size={11} aria-hidden="true" />
                        Passt nicht{conditions ? ` (${conditions})` : ''}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setHideCandidate(r)}
                  aria-label={`${r.name} ausblenden`}
                  title="Ausblenden – wird nicht mehr vorgeschlagen"
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm hover:text-red-600 hover:bg-white"
                >
                  <EyeOff size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <HiddenItemsList
          title="Ausgeblendete Gerichte"
          names={catalog.hidden}
          onShow={restore}
          onDelete={async (name) => {
            setCatalog(await deleteRecipe(name));
            flash(`„${name}“ ist endgültig gelöscht.`);
          }}
          deleteHint="Selbst erstellte, importierte und KI-Rezepte verschwinden aus der Datenbank, Gerichte der Grundsammlung werden nie mehr vorgeschlagen."
        />
      </div>

      {selected && (
        <MealModal
          key={selected.name}
          meal={toMeal(selected)}
          defaultPortions={defaultPortions}
          onChoose={onReplace ? async () => setAssign(selected) : undefined}
          chooseLabel="In den Speiseplan übernehmen"
          onGenerateImage={async (name) => generateMealImage(name, !!selected.imageUrl)}
          onImageChange={(url, credit) =>
            setCatalog((c) =>
              c ? { ...c, recipes: c.recipes.map((r) => (r.name === selected.name ? { ...r, imageUrl: url, imageCredit: credit } : r)) } : c
            )
          }
          onEdit={() => setEditing(selected)}
          extra={
            <div className="space-y-3">
              {selected.unsuitable && (
                <p className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <ShieldAlert size={14} className="flex-shrink-0 mt-px" aria-hidden="true" />
                  Passt nicht zu euren Einstellungen{conditions ? ` (${conditions})` : ''} und wird nicht automatisch geplant. Über den
                  Stift lassen sich die Zutaten anpassen.
                </p>
              )}
              {onFiltersChange && (
                <RecipeFilterAssign filters={customFilters} recipe={selected} onChange={onFiltersChange} />
              )}
            </div>
          }
          onClose={() => setSelected(null)}
        />
      )}

      {showAi && (
        <AiRecipeModal
          onSaved={(result, favorite) => {
            setShowAi(false);
            setCatalog(result.catalog);
            setSelected(result.catalog.recipes.find((r) => r.name === result.name) ?? null);
            if (favorite) onRecipesChanged?.();
            flash(`„${result.name}“ ist jetzt in der Sammlung – das Bild entsteht gerade.`);
          }}
          onClose={() => setShowAi(false)}
        />
      )}

      {editing && (
        <RecipeEditModal
          recipe={editing}
          canReset={editing.edited}
          onSave={async (draft) => applyEdit(await saveRecipeEdit(editing.name, draft))}
          onReset={async () => applyEdit(await resetRecipeEdit(editing.name))}
          onClose={() => setEditing(null)}
        />
      )}

      {assign && onReplace && (
        <DayAssignSheet
          mode="replace"
          itemName={assign.name}
          planMeals={planMeals}
          onConfirm={async (pm) => {
            await onReplace(pm, assign);
            setSelected(null);
            flash(`„${assign.name}“ ist jetzt im Speiseplan.`);
          }}
          onClose={() => setAssign(null)}
        />
      )}

      {hideCandidate && (
        <ConfirmDialog
          title="Gericht ausblenden?"
          message={
            <>
              <strong>{hideCandidate.name}</strong> wird nicht mehr vorgeschlagen. Unten unter „Ausgeblendete Gerichte“ kannst du es
              wieder einblenden oder endgültig löschen.
            </>
          }
          confirmLabel="Ausblenden"
          danger
          onConfirm={async () => {
            setCatalog(await setRecipeHidden(hideCandidate.name, true));
            flash(`„${hideCandidate.name}“ ist ausgeblendet.`);
          }}
          onClose={() => setHideCandidate(null)}
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
