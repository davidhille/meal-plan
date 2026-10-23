import { ReactNode, useId } from 'react';

/** Überschrift für eine Gruppe von Einstellungs-Karten */
export default function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      {children}
    </section>
  );
}
