import { useState } from 'react';
import { X, Loader2, Link2, Sparkles } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { Side, SideKind } from '../types';
import { previewAiSide, previewRecipeImport, saveCustomSide } from '../lib/api';
import { SIDE_KIND_LABEL } from '../lib/sides';

interface SideAddSheetProps {
  mealName: string;
  initialKind: SideKind;
  /** Mit welchem Weg das Fenster startet (Standard: Link) */
  initialWay?: 'link' | 'ai';
  /** Nach dem Speichern: die neue Beilage (schon in den eigenen Beilagen) */
  onAdded: (side: Side) => void;
  onClose: () => void;
}

type Way = 'link' | 'ai';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none';

/** Eigene Beilage/Salat anlegen: Rezept-Link (Chefkoch & Co., auf 4 Portionen umgerechnet) oder KI-Vorschlag auf Knopfdruck */
export default function SideAddSheet({ mealName, initialKind, initialWay = 'link', onAdded, onClose }: SideAddSheetProps) {
  const [way, setWay] = useState<Way>(initialWay);
  const [kind, setKind] = useState<SideKind>(initialKind);
  const [url, setUrl] = useState('');
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; ingredients: string; instructions: string; durationMin: number | null; sourceUrl: string | null } | null>(null);
  const dialogRef = useDialog(() => !saving && onClose());

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      if (way === 'link') {
        if (!url.trim()) return;
        const r = await previewRecipeImport(url.trim());
        setDraft({ name: r.name, ingredients: r.ingredients.join('\n'), instructions: r.instructions, durationMin: r.durationMin ?? null, sourceUrl: r.sourceUrl });
      } else {
        const s = await previewAiSide(kind, mealName, wish.trim());
        setDraft({ name: s.name, ingredients: s.ingredients.join('\n'), instructions: s.instructions, durationMin: s.durationMin, sourceUrl: null });
      }
    } catch (e) {
      setDraft(null);
      setError((e as Error).message || 'Das hat nicht geklappt. Bitte nochmal versuchen.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const ingredients = draft.ingredients.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!draft.name.trim() || ingredients.length === 0) {
      setError('Name und mindestens eine Zutat sind nötig.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { name: draft.name.trim(), kind, ingredients, instructions: draft.instructions.trim(), durationMin: draft.durationMin, sourceUrl: draft.sourceUrl };
      const list = await saveCustomSide(body);
      const saved = list.find((s) => s.name === body.name);
      onAdded(saved ?? { ...body, custom: true, durationMin: body.durationMin ?? 0 });
    } catch (e) {
      setError((e as Error).message || 'Die Beilage konnte nicht gespeichert werden.');
      setSaving(false);
    }
  };

  const tabClass = (on: boolean) =>
    `flex-1 min-h-11 px-3 rounded-xl text-sm font-semibold border flex items-center justify-center gap-1.5 ${
      on ? 'bg-brand-700 border-brand-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
    }`;

  return (
    <div className="fixed inset-0 z-[60] bg-gray-900/40 flex items-end sm:items-center justify-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-add-title"
        tabIndex={-1}
        className="outline-none bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl"
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <h2 id="side-add-title" className="flex-1 text-base font-semibold text-gray-900">
            Eigene Beilage hinzufügen
          </h2>
          <button onClick={onClose} aria-label="Schließen" className="tap w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2" role="group" aria-label="Art">
            {(['beilage', 'salat'] as SideKind[]).map((k) => (
              <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={tabClass(kind === k)}>
                {SIDE_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          {!draft && (
            <>
              <div className="flex gap-2" role="group" aria-label="Quelle">
                <button aria-pressed={way === 'link'} onClick={() => setWay('link')} className={tabClass(way === 'link')}>
                  <Link2 size={14} aria-hidden="true" /> Per Link
                </button>
                <button aria-pressed={way === 'ai'} onClick={() => setWay('ai')} className={tabClass(way === 'ai')}>
                  <Sparkles size={14} aria-hidden="true" /> KI-Vorschlag
                </button>
              </div>
              {way === 'link' ? (
                <div>
                  <label htmlFor="side-url" className="block text-xs font-semibold text-gray-600 mb-1">
                    Link zum Rezept (z. B. Chefkoch)
                  </label>
                  <input id="side-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.chefkoch.de/rezepte/…" className={inputClass} />
                  <p className="mt-1 text-xs text-gray-500">Die Mengen werden auf 4 Portionen umgerechnet.</p>
                </div>
              ) : (
                <div>
                  <label htmlFor="side-wish" className="block text-xs font-semibold text-gray-600 mb-1">
                    Wunsch (optional)
                  </label>
                  <input id="side-wish" value={wish} onChange={(e) => setWish(e.target.value)} maxLength={120} placeholder={`z. B. mit Kürbis, leicht`} className={inputClass} />
                  <p className="mt-1 text-xs text-gray-500">Die KI schlägt etwas passend zu „{mealName}“ vor. Das zählt zu eurem KI-Kontingent.</p>
                </div>
              )}
              <button
                onClick={load}
                disabled={busy || (way === 'link' && !url.trim())}
                className="w-full min-h-11 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {way === 'link' ? 'Rezept holen' : 'Vorschlag holen'}
              </button>
            </>
          )}
          {draft && (
            <div className="space-y-3">
              <div>
                <label htmlFor="side-name" className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                <input id="side-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="side-ing" className="block text-xs font-semibold text-gray-600 mb-1">Zutaten für 4 Portionen (eine pro Zeile)</label>
                <textarea id="side-ing" rows={6} value={draft.ingredients} onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label htmlFor="side-steps" className="block text-xs font-semibold text-gray-600 mb-1">Zubereitung (ein Schritt pro Zeile)</label>
                <textarea id="side-steps" rows={5} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDraft(null)} disabled={saving} className="px-4 min-h-11 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">
                  Zurück
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 min-h-11 rounded-xl text-sm font-semibold text-white bg-brand-700 hover:bg-brand-800 disabled:bg-brand-300 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Speichern und auswählen
                </button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
