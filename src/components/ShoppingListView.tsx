import { useState, useEffect, useCallback } from 'react';
import { Plus, Package, X, Tag } from 'lucide-react';
import {
  ShoppingItem,
  ShoppingLabel,
  DEFAULT_LABELS,
  LABEL_COLORS,
  BASICS_ITEMS,
} from '../types';
import { buildAmazonCartUrl } from '../lib/amazon';
import ShoppingSection from './ShoppingSection';
import AmazonPreviewModal from './AmazonPreviewModal';

interface ShoppingListViewProps {
  knuspr: string[];
  metzger: string[];
  weekKey: string;
}

// --- localStorage persistence ---

interface PersistedState {
  items: ShoppingItem[];
  labels: ShoppingLabel[];
  hiddenBasics: string[];
}

function getStorageKey(weekKey: string) {
  return `shopping-v2-${weekKey}`;
}

function loadState(weekKey: string, knuspr: string[], metzger: string[]): {
  items: ShoppingItem[];
  labels: ShoppingLabel[];
  hiddenBasics: string[];
} {
  try {
    const raw = localStorage.getItem(getStorageKey(weekKey));
    if (raw) {
      const saved: PersistedState = JSON.parse(raw);
      // Merge in any new items from the meal plan that aren't saved yet
      const existingNames = new Set(saved.items.map((i) => i.name));
      const newItems: ShoppingItem[] = [];

      knuspr.forEach((name, idx) => {
        if (!existingNames.has(name)) {
          newItems.push({ id: `knuspr-${weekKey}-${idx}`, name, checked: false, label: 'knuspr' });
        }
      });
      metzger.forEach((name, idx) => {
        if (!existingNames.has(name)) {
          newItems.push({ id: `metzger-${weekKey}-${idx}`, name, checked: false, label: 'metzger' });
        }
      });

      return {
        items: [...saved.items, ...newItems],
        labels: saved.labels,
        hiddenBasics: saved.hiddenBasics,
      };
    }
  } catch {
    // fall through
  }

  // Fresh state
  const items: ShoppingItem[] = [];
  knuspr.forEach((name, idx) => {
    items.push({ id: `knuspr-${weekKey}-${idx}`, name, checked: false, label: 'knuspr' });
  });
  metzger.forEach((name, idx) => {
    items.push({ id: `metzger-${weekKey}-${idx}`, name, checked: false, label: 'metzger' });
  });

  return { items, labels: [...DEFAULT_LABELS], hiddenBasics: [...BASICS_ITEMS] };
}

function saveState(weekKey: string, items: ShoppingItem[], labels: ShoppingLabel[], hiddenBasics: string[]) {
  try {
    const data: PersistedState = { items, labels, hiddenBasics };
    localStorage.setItem(getStorageKey(weekKey), JSON.stringify(data));
  } catch {
    // localStorage unavailable
  }
}

// --- ASIN persistence (separate key) ---

interface SavedAsin { asin: string; productName: string; }

function getAsinKey(weekKey: string) { return `amazon-asins-${weekKey}`; }

function loadAsins(weekKey: string): Record<string, SavedAsin> {
  try {
    const raw = localStorage.getItem(getAsinKey(weekKey));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAsin(weekKey: string, name: string, asin: string, productName: string) {
  try {
    const saved = loadAsins(weekKey);
    saved[name] = { asin, productName };
    localStorage.setItem(getAsinKey(weekKey), JSON.stringify(saved));
  } catch { /* ignore */ }
}

// --- Component ---

export default function ShoppingListView({ knuspr, metzger, weekKey }: ShoppingListViewProps) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [labels, setLabels] = useState<ShoppingLabel[]>([...DEFAULT_LABELS]);
  const [hiddenBasics, setHiddenBasics] = useState<string[]>([...BASICS_ITEMS]);
  const [showBasics, setShowBasics] = useState(false);
  const [basicPickerTarget, setBasicPickerTarget] = useState<string | null>(null);
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[2]);
  const [amazonModalItem, setAmazonModalItem] = useState<ShoppingItem | null>(null);

  // Load persisted state on week change
  useEffect(() => {
    const state = loadState(weekKey, knuspr, metzger);
    // Restore ASINs
    const asins = loadAsins(weekKey);
    const restored = state.items.map((item) => {
      const a = asins[item.name];
      return a ? { ...item, asin: a.asin, productName: a.productName } : item;
    });
    setItems(restored);
    setLabels(state.labels);
    setHiddenBasics(state.hiddenBasics);
  }, [weekKey, knuspr, metzger]);

  // Persist on change
  useEffect(() => {
    if (items.length > 0) {
      saveState(weekKey, items, labels, hiddenBasics);
    }
  }, [items, labels, hiddenBasics, weekKey]);

  const toggleItem = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }, []);

  const changeLabel = useCallback((itemId: string, newLabelId: string) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, label: newLabelId } : i)));
  }, []);

  const addLabel = useCallback(() => {
    if (!newLabelName.trim()) return;
    const id = newLabelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (labels.some((l) => l.id === id)) return;
    setLabels((prev) => [...prev, { id, name: newLabelName.trim(), color: newLabelColor }]);
    setNewLabelName('');
    setShowAddLabel(false);
  }, [newLabelName, newLabelColor, labels]);

  const removeLabel = useCallback((labelId: string) => {
    // Move all items from this label back to Knuspr
    setItems((prev) =>
      prev.map((i) => (i.label === labelId ? { ...i, label: 'knuspr' } : i))
    );
    setLabels((prev) => prev.filter((l) => l.id !== labelId));
  }, []);

  const addBasicToItems = useCallback((basicName: string, targetLabel: string) => {
    const id = `basic-${weekKey}-${basicName}`;
    if (items.some((i) => i.id === id)) return;
    setItems((prev) => [...prev, { id, name: basicName, checked: false, label: targetLabel, isBasic: true }]);
    setHiddenBasics((prev) => prev.filter((b) => b !== basicName));
  }, [weekKey, items]);

  const moveBasicBack = useCallback((itemId: string, itemName: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setHiddenBasics((prev) => {
      if (!prev.includes(itemName)) return [...prev, itemName];
      return prev;
    });
  }, []);

  // Amazon handlers
  const handleIngredientClick = useCallback((item: ShoppingItem) => {
    setAmazonModalItem(item);
  }, []);

  const handleAmazonSelect = useCallback((asin: string, productName: string) => {
    if (!amazonModalItem) return;
    setItems((prev) =>
      prev.map((i) => (i.id === amazonModalItem.id ? { ...i, asin, productName } : i))
    );
    saveAsin(weekKey, amazonModalItem.name, asin, productName);
    setAmazonModalItem(null);
  }, [amazonModalItem, weekKey]);

  const handleAddToCart = useCallback((labelId: string) => {
    const asins = items.filter((i) => i.label === labelId && i.asin).map((i) => i.asin!);
    if (asins.length === 0) return;
    window.open(buildAmazonCartUrl(asins), '_blank');
  }, [items]);

  // Group items by label
  const itemsByLabel = labels.reduce<Record<string, ShoppingItem[]>>((acc, label) => {
    acc[label.id] = items.filter((i) => i.label === label.id);
    return acc;
  }, {});

  return (
    <>
      <div className="px-4 py-4 space-y-4">
        {/* Label sections */}
        {labels.map((label) => (
          <ShoppingSection
            key={label.id}
            label={label}
            items={itemsByLabel[label.id] || []}
            allLabels={labels}
            onToggle={(id) => {
              const item = items.find((i) => i.id === id);
              if (item?.isBasic && item.checked) {
                moveBasicBack(id, item.name);
              } else {
                toggleItem(id);
              }
            }}
            onLabelChange={changeLabel}
            onIngredientClick={handleIngredientClick}
            onAddToCart={() => handleAddToCart(label.id)}
            showCopyButton
            showAmazon
          />
        ))}

        {/* Add custom label */}
        {showAddLabel ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">Neues Label</span>
              <button
                onClick={() => setShowAddLabel(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                placeholder="z.B. Aldi, Rewe, DM..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewLabelColor(color)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      newLabelColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                onClick={addLabel}
                disabled={!newLabelName.trim()}
                className="w-full py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
              >
                Label hinzufuegen
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddLabel(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
          >
            <Plus size={16} />
            Label hinzufuegen
          </button>
        )}

        {/* Manage labels */}
        {labels.length > DEFAULT_LABELS.length && (
          <div className="flex flex-wrap gap-2 px-1">
            {labels.filter((l) => !DEFAULT_LABELS.some((d) => d.id === l.id)).map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
                <button
                  onClick={() => removeLabel(l.id)}
                  className="w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Basics section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowBasics(!showBasics)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-50"
          >
            <div className="flex items-center gap-2">
              <Package size={15} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-600">Basics & Vorrat</span>
              {hiddenBasics.length > 0 && (
                <span className="bg-gray-100 text-gray-400 text-xs font-medium px-2 py-0.5 rounded-full">
                  {hiddenBasics.length}
                </span>
              )}
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showBasics ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showBasics && (
            <div className="px-4 py-3">
              <p className="text-xs text-gray-400 mb-3">
                Klicke auf ein Basic, um es einer Einkaufsliste hinzuzufuegen.
              </p>
              {labels.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {labels.map((l) => (
                    <span
                      key={l.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-50 text-gray-500"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 relative">
                {hiddenBasics.map((basic) => (
                  <div key={basic} className="relative">
                    <button
                      onClick={() => setBasicPickerTarget(basicPickerTarget === basic ? null : basic)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:scale-95 transition-all"
                    >
                      + {basic}
                    </button>
                    {basicPickerTarget === basic && (
                      <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                        {labels.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => {
                              addBasicToItems(basic, l.id);
                              setBasicPickerTarget(null);
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
                ))}
                {hiddenBasics.length === 0 && (
                  <p className="text-xs text-gray-400">Alle Basics sind bereits auf einer Liste.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {amazonModalItem && (
        <AmazonPreviewModal
          ingredientName={amazonModalItem.name}
          onSelect={handleAmazonSelect}
          onClose={() => setAmazonModalItem(null)}
        />
      )}
    </>
  );
}
