import { useEffect, useRef } from 'react';
import { isTopDialog, popDialog, pushDialog } from './dialogStack';

/**
 * Für alle Fenster (Modals): Escape schließt, Fokus springt ins Fenster und danach zurück,
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

    const onKey = (e: KeyboardEvent) => {
      if (!isTopDialog(id)) return;
      if (e.key === 'Escape') closeRef.current();
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
