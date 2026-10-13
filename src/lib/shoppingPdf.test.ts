import { describe, expect, test } from 'bun:test';
import { buildShoppingPdf, pdfFileName, wrapText } from './shoppingPdf';

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('buildShoppingPdf', () => {
  const pdf = buildShoppingPdf(
    [
      { name: 'Metzger', color: '#f97316', items: ['600 g Rinderhackfleisch', '4 Hähnchenschenkel (groß)'] },
      { name: 'Aldi', items: Array.from({ length: 60 }, (_, i) => `${i + 1} Süßkartoffeln für 3,99 €`) },
    ],
    'Einkaufsliste',
    'KW 42'
  );
  const text = latin1(pdf);

  test('gültiger Aufbau: Kopf, Ende, Verweise zeigen auf die Objekte', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const xrefAt = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const offsets = [...text.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });

  test('Umlaute, ß und € als WinAnsi, Klammern maskiert', () => {
    expect(text).toContain('H\xe4hnchenschenkel \\(gro\xdf\\)');
    expect(text).toContain('S\xfc\xdfkartoffeln f\xfcr 3,99 \x80');
  });

  test('lange Listen gehen auf weiteren Seiten weiter', () => {
    expect(Number(text.match(/\/Count (\d+)/)![1])).toBeGreaterThan(1);
    expect(text).toContain('Aldi \\(Fortsetzung\\)');
  });
});

describe('wrapText', () => {
  test('bricht an Leerzeichen um, kurze Texte bleiben eine Zeile', () => {
    expect(wrapText('2 Dosen Tomaten', 12, 400)).toEqual(['2 Dosen Tomaten']);
    const lines = wrapText('ein sehr langer Eintrag mit vielen Wörtern', 12, 100);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('ein sehr langer Eintrag mit vielen Wörtern');
  });
});

describe('pdfFileName', () => {
  test('ohne Umlaute und Sonderzeichen', () =>
    expect(pdfFileName('Bäcker & Metzger', '2026-10-14')).toBe('Einkaufsliste-Backer-Metzger-2026-10-14.pdf'));
});
