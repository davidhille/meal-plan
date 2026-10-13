import { describe, expect, test } from 'bun:test';

// Minimales DOM: nur das, was die Scroll-Sperre braucht
const body = { style: { overflow: '' } };
(globalThis as unknown as { document: unknown }).document = { body };

const { popDialog, pushDialog } = await import('./dialogStack');

describe('Scroll-Sperre der Fenster', () => {
  test('gesperrt, solange ein Fenster offen ist', () => {
    const a = Symbol();
    pushDialog(a);
    expect(body.style.overflow).toBe('hidden');
    popDialog(a);
    expect(body.style.overflow).toBe('');
  });

  test('Fenster schließen in beliebiger Reihenfolge, Seite scrollt danach wieder', () => {
    // Rezept-Ansicht offen, Bearbeiten darüber. Speichern mit neuem Namen: React räumt erst die alte Ansicht,
    // dann Bearbeiten ab (nicht umgekehrt) und öffnet danach die neue Ansicht – so blieb die Seite früher gesperrt.
    const ansicht = Symbol();
    const bearbeiten = Symbol();
    pushDialog(ansicht);
    pushDialog(bearbeiten);
    popDialog(ansicht);
    popDialog(bearbeiten);
    const neueAnsicht = Symbol();
    pushDialog(neueAnsicht);
    expect(body.style.overflow).toBe('hidden');
    popDialog(neueAnsicht);
    expect(body.style.overflow).toBe('');
  });
});
