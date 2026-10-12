import { useState } from 'react';
import { Scale, Loader2, RefreshCw, ArrowRightLeft, ChevronDown } from 'lucide-react';
import { PriceComparison } from '../lib/priceCompare';
import ConfirmDialog from './ConfirmDialog';

interface PriceComparisonCardProps {
  comparison: PriceComparison;
  /** Vergleichbare Artikel auf die Liste des empfohlenen Shops verschieben; liefert die Anzahl */
  onMoveAll: (labelId: string) => Promise<number>;
  /** Preise aller verknüpften Produkte frisch abfragen */
  onRefresh: () => Promise<string>;
}

const euro = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

/** „Wo ist der Einkauf günstiger?“ – Summe je Shop, Mindestbestellwert, Empfehlung */
export default function PriceComparisonCard({ comparison, onMoveAll, onRefresh }: PriceComparisonCardProps) {
  const { shops, comparable, considered, unlinked, best, saving } = comparison;
  const [open, setOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState(false);

  const toMove = best ? comparable.filter((i) => i.label !== best.label.id) : [];
  const cheapestTotal = Math.min(...shops.map((s) => s.total + s.deliveryFee));

  const refresh = async () => {
    setRefreshing(true);
    setNote(null);
    try {
      setNote(await onRefresh());
    } catch (e) {
      setNote((e as Error).message || 'Die Preise konnten nicht aktualisiert werden.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden" aria-labelledby="preisvergleich">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50"
      >
        <Scale size={16} className="text-gray-500" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span id="preisvergleich" className="block text-sm font-semibold text-gray-800">
            Wo ist der Einkauf günstiger?
          </span>
          <span className="block text-xs text-gray-500">
            {comparable.length} von {considered} Artikeln vergleichbar
            {!open && best ? ` · ${best.label.name}${saving > 0 ? ` spart ca. ${euro(saving)}` : ''}` : ''}
          </span>
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {comparable.length === 0 ? (
            <p className="text-xs text-gray-600">
              Noch kein Artikel ist in beiden Shops mit Preis verknüpft. Tippe auf eine Zutat und wähle in beiden Shops ein Produkt – dann
              erscheint hier der Vergleich.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {shops.map((s) => {
                  const total = s.total + s.deliveryFee;
                  const isBest = best?.provider === s.provider;
                  return (
                    <li
                      key={s.provider}
                      className={`px-3 py-2 rounded-lg border ${isBest ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="w-2 h-2 rounded-full self-center" style={{ backgroundColor: s.label.color }} aria-hidden="true" />
                        <span className="flex-1 text-sm font-semibold text-gray-800">{s.label.name}</span>
                        <span className={`text-sm font-bold ${total === cheapestTotal ? 'text-green-800' : 'text-gray-800'}`}>{euro(total)}</span>
                      </div>
                      <p className="pl-4 text-[11px] text-gray-600">
                        {euro(s.total)} Ware{s.deliveryFee > 0 ? ` + ${euro(s.deliveryFee)} Lieferung` : ''} ·{' '}
                        {s.missing > 0 ? (
                          <span className="text-amber-800">
                            Mindestbestellwert {euro(s.minOrder)} – es fehlen {euro(s.missing)}
                          </span>
                        ) : (
                          <span className="text-green-800">Mindestbestellwert erreicht</span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <p className="text-sm text-gray-800" aria-live="polite">
                {best ? (
                  saving > 0 ? (
                    <>
                      👉 <strong>Bei {best.label.name} bestellen</strong> spart ca. <strong>{euro(saving)}</strong>.
                    </>
                  ) : (
                    <>
                      👉 <strong>{best.label.name}</strong> ist nicht der billigste, erreicht aber als einziger den Mindestbestellwert.
                    </>
                  )
                ) : (
                  'Beide Shops sind für diese Artikel praktisch gleich teuer.'
                )}
              </p>
              <p className="text-[11px] text-gray-500">
                Der Mindestbestellwert bezieht sich nur auf die verglichenen Artikel – andere Einkäufe zählen bei der Bestellung mit.
              </p>

              {best && toMove.length > 0 && (
                <button
                  onClick={() => setConfirmMove(true)}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white bg-green-700 hover:bg-green-800"
                >
                  <ArrowRightLeft size={14} />
                  {toMove.length} Artikel zu {best.label.name} verschieben
                </button>
              )}
            </>
          )}

          {(unlinked > 0 || shops.some((s) => s.onlyHere > 0)) && (
            <p className="text-[11px] text-gray-500">
              {[
                ...shops.filter((s) => s.onlyHere > 0).map((s) => `${s.onlyHere} nur bei ${s.label.name} verknüpft`),
                unlinked > 0 ? `${unlinked} ohne Produkt` : null,
              ]
                .filter(Boolean)
                .join(' · ')}{' '}
              – nicht im Vergleich.
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Preise aktualisieren
            </button>
            {note && (
              <span role="status" className="text-[11px] text-gray-600">
                {note}
              </span>
            )}
          </div>
        </div>
      )}

      {confirmMove && best && (
        <ConfirmDialog
          title={`Zu ${best.label.name} verschieben?`}
          message={
            <>
              {toMove.length} Artikel kommen auf die Liste <strong>{best.label.name}</strong>. Die App merkt sich das auch für künftige
              Pläne.
            </>
          }
          confirmLabel="Verschieben"
          onConfirm={async () => {
            const n = await onMoveAll(best.label.id);
            setNote(`${n} Artikel verschoben.`);
          }}
          onClose={() => setConfirmMove(false)}
        />
      )}
    </section>
  );
}
