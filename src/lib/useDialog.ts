import { useEffect, useRef } from 'react';
import { isTopDialog, popDialog, pushDialog } from './dialogStack';

/**
 * Für alle Fenster (Modals): Escape schließt, Fokus springt ins Fenster und danach zurück,
 * die Seite dahinter scrollt nicht mit. Den Ref ans Fenster-Element hängen.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const id = Symbol();
    pushDialog(id);
    const previousFocus = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopDialog(id)) closeRef.current();
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
