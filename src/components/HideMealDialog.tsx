import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { dislikeGroupsOf } from '../lib/familyDislikes';

interface HideMealDialogProps {
  name: string;
  ingredients: string[];
  /** Was nach dem Ausblenden passiert, z. B. „an diesem Tag kommt ein anderes Gericht“ */
  effect: string;
  /** Wo man es rückgängig macht */
  undoHint: string;
  /** Schon „nie“ markierte Hauptzutaten (werden nicht noch einmal angeboten) */
  familyDislikes?: string[];
  /** Nur dieses Gericht ausblenden */
  onHide: () => Promise<void>;
  /** Hauptzutat für die ganze Familie ausschließen (danach wird das Gericht auch ausgeblendet) */
  onFamilyNo?: (groupId: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Rückfrage beim Ausblenden. Erkennt die App eine Hauptzutat (Fisch, Lamm …), kann man statt nur dieses Gerichts
 * gleich alle mit dieser Zutat ausschließen – ein Nein reicht.
 */
export default function HideMealDialog({ name, ingredients, effect, undoHint, familyDislikes, onHide, onFamilyNo, onClose }: HideMealDialogProps) {
  const groups = onFamilyNo ? dislikeGroupsOf(name, ingredients, familyDislikes) : [];
  const [choice, setChoice] = useState<string>('only');

  return (
    <ConfirmDialog
      title="Gericht ausblenden?"
      message={
        <>
          <span className="block">
            <strong>{name}</strong> {effect}
          </span>
          {groups.length > 0 && (
            <span role="radiogroup" aria-label="Was ausblenden?" className="mt-3 block space-y-2">
              {[{ id: 'only', text: 'Nur dieses Gericht' }, ...groups.map((g) => ({ id: g.id, text: g.never }))].map((o) => (
                <label
                  key={o.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer text-sm ${
                    choice === o.id ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="hide-choice"
                    value={o.id}
                    checked={choice === o.id}
                    onChange={() => setChoice(o.id)}
                    className="accent-brand-700"
                  />
                  {o.text}
                </label>
              ))}
              {choice !== 'only' && (
                <span className="block text-xs text-gray-600">
                  Gilt für die ganze Familie. Zurücknehmen unter Einstellungen → Gesundheit & Ernährung.
                </span>
              )}
            </span>
          )}
          <span className="mt-3 block text-xs text-gray-600">{undoHint}</span>
        </>
      }
      confirmLabel="Ausblenden"
      danger
      onConfirm={async () => {
        if (choice !== 'only' && onFamilyNo) await onFamilyNo(choice);
        await onHide();
      }}
      onClose={onClose}
    />
  );
}
