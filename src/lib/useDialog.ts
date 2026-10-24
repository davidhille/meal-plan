import { useEffect, useRef } from 'react';
import { isTopDialog, popDialog, pushDialog } from './dialogStack';
import { FOCUSABLE, trapIndex } from './focusTrap';

/**
 * Für alle Fenster (Modals): Escape schließt, Fokus springt ins Fenster und danach zurück, Tab bleibt im Fenster,
 * die Seite dahinter scrollt nicht mit. Den Ref ans Fenster-Element hängen.
 * onKey: weitere Tasten (z. B. Pfeile zum Blättern), nur wenn dieses Fenster oben liegt.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void, onKey?: (e: KeyboardEvent) => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const keyRef = useRef(onKey);
  keyRef.current = onKey;

  useEffect(() => {
    const id = Symbol();
    pushDialog(id);
    const previousFocus = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    // Tab springt am Ende zurück an den Anfang (und umgekehrt), statt hinter das Fenster zu wandern
    const trapTab = (e: KeyboardEvent) => {
      const box = ref.current;
      if (!box) return;
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      const active = document.activeElement as HTMLElement | null;
      const target = trapIndex(items.length, active ? items.indexOf(active) : -1, e.shiftKey);
      if (items.length === 0) {
        e.preventDefault(); // nichts zu bedienen: Fokus bleibt auf dem Fenster
        box.focus();
      } else if (target !== null) {
        e.preventDefault();
        items[target].focus();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (!isTopDialog(id)) return;
      if (e.key === 'Escape') closeRef.current();
      else if (e.key === 'Tab') trapTab(e);
      else keyRef.current?.(e);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      popDialog(id);
      previousFocus?.focus?.();
    };
  }, []);

  return ref;
}
