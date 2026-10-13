// Einkaufslisten als PDF – ohne Bibliothek: ein schlichtes A4-PDF mit den Standardschriften Helvetica
// (WinAnsi-Kodierung, damit Umlaute, ß und € passen). Ohne React, damit testbar.

export interface PdfList {
  name: string;
  /** Listenfarbe als #rrggbb (Punkt vor dem Namen) */
  color?: string;
  items: string[];
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const LINE = 22;
const BOX = 11;

/** Zeichen, die in WinAnsi (cp1252) anders liegen als in Latin-1 */
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
};

/** Text als PDF-String (WinAnsi-Bytes, Klammern und Backslash maskiert); unbekannte Zeichen werden „?“ */
function pdfText(s: string): number[] {
  const out: number[] = [0x28]; // (
  for (const ch of s.normalize('NFC')) {
    let code = CP1252[ch] ?? ch.codePointAt(0)!;
    if (code === 0x2009 || code === 0x202f || code === 0xa0) code = 0x20;
    if (code > 0xff || (code < 0x20 && code !== 0x09)) code = 0x3f;
    if (code === 0x28 || code === 0x29 || code === 0x5c) out.push(0x5c);
    out.push(code);
  }
  out.push(0x29); // )
  return out;
}

/** Ungefähre Breite in Punkt (Helvetica, Mittelwert) – fürs Kürzen zu langer Zeilen */
const approxWidth = (s: string, size: number) => s.length * size * 0.5;

/** Zu lange Einträge auf mehrere Zeilen umbrechen (an Leerzeichen; ein sehr langes Wort wird hart geteilt) */
export function wrapText(s: string, size: number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (approxWidth(candidate, size) <= max) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    let rest = word;
    while (approxWidth(rest, size) > max) {
      const n = Math.max(1, Math.floor(max / (size * 0.5)));
      lines.push(rest.slice(0, n));
      rest = rest.slice(n);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function rgb(hex: string | undefined): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  if (!m) return '0.42 0.18 0.48'; // Pflaume
  return [m[1], m[2], m[3]].map((h) => (parseInt(h, 16) / 255).toFixed(3)).join(' ');
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

/** Inhalt einer Seite als Folge von Bytes (Text geht über pdfText, alles andere ist ASCII) */
class PageWriter {
  parts: number[][] = [];
  add(s: string) {
    this.parts.push(ascii(s));
  }
  text(x: number, y: number, font: 'F1' | 'F2', size: number, s: string, gray = 0) {
    this.parts.push(ascii(`BT ${gray} g /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td `), pdfText(s), ascii(' Tj ET\n'));
  }
  bytes() {
    return this.parts.flat();
  }
}

/**
 * Listen zu einem PDF. Pro Liste eine Überschrift, darunter je Eintrag ein Kästchen zum Abhaken.
 * Passt eine Liste nicht mehr auf die Seite, geht sie auf der nächsten weiter.
 */
export function buildShoppingPdf(lists: PdfList[], title: string, subtitle: string): Uint8Array {
  const pages: PageWriter[] = [];
  let page = new PageWriter();
  let y = 0;
  const newPage = () => {
    page = new PageWriter();
    pages.push(page);
    y = PAGE_H - MARGIN;
  };
  newPage();

  page.text(MARGIN, y - 18, 'F2', 20, title);
  page.text(MARGIN, y - 38, 'F1', 10, subtitle, 0.4);
  y -= 70;

  const textMax = PAGE_W - 2 * MARGIN - 24;
  for (const list of lists) {
    // Überschrift nicht allein unten auf der Seite stehen lassen
    if (y < MARGIN + 2 * LINE + 20) newPage();
    page.add(`${rgb(list.color)} rg ${MARGIN} ${(y - 12).toFixed(2)} 8 8 re f\n`);
    page.text(MARGIN + 16, y - 12, 'F2', 14, `${list.name} (${list.items.length})`);
    y -= 22;
    page.add(`0.85 G 0.5 w ${MARGIN} ${y.toFixed(2)} m ${PAGE_W - MARGIN} ${y.toFixed(2)} l S\n`);
    y -= 6;
    if (!list.items.length) {
      page.text(MARGIN, y - 14, 'F1', 11, 'Nichts offen', 0.45);
      y -= LINE;
    }
    for (const item of list.items) {
      const lines = wrapText(item, 12, textMax);
      const height = LINE + (lines.length - 1) * 15;
      if (y - height < MARGIN) {
        newPage();
        page.text(MARGIN, y - 12, 'F2', 11, `${list.name} (Fortsetzung)`, 0.45);
        y -= 20;
      }
      const base = y - 15;
      page.add(`0.4 G 0.8 w ${MARGIN} ${(base - 2).toFixed(2)} ${BOX} ${BOX} re S\n`);
      lines.forEach((l, i) => page.text(MARGIN + 20, base - i * 15, 'F1', 12, l));
      y -= height;
    }
    y -= 14;
  }

  // Seitenzahlen, wenn es mehrere Seiten sind
  if (pages.length > 1) pages.forEach((p, i) => p.text(PAGE_W - MARGIN - 40, MARGIN - 25, 'F1', 9, `Seite ${i + 1}/${pages.length}`, 0.5));

  // Objekte: 1 Katalog, 2 Seitenbaum, 3/4 Schriften, dann je Seite Seite + Inhalt
  const objects: number[][] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects.push(ascii('<< /Type /Catalog /Pages 2 0 R >>'));
  objects.push(ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`));
  objects.push(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
  objects.push(ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  pages.forEach((p, i) => {
    const content = p.bytes();
    objects.push(
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`
      )
    );
    objects.push([...ascii(`<< /Length ${content.length} >>\nstream\n`), ...content, ...ascii('\nendstream')]);
  });

  const out: number[] = ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    out.push(...ascii(`${i + 1} 0 obj\n`), ...obj, ...ascii('\nendobj\n'));
  });
  const xref = out.length;
  out.push(...ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (const o of offsets) out.push(...ascii(`${String(o).padStart(10, '0')} 00000 n \n`));
  out.push(...ascii(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Uint8Array.from(out);
}

/** Dateiname ohne Sonderzeichen, z. B. „Einkaufsliste-Metzger-2026-10-14.pdf“ */
export function pdfFileName(part: string, isoDate: string) {
  const clean = part
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `Einkaufsliste-${clean || 'Listen'}-${isoDate}.pdf`;
}

/** PDF im Browser herunterladen (auf iPhone/iPad öffnet sich die Vorschau mit „Teilen“) */
export function downloadPdf(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
