import { useRef, useState } from 'react';
import { X, Search, Loader2, Star, Clock, ChefHat, ArrowLeft, ExternalLink, ShieldAlert, Check } from 'lucide-react';
import { DessertCategory, MealType } from '../types';
import { DESSERT_CATEGORIES, guessDessertCategory } from '../lib/desserts';
import {
  ChefkochCursor,
  ChefkochDetails,
  ChefkochFilters,
  ChefkochHit,
  previewChefkoch,
  saveCustomDessert,
  saveImportedRecipe,
  searchChefkoch,
} from '../lib/api';
import { useDialog } from '../lib/useDialog';

interface ChefkochSearchModalProps {
  /** Hauptgerichte (Standard) oder Nachtische: Filter „Dessert“, Zutaten in Originalmenge, Kategorie statt Art */
  mode?: 'main' | 'dessert';
  /** Namen, die schon in der Sammlung sind */
  existingNames: Set<string>;
  /** Rezept übernommen – das Fenster bleibt offen (weitere Rezepte übernehmen) */
  onSaved: (name: string, favorite: boolean) => void;
  onClose: () => void;
}

const TYPES: { id: MealType; label: string }[] = [
  { id: 'vegetarisch', label: 'Vegetarisch' },
  { id: 'fleisch', label: 'Fleisch/Fisch' },
  { id: 'wochenende', label: 'Wochenende' },
];

type ChipId = 'main' | 'dessert' | 'vegetarian' | 'vegan' | 'quick' | 'topRated' | 'best';
const CHIPS: { id: ChipId; label: string }[] = [
  { id: 'main', label: 'Hauptspeise' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'vegetarian', label: 'Vegetarisch' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'quick', label: 'Bis 30 Min' },
  { id: 'topRated', label: 'Ab 4 ★' },
  { id: 'best', label: 'Beste zuerst' },
];

const formatRating = (r: number) =>
  r.toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/** Rezepte bei Chefkoch suchen, ansehen und in die eigene Sammlung übernehmen */
export default function ChefkochSearchModal({ mode = 'main', existingNames, onSaved, onClose }: ChefkochSearchModalProps) {
  const isDessert = mode === 'dessert';
  const chipList = CHIPS.filter((c) => (isDessert ? c.id !== 'main' && c.id !== 'vegetarian' : c.id !== 'dessert'));
  const [query, setQuery] = useState('');
  const [chips, setChips] = useState<Set<ChipId>>(new Set([isDessert ? 'dessert' : 'main']));
  const [hits, setHits] = useState<ChefkochHit[] | null>(null);
  /** Weiter bei … (null = keine weiteren Treffer); gilt für die Suche in `searched` */
  const [next, setNext] = useState<ChefkochCursor | null>(null);
  const [searched, setSearched] = useState<{
    query: string;
    filters: ChefkochFilters;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChefkochDetails | null>(null);
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const [type, setType] = useState<MealType>('vegetarisch');
  const [favorite, setFavorite] = useState(false);
  const [category, setCategory] = useState<DessertCategory>('creme');
  /** Name zum Speichern – lässt sich vor dem Übernehmen ändern */
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** In dieser Sitzung übernommene Rezepte (Markierung in der Trefferliste) */
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);

  /** Zurück zur Trefferliste, an dieselbe Stelle */
  const backToList = () => {
    setDetail(null);
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listScroll.current }));
  };
  const dialogRef = useDialog(() => !saving && (detail ? backToList() : onClose()));
  const imgFailed = (url: string) => setBrokenImages((prev) => new Set(prev).add(url));

  const toggle = (id: ChipId) =>
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filters = (): ChefkochFilters => ({
    main: chips.has('main'),
    dessert: chips.has('dessert'),
    vegetarian: chips.has('vegetarian'),
    vegan: chips.has('vegan'),
    maxMinutes: chips.has('quick') ? 30 : null,
    topRated: chips.has('topRated'),
    sort: chips.has('best') ? 'rating' : 'relevance',
  });

  const search = async () => {
    if (query.trim().length < 2 || searching) return;
    setSearching(true);
    setError(null);
    try {
      const q = { query: query.trim(), filters: filters() };
      const r = await searchChefkoch(q.query, q.filters);
      setHits(r.hits);
      setNext(r.next);
      setSearched(q);
      listRef.current?.scrollTo({ top: 0 });
    } catch (e) {
      setHits(null);
      setNext(null);
      setError((e as Error).message || 'Die Suche hat nicht geklappt.');
    } finally {
      setSearching(false);
    }
  };

  /** Nächste Treffer derselben Suche anhängen (ohne Doppelte); leere Seiten werden übersprungen */
  const loadMore = async () => {
    if (!searched || !next || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      let cursor: ChefkochCursor | null = next;
      let added: ChefkochHit[] = [];
      for (let tries = 0; cursor && added.length === 0 && tries < 3; tries++) {
        const r = await searchChefkoch(searched.query, searched.filters, cursor);
        const known = new Set((hits ?? []).map((h) => h.url));
        added = r.hits.filter((h) => !known.has(h.url));
        cursor = r.next;
      }
      setHits((prev) => [...(prev ?? []), ...added]);
      setNext(added.length ? cursor : null);
    } catch (e) {
      setError((e as Error).message || 'Weitere Rezepte konnten nicht geladen werden.');
    } finally {
      setLoadingMore(false);
    }
  };

  const open = async (hit: ChefkochHit) => {
    setLoadingUrl(hit.url);
    setError(null);
    setNotice(null);
    listScroll.current = listRef.current?.scrollTop ?? 0;
    try {
      const d = await previewChefkoch(hit.url);
      setDetail(d);
      setName(d.recipe.name);
      setType(d.recipe.type);
      setCategory(guessDessertCategory(`${d.recipe.name} ${d.tags.join(' ')}`));
      setFavorite(false);
    } catch (e) {
      setError((e as Error).message || 'Das Rezept konnte nicht geladen werden.');
    } finally {
      setLoadingUrl(null);
    }
  };

  const save = async () => {
    if (!detail || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = detail.recipe;
      const finalName = name.trim() || r.name;
      if (isDessert) {
        await saveCustomDessert({
          name: finalName,
          category,
          yield: detail.yieldText ?? '4 Portionen',
          durationMin: r.durationMin ?? null,
          ingredients: detail.originalIngredients.length ? detail.originalIngredients : r.ingredients,
          instructions: r.instructions,
          sourceUrl: r.sourceUrl,
          imageUrl: detail.imageUrl,
        });
      } else {
        await saveImportedRecipe(
          {
            name: finalName,
            type,
            ingredients: r.ingredients,
            instructions: r.instructions,
            durationMin: r.durationMin,
            sourceUrl: r.sourceUrl,
            imageUrl: detail.imageUrl,
          },
          favorite
        );
      }
      onSaved(finalName, favorite);
      setTaken((prev) => new Set(prev).add(r.name).add(finalName));
      setNotice(`„${finalName}“ ist jetzt ${isDessert ? 'bei deinen Nachtischen' : 'in deinen Rezepten'}.`);
      backToList();
    } catch (e) {
      setError((e as Error).message || 'Das Rezept konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const steps = detail ? detail.recipe.instructions.split('\n').filter(Boolean) : [];
  const already = detail ? existingNames.has(name.trim() || detail.recipe.name) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/40" onClick={() => !saving && (detail ? backToList() : onClose())} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chefkoch-title"
        tabIndex={-1}
        className="outline-none relative w-full sm:max-w-lg max-h-[92vh] bg-gray-50 rounded-t-3xl sm:rounded-3xl shadow-xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          {detail ? (
            <button
              onClick={backToList}
              aria-label="Zurück zur Trefferliste"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <ChefHat size={18} className="text-brand-700 ml-1" aria-hidden="true" />
          )}
          <h2 id="chefkoch-title" className="flex-1 text-lg font-bold text-gray-900 truncate">
            {detail ? detail.recipe.name : isDessert ? 'Nachtisch bei Chefkoch suchen' : 'Bei Chefkoch suchen'}
          </h2>
          {!detail && (
            <button
              onClick={onClose}
              aria-label="Schließen"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {!detail && (
          <div className="px-4 pb-3 space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
              className="flex gap-2"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder={isDessert ? 'z. B. Tiramisu, Apfelkuchen, Mousse' : 'z. B. Kürbis, Lasagne, Curry'}
                aria-label="Suchbegriff"
                autoFocus
                className="flex-1 h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <button
                type="submit"
                disabled={query.trim().length < 2 || searching}
                aria-label="Suchen"
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-brand-700 text-white disabled:bg-gray-200 disabled:text-gray-500"
              >
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </form>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
              {chipList.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={chips.has(c.id)}
                  onClick={() => toggle(c.id)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold border ${
                    chips.has(c.id) ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mx-4 mb-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && !detail && (
          <p role="status" className="mx-4 mb-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-50 text-sm text-brand-900">
            <Check size={14} aria-hidden="true" /> {notice}
          </p>
        )}

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-5">
          {detail ? (
            <div className="space-y-4">
              {detail.imageUrl && !brokenImages.has(detail.imageUrl) && (
                <img
                  src={detail.imageUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => imgFailed(detail.imageUrl!)}
                  className="w-full aspect-[3/2] object-cover rounded-2xl bg-gray-100"
                />
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                {detail.rating != null && (
                  <span className="inline-flex items-center gap-1">
                    <Star size={14} className="text-amber-500 fill-amber-500" aria-hidden="true" />
                    {formatRating(detail.rating)}
                    {detail.ratingCount ? ` (${detail.ratingCount})` : ''}
                  </span>
                )}
                {detail.recipe.durationMin && (
                  <span className="inline-flex items-center gap-1">
                    <Clock size={14} aria-hidden="true" /> {detail.recipe.durationMin} Min
                  </span>
                )}
                <a
                  href={detail.recipe.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800"
                >
                  Bei Chefkoch ansehen <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>

              <label className="block">
                <span className="block text-sm font-bold text-gray-900 mb-1">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </label>
              {detail.unsuitable && (
                <p className="flex gap-2 p-3 rounded-xl bg-amber-50 text-sm text-amber-900">
                  <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                  Passt nicht zu euren Gesundheitseinstellungen (z. B. Allergie oder vegetarisch). Du kannst es übernehmen, geplant wird es
                  aber nie automatisch.
                </p>
              )}
              {already && (
                <p className="p-3 rounded-xl bg-brand-50 text-sm text-brand-900">
                  Ein Rezept mit diesem Namen ist schon in deiner Sammlung – Übernehmen ersetzt es.
                </p>
              )}

              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">
                  Zutaten{' '}
                  <span className="font-normal text-gray-500">
                    · {isDessert ? (detail.yieldText ?? 'wie im Rezept') : 'für 4 Portionen'}
                  </span>
                </h3>
                {!isDessert && detail.recipe.sourcePortions && detail.recipe.sourcePortions !== 4 && (
                  <p className="text-xs text-gray-500 mb-1">Umgerechnet vom Originalrezept für {detail.recipe.sourcePortions} Portionen.</p>
                )}
                <ul className="text-sm text-gray-800 space-y-0.5 list-disc pl-5">
                  {(isDessert && detail.originalIngredients.length ? detail.originalIngredients : detail.recipe.ingredients).map((i, n) => (
                    <li key={n}>{i}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Zubereitung</h3>
                <ol className="text-sm text-gray-800 space-y-1.5 list-decimal pl-5">
                  {steps.map((s, n) => (
                    <li key={n}>{s}</li>
                  ))}
                </ol>
              </div>

              {isDessert ? (
                <div>
                  <span className="block text-sm font-bold text-gray-900 mb-1">Kategorie</span>
                  <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Kategorie">
                    {DESSERT_CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        role="radio"
                        aria-checked={category === c.id}
                        onClick={() => setCategory(c.id)}
                        className={`h-9 rounded-lg text-xs font-semibold border ${
                          category === c.id ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-700'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <span className="block text-sm font-bold text-gray-900 mb-1">Einordnen als</span>
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Einordnen als">
                      {TYPES.map((t) => (
                        <button
                          key={t.id}
                          role="radio"
                          aria-checked={type === t.id}
                          onClick={() => setType(t.id)}
                          className={`h-9 rounded-lg text-xs font-semibold border ${
                            type === t.id ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-700'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={favorite}
                      onChange={(e) => setFavorite(e.target.checked)}
                      className="w-5 h-5 accent-brand-700"
                    />
                    Als Favorit merken (wird beim Planen bevorzugt)
                  </label>
                </>
              )}
              <p className="text-xs text-gray-500">Rezept und Foto: chefkoch.de – der Link zum Original wird mitgespeichert.</p>
            </div>
          ) : searching ? (
            <div className="py-10 flex justify-center" role="status" aria-label="Suche läuft">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : hits === null ? (
            <p className="py-6 text-sm text-gray-500 text-center">
              Suchbegriff eingeben – die Treffer kannst du ansehen und in deine Rezepte übernehmen.
            </p>
          ) : hits.length === 0 ? (
            <p className="py-6 text-sm text-gray-500 text-center">Keine Rezepte gefunden. Vielleicht einen Filter abschalten?</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {hits.map((h) => (
                <li key={h.url}>
                  <button
                    onClick={() => open(h)}
                    disabled={loadingUrl !== null}
                    className="w-full text-left rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center">
                      {h.imageUrl && !brokenImages.has(h.imageUrl) ? (
                        <img
                          src={h.imageUrl}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() => imgFailed(h.imageUrl!)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ChefHat size={22} className="text-gray-300" aria-hidden="true" />
                      )}
                      {loadingUrl === h.url && (
                        <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                          <Loader2 size={20} className="animate-spin text-brand-700" />
                        </span>
                      )}
                      {(existingNames.has(h.name) || taken.has(h.name)) && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/95 text-[10px] font-semibold text-brand-800">
                          <Check size={10} aria-hidden="true" /> schon da
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{h.name}</p>
                      <p className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
                        {h.rating != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star size={11} className="text-amber-500 fill-amber-500" aria-hidden="true" />
                            {formatRating(h.rating)}
                          </span>
                        )}
                        {h.durationMin != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock size={11} aria-hidden="true" />
                            {h.durationMin} Min
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!detail && !searching && hits && hits.length > 0 && (
            <div className="pt-4 flex flex-col items-center gap-1">
              {next ? (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="h-10 px-5 flex items-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-brand-800 hover:bg-brand-50"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? 'Lädt …' : 'Mehr laden'}
                </button>
              ) : (
                <p className="text-xs text-gray-500">Keine weiteren Treffer.</p>
              )}
              <p className="text-[11px] text-gray-500">{hits.length} Rezepte geladen</p>
            </div>
          )}
        </div>

        {detail && (
          <div className="px-4 py-3 border-t border-gray-200 bg-white">
            <button
              onClick={save}
              disabled={saving}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-brand-700 text-white text-sm font-semibold hover:bg-brand-800 disabled:bg-brand-300"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {isDessert ? 'Zu meinen Nachtischen' : 'In meine Rezepte übernehmen'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
