import { useState } from 'react';
import { useDialog } from '../lib/useDialog';
import { X, Clock, ShoppingBasket, BookOpen, Star, ImageIcon, ImageOff, Loader2, Minus, Plus, Users, ListPlus, Pencil, ChefHat, MessageSquare } from 'lucide-react';
import { formatRatingDate, useRatings } from '../lib/ratings';
import { ImageCredit, Meal } from '../types';
import MealRatingModal from './MealRatingModal';
import ConfirmDialog from './ConfirmDialog';
import CookingMode from './CookingMode';
import { toSteps } from '../lib/cooking';
import { RECIPE_BASE_PORTIONS, scaleIngredient, formatPortions } from '../lib/portions';

interface MealModalProps {
  meal: Meal;
  /** Sterne (ohne Angabe: aus den Bewertungen der Familie) */
  currentRating?: number;
  /** Bewerten (ohne Angabe: über die Bewertungen der Familie) */
  onRate?: (rating: number, notes: string) => Promise<void>;
  /** false bei Nachtischen: keine Bewertung anzeigen oder speichern */
  allowRating?: boolean;
  onGenerateImage?: (mealName: string) => Promise<{ url: string; credit: ImageCredit | null }>;
  /** Unpassendes Bild entfernen (kommt nicht wieder); wirft bei Fehlern */
  onRemoveImage?: (mealName: string) => Promise<void>;
  /** Portionen der Familie (Standard für die Mengenanzeige) */
  defaultPortions?: number;
  /** Feste Menge statt Portionsrechner (z. B. „1 Kuchen (12 Stücke)“) */
  yieldLabel?: string;
  /** Zutaten auf die Einkaufsliste setzen; liefert die Meldung für den Nutzer */
  onAddToShopping?: () => Promise<string>;
  /** Auswahl-Button unten (z. B. Nachtisch zum Gericht hinzufügen); wirft bei Fehlern */
  onChoose?: () => Promise<void>;
  chooseLabel?: string;
  /** Stift oben rechts: Gericht bearbeiten */
  onEdit?: () => void;
  /** Neues Bild wurde erzeugt (z. B. damit die Übersicht es auch zeigt) */
  onImageChange?: (url: string, credit: ImageCredit | null) => void;
  /** Zusätzlicher Bereich unter dem Bild (z. B. Filter zuordnen) */
  extra?: React.ReactNode;
  /** Direkt im Kochmodus öffnen (z. B. aus der Heute-Karte) */
  startCooking?: boolean;
  onClose: () => void;
}

type ModalTab = 'zutaten' | 'zubereitung';


export default function MealModal({
  meal,
  currentRating: ratingProp,
  onRate: onRateProp,
  allowRating = true,
  onGenerateImage,
  onRemoveImage,
  defaultPortions = RECIPE_BASE_PORTIONS,
  yieldLabel,
  onAddToShopping,
  onChoose,
  chooseLabel = 'Auswählen',
  onEdit,
  onImageChange,
  extra,
  startCooking = false,
  onClose,
}: MealModalProps) {
  const [portions, setPortions] = useState(defaultPortions);
  const factor = yieldLabel ? 1 : portions / RECIPE_BASE_PORTIONS;
  const [adding, setAdding] = useState(false);
  const [shoppingMsg, setShoppingMsg] = useState<string | null>(null);
  const steps = toSteps(meal.instructions);

  const dialogRef = useDialog(onClose);
  const [activeTab, setActiveTab] = useState<ModalTab>('zutaten');
  const [showRating, setShowRating] = useState(false);
  // Bewertung und Kommentar der Familie (aus App.tsx über den Kontext)
  const family = useRatings();
  const currentRating = allowRating ? ratingProp ?? family.ratings[meal.meal] ?? 0 : 0;
  const note = allowRating ? family.notes[meal.meal] : undefined;
  const familyRate = family.rate;
  const onRate =
    onRateProp ?? (allowRating && familyRate ? (rating: number, notes: string) => familyRate(meal.meal, rating, notes) : undefined);
  const [cooking, setCooking] = useState(startCooking && steps.length > 0);
  const [generating, setGenerating] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(meal.imageUrl);
  const [imageCredit, setImageCredit] = useState(meal.imageCredit ?? null);
  const [confirmRemoveImage, setConfirmRemoveImage] = useState(false);
  const isWeekend = meal.type === 'wochenende';

  const [choosing, setChoosing] = useState(false);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const handleChoose = async () => {
    if (!onChoose || choosing) return;
    setChoosing(true);
    setChooseError(null);
    try {
      await onChoose();
    } catch (e) {
      setChooseError((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setChoosing(false);
    }
  };

  const handleAddToShopping = async () => {
    if (!onAddToShopping || adding) return;
    setAdding(true);
    setShoppingMsg(null);
    try {
      setShoppingMsg(await onAddToShopping());
    } catch (e) {
      setShoppingMsg((e as Error).message || 'Das hat nicht geklappt.');
    } finally {
      setAdding(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!onGenerateImage || generating) return;
    setGenerating(true);
    setImageError(null);
    try {
      const image = await onGenerateImage(meal.meal);
      setImageUrl(image.url);
      setImageCredit(image.credit);
      onImageChange?.(image.url, image.credit);
    } catch (e) {
      setImageError((e as Error).message || 'Das Bild konnte nicht erstellt werden.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-dialog-title"
        tabIndex={-1}
        className="outline-none flex flex-col w-full max-w-2xl h-full bg-white sm:rounded-2xl overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 bg-white">
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              {meal.day}
              {meal.durationMin ? ` · ${meal.durationMin} Min` : ''}
            </p>
            <h2 id="meal-dialog-title" className="text-base font-semibold text-gray-900 leading-tight truncate">{meal.meal}</h2>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              aria-label={`${meal.meal} bearbeiten`}
              title="Bearbeiten"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors flex-shrink-0"
            >
              <Pencil size={14} />
            </button>
          )}
          {currentRating > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0" role="img" aria-label={`Bewertet mit ${currentRating} von 5 Sternen`}>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < currentRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Scrollbereich: Bild, Badge, Reiter, Inhalt */}
        <div className="flex-1 overflow-y-auto">
        {/* Hero Image (in der Höhe begrenzt) */}
        <div className={`relative w-full bg-gray-100 overflow-hidden ${imageUrl ? 'aspect-[16/9] max-h-[35vh]' : 'h-36'}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={meal.meal}
              onError={() => setImageUrl(undefined)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-50 to-gray-100">
              <ImageIcon size={32} className="text-gray-300" />
              <p className="text-xs text-gray-500">Kein Bild vorhanden</p>
              {onGenerateImage && (
                <button
                  onClick={handleGenerateImage}
                  disabled={generating}
                  className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300 transition-all active:scale-95"
                >
                  {generating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Bild wird erstellt …
                    </>
                  ) : (
                    <>
                      <ImageIcon size={14} />
                      Bild generieren
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          {imageUrl && imageCredit && (
            <a
              href={imageCredit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 left-3 max-w-[55%] truncate px-2 py-1 rounded-md text-[11px] bg-black/60 text-white hover:bg-black/70"
            >
              Foto: {imageCredit.name}
            </a>
          )}
          {imageUrl && (onRemoveImage || onGenerateImage) && (
            <div className="absolute bottom-3 right-3 flex gap-2">
              {onRemoveImage && (
                <button
                  onClick={() => setConfirmRemoveImage(true)}
                  disabled={generating}
                  aria-label="Bild entfernen"
                  title="Bild entfernen"
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/70 backdrop-blur-sm transition-all active:scale-95"
                >
                  <ImageOff size={14} aria-hidden="true" />
                </button>
              )}
              {onGenerateImage && (
                <button
                  onClick={handleGenerateImage}
                  disabled={generating}
                  className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium bg-black/60 text-white hover:bg-black/70 backdrop-blur-sm transition-all active:scale-95"
                >
                  {generating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Neu …
                    </>
                  ) : (
                    <>
                      <ImageIcon size={12} />
                      Neues Bild
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {imageError && (
          <p role="alert" className="mx-4 mt-3 text-xs text-red-600">
            {imageError}
          </p>
        )}

        {(currentRating > 0 || note) && (
          <section aria-label="Eure Bewertung" className="mx-4 mt-4 px-3 py-2.5 rounded-xl bg-amber-50/70 border border-amber-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-900">Eure Bewertung</span>
              {currentRating > 0 && (
                <span className="flex items-center gap-0.5" role="img" aria-label={`${currentRating} von 5 Sternen`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={13} className={n <= currentRating ? 'fill-yellow-400 text-yellow-500' : 'text-amber-200'} />
                  ))}
                </span>
              )}
              {formatRatingDate(note?.updatedAt) && (
                <span className="ml-auto text-[11px] text-amber-800/80">{formatRatingDate(note?.updatedAt)}</span>
              )}
              {onRate && (
                <button
                  onClick={() => setShowRating(true)}
                  className={`${formatRatingDate(note?.updatedAt) ? '' : 'ml-auto '}text-xs font-semibold text-brand-700 hover:underline`}
                >
                  Ändern
                </button>
              )}
            </div>
            {note && (
              <p className="mt-1.5 flex gap-1.5 text-sm text-gray-800">
                <MessageSquare size={14} className="flex-shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
                <span className="whitespace-pre-line">{note.notes}</span>
              </p>
            )}
          </section>
        )}

        {extra && <div className="mx-4 mt-4">{extra}</div>}

        {/* Weekend Badge */}
        {isWeekend && (
          <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Clock size={18} className="text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Wochenende: mehr Zeit einplanen</p>
              <p className="text-xs text-blue-700 mt-0.5">Dieses Gericht braucht etwas mehr Vorbereitung</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div role="tablist" aria-label="Rezept" className="sticky top-0 z-10 flex px-4 mt-4 border-b border-gray-100 bg-white">
          <button
            role="tab"
            aria-selected={activeTab === 'zutaten'}
            onClick={() => setActiveTab('zutaten')}
            className={`flex items-center gap-1.5 py-3 mr-6 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'zutaten'
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500'
            }`}
          >
            <ShoppingBasket size={14} />
            Zutaten
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'zubereitung'}
            onClick={() => setActiveTab('zubereitung')}
            className={`flex items-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'zubereitung'
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500'
            }`}
          >
            <BookOpen size={14} />
            Zubereitung
          </button>
          {steps.length > 0 && (
            <button
              onClick={() => setCooking(true)}
              className="ml-auto my-1.5 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-brand-700 text-white hover:bg-brand-800"
            >
              <ChefHat size={14} />
              Kochmodus
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="px-4 py-4" role="tabpanel">
          {activeTab === 'zutaten' ? (
            <>
            {yieldLabel ? (
              <p className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-600">
                <Users size={14} className="text-gray-500" />
                Ergibt {yieldLabel}
              </p>
            ) : (
            <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-gray-50">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <Users size={14} className="text-gray-500" />
                Portionen
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPortions((p) => Math.max(0.5, p - 0.5))}
                  aria-label="Weniger Portionen"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 active:scale-95"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-semibold text-gray-900" aria-live="polite">
                  {formatPortions(portions)}
                </span>
                <button
                  onClick={() => setPortions((p) => Math.min(20, p + 0.5))}
                  aria-label="Mehr Portionen"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 active:scale-95"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            )}
            <ul className="space-y-2">
              {meal.ingredients.map((ingredient, idx) => (
                <li key={idx} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0 mt-2" />
                  <span className="text-sm text-gray-700">{scaleIngredient(ingredient, factor)}</span>
                </li>
              ))}
            </ul>
            {factor !== 1 && (
              <p className="mt-3 text-xs text-gray-500">
                Mengen umgerechnet vom Originalrezept für {RECIPE_BASE_PORTIONS} Portionen.
              </p>
            )}
            </>
          ) : (
            <div className="prose prose-sm max-w-none">
              {steps.length > 1 ? (
                <ol className="space-y-3">
                  {steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{meal.instructions}</p>
              )}
            </div>
          )}
        </div>
        </div>

        {onChoose && (
          <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleChoose}
              disabled={choosing}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 transition-colors flex items-center justify-center gap-2"
            >
              {choosing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {chooseLabel}
            </button>
            {chooseError && (
              <p role="alert" className="mt-2 text-xs text-center text-red-600">
                {chooseError}
              </p>
            )}
          </div>
        )}

        {onAddToShopping && (
          <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleAddToShopping}
              disabled={adding}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 transition-colors flex items-center justify-center gap-2"
            >
              {adding ? <Loader2 size={14} className="animate-spin" /> : <ListPlus size={14} />}
              Zutaten auf die Einkaufsliste
            </button>
            {shoppingMsg && (
              <p role="status" className="mt-2 text-xs text-center text-gray-600">
                {shoppingMsg}
              </p>
            )}
          </div>
        )}

        {/* Rating Button */}
        {onRate && (
          <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => setShowRating(true)}
              className="w-full px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Star size={14} />
              Gericht bewerten
            </button>
          </div>
        )}
      </div>
      </div>

      {cooking && (
        <CookingMode
          name={meal.meal}
          ingredients={meal.ingredients.map((i) => scaleIngredient(i, factor))}
          steps={steps}
          amountLabel={yieldLabel ?? `${formatPortions(portions)} Portionen`}
          onRate={
            onRate
              ? () => {
                  setCooking(false);
                  setShowRating(true);
                }
              : undefined
          }
          onClose={() => setCooking(false)}
        />
      )}

      {confirmRemoveImage && onRemoveImage && (
        <ConfirmDialog
          title="Bild entfernen?"
          message={
            <>
              Das Bild passt nicht zu „{meal.meal}“? Es wird entfernt und kommt nicht wieder. Ein anderes Bild gibt es über
              „Bild generieren“; bei Gerichten im Speiseplan erstellt die App später automatisch ein KI-Bild.
            </>
          }
          confirmLabel="Entfernen"
          danger
          onConfirm={async () => {
            await onRemoveImage(meal.meal);
            setImageUrl(undefined);
            setImageCredit(null);
            setImageError(null);
            onImageChange?.('', null);
          }}
          onClose={() => setConfirmRemoveImage(false)}
        />
      )}

      {showRating && onRate && (
        <MealRatingModal
          mealName={meal.meal}
          currentRating={currentRating}
          currentNotes={note?.notes ?? ''}
          onSave={async (rating, notes) => {
            await onRate(rating, notes);
            setShowRating(false);
          }}
          onClose={() => setShowRating(false)}
        />
      )}
    </>
  );
}
