import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, Eye, Loader2, Search, EyeOff, X, ShieldAlert, MessageSquare, Star, SlidersHorizontal, Refrigerator, Plus, ArrowUpDown } from 'lucide-react';
import { useRatings } from '../lib/ratings';
import { CatalogRecipe, Meal, PlanMeal, RecipeCatalog, RecipeFilter } from '../types';
import { CategoryOverride, toOverrideMap } from '../lib/recipeCategories';
import {
  EMPTY_SELECTION,
  FacetGroup,
  FacetSelection,
  matchesSelection,
  optionLabel,
  selectionSize,
  toggleOption,
} from '../lib/recipeFacets';
import RecipeFilterSheet from './RecipeFilterSheet';
import RecipeCategoryAssign from './RecipeCategoryAssign';
import { CONDITION_LABELS, swapExample } from '../lib/health';
import RecipeFilterAssign from './RecipeFilterAssign';
import RecipeEditModal from './RecipeEditModal';
import AiRecipeModal from './AiRecipeModal';
import WhatIHaveSheet from './WhatIHaveSheet';
import ChefkochSearchModal from './ChefkochSearchModal';
import AddRecipeSheet from './AddRecipeSheet';
import RecipeImportModal from './RecipeImportModal';
import HiddenItemsList from './HiddenItemsList';
import {
  deleteRecipe,
  getCategoryOverrides,
  moveRecipeToDessert,
  generateMealImage,
  removeMealImage,
  getRecipeCatalog,
  resetRecipeEdit,
  saveRecipeEdit,
  setRecipeHidden,
  wishToQuery,
} from '../lib/api';
import { RECIPE_BASE_PORTIONS } from '../lib/portions';
import { RecipeSort, SORT_LABELS, sortRecipes } from '../lib/recipeSort';
import MealModal from './MealModal';
import DishTypeLabel from './DishTypeLabel';
import { DISH_KIND_LABEL, dishKind } from '../lib/dishType';
import DayAssignSheet from './DayAssignSheet';
import HideMealDialog from './HideMealDialog';

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
  /** Namen der Favoriten (für die Sortierung „Empfohlen“) */
  favoriteNames?: string[];
  /** „Kommt nie in den Plan“ – beim Ausblenden anbieten */
  familyDislikes?: string[];
  onFamilyDislike?: (groupId: string) => Promise<void>;
}

function readSort(): RecipeSort {
  try {
    const v = localStorage.getItem('rezepte-sortierung');
    return v && v in SORT_LABELS ? (v as RecipeSort) : 'empfohlen';
  } catch {
    return 'empfohlen';
  }
}


const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** TheMealDB-Fotos gibt es auch klein; eigene Bilder bleiben, wie sie sind */
const thumb = (url: string) => (url.startsWith('https://www.themealdb.com/') ? `${url}/small` : url);

function toMeal(r: CatalogRecipe): Meal {
  return {
    day: DISH_KIND_LABEL[dishKind(r.type, r.name, r.ingredients)],
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
  favoriteNames = [],
  familyDislikes,
  onFamilyDislike,
}: MainDishesViewProps) {
  const [catalog, setCatalog] = useState<RecipeCatalog | null>(null);
  const { ratings, notes } = useRatings();
  const [loadError, setLoadError] = useState<string | null>(null);
  // Filter-Auswahl (Art, Speiseart, Hauptzutat, eigene Filter) – im Filter-Fenster
  const [selection, setSelection] = useState<FacetSelection>(EMPTY_SELECTION);
  const [showFilters, setShowFilters] = useState(false);
  const [overrideList, setOverrideList] = useState<CategoryOverride[]>([]);
  const overrides = useMemo(() => toOverrideMap(overrideList), [overrideList]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RecipeSort>(readSort);
  const changeSort = (value: RecipeSort) => {
    setSort(value);
    try {
      localStorage.setItem('rezepte-sortierung', value);
    } catch {
      // gilt dann nur bis zum Neuladen
    }
  };
  const [selected, setSelected] = useState<CatalogRecipe | null>(null);
  const [assign, setAssign] = useState<CatalogRecipe | null>(null);
  const [hideCandidate, setHideCandidate] = useState<CatalogRecipe | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogRecipe | null>(null);
  /** Unpassende Gerichte, die in der Übersicht gezeigt werden sollen (Entscheidung pro Gericht, im Browser gemerkt) */
  const [revealed, setRevealedState] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('mp_revealed_unsuitable') ?? '[]');
      return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const setRevealed = (names: string[]) => {
    setRevealedState(names);
    try {
      localStorage.setItem('mp_revealed_unsuitable', JSON.stringify(names));
    } catch {
      /* ohne Speicher geht es auch – dann gilt die Auswahl nur für diese Sitzung */
    }
  };
  const [showUnsuitableList, setShowUnsuitableList] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showChefkoch, setShowChefkoch] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showHave, setShowHave] = useState(false);
  /** Suchbegriff für Chefkoch, wenn aus der KI heraus geöffnet (Kontingent leer) */
  const [chefkochQuery, setChefkochQuery] = useState('');

  useEffect(() => {
    getRecipeCatalog()
      .then(setCatalog)
      .catch((e) => setLoadError((e as Error).message || 'Die Gerichte konnten nicht geladen werden.'));
    // Ohne Korrekturen geht es auch – dann gilt nur die automatische Erkennung
    getCategoryOverrides()
      .then(setOverrideList)
      .catch(() => {});
  }, []);

  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(null), 4000);
  };

  // Gerichte nach Suche und Gesundheits-Einstellung; darauf beziehen sich die Zahlen im Filter-Fenster
  const searched = useMemo(() => {
    if (!catalog) return [];
    const q = normalize(query.trim());
    return catalog.recipes.filter(
      (r) =>
        (!r.unsuitable || revealed.includes(r.name)) &&
        (!q || normalize(r.name).includes(q) || r.ingredients.some((i) => normalize(i).includes(q)))
    );
  }, [catalog, query, revealed]);

  // Eigene Filter, die es nicht mehr gibt, nicht mitzählen
  const activeSelection = useMemo(
    () => ({ ...selection, custom: selection.custom.filter((id) => customFilters.some((f) => f.id === id)) }),
    [selection, customFilters]
  );
  const visible = useMemo(
    () =>
      sortRecipes(
        searched.filter((r) => matchesSelection(r, activeSelection, { customFilters, overrides })),
        sort,
        { ratings, favorites: new Set(favoriteNames), month: new Date().getMonth() + 1 }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searched, activeSelection, customFilters, overrides, sort, ratings, favoriteNames.join('|')]
  );
  const activeCount = selectionSize(activeSelection);

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

  // Blättern in der Rezept-Ansicht: in der aktuell gefilterten Liste
  const selectedIndex = selected ? visible.findIndex((r) => r.name === selected.name) : -1;
  const goTo = (index: number) => {
    const next = visible[index];
    if (!next) return;
    setSelected(next);
    // Kachel im Hintergrund mitführen, damit man nach dem Schließen dort weitermacht
    document.querySelector(`[data-recipe="${CSS.escape(next.name)}"]`)?.scrollIntoView({ block: 'center' });
  };

  const suitableCount = catalog.recipes.filter((r) => !r.unsuitable).length;
  const unsuitableCount = catalog.recipes.length - suitableCount;
  const unsuitableRecipes = catalog.recipes.filter((r) => r.unsuitable);
  const revealedCount = unsuitableRecipes.filter((r) => revealed.includes(r.name)).length;
  const shownTotal = suitableCount + revealedCount;
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
        <div className="flex gap-2">
          <label className="relative block flex-1 min-w-0">
            <span className="sr-only">Gericht suchen</span>
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Gericht oder Zutat suchen"
              className="w-full h-11 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Suche leeren"
                className="tap absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            )}
          </label>
          <button
            onClick={() => setShowFilters(true)}
            aria-label={activeCount ? `Filter, ${activeCount} aktiv` : 'Filter'}
            className={`relative h-11 px-3.5 flex items-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors ${
              activeCount ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-brand-50'
            }`}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filter
            {activeCount > 0 && (
              <span className="min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-white text-brand-800 text-xs font-bold">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50 text-sm font-semibold text-brand-800 hover:bg-brand-50"
          >
            <Plus size={16} aria-hidden="true" />
            Rezept hinzufügen
          </button>
          <button
            onClick={() => setShowHave(true)}
            className="h-11 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-brand-50"
          >
            <Refrigerator size={16} aria-hidden="true" />
            Was hab ich da?
          </button>
        </div>

        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Aktive Filter">
            {(Object.keys(activeSelection) as FacetGroup[]).flatMap((g) =>
              activeSelection[g].map((id) => {
                const label = optionLabel(g, id, customFilters);
                return (
                  <button
                    key={g + id}
                    onClick={() => setSelection((s) => toggleOption(s, g, id))}
                    aria-label={`Filter ${label} entfernen`}
                    className="h-8 pl-3 pr-2 flex items-center gap-1 rounded-full bg-brand-100 text-xs font-semibold text-brand-800 hover:bg-brand-200"
                  >
                    {label}
                    <X size={13} aria-hidden="true" />
                  </button>
                );
              })
            )}
            <button onClick={() => setSelection(EMPTY_SELECTION)} className="h-8 px-2 text-xs font-semibold text-brand-700 hover:underline">
              Alle löschen
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-gray-500" aria-live="polite">
            {visible.length === shownTotal ? `${shownTotal} Gerichte` : `${visible.length} von ${shownTotal} Gerichten`}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <ArrowUpDown size={13} aria-hidden="true" />
            <select
              aria-label="Sortieren nach"
              value={sort}
              onChange={(e) => changeSort(e.target.value as RecipeSort)}
              className="h-8 pl-2 pr-7 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              {(Object.keys(SORT_LABELS) as RecipeSort[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {unsuitableCount > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <button
              type="button"
              onClick={() => setShowUnsuitableList((v) => !v)}
              aria-expanded={showUnsuitableList}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left"
            >
              <ShieldAlert size={14} className="flex-shrink-0 mt-px" aria-hidden="true" />
              <span className="flex-1">
                {unsuitableCount} weitere Gerichte passen nicht zu euren Einstellungen{conditions ? ` (${conditions})` : ''} und werden
                nie geplant{revealedCount > 0 ? `, ${revealedCount} davon sind in der Liste` : ''}.{' '}
                <strong className="underline underline-offset-2">{showUnsuitableList ? 'Schließen' : 'Ansehen und auswählen'}</strong>
                {!showUnsuitableList && example ? ` – z. B. um Zutaten auszutauschen (${example})` : ''}
              </span>
            </button>
            {showUnsuitableList && (
              <div className="px-3 pb-2.5">
                <div className="flex items-center gap-3 pb-1">
                  <button
                    type="button"
                    onClick={() => setRevealed([...new Set([...revealed, ...unsuitableRecipes.map((r) => r.name)])])}
                    className="h-8 font-semibold underline underline-offset-2"
                  >
                    Alle zeigen
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevealed(revealed.filter((n) => !unsuitableRecipes.some((r) => r.name === n)))}
                    className="h-8 font-semibold underline underline-offset-2"
                  >
                    Alle ausblenden
                  </button>
                </div>
                <ul className="divide-y divide-amber-200">
                  {unsuitableRecipes.map((r) => {
                    const shown = revealed.includes(r.name);
                    return (
                      <li key={r.name} className="flex items-center justify-between gap-3 py-1">
                        <button type="button" onClick={() => setSelected(r)} className="min-w-0 text-left font-medium truncate hover:underline">
                          {r.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRevealed(shown ? revealed.filter((n) => n !== r.name) : [...revealed, r.name])}
                          aria-pressed={shown}
                          aria-label={`${r.name} in der Liste ${shown ? 'ausblenden' : 'zeigen'}`}
                          title={shown ? 'In der Liste – antippen zum Ausblenden' : 'Nicht in der Liste – antippen zum Zeigen'}
                          className={`tap flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full border ${
                            shown
                              ? 'bg-amber-700 border-amber-700 text-white'
                              : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          {shown ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center gap-2">
            <ChefHat size={28} className="text-gray-300" />
            <p className="text-sm text-gray-500">Nichts gefunden – versuch es mit einem anderen Begriff.</p>
            {revealedCount < unsuitableCount && (
              <button onClick={() => setRevealed(unsuitableRecipes.map((r) => r.name))} className="text-xs font-semibold text-brand-700 hover:underline">
                Auch unpassende Gerichte durchsuchen
              </button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {visible.map((r) => (
              <li key={r.name} data-recipe={r.name} className="relative">
                <button
                  onClick={() => setSelected(r)}
                  className="w-full h-full flex flex-col justify-start text-left bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
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
                      <DishTypeLabel kind={dishKind(r.type, r.name, r.ingredients)} />
                      {r.durationMin ? (
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock size={12} aria-hidden="true" />
                          {r.durationMin} Min
                        </span>
                      ) : null}
                      {ratings[r.name] ? (
                        <span
                          className="flex items-center gap-0.5 whitespace-nowrap text-amber-700"
                          aria-label={`${ratings[r.name]} von 5 Sternen`}
                        >
                          <Star size={11} className="fill-yellow-400 text-yellow-500" aria-hidden="true" />
                          {ratings[r.name]}
                        </span>
                      ) : null}
                      {notes[r.name] && <MessageSquare size={12} className="text-amber-700" aria-label="mit Kommentar" />}
                    </p>
                    {r.unsuitable && (
                      <p className="flex items-center gap-1 mt-1 text-xs font-medium text-amber-800">
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
                  className="tap absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-sm hover:text-red-600 hover:bg-white"
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

      {showHave && catalog && (
        <WhatIHaveSheet recipes={catalog.recipes} onOpen={setSelected} onClose={() => setShowHave(false)} />
      )}

      {selected && (
        <MealModal
          key={selected.name}
          meal={toMeal(selected)}
          defaultPortions={defaultPortions}
          onChoose={onReplace ? async () => setAssign(selected) : undefined}
          chooseLabel="In den Speiseplan übernehmen"
          onGenerateImage={async (name) => generateMealImage(name, !!selected.imageUrl)}
          onRemoveImage={removeMealImage}
          onImageChange={(url, credit) =>
            setCatalog((c) =>
              c
                ? {
                    ...c,
                    recipes: c.recipes.map((r) => (r.name === selected.name ? { ...r, imageUrl: url || null, imageCredit: credit } : r)),
                  }
                : c
            )
          }
          onEdit={() => setEditing(selected)}
          // Aus „Was hab ich da?“ geöffnet: kein Blättern in der gefilterten Übersicht
          onPrev={!showHave && selectedIndex > 0 ? () => goTo(selectedIndex - 1) : undefined}
          onNext={!showHave && selectedIndex >= 0 && selectedIndex < visible.length - 1 ? () => goTo(selectedIndex + 1) : undefined}
          position={selectedIndex >= 0 ? `${selectedIndex + 1} / ${visible.length}` : undefined}
          extraBelow
          extra={
            <div className="space-y-3">
              {selected.unsuitable && (
                <p className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <ShieldAlert size={14} className="flex-shrink-0 mt-px" aria-hidden="true" />
                  Passt nicht zu euren Einstellungen{conditions ? ` (${conditions})` : ''} und wird nicht automatisch geplant. Über den
                  Stift lassen sich die Zutaten anpassen.
                </p>
              )}
              <RecipeCategoryAssign recipe={selected} overrides={overrides} onChange={setOverrideList} />
              {onFiltersChange && <RecipeFilterAssign filters={customFilters} recipe={selected} onChange={onFiltersChange} />}
            </div>
          }
          onClose={() => setSelected(null)}
        />
      )}

      {showFilters && (
        <RecipeFilterSheet
          recipes={searched}
          selection={activeSelection}
          onChange={setSelection}
          resultCount={visible.length}
          customFilters={customFilters}
          overrides={overrides}
          onClose={() => setShowFilters(false)}
        />
      )}

      {showAdd && (
        <AddRecipeSheet
          onPick={(way) => {
            setShowAdd(false);
            if (way === 'chefkoch') {
              setChefkochQuery('');
              setShowChefkoch(true);
            } else if (way === 'ai') setShowAi(true);
            else setShowImport(true);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showImport && (
        <RecipeImportModal
          onSaved={async (_favorites, name) => {
            setShowImport(false);
            const next = await getRecipeCatalog();
            setCatalog(next);
            setSelected(next.recipes.find((r) => r.name === name) ?? null);
            onRecipesChanged?.();
            flash(`„${name}“ ist jetzt in der Sammlung.`);
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showChefkoch && (
        <ChefkochSearchModal
          existingNames={new Set((catalog?.recipes ?? []).map((r) => r.name))}
          initialQuery={chefkochQuery}
          onSaved={async (_name, favorite) => {
            // Fenster bleibt offen – nur die Sammlung im Hintergrund aktualisieren
            setCatalog(await getRecipeCatalog());
            if (favorite) onRecipesChanged?.();
          }}
          onClose={() => setShowChefkoch(false)}
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
          onChefkoch={(wish) => {
            setShowAi(false);
            setChefkochQuery(wishToQuery(wish));
            setShowChefkoch(true);
          }}
        />
      )}

      {editing && (
        <RecipeEditModal
          recipe={editing}
          canReset={editing.edited}
          onSave={async (draft) => applyEdit(await saveRecipeEdit(editing.name, draft))}
          onReset={async () => applyEdit(await resetRecipeEdit(editing.name))}
          onMoveToDessert={async (d) => {
            const r = await moveRecipeToDessert(editing.name, d);
            setCatalog(r.catalog);
            setEditing(null);
            setSelected(null);
            onRecipesChanged?.();
            flash(`„${d.name}“ ist jetzt bei den Nachtischen.`);
          }}
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
        <HideMealDialog
          name={hideCandidate.name}
          ingredients={hideCandidate.ingredients}
          effect="wird nicht mehr vorgeschlagen."
          undoHint="Unten unter „Ausgeblendete Gerichte“ kannst du es wieder einblenden oder endgültig löschen."
          familyDislikes={familyDislikes}
          onFamilyNo={onFamilyDislike}
          onHide={async () => {
            setCatalog(await setRecipeHidden(hideCandidate.name, true));
            flash(`„${hideCandidate.name}“ ist ausgeblendet.`);
          }}
          onClose={() => setHideCandidate(null)}
        />
      )}

      {notice && (
        <div
          role="status"
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-6 inset-x-4 z-40 max-w-md mx-auto px-4 py-3 rounded-2xl bg-gray-800 text-white text-sm shadow-lg"
        >
          {notice}
        </div>
      )}
    </>
  );
}
