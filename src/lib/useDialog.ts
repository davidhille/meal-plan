import { useEffect, useRef } from 'react';

// Offene Fenster von unten nach oben – Escape schließt nur das oberste
const stack: symbol[] = [];

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
    stack.push(id);
    const previousFocus = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === id) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(id), 1);
      document.body.style.overflow = prevOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  return ref;
}
