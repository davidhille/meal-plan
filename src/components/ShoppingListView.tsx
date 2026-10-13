import { useState, useEffect, useCallback } from 'react';
import { Plus, Package, X, Loader2, ShoppingCart, FileDown } from 'lucide-react';
import { MealPlan, ProductLink, ShopProvider, ShopRule, PlanMeal, ShoppingItem, ShoppingLabel, DEFAULT_LABELS, BASICS_ITEMS, ProductResult } from '../types';
import { PlanWeek, currentWeekIndex, formatShortDate, toIso } from '../lib/dateUtils';
import ShoppingRangePicker from './ShoppingRangePicker';
import { packagesNeeded, parseEuro } from '../lib/unitPrice';
import {
  getShopping,
  updateShoppingItem,
  addShoppingItem,
  removeShoppingItem,
  saveProductLink,
  removeProductLink,
  getShopCart,
  refreshShopPrices,
  setShopCartQuantity,
  clearShopCart,
  addToShopCart,
  type WeekRange,
  type CartSummary,
  addToPantry,
  removeFromPantry,
} from '../lib/api';
import ShoppingSection from './ShoppingSection';
import { buildShoppingPdf, downloadPdf, pdfFileName, type PdfList } from '../lib/shoppingPdf';
import ProductSearchModal from './ProductSearchModal';
import CartPreviewSheet from './CartPreviewSheet';
import CartBar from './CartBar';

interface ShoppingListViewProps {
  plan: MealPlan | null;
  /** Kalenderwochen des Plans – bei mehreren wählt man, für welche eingekauft wird */
  weeks: PlanWeek[];
  planMeals: PlanMeal[];
  onCreatePlan: () => void;
}

const lc = (s: string) => s.trim().toLowerCase();

/** Gemeinsame Liste für alle Lieferdienste – der Shop wird pro Artikel gewählt */
const DELIVERY_LABEL: ShoppingLabel = { id: 'lieferdienst', name: 'Lieferdienst', color: '#6B2E7A' };

/** Gewählte Wochen pro Plan merken (Indizes in `weeks`) */
function loadRange(planId: string | undefined, weeks: PlanWeek[]): [number, number] {
  const now = currentWeekIndex(weeks);
  try {
    const saved = planId ? JSON.parse(localStorage.getItem(`einkauf-${planId}`) || 'null') : null;
    if (Array.isArray(saved)) {
      const s = weeks.findIndex((w) => w.key === saved[0]);
      const e = weeks.findIndex((w) => w.key === saved[1]);
      // Vergangene Wochen nicht als Vorauswahl behalten
      if (s >= 0 && e >= s && e >= now) return [Math.max(s, now), e];
    }
  } catch {
    // ohne gespeicherte Auswahl starten
  }
  return [now, now];
}

export default function ShoppingListView({ plan, weeks, planMeals, onCreatePlan }: ShoppingListViewProps) {
  const [[startIdx, endIdx], setRange] = useState<[number, number]>(() => loadRange(plan?.id, weeks));
  const multiWeek = weeks.length > 1;
  const week: WeekRange | undefined =
    multiWeek && weeks[startIdx] && weeks[endIdx] ? { from: weeks[startIdx].weekStart, to: weeks[endIdx].weekEnd } : undefined;
  const changeRange = (s: number, e: number) => {
    setRange([s, e]);
    try {
      if (plan) localStorage.setItem(`einkauf-${plan.id}`, JSON.stringify([weeks[s].key, weeks[e].key]));
    } catch {
      // Auswahl gilt dann nur bis zum Neuladen
    }
  };
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [labels, setLabels] = useState<ShoppingLabel[]>([...DEFAULT_LABELS]);
  const [pantryNeeded, setPantryNeeded] = useState<string[]>([]);
  const [customPantry, setCustomPantry] = useState<string[]>([]);
  const [newPantryName, setNewPantryName] = useState('');
  const [showBasics, setShowBasics] = useState(false);
  const [basicPickerTarget, setBasicPickerTarget] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [productItem, setProductItem] = useState<ShoppingItem | null>(null);
  /** Für welchen Shop der Produkt-Dialog geöffnet wurde (nach der Auswahl dort bestellen) */
  const [productTarget, setProductTarget] = useState<ShopProvider | null>(null);
  // Warenkörbe: fehlt = lädt noch, null = nicht lesbar
  const [carts, setCarts] = useState<Partial<Record<ShopProvider, CartSummary | null>>>({});
  const [shopRules, setShopRules] = useState<Partial<Record<ShopProvider, ShopRule>>>({});
  const [cartLoading, setCartLoading] = useState<Partial<Record<ShopProvider, boolean>>>({});
  const [cartPreview, setCartPreview] = useState<ShopProvider | null>(null);
  const [standardLabel, setStandardLabel] = useState('knuspr');

  const planId = plan?.id;

  const load = useCallback(async () => {
    if (!planId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await getShopping(planId, week);
    if (data) {
      setItems(data.items);
      setLabels(data.labels);
      setPantryNeeded(data.pantryNeeded);
      setCustomPantry(data.customPantry);
      setStandardLabel(data.standardLabel);
      if (data.shopRules) setShopRules(data.shopRules);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, week?.from, week?.to]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Artikel ---

  const patchLocal = (id: string, change: Partial<ShoppingItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...change } : i)));

  const toggleItem = async (id: string) => {
    if (!planId) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    // Abgehakte Basics wandern zurück in den Vorrat
    if (item.isBasic && !item.checked) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      await removeShoppingItem(planId, id);
      return;
    }
    patchLocal(id, { checked: !item.checked });
    const ok = await updateShoppingItem(planId, item, { checked: !item.checked });
    if (!ok) patchLocal(id, { checked: item.checked });
  };

  const changeLabel = async (id: string, label: string) => {
    if (!planId) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    patchLocal(id, { label });
    const ok = await updateShoppingItem(planId, item, { label });
    if (!ok) patchLocal(id, { label: item.label });
  };

  const addItem = async (name: string, label: string, isBasic = false) => {
    if (!planId || !name.trim()) return;
    const data = await addShoppingItem(planId, name.trim(), label, isBasic, week);
    if (data) setItems(data.items);
  };

  const removeItem = async (item: ShoppingItem) => {
    if (!planId) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await removeShoppingItem(planId, item.id);
  };

  // --- Vorrat ---

  const moveToPantry = async (item: ShoppingItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (await addToPantry(item.baseName)) await load();
  };

  const takeFromPantry = async (name: string) => {
    setCustomPantry((prev) => prev.filter((n) => n !== name));
    if (await removeFromPantry(name)) await load();
  };

  // --- Shops ---

  // Verbundene Shops für den Produkt-Dialog (Preisvergleich nebeneinander)
  const productShops = labels
    .filter((l): l is ShoppingLabel & { provider: ShopProvider } => l.provider === 'knuspr' || l.provider === 'picnic')
    .map((l) => ({ provider: l.provider, label: l }));

  /** Verknüpfung in allen Einträgen mit derselben Zutat aktualisieren (null = gelöst) */
  const applyLink = (baseName: string, provider: ShopProvider, link: ProductLink | null) => {
    const base = lc(baseName);
    const update = (i: ShoppingItem): ShoppingItem => {
      if (lc(i.baseName) !== base) return i;
      const links = { ...(i.links ?? {}) };
      if (link) links[provider] = link;
      else delete links[provider];
      const labelProvider = labels.find((l) => l.id === i.label)?.provider;
      const own =
        labelProvider === provider
          ? link
            ? { productId: link.productId, productName: link.productName, productImage: link.productImage, productPrice: link.productPrice, productAmount: link.productAmount }
            : { productId: undefined, productName: undefined, productImage: undefined, productPrice: undefined, productAmount: undefined }
          : {};
      return { ...i, ...own, links };
    };
    setItems((prev) => prev.map(update));
    setProductItem((prev) => (prev ? update(prev) : prev));
  };

  const handleProductSelect = async (provider: ShopProvider, product: ProductResult) => {
    if (!productItem) return;
    if (!(await saveProductLink(productItem.baseName, provider, product))) throw new Error('Die Auswahl konnte nicht gespeichert werden.');
    applyLink(productItem.baseName, provider, {
      productId: product.productId,
      productName: product.name,
      productImage: product.imageUrl,
      productPrice: parseEuro(product.price) ?? undefined,
      productAmount: product.amount,
    });
    // Über den Shop-Knopf geöffnet: Artikel gleich diesem Shop zuordnen
    const shopLabel = productShops.find((s) => s.provider === provider)?.label;
    if (provider === productTarget && shopLabel && productItem.label !== shopLabel.id) {
      patchLocal(productItem.id, {
        productId: product.productId,
        productName: product.name,
        productImage: product.imageUrl,
        productPrice: parseEuro(product.price) ?? undefined,
        productAmount: product.amount,
      });
      await changeLabel(productItem.id, shopLabel.id);
      setProductItem((prev) => (prev ? { ...prev, label: shopLabel.id } : prev));
    }
    // Mit nur einem Shop gleich schließen, sonst offen lassen (zweiten Shop verknüpfen)
    if (productShops.length < 2) setProductItem(null);
  };

  const handleProductRemove = async (provider: ShopProvider) => {
    if (!productItem) return;
    await removeProductLink(productItem.baseName, provider);
    applyLink(productItem.baseName, provider, null);
  };

  const shopName = (p: ShopProvider) => productShops.find((s) => s.provider === p)?.label.name ?? p;
  const shopError = (p: ShopProvider, e: unknown) =>
    new Error(
      (e as Error).message === 'not_connected'
        ? `${shopName(p)} ist nicht verbunden – bitte in den Einstellungen verbinden.`
        : (e as Error).message
    );

  const refreshCart = async (p: ShopProvider) => {
    setCartLoading((prev) => ({ ...prev, [p]: true }));
    try {
      const c = await getShopCart(p);
      setCarts((prev) => ({ ...prev, [p]: c }));
    } catch {
      setCarts((prev) => ({ ...prev, [p]: null }));
    } finally {
      setCartLoading((prev) => ({ ...prev, [p]: false }));
    }
  };

  // Warenkörbe aller verbundenen Shops laden – der aktuelle Wert soll immer zu sehen sein
  const shopKey = productShops.map((s) => s.provider).join(',');
  useEffect(() => {
    for (const { provider } of productShops) if (!(provider in carts)) refreshCart(provider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopKey]);

  const providerOfLabel = (labelId: string) => productShops.find((s) => s.label.id === labelId)?.provider;
  const inCartSets = Object.fromEntries(
    productShops.map(({ provider }) => [provider, new Set((carts[provider]?.items ?? []).map((c) => c.productId))])
  ) as Partial<Record<ShopProvider, Set<string>>>;
  const isInCart = (item: ShoppingItem) => {
    const p = providerOfLabel(item.label);
    return !!(p && item.productId && inCartSets[p]?.has(item.productId));
  };

  const setCartQuantity = (p: ShopProvider) => async (productId: string, quantity: number) => {
    try {
      const c = await setShopCartQuantity(p, productId, quantity);
      setCarts((prev) => ({ ...prev, [p]: c }));
    } catch (e) {
      await refreshCart(p);
      throw shopError(p, e);
    }
  };

  const emptyCart = (p: ShopProvider) => async () => {
    try {
      const c = await clearShopCart(p);
      setCarts((prev) => ({ ...prev, [p]: c }));
    } catch (e) {
      await refreshCart(p);
      throw shopError(p, e);
    }
  };

  const transferToCart = (p: ShopProvider) => async (wanted: { productId: string; quantity: number }[]) => {
    try {
      const result = await addToShopCart(p, wanted);
      await refreshCart(p);
      return result.failed.length
        ? `${result.added} übertragen, ${result.failed.length} fehlgeschlagen.`
        : `${result.added} ${result.added === 1 ? 'Produkt liegt' : 'Produkte liegen'} jetzt in deinem ${shopName(p)}-Warenkorb.`;
    } catch (e) {
      throw shopError(p, e);
    }
  };

  /** Artikel einem Shop zuordnen (verschiebt ihn auf dessen Liste) */
  const assignShop = (item: ShoppingItem, p: ShopProvider) => {
    const shopLabel = productShops.find((s) => s.provider === p)?.label;
    if (!shopLabel || item.label === shopLabel.id) return;
    const link = item.links?.[p];
    // Gewähltes Produkt sofort mitwechseln, damit Summen und Warenkorb-Hinweis stimmen
    patchLocal(item.id, {
      productId: link?.productId,
      productName: link?.productName,
      productImage: link?.productImage,
      productPrice: link?.productPrice,
      productAmount: link?.productAmount,
    });
    changeLabel(item.id, shopLabel.id);
  };

  const findProduct = (item: ShoppingItem, p?: ShopProvider) => {
    setProductTarget(p ?? null);
    setProductItem(item);
  };

  const refreshAll = async () => {
    const names = [...new Set(items.filter((i) => !i.checked && i.links).map((i) => i.baseName))];
    let updated = 0;
    const missing = new Set<string>();
    for (const { provider } of productShops) {
      try {
        const r = await refreshShopPrices(provider, names);
        updated += r.updated;
        r.missing.forEach((m) => missing.add(m));
      } catch {
        // Preise bleiben dann wie sie sind
      }
    }
    await Promise.all([load(), ...productShops.map(({ provider }) => refreshCart(provider))]);
    return missing.size
      ? `${updated} Preise aktualisiert, ${missing.size} Produkte nicht mehr gefunden.`
      : `Warenkörbe und ${updated} Preise aktualisiert.`;
  };

  // --- Ansicht ---

  if (!plan) {
    return (
      <div className="px-4 py-12 flex flex-col items-center text-center gap-3">
        <ShoppingCart size={32} className="text-gray-300" aria-hidden="true" />
        <p className="text-base font-semibold text-gray-800">Noch keine Einkaufsliste</p>
        <p className="text-sm text-gray-500 max-w-xs">Die Einkaufsliste entsteht automatisch aus deinem Speiseplan.</p>
        <button
          onClick={onCreatePlan}
          className="mt-3 px-6 h-11 rounded-lg text-sm font-semibold bg-brand-700 text-white hover:bg-brand-800"
        >
          Plan erstellen
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-12 flex justify-center" role="status" aria-label="Einkaufsliste wird geladen">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }

  // Grob vereinheitlichen, damit „Zwiebel“ und „Zwiebeln“ als dasselbe gelten
  const stem = (s: string) => lc(s).replace(/\(.*?\)/g, '').trim().replace(/(en|n|e|s)$/, '');
  // Alles, was schon auf einer Liste steht (aus dem Plan oder als Basic), unten nicht noch einmal anbieten
  const onList = new Set(items.filter((i) => !i.checked || i.isBasic).map((i) => stem(i.baseName)));
  const neededSet = new Set(pantryNeeded.map(lc));
  const availableBasics = [
    ...pantryNeeded.filter((b) => !BASICS_ITEMS.some((x) => lc(x) === lc(b))),
    ...BASICS_ITEMS,
  ].filter((b) => !onList.has(stem(b)));
  // Benötigte Basics zuerst
  availableBasics.sort((a, b) => Number(neededSet.has(lc(b))) - Number(neededSet.has(lc(a))));

  const shopLabelIdsForPdf = new Set(productShops.map((s) => s.label.id));
  const itemsByLabel = labels.reduce<Record<string, ShoppingItem[]>>((acc, label) => {
    acc[label.id] = items
      .filter((i) => i.label === label.id)
      .sort((a, b) => Number(a.checked) - Number(b.checked));
    return acc;
  }, {});

  // Welche Gerichte die Liste abdeckt
  const today = toIso(new Date());
  const inRange = planMeals.filter((m) => !m.rejected && (!week || (m.meal_date >= week.from && m.meal_date <= week.to)));
  const past = inRange.filter((m) => m.meal_date < today).length;
  const firstDay = inRange[0]?.meal_date;
  const lastDay = inRange[inRange.length - 1]?.meal_date;
  const summary =
    inRange.length === 0
      ? 'In diesem Zeitraum sind keine Gerichte geplant.'
      : `Zutaten für ${inRange.length} ${inRange.length === 1 ? 'Gericht' : 'Gerichte'}` +
        (firstDay && lastDay ? ` · ${formatShortDate(firstDay)} – ${formatShortDate(lastDay)}` : '') +
        (past ? ` · davon ${past} schon vorbei` : '');

  // PDF: nur Listen ohne Shop (Metzger, Aldi …), nur offene Einträge
  const pdfListFor = (label: ShoppingLabel): PdfList => ({
    name: label.name,
    color: label.color,
    items: (itemsByLabel[label.id] || []).filter((i) => !i.checked).map((i) => i.name),
  });
  const offlineLists = labels.filter((l) => !shopLabelIdsForPdf.has(l.id)).map(pdfListFor).filter((l) => l.items.length > 0);
  const savePdf = (lists: PdfList[], namePart: string) => {
    const created = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    downloadPdf(buildShoppingPdf(lists, 'Einkaufsliste', `${summary} · erstellt am ${created}`), pdfFileName(namePart, today));
  };

  // Dem Shop zugeordnet, aber noch nicht im Warenkorb – so sieht man, was die Bestellung kosten wird
  const pending = Object.fromEntries(
    productShops.map(({ provider, label }) => [
      provider,
      items
        .filter((i) => !i.checked && i.label === label.id && i.productId && i.productPrice != null && !inCartSets[provider]?.has(i.productId))
        .reduce((sum, i) => sum + i.productPrice! * packagesNeeded(i.name, i.productAmount), 0),
    ])
  ) as Partial<Record<ShopProvider, number>>;
  const shopLabelIds = new Set(productShops.map((s) => s.label.id));
  const firstShopLabel = labels.find((l) => shopLabelIds.has(l.id))?.id;
  const deliveryItems = items
    .filter((i) => shopLabelIds.has(i.label))
    .sort((a, b) => Number(a.checked) - Number(b.checked));

  return (
    <>
      <div className="px-4 py-4 space-y-4">
        {multiWeek ? (
          <ShoppingRangePicker
            weeks={weeks}
            currentIndex={currentWeekIndex(weeks)}
            start={startIdx}
            end={endIdx}
            onChange={changeRange}
            summary={summary}
          />
        ) : (
          <p className="px-1 text-xs text-gray-600">{summary}</p>
        )}

        {offlineLists.length > 0 && (
          <button
            onClick={() => savePdf(offlineLists, offlineLists.length === 1 ? offlineLists[0].name : 'Listen')}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FileDown size={15} />
            {offlineLists.length === 1 ? `${offlineLists[0].name} als PDF` : `Listen ohne Shop als PDF (${offlineLists.map((l) => l.name).join(', ')})`}
          </button>
        )}

        {/* Eigenen Artikel hinzufügen */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = newItemName;
            setNewItemName('');
            await addItem(name, standardLabel);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Artikel hinzufügen, z. B. Klopapier"
            aria-label="Eigenen Artikel hinzufügen"
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            aria-label="Hinzufügen"
            className="w-10 flex items-center justify-center rounded-xl bg-brand-700 text-white disabled:bg-gray-200 disabled:text-gray-500"
          >
            <Plus size={16} />
          </button>
        </form>

        {/* Listen je Label */}
        {labels.map((label) =>
          shopLabelIds.has(label.id) ? (
            // Alle Lieferdienste als eine Liste – an der Stelle der ersten Shop-Liste
            label.id === firstShopLabel && (
              <ShoppingSection
                key={DELIVERY_LABEL.id}
                label={DELIVERY_LABEL}
                items={deliveryItems}
                allLabels={labels}
                deliveryShops={productShops}
                onAssignShop={assignShop}
                onToggle={toggleItem}
                onLabelChange={changeLabel}
                onFindProduct={findProduct}
                isInCart={isInCart}
                onRemove={removeItem}
                onMoveToPantry={moveToPantry}
              />
            )
          ) : (
            <ShoppingSection
              key={label.id}
              label={label}
              items={itemsByLabel[label.id] || []}
              allLabels={labels}
              onToggle={toggleItem}
              onLabelChange={changeLabel}
              onRemove={removeItem}
              onMoveToPantry={moveToPantry}
              onDownloadPdf={() => savePdf([pdfListFor(label)], label.name)}
            />
          )
        )}

        <p className="px-1 text-xs text-gray-500">Eigene Listen (z. B. Aldi, DM) legst du in den Einstellungen an.</p>

        {/* Basics & Vorrat */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowBasics(!showBasics)}
            aria-expanded={showBasics}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-50"
          >
            <div className="flex items-center gap-2">
              <Package size={15} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-600">Basics & Vorrat</span>
              {pantryNeeded.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {pantryNeeded.length} im Plan
                </span>
              )}
            </div>
            <svg
              aria-hidden="true"
              className={`w-4 h-4 text-gray-500 transition-transform ${showBasics ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showBasics && (
            <div className="px-4 py-3">
              <p className="text-xs text-gray-500 mb-3">
                Vorrat steht nicht automatisch auf der Liste. Gelb markiert: wird diese Woche gebraucht. Tippen, um
                es auf eine Liste zu setzen, falls es ausgeht.
              </p>
              <div className="flex flex-wrap gap-2">
                {availableBasics.map((basic) => {
                  const needed = neededSet.has(lc(basic));
                  return (
                    <div key={basic} className="relative">
                      <button
                        onClick={() => setBasicPickerTarget(basicPickerTarget === basic ? null : basic)}
                        aria-haspopup="menu"
                        aria-expanded={basicPickerTarget === basic}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium active:scale-95 transition-all ${
                          needed
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                        }`}
                      >
                        + {basic}
                      </button>
                      {basicPickerTarget === basic && (
                        <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                          {labels.map((l) => (
                            <button
                              key={l.id}
                              onClick={async () => {
                                setBasicPickerTarget(null);
                                await addItem(basic, l.id, true);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                              {l.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {availableBasics.length === 0 && (
                  <p className="text-xs text-gray-500">Alle Basics sind bereits auf einer Liste.</p>
                )}
              </div>

              {/* Eigener Vorrat */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">Haben wir immer da</p>
                {customPantry.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {customPantry.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-amber-50 text-xs text-amber-900">
                        {name}
                        <button
                          onClick={() => takeFromPantry(name)}
                          title="Wieder auf die Einkaufsliste"
                          aria-label={`${name} wieder auf die Einkaufsliste`}
                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-amber-100"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mb-3">
                    Tippe bei einer Zutat auf das Kisten-Symbol, damit sie nicht mehr auf der Liste landet.
                  </p>
                )}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = newPantryName.trim();
                    if (!name) return;
                    setNewPantryName('');
                    if (await addToPantry(name)) await load();
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={newPantryName}
                    onChange={(e) => setNewPantryName(e.target.value)}
                    placeholder="z. B. Reis, Nudeln, Eier"
                    aria-label="Zutat, die immer da ist"
                    className="flex-1 h-9 px-3 rounded-xl border border-gray-200 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={!newPantryName.trim()}
                    className="px-3 h-9 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 disabled:text-gray-300"
                  >
                    Hinzufügen
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {productItem && productShops.length > 0 && (
        <ProductSearchModal
          item={productItem}
          shops={productShops}
          onSelect={handleProductSelect}
          onRemove={handleProductRemove}
          onClose={() => {
            setProductItem(null);
            setProductTarget(null);
          }}
        />
      )}

      {productShops.length > 0 && (
        <CartBar
          shops={productShops}
          carts={carts}
          pending={pending}
          rules={shopRules}
          onOpen={(p) => {
            setCartPreview(p);
            refreshCart(p);
          }}
          onRefresh={refreshAll}
        />
      )}

      {cartPreview && (
        <CartPreviewSheet
          shopName={shopName(cartPreview)}
          items={items.filter((i) => providerOfLabel(i.label) === cartPreview && i.productId && !i.checked)}
          cart={carts[cartPreview]?.items ?? null}
          cartTotal={carts[cartPreview]?.total ?? null}
          rule={shopRules[cartPreview]}
          cartLoading={!!cartLoading[cartPreview] || !(cartPreview in carts)}
          onTransfer={transferToCart(cartPreview)}
          onSetQuantity={setCartQuantity(cartPreview)}
          onClearCart={emptyCart(cartPreview)}
          onClose={() => setCartPreview(null)}
        />
      )}
    </>
  );
}
